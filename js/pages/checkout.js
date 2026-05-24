import { renderNav } from '../components/nav.js';
import { renderFooter } from '../components/footer.js';
import { callEdge, validatePromoCode } from '../lib/api.js';
import { formatRWF, districts, districtSectors, toast } from '../lib/utils.js';
import { syncCart, updateCartBadges } from '../lib/cart.js';
import { getCurrentProfile, getSession } from '../lib/auth.js';

renderNav();
renderFooter();

let cartState = null;
let appliedPromo = null;

const PAYMENT_CHANNELS = [
  { id: '7e621e69-173d-422c-b260-c4eae60eb124', name: 'MTN MoMo', logo: '🟡' },
  { id: '341dfa1a-a518-428d-b647-6ff121fafab4', name: 'Airtel Money', logo: '🔴' },
];

init();

async function init() {
  cartState = await syncCart();
  updateCartBadges();

  if (!cartState.items.length) {
    window.location.href = '/cart/';
    return;
  }

  // Require login — edge function uses JWT to identify the customer
  const session = await getSession();
  if (!session) {
    sessionStorage.setItem('cent_checkout_redirect', window.location.href);
    toast.error('Please sign in to place an order.');
    setTimeout(() => { window.location.href = '/login/?next=/checkout/'; }, 1500);
    return;
  }

  renderSummary();
  renderPaymentChannels();
  populateDistricts();
  restoreFormFromSession();
  await prefillFromProfile();
  setupEvents();
}

function renderPaymentChannels() {
  const el = document.getElementById('payment-channels');
  if (!el) return;
  el.innerHTML = PAYMENT_CHANNELS.map((ch, i) => `
    <label class="payment-channel-option ${i === 0 ? 'selected' : ''}" data-id="${ch.id}">
      <input type="radio" name="payment_channel" value="${ch.id}" ${i === 0 ? 'checked' : ''} style="display:none">
      <span style="font-size:1.4rem">${ch.logo}</span>
      <span style="font-weight:600">${ch.name}</span>
    </label>
  `).join('');
  el.querySelectorAll('.payment-channel-option').forEach(label => {
    label.addEventListener('click', () => {
      el.querySelectorAll('.payment-channel-option').forEach(l => l.classList.remove('selected'));
      label.classList.add('selected');
      label.querySelector('input').checked = true;
    });
  });
}

function renderSummary() {
  const el = document.getElementById('checkout-summary');
  if (!el || !cartState) return;

  const subtotal = cartState.items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
  const discount = appliedPromo ? Math.floor(subtotal * appliedPromo.discount_pct / 100) : 0;
  const total = subtotal - discount;

  el.innerHTML = `
    ${cartState.items.map(item => `
      <div class="order-summary-row">
        <span>${item.productName} ${item.size ? `(${item.size})` : ''} × ${item.quantity}</span>
        <span>${formatRWF(item.priceCents * item.quantity)}</span>
      </div>
    `).join('')}
    <div class="order-summary-row">
      <span>Subtotal</span>
      <span>${formatRWF(subtotal)}</span>
    </div>
    ${appliedPromo ? `
      <div class="order-summary-row" style="color:var(--success)">
        <span>Promo (${appliedPromo.code})</span>
        <span>−${formatRWF(discount)}</span>
      </div>
    ` : ''}
    <div class="order-summary-row">
      <span class="order-summary-total">Total</span>
      <span class="order-summary-total">${formatRWF(total)}</span>
    </div>
  `;
}

function populateDistricts() {
  const sel = document.getElementById('district');
  if (!sel) return;
  districts.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d; opt.textContent = d;
    sel.appendChild(opt);
  });
}

function setupEvents() {
  const districtSel = document.getElementById('district');
  const sectorSel = document.getElementById('sector');

  districtSel?.addEventListener('change', () => {
    const dist = districtSel.value;
    sectorSel.innerHTML = '<option value="">Select sector</option>';
    if (dist && districtSectors[dist]) {
      districtSectors[dist].forEach(s => {
        const opt = document.createElement('option');
        opt.value = s; opt.textContent = s;
        sectorSel.appendChild(opt);
      });
    }
    sectorSel.disabled = !dist;
  });

  // Autosave to sessionStorage
  const form = document.getElementById('checkout-form');
  form?.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input', () => saveFormToSession());
    el.addEventListener('change', () => saveFormToSession());
  });

  // Submit
  form?.addEventListener('submit', handleSubmit);
}

