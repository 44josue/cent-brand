import { renderNav } from '../components/nav.js';
import { renderFooter } from '../components/footer.js';
import { callEdge, validatePromoCode, getPaymentChannels } from '../lib/api.js';
import { formatRWF, districts, districtSectors, toast } from '../lib/utils.js';
import { syncCart, updateCartBadges } from '../lib/cart.js';
import { getCurrentProfile, getSession } from '../lib/auth.js';
import { pageUrl } from '../lib/paths.js';

renderNav();
renderFooter();

let cartState = null;
let appliedPromo = null;
let paymentChannels = [];

function channelLogo(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('mtn')) return '🟡';
  if (n.includes('airtel')) return '🔴';
  return '💳';
}

let isGuest = false;

init();

async function init() {
  cartState = await syncCart();
  updateCartBadges();

  if (!cartState.items.length) {
    window.location.href = pageUrl('cart/');
    return;
  }

  const session = await getSession();
  isGuest = !session;

  renderAuthBanner(session);
  renderSummary();
  await renderPaymentChannels();
  populateDistricts();
  restoreFormFromSession();
  if (!isGuest) await prefillFromProfile();
  setupEvents();
}

function renderAuthBanner(session) {
  const banner = document.getElementById('auth-banner');
  if (!banner) return;
  if (session) {
    banner.innerHTML = `<div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:var(--radius);padding:var(--space-3) var(--space-4);font-size:var(--text-sm);color:var(--success);margin-bottom:var(--space-4)">✓ Signed in — your order will be linked to your account.</div>`;
  } else {
    banner.innerHTML = `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:var(--space-4);margin-bottom:var(--space-4);font-size:var(--text-sm)">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-2)">
        <span style="color:var(--text-secondary)">Checking out as <strong style="color:var(--text-primary)">Guest</strong> — no account needed.</span>
        <a href="${pageUrl('login/')}?next=${encodeURIComponent(pageUrl('checkout/'))}" style="font-size:var(--text-xs);color:var(--text-muted);text-decoration:underline">Sign in instead</a>
      </div>
    </div>`;
  }
}

async function renderPaymentChannels() {
  const el = document.getElementById('payment-channels');
  if (!el) return;

  try {
    paymentChannels = await getPaymentChannels();
  } catch {
    paymentChannels = [];
  }

  if (!paymentChannels.length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:var(--text-sm)">No payment methods available right now. Contact us at admin@cent.rw.</p>';
    return;
  }

  el.innerHTML = paymentChannels.map((ch, i) => `
    <label class="payment-channel-option ${i === 0 ? 'selected' : ''}" data-id="${ch.id}">
      <input type="radio" name="payment_channel" value="${ch.id}" ${i === 0 ? 'checked' : ''} style="display:none">
      <span style="font-size:1.4rem">${channelLogo(ch.name)}</span>
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

function calcDiscount(subtotal) {
  if (!appliedPromo) return 0;
  const raw = appliedPromo.discount_type === 'fixed'
    ? appliedPromo.discount_value
    : Math.floor(subtotal * appliedPromo.discount_value / 100);
  return Math.min(raw, subtotal);
}

function renderSummary() {
  const el = document.getElementById('checkout-summary');
  if (!el || !cartState) return;

  const subtotal = cartState.items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
  const discount = calcDiscount(subtotal);
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

  // Promo code
  document.getElementById('promo-apply-btn')?.addEventListener('click', applyPromo);
  document.getElementById('promo-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); applyPromo(); }
  });
}

async function applyPromo() {
  const input = document.getElementById('promo-input');
  const msg = document.getElementById('promo-msg');
  const btn = document.getElementById('promo-apply-btn');
  const code = input?.value.trim();
  if (!code) return;

  btn.disabled = true;
  btn.textContent = '...';
  try {
    const promo = await validatePromoCode(code);
    const subtotal = cartState.items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
    if (!promo) {
      appliedPromo = null;
      msg.style.display = 'block';
      msg.style.color = 'var(--error)';
      msg.textContent = 'Invalid or expired promo code.';
    } else if (promo.min_order_cents && subtotal < promo.min_order_cents) {
      appliedPromo = null;
      msg.style.display = 'block';
      msg.style.color = 'var(--error)';
      msg.textContent = `Minimum order of ${formatRWF(promo.min_order_cents)} required.`;
    } else {
      appliedPromo = promo;
      msg.style.display = 'block';
      msg.style.color = 'var(--success)';
      msg.textContent = `Applied "${promo.code}".`;
      toast.success('Promo code applied.');
    }
  } catch {
    msg.style.display = 'block';
    msg.style.color = 'var(--error)';
    msg.textContent = 'Could not validate promo code.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Apply';
    renderSummary();
  }
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

  const note = document.getElementById('notes').value.trim() || undefined;
  const promoCode = appliedPromo?.code || undefined;

  try {
    const subtotal = cartState.items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
    const discount = calcDiscount(subtotal);
    const totalCents = subtotal - discount;

    let result;
    if (isGuest) {
      result = await callEdge('guest-place-order', {
        items,
        guestName: shippingAddress.fullName,
        guestEmail: shippingAddress.email,
        guestPhone: shippingAddress.phone,
        shippingAddress,
        paymentChannelId,
        note,
        promoCode,
      });
    } else {
      result = await callEdge('place-order', { items, shippingAddress, paymentChannelId, note, promoCode });
    }
    sessionStorage.removeItem('cent_checkout');
    window.location.href = `${pageUrl('checkout-payment/')}?order_id=${result.orderId}&token=${result.token}&total=${totalCents}`;
  } catch (err) {
    console.error('place-order error:', err);
    errorBanner.textContent = err.message || 'Something went wrong. Please try again.';
    errorBanner.classList.remove('hidden');
    toast.error(err.message || 'Could not place order. Try again.');
    btn.disabled = false;
    btn.textContent = 'Place Order';
  }
}
