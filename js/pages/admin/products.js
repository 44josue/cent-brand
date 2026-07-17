import { renderAdminShell } from '../../components/admin-shell.js';
import { getAdminProducts, deleteProduct } from '../../lib/api.js';
import { formatRWF, toast, initTheme } from '../../lib/utils.js';
import { pageUrl } from '../../lib/paths.js';

initTheme();
renderAdminShell('Products', renderPage);

async function renderPage(container) {
  container.innerHTML = `
    <div class="admin-content">
      <div class="page-header">
        <h1>Products</h1>
        <a href="${pageUrl('admin/product-form/')}" class="btn btn-primary btn-sm">+ New Product</a>
      </div>
      <div id="products-table"></div>
    </div>
  `;
  loadProducts(container);
}

async function loadProducts(container) {
  const tableEl = document.getElementById('products-table');
  tableEl.innerHTML = '<div class="skeleton skeleton-rows"></div>';

  try {
    const { products } = await getAdminProducts({ limit: 200 });
    if (!products.length) {
      tableEl.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7"/></svg>
            </div>
            <h3>No products yet</h3>
            <p>Start building your catalog by adding your first product.</p>
            <a href="${pageUrl('admin/product-form/')}" class="btn btn-primary" style="margin-top:var(--space-4)">Add Product</a>
          </div>
        </div>
      `;
      return;
    }

    tableEl.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Product</th><th>Category</th><th>Variants</th><th>Price from</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            ${products.map(p => {
              const variants = p.product_variants || [];
              const active = variants.filter(v => v.is_active);
              const prices = active.map(v => v.price_cents).filter(Boolean);
              const minPrice = prices.length ? Math.min(...prices) : null;
              const media = (p.product_media || []).find(m => m.is_primary) || p.product_media?.[0];
              return `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:var(--space-3)">
                      ${media ? `<img src="${media.url}" alt="" style="width:40px;height:53px;object-fit:cover;border-radius:var(--radius-sm);background:var(--bg-base)">` : `<div style="width:40px;height:53px;background:var(--bg-card);border-radius:var(--radius-sm)"></div>`}
                      <div>
                        <div style="font-weight:600;font-size:var(--text-sm)">${p.name}</div>
                        <div style="font-size:var(--text-xs);color:var(--text-muted)">${p.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td style="font-size:var(--text-sm);color:var(--text-muted)">${p.categories?.name || '—'}</td>
                  <td style="font-size:var(--text-sm)">${active.length} active / ${variants.length} total</td>
                  <td style="font-weight:600;font-size:var(--text-sm)">${minPrice ? formatRWF(minPrice) : '—'}</td>
                  <td>
                    <span class="badge ${p.is_active ? 'badge-success' : 'badge-default'}">${p.is_active ? 'Active' : 'Draft'}</span>
                    ${p.is_featured ? '<span class="badge badge-info" style="margin-left:4px">Featured</span>' : ''}
                  </td>
                  <td>
                    <div style="display:flex;gap:var(--space-2)">
                      <a href="${pageUrl('admin/product-form/')}?id=${p.id}" class="btn btn-secondary btn-sm">Edit</a>
                      <button class="btn btn-ghost btn-sm delete-btn" data-id="${p.id}" data-name="${p.name}">Delete</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    tableEl.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Delete "${btn.dataset.name}"? This cannot be undone.`)) return;
        try {
          await deleteProduct(btn.dataset.id);
          toast.success('Product deleted.');
          loadProducts(container);
        } catch (err) {
          toast.error(err.message || 'Could not delete product.');
        }
      });
    });
  } catch (err) {
    console.error('loadProducts:', err);
    tableEl.innerHTML = '<p style="color:var(--text-muted)">Could not load products.</p>';
  }
}
