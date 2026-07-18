import { renderAdminShell } from '../../components/admin-shell.js';
import { getAdminPromotions, upsertPromotion, deletePromotion, getAdminProducts, getAdminPromotionProducts, setPromotionProducts } from '../../lib/api.js';
import { formatRWF, formatDate, toast, initTheme } from '../../lib/utils.js';

initTheme();
renderAdminShell('Promotions', renderPage);

let allProducts = [];

async function renderPage(container) {
  container.innerHTML = `
    <div class="admin-content">
      <div class="page-header">
        <h1>Promotions</h1>
        <button class="btn btn-primary btn-sm" id="add-promo-btn">+ New Promotion</button>
      </div>
      <div id="promos-table"></div>

      <div class="modal-overlay hidden" id="promo-modal">
        <div class="modal" style="max-width:560px">
          <div class="modal-header">
            <h3 id="promo-modal-title">New Promotion</h3>
            <button class="modal-close" id="promo-modal-close">✕</button>
          </div>
          <div style="padding:var(--space-6);display:flex;flex-direction:column;gap:var(--space-4);max-height:80vh;overflow-y:auto">
            <input type="hidden" id="promo-edit-id">

            <div class="input-group">
              <label class="input-label">Promotion Name / Code *</label>
              <input type="text" class="input" id="promo-code" placeholder="e.g. SUMMER25" style="text-transform:uppercase">
            </div>

            <div class="input-group">
              <label class="input-label">Description (shown to customers)</label>
              <input type="text" class="input" id="promo-desc" placeholder="e.g. Summer sale — 25% off">
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
              <div class="input-group">
                <label class="input-label">Discount Type</label>
                <select class="input" id="promo-discount-type">
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (RWF)</option>
                </select>
              </div>
              <div class="input-group">
                <label class="input-label" id="discount-value-label">Discount Value *</label>
                <input type="number" class="input" id="promo-discount-value" min="1" placeholder="e.g. 25">
              </div>
            </div>

            <div class="input-group">
              <label class="input-label">Scope — Who gets this promotion?</label>
              <select class="input" id="promo-scope">
                <option value="site_wide">Site-wide (all products)</option>
                <option value="featured_only">Featured products only</option>
                <option value="specific_products">Specific products</option>
              </select>
            </div>

            <div id="product-picker-wrap" style="display:none">
              <label class="input-label">Select Products</label>
              <input type="text" class="input input-sm" id="product-search" placeholder="Search products..." style="margin-bottom:var(--space-2)">
              <div id="product-list" style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);padding:var(--space-2);display:flex;flex-direction:column;gap:var(--space-1)"></div>
            </div>

            <div class="input-group">
              <label class="input-label">Show on Page</label>
              <select class="input" id="promo-page">
                <option value="all">All pages</option>
                <option value="shop">Shop page only</option>
                <option value="featured">Featured section only</option>
                <option value="product">Product page only</option>
              </select>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
              <div class="input-group">
                <label class="input-label">Valid From</label>
                <input type="datetime-local" class="input" id="promo-valid-from">
              </div>
              <div class="input-group">
                <label class="input-label">Expires At</label>
                <input type="datetime-local" class="input" id="promo-expires">
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
              <div class="input-group">
                <label class="input-label">Min Order (RWF)</label>
                <input type="number" class="input" id="promo-min-order" min="0" placeholder="Optional">
              </div>
              <div class="input-group">
                <label class="input-label">Max Uses</label>
                <input type="number" class="input" id="promo-max-uses" min="1" placeholder="Unlimited">
              </div>
            </div>

            <label style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer">
              <input type="checkbox" id="promo-active" checked>
              <span style="font-size:var(--text-sm)">Active (promotion is live)</span>
            </label>

            <button class="btn btn-primary w-full" id="promo-save-btn">Save Promotion</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Load all products once for the picker
  getAdminProducts({ limit: 200 }).then(r => { allProducts = r.products || []; }).catch(() => {});

  document.getElementById('add-promo-btn')?.addEventListener('click', () => openPromoModal(null));
  document.getElementById('promo-modal-close')?.addEventListener('click', () => document.getElementById('promo-modal').classList.add('hidden'));
  document.getElementById('promo-discount-type')?.addEventListener('change', updateDiscountLabel);
  document.getElementById('promo-scope')?.addEventListener('change', onScopeChange);
  document.getElementById('product-search')?.addEventListener('input', e => renderProductPicker(e.target.value));

  loadPromos();
}

function updateDiscountLabel() {
  const type = document.getElementById('promo-discount-type')?.value;
  const label = document.getElementById('discount-value-label');
  const input = document.getElementById('promo-discount-value');
  if (!label || !input) return;
  if (type === 'percentage') { label.textContent = 'Discount % *'; input.placeholder = 'e.g. 25'; input.max = 100; }
  else { label.textContent = 'Discount (RWF) *'; input.placeholder = 'e.g. 5000'; input.removeAttribute('max'); }
}

function onScopeChange() {
  const scope = document.getElementById('promo-scope')?.value;
  const wrap = document.getElementById('product-picker-wrap');
  if (wrap) wrap.style.display = scope === 'specific_products' ? 'block' : 'none';
  if (scope === 'specific_products') renderProductPicker('');
}

function renderProductPicker(query) {
  const list = document.getElementById('product-list');
  if (!list) return;
  const filtered = query
    ? allProducts.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : allProducts;

  list.innerHTML = filtered.slice(0, 40).map(p => `
    <label style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) var(--space-2);border-radius:var(--radius);cursor:pointer;font-size:var(--text-sm)">
      <input type="checkbox" class="product-pick-cb" value="${p.id}" ${selectedProducts.has(p.id) ? 'checked' : ''}>
      ${p.name}
    </label>
  `).join('');

  list.querySelectorAll('.product-pick-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) selectedProducts.add(cb.value);
      else selectedProducts.delete(cb.value);
    });
  });
}

let selectedProducts = new Set();

async function loadPromos() {
  const el = document.getElementById('promos-table');
  el.innerHTML = '<div class="skeleton skeleton-rows"></div>';
  try {
    const promos = await getAdminPromotions();
    if (!promos?.length) {
      el.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
            </div>
            <h3>No promotions yet</h3>
            <p>Create a promotion and watch sale badges appear automatically on products.</p>
          </div>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>Code</th><th>Discount</th><th>Scope</th><th>Page</th><th>Uses</th><th>Expires</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            ${promos.map(p => `
              <tr>
                <td data-label="Code">
                  <div style="font-weight:700;font-size:var(--text-sm)">${p.code}</div>
                  ${p.description ? `<div style="font-size:var(--text-xs);color:var(--text-muted)">${p.description}</div>` : ''}
                </td>
                <td data-label="Discount" style="font-weight:700;color:var(--success)">
                  ${p.discount_type === 'percentage' ? `${p.discount_value}% OFF` : `${formatRWF(p.discount_value)} OFF`}
                </td>
                <td data-label="Scope" style="font-size:var(--text-xs)">
                  ${{site_wide:'All products',featured_only:'Featured only',specific_products:'Specific'}[p.scope] || p.scope}
                </td>
                <td data-label="Page" style="font-size:var(--text-xs)">${p.apply_to_page || 'all'}</td>
                <td data-label="Uses" style="font-size:var(--text-xs)">${p.uses_count ?? 0}${p.max_uses ? ` / ${p.max_uses}` : ''}</td>
                <td data-label="Expires" style="font-size:var(--text-xs);color:var(--text-muted)">${p.valid_until ? formatDate(p.valid_until) : '—'}</td>
                <td data-label="Status"><span class="badge ${p.is_active ? 'badge-success' : 'badge-default'}">${p.is_active ? 'Active' : 'Off'}</span></td>
                <td data-label="Actions">
                  <div style="display:flex;gap:var(--space-2)">
                    <button class="btn btn-secondary btn-sm edit-promo-btn" data-id="${p.id}">Edit</button>
                    <button class="btn btn-ghost btn-sm delete-promo-btn" data-id="${p.id}" style="color:var(--error)">✕</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;

    document.querySelectorAll('.edit-promo-btn').forEach(btn => {
      const promo = promos.find(p => p.id === btn.dataset.id);
      btn.addEventListener('click', () => openPromoModal(promo));
    });
    document.querySelectorAll('.delete-promo-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this promotion?')) return;
        try { await deletePromotion(btn.dataset.id); toast.success('Deleted.'); loadPromos(); }
        catch (err) { toast.error(err.message); }
      });
    });
  } catch (err) {
    el.innerHTML = '<p style="color:var(--text-muted)">Could not load promotions.</p>';
  }
}

