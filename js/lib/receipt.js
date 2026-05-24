import { formatRWF } from './utils.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function buildQRDataUrl() {
  await loadScript('https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js');
  return new Promise((resolve) => {
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:200px;height:200px';
    document.body.appendChild(container);
    new window.QRCode(container, {
      text: 'https://cent.rw',
      width: 200, height: 200,
      colorDark: '#000000', colorLight: '#ffffff',
    });
    setTimeout(() => {
      const canvas = container.querySelector('canvas');
      resolve(canvas ? canvas.toDataURL('image/png') : '');
      document.body.removeChild(container);
    }, 150);
  });
}

async function renderReceiptCanvas(order) {
  const qrDataUrl = await buildQRDataUrl();

  const shortId = (order.public_token || '').replace(/-/g, '').slice(0, 6).toUpperCase();
  const dateStr = new Date(order.created_at).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const SIZE = 600;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ── Left column ──────────────────────────────────────────────────────────────
  const lx = 52;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 80px Arial, sans-serif';
  ctx.fillText('CENT', lx, 100);

  // Divider
  ctx.strokeStyle = '#282828';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(lx, 120); ctx.lineTo(SIZE - lx, 120); ctx.stroke();

  // ORDER label
  ctx.fillStyle = '#505050';
  ctx.font = '22px Arial, sans-serif';
  ctx.fillText('ORDER', lx, 175);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px Arial, sans-serif';
  ctx.fillText(`#${shortId}`, lx, 230);

  // DATE label
  ctx.fillStyle = '#505050';
  ctx.font = '22px Arial, sans-serif';
  ctx.fillText('DATE', lx, 295);

  ctx.fillStyle = '#c8c8c8';
  ctx.font = '30px Arial, sans-serif';
  ctx.fillText(dateStr, lx, 335);

  // TOTAL label
  ctx.fillStyle = '#505050';
  ctx.font = '22px Arial, sans-serif';
  ctx.fillText('TOTAL', lx, 400);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px Arial, sans-serif';
  ctx.fillText(formatRWF(order.total_cents), lx, 445);

  // cent.rw footer
  ctx.fillStyle = '#323232';
  ctx.font = '22px Arial, sans-serif';
  ctx.fillText('cent.rw', lx, SIZE - 42);

  // ── Dashed vertical divider ───────────────────────────────────────────────────
  const divX = SIZE / 2 + 10;
  ctx.strokeStyle = '#232323';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 8]);
  ctx.beginPath(); ctx.moveTo(divX, 36); ctx.lineTo(divX, SIZE - 36); ctx.stroke();
  ctx.setLineDash([]);

  // ── Right column: QR ─────────────────────────────────────────────────────────
  const qrSize = 190;
  const rx = divX + (SIZE - divX - qrSize) / 2;
  const ry = 110;

  // White rounded bg for QR
  ctx.fillStyle = '#ffffff';
  const pad = 14;
  roundRect(ctx, rx - pad, ry - pad, qrSize + pad * 2, qrSize + pad * 2, 12);
  ctx.fill();

  const qrImg = new Image();
  await new Promise((res) => { qrImg.onload = res; qrImg.src = qrDataUrl; });
  ctx.drawImage(qrImg, rx, ry, qrSize, qrSize);

  // "scan me"
  ctx.fillStyle = '#505050';
  ctx.font = '22px Arial, sans-serif';
  ctx.textAlign = 'center';
  const centerX = divX + (SIZE - divX) / 2;
  ctx.fillText('scan me', centerX, ry + qrSize + pad * 2 + 28);

  // "bought with CENT"
  ctx.fillStyle = '#3c3c3c';
  ctx.font = '24px Arial, sans-serif';
  ctx.fillText('bought with', centerX, SIZE - 90);

  ctx.fillStyle = '#505050';
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.fillText('CENT', centerX, SIZE - 55);

  ctx.textAlign = 'left';
  return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function downloadReceiptPDF(order) {
  const [canvas] = await Promise.all([
    renderReceiptCanvas(order),
    loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'),
  ]);

  const { jsPDF } = window.jspdf;
  const W = 80, H = 80;
  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'portrait' });
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, W, H);

  const shortId = (order.public_token || '').replace(/-/g, '').slice(0, 6).toUpperCase();
  doc.save(`CENT-${shortId}.pdf`);
}

export async function shareReceiptImage(order) {
  const canvas = await renderReceiptCanvas(order);
  const shortId = (order.public_token || '').replace(/-/g, '').slice(0, 6).toUpperCase();

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error('Canvas export failed')); return; }
      const file = new File([blob], `CENT-${shortId}.jpg`, { type: 'image/jpeg' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `CENT Order #${shortId}`, text: 'bought with CENT · cent.rw' });
          resolve();
        } catch (err) {
          if (err.name !== 'AbortError') reject(err);
          else resolve();
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `CENT-${shortId}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      }
    }, 'image/jpeg', 0.95);
  });
}
