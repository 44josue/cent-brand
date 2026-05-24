import { renderNav } from '../components/nav.js';
import { renderFooter } from '../components/footer.js';
import { getOrderByToken } from '../lib/api.js';
import { formatRWF, formatDateTime, getParam, toast, copyToClipboard, shortToken, statusBadge, paymentBadge } from '../lib/utils.js';
import { supabase } from '../lib/supabase.js';
import { updateCartBadges } from '../lib/cart.js';
import { downloadReceiptPDF, shareReceiptImage } from '../lib/receipt.js';

renderNav();
renderFooter();
updateCartBadges();

const token = getParam('token');
const submitted = getParam('submitted') === '1';

if (!token) {
  renderLookupForm();
} else {
  init();
}

function renderLookupForm() {
  document.getElementById('tracking-page').innerHTML = `
    <div style="max-width:480px;margin:var(--space-16) auto">
      <div class="breadcrumb" style="margin-bottom:var(--space-4)"><a href="/">Home</a><span class="sep">›</span><span>Track Order</span></div>
      <h1 style="font-size:var(--text-2xl);margin-bottom:var(--space-2)">Track Your Order</h1>
      <p style="color:var(--text-muted);font-size:var(--text-sm);margin-bottom:var(--space-6)">Enter the order tracking code you received after checkout.</p>
      <div class="card">
        <div class="input-group">
          <label class="input-label">Order Tracking Code</label>
          <input type="text" class="input" id="lookup-token" placeholder="Paste your tracking code here" style="font-family:var(--font-mono)">
        </div>
        <button class="btn btn-primary w-full" style="margin-top:var(--space-4)" id="lookup-btn">Track Order</button>
      </div>
    </div>
  `;
  document.getElementById('lookup-btn')?.addEventListener('click', () => {
    const val = document.getElementById('lookup-token').value.trim();
    if (!val) { toast.error('Enter your tracking code.'); return; }
    window.location.href = `/order-tracking/?token=${encodeURIComponent(val)}`;
  });
  document.getElementById('lookup-token')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('lookup-btn').click();
  });
}

