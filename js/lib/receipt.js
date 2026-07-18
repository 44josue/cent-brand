import { formatRWF } from './utils.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

export async function downloadReceiptPDF(order, { blurCode = false, share = false } = {}) {
  await Promise.all([
    loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'),
    loadScript('https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js'),
  ]);

  const { jsPDF } = window.jspdf;

  // QR links to cent.rw homepage — safe to share publicly
  const qrDataUrl = await new Promise((resolve) => {
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:200px;height:200px';
    document.body.appendChild(container);
    new window.QRCode(container, {
      text: 'https://cent.rw',
      width: 200,
      height: 200,
      colorDark: '#000000',
      colorLight: '#ffffff',
    });
    setTimeout(() => {
      const canvas = container.querySelector('canvas');
      resolve(canvas ? canvas.toDataURL('image/png') : '');
      document.body.removeChild(container);
    }, 150);
  });

  const shortId = (order.public_token || '').replace(/-/g, '').slice(0, 6).toUpperCase();
  const dateStr = new Date(order.created_at).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  // Square ticket: 80mm × 80mm
  const W = 80, H = 80;
  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'portrait' });

  // Background
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, W, H, 'F');

  // ── Left column: text ────────────────────────────────────────────────────────
  const lx = 8;

  // Brand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('CENT', lx, 14);

  // Divider
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.3);
  doc.line(lx, 18, W - 8, 18);

  // Order label + value
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(80, 80, 80);
  doc.text('ORDER', lx, 25);

  if (blurCode) {
    // jsPDF can't blur, so simulate "hidden" with a scrambled placeholder
    doc.setFillColor(38, 38, 38);
    doc.roundedRect(lx - 1, 27, 22, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text('•••••••', lx, 31);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(`#${shortId}`, lx, 31);
  }

  // Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(80, 80, 80);
  doc.text('DATE', lx, 40);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 200, 200);
  doc.text(dateStr, lx, 45.5);

  // Total
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(80, 80, 80);
  doc.text('TOTAL', lx, 54);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(formatRWF(order.total_cents), lx, 59.5);

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(50, 50, 50);
  doc.text('cent.rw', lx, H - 5);

  // ── Vertical dashed divider ───────────────────────────────────────────────────
  const divX = W / 2 + 2;
  doc.setDrawColor(35, 35, 35);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.line(divX, 6, divX, H - 6);
  doc.setLineDashPattern([], 0);

  // ── Right column: QR ─────────────────────────────────────────────────────────
  const qrSize = 28;
  const rx = divX + (W - divX - qrSize) / 2;

  // White bg for QR
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(rx - 2, 14, qrSize + 4, qrSize + 4, 2, 2, 'F');
  doc.addImage(qrDataUrl, 'PNG', rx, 16, qrSize, qrSize);

  // "Scan me" caption
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(70, 70, 70);
  doc.text('scan me', divX + (W - divX) / 2, 14 + qrSize + 8, { align: 'center' });

  // "bought with CENT" tag
  doc.setFontSize(5.5);
  doc.setTextColor(60, 60, 60);
  doc.text('bought with', divX + (W - divX) / 2, H - 12, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('CENT', divX + (W - divX) / 2, H - 7, { align: 'center' });

  if (share) {
    const blob = doc.output('blob');
    const file = new File([blob], `CENT-${shortId}.pdf`, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'My CENT Receipt', text: 'Every Cent Matters. — cent.rw' });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
        // fall through to download
      }
    }
  }

  doc.save(`CENT-${shortId}.pdf`);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Renders a 1080×1920 (Instagram Story size) PNG people actually want to post. */