async function prefillFromProfile() {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return;
    const nameEl = document.getElementById('full-name');
    const emailEl = document.getElementById('email');
    const phoneEl = document.getElementById('phone');
    if (nameEl && !nameEl.value) nameEl.value = profile.full_name || '';
    if (emailEl && !emailEl.value) emailEl.value = profile.email || '';
    if (phoneEl && !phoneEl.value) phoneEl.value = profile.phone || '';
  } catch { /* not logged in */ }
}

function saveFormToSession() {
  const data = {
    full_name: document.getElementById('full-name')?.value,
    email: document.getElementById('email')?.value,
    phone: document.getElementById('phone')?.value,
    district: document.getElementById('district')?.value,
    sector: document.getElementById('sector')?.value,
    notes: document.getElementById('notes')?.value,
  };
  sessionStorage.setItem('cent_checkout', JSON.stringify(data));
}

function restoreFormFromSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('cent_checkout') || '{}');
    if (saved.full_name) document.getElementById('full-name').value = saved.full_name;
    if (saved.email) document.getElementById('email').value = saved.email;
    if (saved.phone) document.getElementById('phone').value = saved.phone;
    if (saved.notes) document.getElementById('notes').value = saved.notes;
    if (saved.district) {
      document.getElementById('district').value = saved.district;
      document.getElementById('district').dispatchEvent(new Event('change'));
      setTimeout(() => {
        if (saved.sector) document.getElementById('sector').value = saved.sector;
      }, 50);
    }
  } catch { /* no session data */ }
}

function validateForm() {
  let valid = true;

  const fields = [
    { id: 'full-name', check: v => v.trim().length >= 2 },
    { id: 'email', check: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
    { id: 'phone', check: v => v.trim().length >= 8 },
    { id: 'district', check: v => v !== '' },
    { id: 'sector', check: v => v !== '' },
  ];

  fields.forEach(({ id, check }) => {
    const el = document.getElementById(id);
    const group = el?.closest('.input-group');
    const val = el?.value || '';
    if (!check(val)) {
      group?.classList.add('has-error');
      el?.classList.add('input-error');
      valid = false;
    } else {
      group?.classList.remove('has-error');
      el?.classList.remove('input-error');
    }
  });

  return valid;
}

async function handleSubmit(e) {
  e.preventDefault();
  if (!validateForm()) {
    toast.error('Please fix the errors above.');
    return;
  }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Placing Order...';

  const errorBanner = document.getElementById('error-banner');
  errorBanner.classList.add('hidden');

  const paymentChannelId = document.querySelector('input[name="payment_channel"]:checked')?.value;
  if (!paymentChannelId) {
    toast.error('Please select a payment method.');
    btn.disabled = false;
    btn.textContent = 'Place Order';
    return;
  }

  const items = cartState.items.map(i => ({
    variantId: i.variantId,
    quantity: i.quantity,
    size: i.size || null,
    color: i.color || null,
    imageUrl: i.imageUrl || null,
  }));

  const shippingAddress = {
    fullName: document.getElementById('full-name').value.trim(),
    email: document.getElementById('email').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    district: document.getElementById('district').value,
    sector: document.getElementById('sector').value,
  };

  const body = {
    items,
    shippingAddress,
    paymentChannelId,
    note: document.getElementById('notes').value.trim() || undefined,
    promoCode: appliedPromo?.code || undefined,
  };

  try {
    const subtotal = cartState.items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
    const discount = appliedPromo ? Math.floor(subtotal * (appliedPromo.discount_value || 0) / 100) : 0;
    const totalCents = subtotal - discount;

    const result = await callEdge('place-order', body);
    sessionStorage.removeItem('cent_checkout');
    window.location.href = `/checkout-payment/?order_id=${result.orderId}&token=${result.token}&total=${totalCents}`;
  } catch (err) {
    console.error('place-order error:', err);
    errorBanner.textContent = err.message || 'Something went wrong. Please try again.';
    errorBanner.classList.remove('hidden');
    toast.error(err.message || 'Could not place order. Try again.');
    btn.disabled = false;
    btn.textContent = 'Place Order';
  }
}
