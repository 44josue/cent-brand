import { renderNav } from '../components/nav.js';
import { renderFooter } from '../components/footer.js';
import { validatePromoCode } from '../lib/api.js';
import { formatRWF, toast } from '../lib/utils.js';
import { syncCart, setCartItemQty, removeFromCart, updateCartBadges } from '../lib/cart.js';
import { pageUrl } from '../lib/paths.js';
import { trackScrollPosition, restoreScrollPosition } from '../lib/page-state.js';

renderNav();
renderFooter();

let cartState = null;
let appliedPromo = null;

init();

async function init() {
  cartState = await syncCart();
  updateCartBadges();
  renderCart();
  trackScrollPosition();
  restoreScrollPosition();
}

function renderCart() {
  const wrapper = document.getElementById('cart-wrapper');
  if (!wrapper) return;

  if (!cartState.items.length) {
    wrapper.innerHTML = `
      <div class="empty-state">
        <div style="font-size:4rem;margin-bottom:var(--space-4)">○</div>
        <h3>Your cart is empty</h3>
        <p>Looks like you haven't added anything yet.</p>
        <a href="${pageUrl('products/')}" class="btn btn-primary" style="margin-top:var(--space-4)">Start Shopping</a>
      </div>
    `;
    return;
  }

  const subtotal = cartState.items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
  const discount = appliedPromo ? Math.floor(subtotal * appliedPromo.discount_pct / 100) : 0;
  const total = subtotal - discount;

  wrapper.innerHTML = `
    <div class="cart-layout">
      <div>
        <div id="cart-items">
          ${cartState.items.map(cartItemRow).join('')}
        </div>
        <a href="${pageUrl('products/')}" class="btn btn-ghost" style="margin-top:var(--space-4)">← Continue Shopping</a>
      </div>

      <div class="order-summary">
        <h3 style="font-size:var(--text-lg);margin-bottom:var(--space-4)">Order Summary</h3>

        <div class="order-summary-row">
          <span>Subtotal</span>
          <span>${formatRWF(subtotal)}</span>
        </div>

        ${appliedPromo ? `
          <div class="order-summary-row" style="color:var(--success)">
            <span>Promo (${appliedPromo.code}) −${appliedPromo.discount_pct}%</span>
            <span>−${formatRWF(discount)}</span>
          </div>
        ` : ''}

        <div class="order-summary-row" style="padding-top:var(--space-4)">
          <div class="promo-wrap" style="width:100%">
            <input type="text" class="input input-sm" id="promo-input" placeholder="Promo code" value="${appliedPromo?.code || ''}">
            <button class="btn btn-secondary btn-sm" id="promo-btn">${appliedPromo ? 'Remove' : 'Apply'}</button>
          </div>
        </div>

        ${appliedPromo ? `<p style="font-size:var(--text-xs);color:var(--success);margin-top:var(--space-1)">✓ Promo applied</p>` : ''}

        <div class="order-summary-row" style="margin-top:var(--space-4)">
          <span class="order-summary-total">Total</span>
          <span class="order-summary-total">${formatRWF(total)}</span>
        </div>

        <a href="${pageUrl('checkout/')}" class="btn btn-primary btn-lg w-full" style="margin-top:var(--space-6)">
          Proceed to Checkout
        </a>

        <p style="font-size:var(--text-xs);color:var(--text-muted);text-align:center;margin-top:var(--space-3)">
          Pay via MTN MoMo or Airtel Money after checkout
        </p>
      </div>
    </div>
  `;

  initCartEvents();
}

