import { renderAdminShell } from '../../components/admin-shell.js';
import { getOrderByToken, callEdge } from '../../lib/api.js';
import { formatRWF, formatDate, formatDateTime, statusBadge, shortToken, getParam, toast, initTheme } from '../../lib/utils.js';
import { supabase } from '../../lib/supabase.js';
import { pageUrl } from '../../lib/paths.js';

initTheme();
renderAdminShell('Order Detail', renderPage);

const STATUS_FLOW = ['payment_verified', 'packed', 'out_for_delivery', 'delivered'];
const STATUS_LABELS = {
  draft: 'Draft',
  awaiting_payment_submission: 'Awaiting Payment',
  awaiting_payment_verification: 'Needs Verification',
  payment_verified: 'Payment Verified',
  packed: 'Packed',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

async function renderPage(container) {
  const token = getParam('token');
  if (!token) { container.innerHTML = '<div class="admin-content"><p>No order token provided.</p></div>'; return; }

  container.innerHTML = `
    <div class="admin-content">
      <div class="page-header">
        <div>
          <a href="${pageUrl('admin/orders/')}" style="font-size:var(--text-sm);color:var(--text-muted);text-decoration:none">← Orders</a>
          <h1 id="order-title">Order</h1>
        </div>
        <div id="order-actions" style="display:flex;gap:var(--space-2)"></div>
      </div>
      <div id="order-body">
        <div class="skeleton skeleton-rows"></div>
      </div>
    </div>
  `;

  loadOrder(container, token);
}

async function loadOrder(container, token) {
  const body = document.getElementById('order-body');
  try {
    const order = await getOrderByToken(token);
    if (!order) { body.innerHTML = '<p style="color:var(--text-muted)">Order not found.</p>'; return; }

    // Generate signed proof URL if there's a storage path
    const proofPath = order.payment_submissions?.[0]?.proof_storage_path;
    let proofUrl = null;
    if (proofPath) {
      if (proofPath.startsWith('http')) {
        proofUrl = proofPath;
      } else {
        const { data } = await supabase.storage.from('payment-proofs').createSignedUrl(proofPath, 3600);
        proofUrl = data?.signedUrl || null;
      }
    }

    document.getElementById('order-title').textContent = `Order #${shortToken(order.public_token)}`;
    renderOrder(container, order, proofUrl);
  } catch (err) {
    console.error('loadOrder:', err);
    body.innerHTML = '<p style="color:var(--text-muted)">Could not load order.</p>';
  }
}

function renderOrder(container, order, proofUrl) {
  const body = document.getElementById('order-body');
  const actionsEl = document.getElementById('order-actions');
  const isPending = order.status === 'awaiting_payment_verification';
  const canProgress = STATUS_FLOW.includes(order.status) && order.status !== 'delivered';

  const addr = order.shipping_address || {};
  const submission = order.payment_submissions?.[0] || null;

  actionsEl.innerHTML = `
    ${isPending ? `
      <button class="btn btn-success btn-sm" id="verify-btn">✓ Verify Payment</button>
      <button class="btn btn-danger btn-sm" id="reject-btn">✕ Reject</button>
    ` : ''}
    ${canProgress ? `
      <button class="btn btn-primary btn-sm" id="advance-btn">Advance Status →</button>
    ` : ''}
    ${!['delivered','cancelled'].includes(order.status) ? `
      <button class="btn btn-ghost btn-sm" id="cancel-btn">Cancel Order</button>
    ` : ''}
  `;

  const proofHtml = proofUrl ? `
    <div style="margin-top:var(--space-4)">
      <div style="font-size:var(--text-xs);font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:var(--space-2)">Payment Proof</div>
      <a href="${proofUrl}" target="_blank" rel="noopener">
        <img src="${proofUrl}" alt="Payment proof" style="max-width:280px;border-radius:var(--radius);border:1px solid var(--border)">
      </a>
    </div>
  ` : (submission?.proof_storage_path ? `
    <div style="margin-top:var(--space-4)">
      <div style="font-size:var(--text-xs);font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:var(--space-2)">Payment Proof</div>
      <span style="font-size:var(--text-xs);color:var(--text-muted)">Proof uploaded (path: ${submission.proof_storage_path})</span>
    </div>
  ` : '');

  body.innerHTML = `
    <div class="order-detail-grid">
      <div>
        <div class="card" style="margin-bottom:var(--space-6)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4)">
            <h3>Status</h3>
            ${statusBadge(order.status)}
          </div>
          <div class="status-timeline">
            ${STATUS_FLOW.map(s => {
              const idx = STATUS_FLOW.indexOf(order.status);
              const sIdx = STATUS_FLOW.indexOf(s);
              const done = idx >= sIdx && idx !== -1;
              const current = order.status === s;
              return `
                <div class="timeline-step ${done ? 'done' : ''} ${current ? 'current' : ''}">
                  <div class="timeline-dot"></div>
                  <div class="timeline-label">${STATUS_LABELS[s]}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="card">
          <h3 style="margin-bottom:var(--space-4)">Items (${(order.order_items || []).reduce((s, i) => s + i.quantity, 0)})</h3>
          ${(order.order_items || []).map(item => `
            <div style="display:flex;gap:var(--space-3);padding:var(--space-3) 0;border-bottom:1px solid var(--border)">
              ${item.image_url ? `<img src="${item.image_url}" alt=""
                style="width:64px;height:85px;object-fit:cover;border-radius:var(--radius);background:var(--bg-base);flex-shrink:0"
                onerror="this.style.display='none'">` : ''}
              <div style="flex:1">
                <div style="font-weight:600;font-size:var(--text-sm)">${item.product_name}</div>
                <div style="font-size:var(--text-xs);color:var(--text-muted)">${[item.size, item.color].filter(Boolean).join(' · ')}</div>
                <div style="font-size:var(--text-sm);margin-top:var(--space-1)">${item.quantity} × ${formatRWF(item.unit_price_cents)}</div>
              </div>
              <div style="font-weight:700;font-size:var(--text-sm)">${formatRWF(item.quantity * item.unit_price_cents)}</div>
            </div>
          `).join('')}
          <div style="display:flex;justify-content:space-between;padding-top:var(--space-4);font-weight:700">
            <span>Total</span>
            <span>${formatRWF(order.total_cents)}</span>
          </div>
        </div>
      </div>

      <div>
        <div class="card" style="margin-bottom:var(--space-6)">
          <h3 style="margin-bottom:var(--space-4)">Customer</h3>
          <div style="font-size:var(--text-sm)">${order.customers?.full_name || 'Guest'}</div>
          <div style="font-size:var(--text-sm);color:var(--text-muted)">${order.customers?.email || '—'}</div>
          ${order.customers?.phone ? `<div style="font-size:var(--text-sm);color:var(--text-muted)">${order.customers.phone}</div>` : ''}

          <div style="margin-top:var(--space-4);padding-top:var(--space-4);border-top:1px solid var(--border)">
            <div style="font-size:var(--text-xs);font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:var(--space-2)">Delivery Address</div>
            ${addr.district ? `<div style="font-size:var(--text-sm)">${addr.district}${addr.sector ? `, ${addr.sector}` : ''}</div>` : '<div style="font-size:var(--text-sm);color:var(--text-muted)">—</div>'}
            ${addr.phone ? `<div style="font-size:var(--text-sm);color:var(--text-muted)">${addr.phone}</div>` : ''}
            ${addr.notes || order.note ? `<div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:var(--space-2)">${addr.notes || order.note}</div>` : ''}
          </div>
        </div>

        <div class="card">
          <h3 style="margin-bottom:var(--space-4)">Payment</h3>
          <div style="display:flex;justify-content:space-between;font-size:var(--text-sm);margin-bottom:var(--space-2)">
            <span style="color:var(--text-muted)">Channel</span>
            <span>${order.payment_channels?.name || '—'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:var(--text-sm);margin-bottom:var(--space-2)">
            <span style="color:var(--text-muted)">Reference</span>
            <span class="font-mono" style="font-size:var(--text-xs)">${submission?.reference_code || '—'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:var(--text-sm);margin-bottom:var(--space-2)">
            <span style="color:var(--text-muted)">Payer Phone</span>
            <span>${submission?.payer_phone || '—'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:var(--text-sm)">
            <span style="color:var(--text-muted)">Submitted</span>
            <span>${submission?.created_at ? formatDateTime(submission.created_at) : '—'}</span>
          </div>
          ${proofHtml}
        </div>

        <div style="margin-top:var(--space-4);font-size:var(--text-xs);color:var(--text-muted)">
          Created ${formatDateTime(order.created_at)} &middot; Token: <span class="font-mono">${order.public_token}</span>
        </div>
      </div>
    </div>

    <div class="modal-overlay hidden" id="note-modal">
      <div class="modal">
        <div class="modal-header">
          <h3 id="note-modal-title">Add Note</h3>
          <button class="modal-close" id="note-close">✕</button>
        </div>
        <div style="padding:var(--space-6)">
          <textarea class="input" id="admin-note" rows="4" placeholder="Internal note (optional)..." style="width:100%;resize:vertical"></textarea>
          <button class="btn btn-primary w-full" style="margin-top:var(--space-4)" id="note-confirm-btn">Confirm</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('verify-btn')?.addEventListener('click', () => {
    document.getElementById('note-modal-title').textContent = 'Verify Payment';
    document.getElementById('note-modal').classList.remove('hidden');
    document.getElementById('note-confirm-btn').onclick = async () => {
      const note = document.getElementById('admin-note').value.trim();
      await runAction(() => callEdge('admin-verify-payment', { orderId: order.id, note }), 'Payment verified!', container, order.public_token);
    };
  });

  document.getElementById('reject-btn')?.addEventListener('click', () => {
    document.getElementById('note-modal-title').textContent = 'Reject Payment';
    document.getElementById('note-modal').classList.remove('hidden');
    document.getElementById('note-confirm-btn').onclick = async () => {
      const note = document.getElementById('admin-note').value.trim();
      await runAction(() => callEdge('admin-reject-payment', { orderId: order.id, reason: note }), 'Payment rejected.', container, order.public_token);
    };
  });

  document.getElementById('advance-btn')?.addEventListener('click', () => {
    const currentIdx = STATUS_FLOW.indexOf(order.status);
    const nextStatus = STATUS_FLOW[currentIdx + 1];
    if (!nextStatus) return;
    if (!confirm(`Advance to "${STATUS_LABELS[nextStatus]}"?`)) return;
    runAction(() => callEdge('admin-update-status', { orderId: order.id, newStatus: nextStatus }), `Status: ${STATUS_LABELS[nextStatus]}`, container, order.public_token);
  });

  document.getElementById('cancel-btn')?.addEventListener('click', () => {
    if (!confirm('Cancel this order?')) return;
    runAction(() => callEdge('admin-update-status', { orderId: order.id, newStatus: 'cancelled' }), 'Order cancelled.', container, order.public_token);
  });

  document.getElementById('note-close')?.addEventListener('click', () => {
    document.getElementById('note-modal').classList.add('hidden');
  });
}

async function runAction(action, successMsg, container, token) {
  try {
    document.getElementById('note-modal')?.classList.add('hidden');
    await action();
    toast.success(successMsg);
    loadOrder(container, token);
  } catch (err) {
    toast.error(err.message || 'Action failed.');
  }
}