async function openPromoModal(promo) {
  selectedProducts = new Set();

  document.getElementById('promo-modal-title').textContent = promo ? 'Edit Promotion' : 'New Promotion';
  document.getElementById('promo-edit-id').value = promo?.id || '';
  document.getElementById('promo-code').value = promo?.code || '';
  document.getElementById('promo-desc').value = promo?.description || '';
  document.getElementById('promo-discount-type').value = promo?.discount_type || 'percentage';
  document.getElementById('promo-discount-value').value = promo?.discount_value || '';
  document.getElementById('promo-scope').value = promo?.scope || 'site_wide';
  document.getElementById('promo-page').value = promo?.apply_to_page || 'all';
  document.getElementById('promo-min-order').value = promo?.min_order_cents || '';
  document.getElementById('promo-max-uses').value = promo?.max_uses || '';
  document.getElementById('promo-valid-from').value = promo?.valid_from ? promo.valid_from.slice(0, 16) : '';
  document.getElementById('promo-expires').value = promo?.valid_until ? promo.valid_until.slice(0, 16) : '';
  document.getElementById('promo-active').checked = promo?.is_active !== false;

  updateDiscountLabel();

  // Load existing product selections for specific_products scope
  if (promo?.scope === 'specific_products' && promo.id) {
    try {
      const linked = await getAdminPromotionProducts(promo.id);
      linked.forEach(p => p && selectedProducts.add(p.id));
    } catch {}
  }

  onScopeChange();
  document.getElementById('promo-modal').classList.remove('hidden');

  document.getElementById('promo-save-btn').onclick = async () => {
    const code = document.getElementById('promo-code').value.trim().toUpperCase();
    const description = document.getElementById('promo-desc').value.trim() || null;
    const discount_type = document.getElementById('promo-discount-type').value;
    const discount_value = parseFloat(document.getElementById('promo-discount-value').value);
    const scope = document.getElementById('promo-scope').value;
    const apply_to_page = document.getElementById('promo-page').value;
    const min_order_cents = parseInt(document.getElementById('promo-min-order').value) || 0;
    const max_uses = parseInt(document.getElementById('promo-max-uses').value) || null;
    const valid_from = document.getElementById('promo-valid-from').value || new Date().toISOString();
    const valid_until = document.getElementById('promo-expires').value || null;
    const is_active = document.getElementById('promo-active').checked;
    const id = document.getElementById('promo-edit-id').value || undefined;

    if (!code || !discount_value) { toast.error('Code and discount value are required.'); return; }
    if (discount_type === 'percentage' && (discount_value < 1 || discount_value > 100)) {
      toast.error('Percentage must be 1–100.'); return;
    }

    const btn = document.getElementById('promo-save-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

    try {
      const row = { code, description, discount_type, discount_value, scope, apply_to_page, min_order_cents, max_uses, valid_from, valid_until, is_active };
      if (id) row.id = id;
      const saved = await upsertPromotion(row);
      const savedId = saved?.id || id;

      // Save product links for specific_products scope
      if (scope === 'specific_products' && savedId) {
        await setPromotionProducts(savedId, [...selectedProducts]);
      }

      toast.success('Promotion saved!');
      document.getElementById('promo-modal').classList.add('hidden');
      loadPromos();
    } catch (err) {
      toast.error(err.message || 'Could not save promotion.');
    }
    btn.disabled = false; btn.textContent = 'Save Promotion';
  };
}