function cartItemRow(item) {
  const isOos = item.stock !== undefined && item.stock < item.quantity;

  return `
    <div class="cart-item" data-variant="${item.variantId}" data-item="${item.id}">
      <img src="${item.imageUrl || ''}" alt="${item.productName}" class="cart-item-img" loading="lazy"
        onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2288%22 height=%22117%22%3E%3Crect width=%2288%22 height=%22117%22 fill=%22%23161616%22/%3E%3C/svg%3E'">
      <div>
        <div class="cart-item-name">
          ${item.productName}
          ${isOos ? '<span class="badge badge-cancelled" style="margin-left:var(--space-2)">Out of stock</span>' : ''}
        </div>
        <div class="cart-item-variant">${[item.size, item.color].filter(Boolean).join(' · ')}</div>
        <div class="cart-item-price">${formatRWF(item.priceCents)}</div>
        <div style="margin-top:var(--space-3)">
          <div class="qty-stepper">
            <button class="qty-minus" data-variant="${item.variantId}" data-item="${item.id}" aria-label="Decrease" ${item.quantity <= 1 ? 'disabled' : ''}>−</button>
            <input type="number" class="qty-val" data-variant="${item.variantId}" value="${item.quantity}" min="1" max="${item.stock || 99}" aria-label="Quantity" readonly>
            <button class="qty-plus" data-variant="${item.variantId}" data-item="${item.id}" aria-label="Increase" ${item.stock !== undefined && item.quantity >= item.stock ? 'disabled' : ''}>+</button>
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:var(--space-2)">
        <button class="remove-btn" data-variant="${item.variantId}" data-item="${item.id}" aria-label="Remove item">✕</button>
        <div class="cart-item-total">${formatRWF(item.priceCents * item.quantity)}</div>
      </div>
    </div>
  `;
}

function initCartEvents() {
  // Qty minus
  document.querySelectorAll('.qty-minus').forEach(btn => {
    btn.addEventListener('click', async () => {
      const variantId = btn.dataset.variant;
      const itemId = btn.dataset.item;
      const item = cartState.items.find(i => i.variantId === variantId);
      if (!item || item.quantity <= 1) return;
      btn.disabled = true;
      try {
        await setCartItemQty(itemId, variantId, item.quantity - 1);
        cartState = { ...cartState, items: cartState.items.map(i => i.variantId === variantId ? { ...i, quantity: i.quantity - 1 } : i) };
        renderCart();
      } catch { toast.error('Failed to update cart.'); }
    });
  });

  // Qty plus
  document.querySelectorAll('.qty-plus').forEach(btn => {
    btn.addEventListener('click', async () => {
      const variantId = btn.dataset.variant;
      const itemId = btn.dataset.item;
      const item = cartState.items.find(i => i.variantId === variantId);
      if (!item) return;
      btn.disabled = true;
      try {
        await setCartItemQty(itemId, variantId, item.quantity + 1);
        cartState = { ...cartState, items: cartState.items.map(i => i.variantId === variantId ? { ...i, quantity: i.quantity + 1 } : i) };
        renderCart();
      } catch { toast.error('Failed to update cart.'); }
    });
  });

  // Remove
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const variantId = btn.dataset.variant;
      const itemId = btn.dataset.item;
      btn.disabled = true;
      try {
        await removeFromCart(itemId, variantId);
        cartState = { ...cartState, items: cartState.items.filter(i => i.variantId !== variantId) };
        renderCart();
        updateCartBadges();
        toast.info('Item removed from cart.');
      } catch { toast.error('Failed to remove item.'); }
    });
  });

  // Promo
  const promoBtn = document.getElementById('promo-btn');
  promoBtn?.addEventListener('click', async () => {
    if (appliedPromo) {
      appliedPromo = null;
      toast.info('Promo code removed.');
      renderCart();
      return;
    }

    const code = document.getElementById('promo-input')?.value.trim();
    if (!code) { toast.error('Enter a promo code.'); return; }

    promoBtn.disabled = true;
    promoBtn.textContent = '...';

    try {
      const promo = await validatePromoCode(code);
      if (!promo) {
        toast.error('That promo code is invalid or expired.');
      } else {
        appliedPromo = promo;
        toast.success(`Promo applied: ${promo.discount_pct}% off!`);
        renderCart();
        return;
      }
    } catch { toast.error('Could not validate promo code.'); }

    promoBtn.disabled = false;
    promoBtn.textContent = 'Apply';
  });
}