const STATUS_STEPS = [
  { key: 'awaiting_payment_submission', label: 'Order Placed' },
  { key: 'awaiting_payment_verification', label: 'Payment Submitted' },
  { key: 'payment_verified', label: 'Payment Verified' },
  { key: 'packed', label: 'Packed' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

const STATUS_ORDER = STATUS_STEPS.map(s => s.key);

async function init() {

  try {
    const order = await getOrderByToken(token);
    renderOrder(order);
    subscribeRealtime(order.id, order);
  } catch (err) {
    console.error('order-tracking:', err);
    document.getElementById('tracking-page').innerHTML = `
      <div class="empty-state">
        <h2>Order not found</h2>
        <p>This tracking link may be invalid or expired.</p>
        <a href="/" class="btn btn-secondary" style="margin-top:var(--space-4)">Go Home</a>
      </div>
    `;
  }
}

function renderOrder(order) {
  const page = document.getElementById('tracking-page');
  if (!page) return;

  const currentStatusIdx = STATUS_ORDER.indexOf(order.status);
  const address = order.shipping_address || {};
  const latestPayment = order.payment_submissions?.[order.payment_submissions.length - 1];

  page.innerHTML = `
    ${submitted ? `
    <div id="order-receipt" style="max-width:400px;margin:0 auto var(--space-10)">
      <!-- Brand receipt card -->
      <div style="background:#0a0a0a;color:#fff;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">
        <!-- Header -->
        <div style="padding:32px 32px 24px;border-bottom:1px solid rgba(255,255,255,0.08)">
          <div style="font-family:'Bebas Neue','Arial Black',sans-serif;font-size:52px;letter-spacing:0.06em;line-height:1;color:#fff">CENT</div>
          <div style="font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-top:4px">Kigali, Rwanda</div>
        </div>
        <!-- Body -->
        <div style="padding:24px 32px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
            <div>
              <div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:6px">Status</div>
              <div style="font-size:13px;font-weight:600;color:#4ade80">✓ Order Placed</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:6px">Total</div>
              <div style="font-size:13px;font-weight:700">${formatRWF(order.total_cents)}</div>
            </div>
          </div>
          <div>
            <div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:8px">Order Code</div>
            <div id="receipt-token" style="font-family:'Courier New',monospace;font-size:18px;font-weight:700;color:#fff;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:12px 16px;cursor:pointer;letter-spacing:0.12em">#${shortToken(token)}</div>
          </div>
        </div>
        <!-- Footer -->
        <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:0.1em">cent.rw</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.3)">Keep this code to track your drop</div>
        </div>
      </div>
      <!-- Action buttons -->
      <div style="display:flex;gap:var(--space-2);margin-top:var(--space-3)">
        <button class="btn btn-secondary btn-sm" id="copy-receipt-btn" style="flex:1">Copy Code</button>
        <button class="btn btn-secondary btn-sm" id="share-receipt-btn" style="flex:1">Share Receipt</button>
      </div>
    </div>
    ` : ''}
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-4);margin-bottom:var(--space-6)">
      <div>
        <div class="breadcrumb"><a href="/">Home</a><span class="sep">›</span><span>Track Order</span></div>
        <h1 style="font-size:var(--text-2xl);margin-top:var(--space-2)">
          Order #${shortToken(token)}
        </h1>
        <div style="display:flex;align-items:center;gap:var(--space-3);margin-top:var(--space-2);flex-wrap:wrap">
          <span id="status-badge">${statusBadge(order.status)}</span>
          <span>${paymentBadge(order.payment_status)}</span>
          <span style="font-size:var(--text-sm);color:var(--text-muted)">${formatDateTime(order.created_at)}</span>
          <span class="realtime-indicator">
            <span class="realtime-dot"></span>
            Live Updates
          </span>
        </div>
      </div>
      <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" id="share-btn">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Z"/>
          </svg>
          Share
        </button>
        <button class="btn btn-secondary btn-sm" id="receipt-btn">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
          </svg>
          Receipt
        </button>
        ${['awaiting_payment_submission', 'awaiting_payment_verification'].includes(order.status) ? `
        <button class="btn btn-sm" id="cancel-btn" style="color:var(--error);border-color:var(--error);background:transparent">
          Cancel Order
        </button>` : ''}
      </div>
    </div>

    <div class="tracking-layout">
      <div>
        <!-- Status Timeline -->
        <div class="card" style="margin-bottom:var(--space-4)">
          <h3 style="font-size:var(--text-lg);margin-bottom:var(--space-6)">Order Status</h3>
          <div class="status-timeline" id="status-timeline">
            ${renderTimeline(order.status)}
          </div>
        </div>

        <!-- Order Items -->
        <div class="card" style="margin-bottom:var(--space-4)">
          <h3 style="font-size:var(--text-lg);margin-bottom:var(--space-4)">Items</h3>
          ${(order.order_items || []).map(item => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-3) 0;border-bottom:1px solid var(--border)">
              <div>
                <div style="font-size:var(--text-sm);font-weight:600">${item.product_name}</div>
                <div style="font-size:var(--text-xs);color:var(--text-muted)">${[item.size, item.color].filter(Boolean).join(' · ')} &times; ${item.quantity}</div>
              </div>
              <div style="font-size:var(--text-sm);font-weight:700">${formatRWF((item.unit_price_cents || item.price_cents) * item.quantity)}</div>
            </div>
          `).join('')}
          <div style="display:flex;justify-content:space-between;padding-top:var(--space-4);font-weight:700;font-size:var(--text-lg)">
            <span>Total</span>
            <span>${formatRWF(order.total_cents)}</span>
          </div>
        </div>

        <!-- Payment section -->
        ${renderPaymentSection(order, latestPayment)}
      </div>

      <div>
        <!-- Delivery Info -->
        <div class="card" style="margin-bottom:var(--space-4)">
          <h3 style="font-size:var(--text-base);margin-bottom:var(--space-3)">Delivery Address</h3>
          <div style="font-size:var(--text-sm);color:var(--text-secondary)">
            <strong>${order.customers?.full_name || 'Customer'}</strong><br>
            ${address.district || ''}${address.sector ? ', ' + address.sector : ''}<br>
            Rwanda
          </div>
        </div>

        <!-- Token card -->
        <div class="card">
          <h3 style="font-size:var(--text-base);margin-bottom:var(--space-3)">Order Code</h3>
          <div class="font-mono copy-btn" id="tracking-token-display" style="font-size:var(--text-lg);font-weight:700;letter-spacing:0.12em;cursor:pointer;color:var(--text-primary)" title="Click to copy">#${shortToken(token)}</div>
          <p style="font-size:var(--text-xs);color:var(--text-muted);margin-top:var(--space-2)">Click to copy your full tracking code.</p>
        </div>
      </div>
    </div>
  `;

  // Share button → share receipt image
  document.getElementById('share-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('share-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      await shareReceiptImage(order);
    } catch (err) {
      console.error('share receipt error:', err);
      toast.error('Could not share receipt.');
    }
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Z"/></svg> Share`;
  });

  // Receipt download
  document.getElementById('receipt-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('receipt-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      await downloadReceiptPDF(order);
    } catch (err) {
      console.error('receipt error:', err);
      toast.error('Could not generate receipt.');
    }
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg> Receipt`;
  });

  // Copy token
  document.getElementById('tracking-token-display')?.addEventListener('click', (e) => {
    copyToClipboard(token, e.currentTarget);
    toast.success('Token copied!');
  });

  // Receipt actions
  document.getElementById('receipt-token')?.addEventListener('click', () => {
    copyToClipboard(token);
    toast.success('Order code copied!');
  });
  document.getElementById('copy-receipt-btn')?.addEventListener('click', () => {
    copyToClipboard(token);
    toast.success('Order code copied!');
  });
  document.getElementById('share-receipt-btn')?.addEventListener('click', async () => {
    const url = `${window.location.origin}/order-tracking/?token=${token}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'My CENT Order', text: `Track my order: ${token}`, url }); } catch {}
    } else {
      await copyToClipboard(url);
      toast.success('Tracking link copied!');
    }
  });

  // Cancel order
  document.getElementById('cancel-btn')?.addEventListener('click', async () => {
    if (!confirm('Cancel this order? This cannot be undone.')) return;
    const btn = document.getElementById('cancel-btn');
    btn.disabled = true;
    btn.textContent = 'Cancelling...';
    try {
      const { error } = await supabase.functions.invoke('cancel-order', {
        body: { orderId: order.id },
      });
      if (error) throw error;
      toast.success('Order cancelled.');
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      toast.error('Could not cancel. Contact support if the issue persists.');
      btn.disabled = false;
      btn.textContent = 'Cancel Order';
    }
  });

  if (submitted) {
    setTimeout(() => toast.success('Payment submitted! We\'ll verify within 2–4 hours.'), 500);
  }
}

