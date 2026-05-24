import { renderNav } from '../components/nav.js';
import { renderFooter } from '../components/footer.js';
import { requireAuth, getCurrentProfile, updateProfile, signOut, getUser } from '../lib/auth.js';
import { getOrdersByCustomer } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';
import { formatRWF, formatDate, modal, toast, statusBadge, shortToken, initTheme } from '../lib/utils.js';
import { updateCartBadges } from '../lib/cart.js';

initTheme();
renderNav();
renderFooter();
updateCartBadges();

init();

async function init() {
  const user = await requireAuth('/login/?redirect=/account/');
  if (!user) return;

  const profile = await getCurrentProfile();
  if (!profile) { window.location.href = '/login/'; return; }

  // Get customer record for orders
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();

  const [orders, wishlist] = await Promise.all([
    customer ? getOrdersByCustomer(customer.id).catch(() => []) : [],
    getWishlistItems(),
  ]);

  renderAccount(profile, orders, wishlist);
}

async function getWishlistItems() {
  try {
    const ids = JSON.parse(localStorage.getItem('cent_wishlist') || '[]');
    if (!ids.length) return [];
    const { data } = await supabase
      .from('products')
      .select('id, slug, name, product_variants(price_cents, is_active), product_media(url, is_primary, sort_order)')
      .in('id', ids);
    return data || [];
  } catch { return []; }
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function renderAccount(profile, orders, wishlist) {
  const page = document.getElementById('account-page');
  if (!page) return;

  page.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-4);margin-bottom:var(--space-8)">
      <div style="display:flex;align-items:center;gap:var(--space-4)">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--bg-card);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:var(--text-xl);font-weight:700">
          ${getInitials(profile.full_name)}
        </div>
        <div>
          <h1 style="font-size:var(--text-2xl);line-height:1.1">${profile.full_name || 'Account'}</h1>
          <div style="font-size:var(--text-sm);color:var(--text-muted)">${profile.email}</div>
        </div>
      </div>
      <div style="display:flex;gap:var(--space-2)">
        <button class="btn btn-secondary btn-sm" id="edit-profile-btn">Edit Profile</button>
        <button class="btn btn-ghost btn-sm" id="signout-btn">Sign Out</button>
      </div>
    </div>

    <div class="tabs" id="account-tabs">
      <button class="tab-btn active" data-tab="orders">Orders (${orders.length})</button>
      <button class="tab-btn" data-tab="track">Track Order</button>
      <button class="tab-btn" data-tab="wishlist">Wishlist (${wishlist.length})</button>
    </div>

    <div class="tab-panel active" id="tab-orders">
      ${renderOrders(orders)}
    </div>

    <div class="tab-panel" id="tab-track">
      ${renderTrackTab()}
    </div>

    <div class="tab-panel" id="tab-wishlist">
      ${renderWishlist(wishlist)}
    </div>
  `;

  // Tabs
  document.querySelectorAll('#account-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#account-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    });
  });

  // Track order tab
  document.getElementById('track-lookup-btn')?.addEventListener('click', () => {
    const token = document.getElementById('track-token-input').value.trim();
    if (!token) { toast.error('Enter a tracking code.'); return; }
    window.location.href = `/order-tracking/?token=${encodeURIComponent(token)}`;
  });
  document.getElementById('track-token-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('track-lookup-btn').click();
  });

  // Edit profile
  document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
    document.getElementById('edit-name').value = profile.full_name || '';
    document.getElementById('edit-phone').value = profile.phone || '';
    document.querySelector('#edit-profile-modal .modal-close')?.addEventListener('click', () => modal.close('edit-profile-modal'), { once: true });
    modal.open('edit-profile-modal');
  });

  // Sign out
  document.getElementById('signout-btn')?.addEventListener('click', async () => {
    await signOut();
    window.location.href = '/';
  });

  // Save profile
  document.getElementById('edit-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-profile-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      await updateProfile(profile.id, {
        full_name: document.getElementById('edit-name').value.trim(),
        phone: document.getElementById('edit-phone').value.trim(),
      });
      toast.success('Profile updated!');
      modal.close('edit-profile-modal');
      setTimeout(() => window.location.reload(), 500);
    } catch {
      toast.error('Could not update profile.');
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  });
}

function renderTrackTab() {
  return `
    <div style="max-width:480px;margin:var(--space-10) auto 0;text-align:center">
      <div style="font-size:3rem;margin-bottom:var(--space-4)">📦</div>
      <h3 style="font-size:var(--text-xl);margin-bottom:var(--space-2)">Track an Order</h3>
      <p style="color:var(--text-muted);font-size:var(--text-sm);margin-bottom:var(--space-6)">
        Enter the tracking code from your order confirmation.
      </p>
      <div style="display:flex;gap:var(--space-2)">
        <input type="text" class="input" id="track-token-input"
          placeholder="Paste tracking code here"
          style="flex:1;font-family:var(--font-mono)">
        <button class="btn btn-primary" id="track-lookup-btn">Track</button>
      </div>
      <p style="font-size:var(--text-xs);color:var(--text-muted);margin-top:var(--space-3)">
        Your tracking code was shown after checkout and sent to your email.
      </p>
    </div>
  `;
}

function renderOrders(orders) {
  if (!orders.length) {
    return `
      <div class="empty-state" style="padding:var(--space-16) var(--space-6)">
        <div class="empty-state-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
        </div>
        <h3>No orders yet</h3>
        <p>When you place an order, it'll show up right here.</p>
        <a href="/products/" class="btn btn-primary" style="margin-top:var(--space-4)">Shop Now</a>
      </div>
    `;
  }

  return `
    <div class="data-table-wrap" style="margin-top:var(--space-4)">
      <table class="data-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Date</th>
            <th>Status</th>
            <th>Items</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td><span class="font-mono" style="font-size:var(--text-xs)">#${shortToken(o.public_token)}</span></td>
              <td style="font-size:var(--text-xs);color:var(--text-muted)">${formatDate(o.created_at)}</td>
              <td>${statusBadge(o.status)}</td>
              <td style="font-size:var(--text-sm);color:var(--text-muted)">${(o.order_items || []).reduce((s, i) => s + i.quantity, 0)} items</td>
              <td style="font-weight:700;font-size:var(--text-sm)">${formatRWF(o.total_cents)}</td>
              <td>
                <a href="/order-tracking/?token=${o.public_token}" class="btn btn-secondary btn-sm">Track</a>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderWishlist(items) {
  if (!items.length) {
    return `
      <div class="empty-state" style="padding:var(--space-16) var(--space-6)">
        <div class="empty-state-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
        </div>
        <h3>Wishlist is empty</h3>
        <p>Save products you love — tap the heart on any product to add it here.</p>
        <a href="/products/" class="btn btn-primary" style="margin-top:var(--space-4)">Browse Products</a>
      </div>
    `;
  }

  return `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-4);margin-top:var(--space-4)">
      ${items.map(p => {
        const variants = (p.product_variants || []).filter(v => v.is_active);
        const media = [...(p.product_media || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        const img = media.find(m => m.is_primary) || media[0];
        const minPrice = variants.length ? Math.min(...variants.map(v => v.price_cents)) : null;
        return `
          <a href="/product/?slug=${p.slug}" class="product-card" style="text-decoration:none">
            <div class="product-card-image">
              <img src="${img?.url || ''}" alt="${p.name}" loading="lazy" width="300" height="400"
                onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22400%22%3E%3Crect width=%22300%22 height=%22400%22 fill=%22%23161616%22/%3E%3C/svg%3E'">
            </div>
            <div class="product-card-body">
              <div class="product-card-name">${p.name}</div>
              <div class="product-card-price">${minPrice ? formatRWF(minPrice) : 'N/A'}</div>
            </div>
          </a>
        `;
      }).join('')}
    </div>
  `;
}
