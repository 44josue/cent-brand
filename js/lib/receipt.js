import { formatRWF } from './utils.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

export async function downloadReceiptPDF(order) {
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

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(`#${shortId}`, lx, 31);

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

  doc.save(`CENT-${shortId}.pdf`);
}

export async function shareReceiptImage(order) {
  await downloadReceiptPDF(order);
}