function renderTimeline(currentStatus) {
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  if (currentStatus === 'cancelled') {
    return `<div class="timeline-item active"><div class="timeline-dot" style="background:var(--error);border-color:var(--error)"></div><div class="timeline-label" style="color:var(--error)">Order Cancelled</div></div>`;
  }

  return STATUS_STEPS.map((step, i) => {
    let state = 'future';
    if (i < currentIdx) state = 'done';
    if (i === currentIdx) state = 'active';
    return `
      <div class="timeline-item ${state}">
        <div class="timeline-dot"></div>
        <div class="timeline-label">${step.label}</div>
      </div>
    `;
  }).join('');
}

function renderPaymentSection(order, latestPayment) {
  if (order.status === 'awaiting_payment_submission') {
    return `
      <div class="card" style="border-color:var(--warning)">
        <h3 style="font-size:var(--text-lg);margin-bottom:var(--space-3);color:var(--warning)">⚠ Payment Required</h3>
        <p style="font-size:var(--text-sm);margin-bottom:var(--space-4)">Your order is waiting for payment. Please send <strong>${formatRWF(order.total_cents)}</strong> and submit your reference code.</p>
        <a href="/checkout-payment/?order_id=${order.id}&token=${order.public_token}&total=${order.total_cents}" class="btn btn-primary">Submit Payment</a>
      </div>
    `;
  }

  if (order.status === 'awaiting_payment_verification' && latestPayment) {
    return `
      <div class="card">
        <h3 style="font-size:var(--text-lg);margin-bottom:var(--space-3)">Payment Submitted</h3>
        <p style="font-size:var(--text-sm);color:var(--text-muted);margin-bottom:var(--space-3)">We received your payment details and are verifying them. This usually takes 2–4 hours.</p>
        <div style="font-size:var(--text-sm)">
          <div style="display:flex;justify-content:space-between;padding:var(--space-2) 0;border-bottom:1px solid var(--border)">
            <span style="color:var(--text-muted)">Reference</span>
            <span class="font-mono">${latestPayment.reference_code}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:var(--space-2) 0;border-bottom:1px solid var(--border)">
            <span style="color:var(--text-muted)">Amount Sent</span>
            <span>${formatRWF(latestPayment.amount_paid_cents)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:var(--space-2) 0">
            <span style="color:var(--text-muted)">Submitted</span>
            <span>${formatDateTime(latestPayment.submitted_at || latestPayment.created_at)}</span>
          </div>
        </div>
      </div>
    `;
  }

  return '';
}

function subscribeRealtime(orderId, originalOrder) {
  supabase
    .channel(`order-${orderId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${orderId}`,
    }, (payload) => {
      const newStatus = payload.new.status;
      const newPaymentStatus = payload.new.payment_status;

      // Update status badge
      const badge = document.getElementById('status-badge');
      if (badge) badge.innerHTML = statusBadge(newStatus);

      // Update timeline
      const timeline = document.getElementById('status-timeline');
      if (timeline) timeline.innerHTML = renderTimeline(newStatus);

      toast.info('Order status updated: ' + newStatus.replace(/_/g, ' '));
    })
    .subscribe();
}
