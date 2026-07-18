import { renderNav } from '../components/nav.js';
import { renderFooter } from '../components/footer.js';
import { getPaymentChannels, getOrderByToken } from '../lib/api.js';
import { callEdge } from '../lib/api.js';
import { formatRWF, getParam, toast, copyToClipboard, shortToken } from '../lib/utils.js';
import { updateCartBadges, clearLocalCart } from '../lib/cart.js';
import { supabase } from '../lib/supabase.js';
import { pageUrl } from '../lib/paths.js';

renderNav();
renderFooter();
updateCartBadges();

const orderId = getParam('order_id');
const token = getParam('token');
let totalCents = parseInt(getParam('total') || '0');

if (!orderId || !token) { window.location.href = pageUrl(); }
else { init(); }

let selectedChannelId = null;
let proofFile = null;
let payOnArrival = false;

async function init() {
  // If total missing from URL, fetch from DB
  if (!totalCents) {
    try {
      const order = await getOrderByToken(token);
      totalCents = order?.total_cents || 0;
    } catch {}
  }

  // Amount display
  const amountEl = document.getElementById('amount-display');
  if (amountEl) amountEl.textContent = formatRWF(totalCents);

  // Pre-fill amount (read-only display)
  const amountInput = document.getElementById('amount-paid');
  if (amountInput) amountInput.value = formatRWF(totalCents);

  // Pay on Arrival amount text
  const poaAmountText = document.getElementById('poa-amount-text');
  if (poaAmountText) poaAmountText.textContent = formatRWF(totalCents);

  // Order token
  const tokenEl = document.getElementById('order-token');
  if (tokenEl) {
    tokenEl.textContent = token;
    tokenEl.addEventListener('click', () => copyToClipboard(token, tokenEl));
  }

  // Summary
  const summaryEl = document.getElementById('payment-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="order-summary-row">
        <span>Order</span>
        <span class="font-mono" style="font-size:var(--text-xs)">#${shortToken(token)}</span>
      </div>
      <div class="order-summary-row">
        <span class="order-summary-total">Total Due</span>
        <span class="order-summary-total">${formatRWF(totalCents)}</span>
      </div>
    `;
  }

  await loadChannels();
  setupPayOnArrival();
  setupFileUpload();
  setupForm();
}

async function loadChannels() {
  const list = document.getElementById('channels-list');
  if (!list) return;

  try {
    const channels = await getPaymentChannels();

    if (!channels.length) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:var(--text-sm)">No payment channels available. Contact us at admin@cent.rw.</p>';
      return;
    }

    list.innerHTML = channels.map((ch, i) => `
      <label class="channel-card ${i === 0 ? 'selected' : ''}" data-id="${ch.id}">
        <input type="radio" name="channel" value="${ch.id}" ${i === 0 ? 'checked' : ''}>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)">
          <div>
            <div style="font-size:var(--text-sm);font-weight:700;margin-bottom:var(--space-1)">${ch.name}</div>
            <div class="channel-number copy-btn" data-copy="${ch.number}" title="Click to copy">
              ${ch.number}
              <span style="font-size:var(--text-xs);color:var(--text-muted);font-family:var(--font-sans)"> ↗ copy</span>
            </div>
          </div>
          <div style="width:24px;height:24px;border-radius:50%;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0" class="radio-indicator">
            ${i === 0 ? '<div style="width:12px;height:12px;border-radius:50%;background:var(--accent)"></div>' : ''}
          </div>
        </div>
      </label>
    `).join('');

    if (channels.length > 0) {
      selectedChannelId = channels[0].id;
      showInstructions(channels[0]);
    }

    // Channel selection
    list.querySelectorAll('.channel-card').forEach(card => {
      card.addEventListener('click', () => {
        list.querySelectorAll('.channel-card').forEach(c => {
          c.classList.remove('selected');
          c.querySelector('.radio-indicator').innerHTML = '';
        });
        card.classList.add('selected');
        card.querySelector('input').checked = true;
        card.querySelector('.radio-indicator').innerHTML = '<div style="width:12px;height:12px;border-radius:50%;background:var(--accent)"></div>';

        selectedChannelId = card.dataset.id;
        deselectPayOnArrival();
        const channel = channels.find(c => c.id === card.dataset.id);
        if (channel) showInstructions(channel);
      });

      // Copy number
      card.querySelector('.channel-number')?.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const num = card.querySelector('.channel-number').dataset.copy;
        copyToClipboard(num, card.querySelector('.channel-number'));
        toast.success('Number copied!');
      });
    });
  } catch (err) {
    console.error('loadChannels:', err);
    list.innerHTML = '<p style="color:var(--text-muted)">Could not load payment channels.</p>';
  }
}

function showInstructions(channel) {
  const wrap = document.getElementById('channel-instructions');
  const body = document.getElementById('instructions-body');
  if (!wrap || !body) return;

  const amount = formatRWF(totalCents);
  const steps = [
    `Open your ${channel.name} app or dial the USSD code`,
    `Send <strong>${amount}</strong> to <strong class="font-mono">${channel.number}</strong>`,
    `Note the transaction reference code from your confirmation SMS`,
    `Fill in the form below with your details`,
  ];

  body.innerHTML = steps.map((s, i) => `
    <div class="step-instruction">
      <div class="step-num-circle">${i + 1}</div>
      <div style="font-size:var(--text-sm);color:var(--text-secondary);padding-top:4px">${s}</div>
    </div>
  `).join('');

  if (channel.instructions) {
    body.innerHTML += `<p style="font-size:var(--text-sm);color:var(--text-muted);margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--border)">${channel.instructions}</p>`;
  }

  wrap.classList.remove('hidden');
}

function setupFileUpload() {
  const input = document.getElementById('proof-upload');
  const zone = document.getElementById('proof-drop-zone');
  const filename = document.getElementById('proof-filename');

  zone?.addEventListener('click', () => input?.click());

  input?.addEventListener('change', () => {
    const file = input.files[0];
    if (file) {
      proofFile = file;
      if (filename) { filename.textContent = `✓ ${file.name}`; filename.style.display = 'block'; }
    }
  });

  zone?.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone?.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone?.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      proofFile = file;
      if (filename) { filename.textContent = `✓ ${file.name}`; filename.style.display = 'block'; }
    }
  });
}

function setupPayOnArrival() {
  const poaCard = document.getElementById('poa-card');
  if (!poaCard) return;

  poaCard.addEventListener('click', () => {
    const list = document.getElementById('channels-list');
    // Deselect all mobile channels
    list?.querySelectorAll('.channel-card').forEach(c => {
      c.classList.remove('selected');
      c.querySelector('.radio-indicator').innerHTML = '';
      c.querySelector('input').checked = false;
    });
    selectedChannelId = null;
    payOnArrival = true;

    // Style POA card as selected
    poaCard.classList.add('selected');
    document.getElementById('poa-radio-indicator').innerHTML = '<div style="width:12px;height:12px;border-radius:50%;background:var(--accent)"></div>';

    // Show/hide relevant sections
    document.getElementById('channel-instructions').classList.add('hidden');
    document.getElementById('poa-banner').style.display = 'block';
    document.getElementById('mobile-payment-fields').style.display = 'none';
    document.getElementById('payment-submit-btn').textContent = 'Confirm Order (Pay on Arrival)';
  });
}

function deselectPayOnArrival() {
  payOnArrival = false;
  document.getElementById('poa-card')?.classList.remove('selected');
  const ind = document.getElementById('poa-radio-indicator');
  if (ind) ind.innerHTML = '';
  document.getElementById('poa-banner').style.display = 'none';
  document.getElementById('mobile-payment-fields').style.display = 'block';
  document.getElementById('payment-submit-btn').textContent = 'Submit Payment';
}

function setupForm() {
  document.getElementById('payment-form')?.addEventListener('submit', handleSubmit);
}

async function handleSubmit(e) {
  e.preventDefault();

  const payerName = document.getElementById('payer-name').value.trim();
  const payerPhone = document.getElementById('payer-phone').value.trim();
  const refCode = payOnArrival ? 'pay_on_arrival' : (document.getElementById('ref-code')?.value.trim() || null);

  let valid = true;
  if (!payerName) { markError('payer-name'); valid = false; } else { clearError('payer-name'); }
  if (!payerPhone || payerPhone.length < 8) { markError('payer-phone'); valid = false; } else { clearError('payer-phone'); }

  if (!valid) { toast.error('Please fill in all required fields.'); return; }

  if (!payOnArrival && !selectedChannelId) {
    toast.error('Please select a payment method.');
    return;
  }

  const btn = document.getElementById('payment-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Submitting...';

  try {
    let proofPath = null;

    // Upload proof if provided
    if (proofFile) {
      const ext = proofFile.name.split('.').pop();
      proofPath = `${orderId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(proofPath, proofFile);
      if (uploadError) {
        console.error('proof upload error:', uploadError);
        proofPath = null;
      }
    }

    await callEdge('submit-payment', {
      token,
      payerName,
      payerPhone,
      referenceCode: refCode,
      amountPaidCents: payOnArrival ? 0 : totalCents,
      proofPath,
    });

    await clearLocalCart();
    window.location.href = `${pageUrl('order-tracking/')}?token=${token}&submitted=1`;

  } catch (err) {
    console.error('submit-payment error:', err);
    toast.error(err.message || 'Could not submit payment. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Submit Payment';
  }
}

function markError(id) {
  const el = document.getElementById(id);
  el?.closest('.input-group')?.classList.add('has-error');
  el?.classList.add('input-error');
}

function clearError(id) {
  const el = document.getElementById(id);
  el?.closest('.input-group')?.classList.remove('has-error');
  el?.classList.remove('input-error');
}