export async function generateShareCard(order, { blurCode = false } = {}) {
  await loadScript('https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js');
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch {} }

  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background + subtle glow
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 520, 0, W / 2, 520, W * 0.85);
  glow.addColorStop(0, 'rgba(245,245,245,0.08)');
  glow.addColorStop(1, 'rgba(245,245,245,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  // Eyebrow
  ctx.fillStyle = '#a3a3a3';
  ctx.font = '600 26px Inter, sans-serif';
  ctx.fillText('R W A N D A   S T R E E T W E A R', W / 2, 220);

  // CENT wordmark
  ctx.fillStyle = '#f5f5f5';
  ctx.font = '900 260px "Bebas Neue", "Arial Black", sans-serif';
  ctx.fillText('CENT', W / 2, 440);

  // Tagline
  ctx.fillStyle = '#cfcfcf';
  ctx.font = '46px "Dancing Script", cursive';
  ctx.fillText('Every Cent Matters.', W / 2, 520);

  // ── Receipt card ──────────────────────────────────────────────────────────
  const cardX = 90, cardY = 620, cardW = W - 180, cardH = 1060;
  roundRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fillStyle = '#111111';
  ctx.fill();
  ctx.strokeStyle = '#262626';
  ctx.lineWidth = 2;
  ctx.stroke();

  let y = cardY + 90;

  // Confirmed badge
  ctx.fillStyle = '#22c55e';
  ctx.font = '700 34px Inter, sans-serif';
  ctx.fillText('✓  ORDER CONFIRMED', W / 2, y);
  y += 70;

  ctx.strokeStyle = '#222222';
  ctx.beginPath();
  ctx.moveTo(cardX + 60, y);
  ctx.lineTo(cardX + cardW - 60, y);
  ctx.stroke();
  y += 70;

  // Item names (up to 3, then "+N more")
  const items = order.order_items || order.items || [];
  ctx.font = '600 40px Inter, sans-serif';
  ctx.fillStyle = '#f5f5f5';
  const shown = items.slice(0, 3);
  shown.forEach((it) => {
    const name = it.product_name || it.productName || 'CENT piece';
    ctx.fillText(name.length > 28 ? name.slice(0, 26) + '…' : name, W / 2, y);
    y += 56;
  });
  if (items.length > 3) {
    ctx.fillStyle = '#737373';
    ctx.font = '400 32px Inter, sans-serif';
    ctx.fillText(`+ ${items.length - 3} more`, W / 2, y);
    y += 56;
  }

  // Order code — blurred out if this card is meant for public sharing
  const shortId = (order.public_token || '').replace(/-/g, '').slice(0, 6).toUpperCase();
  y += 20;
  ctx.fillStyle = '#525252';
  ctx.font = '600 24px Inter, sans-serif';
  ctx.fillText('ORDER CODE', W / 2, y);
  y += 50;
  ctx.font = '700 38px "Courier New", monospace';
  if (blurCode) {
    ctx.save();
    ctx.filter = 'blur(9px)';
    ctx.fillStyle = '#f5f5f5';
    ctx.fillText(`#${shortId}`, W / 2, y);
    ctx.restore();
  } else {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillText(`#${shortId}`, W / 2, y);
  }

  y += 60;
  ctx.fillStyle = '#525252';
  ctx.font = '600 26px Inter, sans-serif';
  ctx.fillText('TOTAL', W / 2, y);
  y += 66;
  ctx.fillStyle = '#f5f5f5';
  ctx.font = '900 72px Inter, sans-serif';
  ctx.fillText(formatRWF(order.total_cents), W / 2, y);

  // QR code linking to the shop
  const qrDataUrl = await new Promise((resolve) => {
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(container);
    new window.QRCode(container, { text: 'https://cent.rw', width: 260, height: 260, colorDark: '#000000', colorLight: '#ffffff' });
    setTimeout(() => {
      const c = container.querySelector('canvas');
      resolve(c ? c.toDataURL('image/png') : '');
      document.body.removeChild(container);
    }, 150);
  });
  if (qrDataUrl) {
    const qrImg = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = qrDataUrl;
    });
    const qrSize = 220;
    const qrX = W / 2 - qrSize / 2;
    const qrY = cardY + cardH - qrSize - 70;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 12);
    ctx.fill();
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  }

  // Footer CTA
  ctx.fillStyle = '#f5f5f5';
  ctx.font = '700 40px Inter, sans-serif';
  ctx.fillText('Shop the drop →  cent.rw', W / 2, H - 100);

  return canvas.toDataURL('image/png');
}

export async function shareReceiptImage(order, { blurCode = false } = {}) {
  const dataUrl = await generateShareCard(order, { blurCode });
  const shortId = (order.public_token || '').replace(/-/g, '').slice(0, 6).toUpperCase();
  const fileName = `CENT-${shortId}.png`;

  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], fileName, { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'CENT', text: 'Every Cent Matters. 🖤 cent.rw' });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return; // user cancelled the share sheet
      // fall through to download
    }
  }

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Shares the receipt as a PDF via the OS share sheet, falling back to a direct download. */
export async function shareReceiptPDF(order, { blurCode = false } = {}) {
  return downloadReceiptPDF(order, { blurCode, share: true });
}
