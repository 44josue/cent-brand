import { supabase } from './supabase.js';
import { getOrCreateCart, upsertCartItem, getCartItems, updateCartItemQty, removeCartItem, clearCart } from './api.js';
import { toast } from './utils.js';

const CART_KEY = 'cent_cart';
const CART_TTL = 5 * 60 * 1000; // 5 minutes

// ── LOCAL STATE ────────────────────────────────────────────────────────────────

function loadLocal() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return defaultState();
    const state = JSON.parse(raw);
    return state;
  } catch {
    return defaultState();
  }
}

function defaultState() {
  return {
    cartId: null,
    sessionToken: crypto.randomUUID(),
    items: [],
    lastFetched: 0,
  };
}

function saveLocal(state) {
  localStorage.setItem(CART_KEY, JSON.stringify(state));
}

export function getLocalCart() {
  return loadLocal();
}

export function getCartCount() {
  const { items } = loadLocal();
  return items.reduce((s, i) => s + i.quantity, 0);
}

export function getCartTotal() {
  const { items } = loadLocal();
  return items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
}

// ── BADGE UPDATE ───────────────────────────────────────────────────────────────

export function updateCartBadges() {
  const count = getCartCount();
  document.querySelectorAll('.cart-badge').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

// ── SYNC FROM SUPABASE ─────────────────────────────────────────────────────────

export async function syncCart() {
  const state = loadLocal();
  const now = Date.now();

  if (now - state.lastFetched < CART_TTL && state.items.length > 0) return state;

  try {
    if (!state.cartId && !state.sessionToken) return state;
    const cartId = await getOrCreateCart(state.sessionToken);
    const items = await getCartItems(cartId);
    const fresh = { ...state, cartId, items, lastFetched: now };
    saveLocal(fresh);
    updateCartBadges();
    return fresh;
  } catch {
    return state;
  }
}

// ── ADD TO CART ────────────────────────────────────────────────────────────────

export async function addToCart({ variantId, quantity = 1, productName, size, color, priceCents, imageUrl }) {
  const state = loadLocal();

  try {
    const cartId = state.cartId || await getOrCreateCart(state.sessionToken);
    const itemId = await upsertCartItem(cartId, variantId, quantity, priceCents || 0);

    const existing = state.items.find(i => i.variantId === variantId);
    let newItems;

    if (existing) {
      newItems = state.items.map(i =>
        i.variantId === variantId ? { ...i, quantity: i.quantity + quantity, id: itemId || i.id } : i
      );
    } else {
      newItems = [...state.items, { id: itemId, variantId, quantity, productName, size, color, priceCents, imageUrl }];
    }

    saveLocal({ ...state, cartId, items: newItems, lastFetched: Date.now() });
    updateCartBadges();
    return true;
  } catch (err) {
    console.error('addToCart error:', err);
    throw err;
  }
}

// ── UPDATE QUANTITY ────────────────────────────────────────────────────────────

export async function setCartItemQty(itemId, variantId, quantity) {
  const state = loadLocal();
  try {
    await updateCartItemQty(itemId, quantity);
    const newItems = quantity <= 0
      ? state.items.filter(i => i.variantId !== variantId)
      : state.items.map(i => i.variantId === variantId ? { ...i, quantity } : i);
    saveLocal({ ...state, items: newItems, lastFetched: Date.now() });
    updateCartBadges();
  } catch (err) {
    console.error('setCartItemQty error:', err);
    throw err;
  }
}

// ── REMOVE ITEM ────────────────────────────────────────────────────────────────

export async function removeFromCart(itemId, variantId) {
  const state = loadLocal();
  try {
    await removeCartItem(itemId);
    const newItems = state.items.filter(i => i.variantId !== variantId);
    saveLocal({ ...state, items: newItems, lastFetched: Date.now() });
    updateCartBadges();
  } catch (err) {
    console.error('removeFromCart error:', err);
    throw err;
  }
}

// ── CLEAR ──────────────────────────────────────────────────────────────────────

export async function clearLocalCart() {
  const state = loadLocal();
  if (state.cartId) {
    try { await clearCart(state.cartId); } catch {}
  }
  saveLocal(defaultState());
  updateCartBadges();
}

// ── MERGE ON LOGIN ─────────────────────────────────────────────────────────────

export async function mergeCartOnLogin(userId) {
  const state = loadLocal();
  if (!state.cartId || state.items.length === 0) return;

  try {
    // carts uses customer_id, not user_id — skip merge for now
    console.log('mergeCartOnLogin: skipped (customer lookup not implemented)');
  } catch (err) {
    console.error('mergeCartOnLogin error:', err);
  }
}
