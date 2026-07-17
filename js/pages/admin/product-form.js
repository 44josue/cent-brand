import { renderAdminShell } from '../../components/admin-shell.js';
import { getProductById, upsertProduct, upsertVariant, deleteVariant, deleteProductMedia, setPrimaryMedia, insertProductMedia, getVariantMedia, getCategories, getCollections, getAdminCollaborators, getRestockSubscriberCount } from '../../lib/api.js';
import { formatRWF, getParam, toast, slugify, initTheme } from '../../lib/utils.js';
import { supabase } from '../../lib/supabase.js';
import { pageUrl } from '../../lib/paths.js';

initTheme();
renderAdminShell('Product Form', renderPage);

const productId = getParam('id');

async function renderPage(container) {
  container.innerHTML = `
    <div class="admin-content">
      <div class="page-header">
        <div>
          <a href="${pageUrl('admin/products/')}" style="font-size:var(--text-sm);color:var(--text-muted);text-decoration:none">← Products</a>
          <h1>${productId ? 'Edit Product' : 'New Product'}</h1>
        </div>
        <div style="display:flex;gap:var(--space-2)">
          <button class="btn btn-secondary btn-sm" id="preview-btn">Preview</button>
          <button class="btn btn-primary btn-sm" id="save-btn">Save Product</button>
        </div>
      </div>
      <div id="form-body"><div class="skeleton skeleton-rows"></div></div>
    </div>
  `;

  const [categories, collections, collaborators] = await Promise.all([getCategories(), getCollections(), getAdminCollaborators()]);
  let product = null;
  if (productId) {
    try { product = await getProductById(productId); } catch {}
  }

  renderForm(container, product, categories, collections, collaborators);
}

function renderForm(container, product, categories, collections, collaborators = []) {
  const p = product || {};
  const variants = p.product_variants || [];
  const media = p.product_media || [];

  document.getElementById('form-body').innerHTML = `
    <div class="product-form-grid">
      <!-- Left: main fields -->
      <div>
        <div class="card" style="margin-bottom:var(--space-6)">
          <h3 style="margin-bottom:var(--space-4)">Basic Info</h3>
          <div class="input-group">
            <label class="input-label">Product Name *</label>
            <input type="text" class="input" id="pf-name" value="${p.name || ''}" placeholder="e.g. Cent Hoodie">
          </div>
          <div class="input-group" style="margin-top:var(--space-4)">
            <label class="input-label">Slug</label>
            <input type="text" class="input" id="pf-slug" value="${p.slug || ''}" placeholder="auto-generated from name">
          </div>
          <div class="input-group" style="margin-top:var(--space-4)">
            <label class="input-label">Description</label>
            <textarea class="input" id="pf-description" rows="5" placeholder="Product description...">${p.description || ''}</textarea>
          </div>
        </div>

        <!-- Variants -->
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4)">
            <h3>Variants</h3>
            <button class="btn btn-secondary btn-sm" id="add-variant-btn">+ Add Variant</button>
          </div>
          <p style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:var(--space-3)">
            ${!productId ? 'Save the product first to add variants.' : ''}
          </p>
          <div id="variants-list" style="display:flex;flex-direction:column;gap:var(--space-3)">
            ${variants.map(v => variantRow(v)).join('')}
          </div>
        </div>
      </div>

      <!-- Right: meta -->
      <div>
        <div class="card" style="margin-bottom:var(--space-6)">
          <h3 style="margin-bottom:var(--space-4)">Categorisation</h3>
          <div class="input-group">
            <label class="input-label">Category</label>
            <select class="input" id="pf-category">
              <option value="">— None —</option>
              ${categories.map(c => `<option value="${c.id}" ${p.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="input-group" style="margin-top:var(--space-4)">
            <label class="input-label">Collection</label>
            <select class="input" id="pf-collection">
              <option value="">— None —</option>
              ${collections.map(c => `<option value="${c.id}" ${p.collection_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
          ${collaborators.length ? `
          <div class="input-group" style="margin-top:var(--space-4)">
            <label class="input-label">Collaboration</label>
            <select class="input" id="pf-collaborator">
              <option value="">— None —</option>
              ${collaborators.map(c => `<option value="${c.id}" ${p.collaborator_id === c.id ? 'selected' : ''}>${c.name}${c.brand_name ? ` × ${c.brand_name}` : ''}</option>`).join('')}
            </select>
          </div>` : ''}
        </div>

        <div class="card">
          <h3 style="margin-bottom:var(--space-4)">Settings</h3>
          <label style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer;margin-bottom:var(--space-4)">
            <label class="toggle">
              <input type="checkbox" id="pf-active-check" ${p.is_active !== false ? 'checked' : ''}>
              <div class="toggle-track"><div class="toggle-thumb"></div></div>
            </label>
            <span style="font-size:var(--text-sm)">Active (visible on store)</span>
          </label>
          <label style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer">
            <label class="toggle">
              <input type="checkbox" id="pf-featured-check" ${p.is_featured ? 'checked' : ''}>
              <div class="toggle-track"><div class="toggle-thumb"></div></div>
            </label>
            <span style="font-size:var(--text-sm)">Featured on home page</span>
          </label>
        </div>
      </div>
    </div>
  `;

  // Auto-slug from name
  document.getElementById('pf-name')?.addEventListener('input', (e) => {
    if (!product) document.getElementById('pf-slug').value = slugify(e.target.value);
  });

  // Add variant
  document.getElementById('add-variant-btn')?.addEventListener('click', () => {
    if (!getParam('id')) { toast.error('Save the product first before adding variants.'); return; }
    const list = document.getElementById('variants-list');
    const tempId = 'new-' + Date.now();
    const div = document.createElement('div');
    div.innerHTML = variantRow({ id: tempId, size: '', color: '', price_cents: '', stock: 0, is_active: true });
    const row = div.firstElementChild;
    list.appendChild(row);
    bindVariantRow(row);
  });

  // Bind existing variant rows
  document.querySelectorAll('.variant-row').forEach(row => bindVariantRow(row));

  // Save button
  document.getElementById('save-btn')?.addEventListener('click', saveProduct);

  // Preview
  document.getElementById('preview-btn')?.addEventListener('click', () => {
    if (product?.slug) window.open(`${pageUrl('product/')}?slug=${product.slug}`, '_blank');
    else toast.info('Save the product first to preview it.');
  });
}



function variantRow(v) {
  const isNew = String(v.id).startsWith('new-');
  return `
    <div class="variant-row" data-id="${v.id}" style="display:flex;flex-direction:column;gap:0;padding:0;border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;background:var(--bg-card)">

      <!-- Fields row -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1.2fr 0.7fr auto;gap:0;border-bottom:1px solid var(--border)">
        <input type="text" class="input vr-size" placeholder="Size" value="${v.size || ''}"
          style="border:none;border-right:1px solid var(--border);border-radius:0;font-size:var(--text-sm)">
        <input type="text" class="input vr-color" placeholder="Color" value="${v.color || ''}"
          style="border:none;border-right:1px solid var(--border);border-radius:0;font-size:var(--text-sm)">
        <input type="number" class="input vr-price" placeholder="Price (RWF)" value="${v.price_cents ? Math.round(v.price_cents / 100) : ''}"
          style="border:none;border-right:1px solid var(--border);border-radius:0;font-size:var(--text-sm)">
        <input type="number" class="input vr-stock" placeholder="Qty" value="${v.stock ?? 0}" min="0"
          style="border:none;border-right:1px solid var(--border);border-radius:0;font-size:var(--text-sm)">
        <label style="display:flex;align-items:center;gap:6px;padding:0 var(--space-3);font-size:var(--text-xs);white-space:nowrap;cursor:pointer">
          <input type="checkbox" class="vr-active" ${v.is_active !== false ? 'checked' : ''}> Active
        </label>
      </div>

      <!-- Actions row -->
      <div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-3);background:var(--bg-surface)">
        <button class="btn btn-primary btn-sm vr-save-btn" style="min-width:64px">Save</button>
        ${!isNew ? `
          <button class="btn btn-secondary btn-sm vr-media-btn" style="gap:4px;display:flex;align-items:center">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
            Images
          </button>
        ` : ''}
        <span class="vr-notify-badge" style="font-size:10px;color:var(--warning);flex:1"></span>
        ${!isNew ? `<button class="btn btn-ghost btn-sm vr-delete-btn" style="color:var(--error);margin-left:auto">Delete</button>` : ''}
      </div>

      <!-- Media panel (hidden by default) -->
      ${!isNew ? `
        <div class="vr-media-panel" style="display:none;padding:var(--space-3);border-top:1px solid var(--border);background:var(--bg-base)">
          <div style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:var(--space-3)">
            Variant photos — up to 5 images + 1 video. Selecting this variant on the product page will show these images.
          </div>
          <div class="vr-media-grid" style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-bottom:var(--space-3)"></div>
          <label class="btn btn-secondary btn-sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            Add Media
            <input type="file" class="vr-file-input" accept="image/*,video/mp4,video/webm,video/quicktime" multiple style="display:none">
          </label>
        </div>
      ` : ''}

    </div>
  `;
}

function bindVariantRow(row) {
  if (!row) return;
  row.querySelector('.vr-save-btn')?.addEventListener('click', async () => {
    const id = row.dataset.id;
    const isNew = id.startsWith('new-');
    const pid = getParam('id');
    if (!pid) { toast.error('Save the product first.'); return; }

    const saveBtn = row.querySelector('.vr-save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span>';

    const data = {
      product_id: pid,
      size: row.querySelector('.vr-size').value.trim() || null,
      color: row.querySelector('.vr-color').value.trim() || null,
      price_cents: Math.round((parseFloat(row.querySelector('.vr-price').value) || 0) * 100),
      stock: parseInt(row.querySelector('.vr-stock').value) || 0,
      is_active: row.querySelector('.vr-active').checked,
    };
    if (!isNew) data.id = id;

    try {
      const saved = await upsertVariant(data);
      // Update data-id so subsequent saves update the same row
      if (isNew && saved?.id) {
        row.dataset.id = saved.id;
        // Add delete button now that row is persisted
        if (!row.querySelector('.vr-delete-btn')) {
          const del = document.createElement('button');
          del.className = 'btn btn-ghost btn-sm vr-delete-btn';
          del.style.color = 'var(--error)';
          del.textContent = '✕';
          row.querySelector('.vr-notify-badge').before(del);
          row.querySelector('.vr-delete-btn').addEventListener('click', async () => {
            if (!confirm('Delete this variant?')) return;
            try { await deleteVariant(row.dataset.id); row.remove(); toast.success('Deleted.'); }
            catch (err) { toast.error(err.message || 'Could not delete.'); }
          });
        }
      }
      toast.success('Variant saved.');
      if (data.stock === 0) {
        const count = await getRestockSubscriberCount(row.dataset.id).catch(() => 0);
        const badge = row.querySelector('.vr-notify-badge');
        if (badge && count > 0) badge.textContent = `${count} waiting`;
      }
    } catch (err) {
      toast.error(err.message || 'Could not save variant.');
    }
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
  });

  row.querySelector('.vr-delete-btn')?.addEventListener('click', async () => {
    if (!confirm('Delete this variant?')) return;
    try { await deleteVariant(row.dataset.id); row.remove(); toast.success('Deleted.'); }
    catch (err) { toast.error(err.message || 'Could not delete.'); }
  });

  // Media panel toggle
  const mediaBtn = row.querySelector('.vr-media-btn');
  const mediaPanel = row.querySelector('.vr-media-panel');
  if (mediaBtn && mediaPanel) {
    mediaBtn.addEventListener('click', async () => {
      const open = mediaPanel.style.display !== 'none';
      mediaPanel.style.display = open ? 'none' : 'block';
      if (!open) await loadVariantMedia(row, mediaPanel);
    });

    row.querySelector('.vr-file-input')?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      const variantId = row.dataset.id;
      const pid = getParam('id');
      const grid = mediaPanel.querySelector('.vr-media-grid');

      const existingCount = grid.querySelectorAll('.image-thumb').length;
      const existingVideos = grid.querySelectorAll('[data-type="video"]').length;
      let imgCount = existingCount - existingVideos;
      let vidCount = existingVideos;

      for (const file of files) {
        const isVideo = file.type.startsWith('video/');
        if (isVideo && vidCount >= 1) { toast.error('Max 1 video per variant.'); continue; }
        if (!isVideo && imgCount >= 5) { toast.error('Max 5 images per variant.'); continue; }
        toast.info(`Uploading ${file.name}...`);
        try {
          const ext = file.name.split('.').pop();
          const folder = isVideo ? 'videos' : 'images';
          const path = `products/${pid}/variants/${variantId}/${folder}/${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
          if (upErr) throw upErr;
          const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
          await insertProductMedia({ product_id: pid, variant_id: variantId, url: publicUrl, is_primary: false, sort_order: 99 });
          if (isVideo) vidCount++; else imgCount++;
          toast.success(`Uploaded!`);
        } catch (err) {
          toast.error(err.message || 'Upload failed.');
        }
      }
      e.target.value = '';
      await loadVariantMedia(row, mediaPanel);
    });
  }
}

async function loadVariantMedia(row, panel) {
  const grid = panel.querySelector('.vr-media-grid');
  if (!grid) return;
  try {
    const media = await getVariantMedia(row.dataset.id);
    grid.innerHTML = media.length ? media.map(m => {
      const isVideo = m.url?.match(/\.(mp4|webm|mov)$/i);
      return `
        <div class="image-thumb" data-id="${m.id}" ${isVideo ? 'data-type="video"' : ''} style="position:relative;width:72px;height:96px;border-radius:var(--radius);overflow:hidden;background:var(--bg-card)">
          ${isVideo
            ? `<video src="${m.url}" style="width:100%;height:100%;object-fit:cover" muted></video>
               <div style="position:absolute;top:2px;left:2px;background:rgba(0,0,0,.7);color:#fff;font-size:9px;padding:1px 4px;border-radius:3px">VIDEO</div>`
            : `<img src="${m.url}" style="width:100%;height:100%;object-fit:cover" loading="lazy">`}
          <button class="vr-media-del" data-id="${m.id}" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>
        </div>`;
    }).join('') : '<span style="font-size:var(--text-xs);color:var(--text-muted)">No media yet</span>';

    grid.querySelectorAll('.vr-media-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        try { await deleteProductMedia(btn.dataset.id); await loadVariantMedia(row, panel); }
        catch (err) { toast.error(err.message || 'Could not delete.'); }
      });
    });
  } catch (err) {
    grid.innerHTML = '<span style="font-size:var(--text-xs);color:var(--error)">Could not load media.</span>';
  }
}


async function uploadMedia(file, productId) {
  try {
    const ext = file.name.split('.').pop();
    const isVideo = file.type.startsWith('video');
    const folder = isVideo ? 'videos' : 'images';
    const path = `products/${productId}/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
    await insertProductMedia({ product_id: productId, url: publicUrl, is_primary: false, sort_order: 99 });
    toast.success(`${isVideo ? 'Video' : 'Image'} uploaded.`);
  } catch (err) {
    toast.error(err.message || 'Upload failed.');
  }
}

async function saveProduct() {
  const name = document.getElementById('pf-name').value.trim();
  const slug = document.getElementById('pf-slug').value.trim() || slugify(name);
  const description = document.getElementById('pf-description').value.trim();
  const category_id = document.getElementById('pf-category').value || null;
  const collection_id = document.getElementById('pf-collection').value || null;
  const collaborator_id = document.getElementById('pf-collaborator')?.value || null;
  const is_active = document.getElementById('pf-active-check')?.checked ?? true;
  const is_featured = document.getElementById('pf-featured-check')?.checked ?? false;

  if (!name) { toast.error('Product name is required.'); return; }

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const data = { name, slug, description, category_id, collection_id, collaborator_id, is_active, is_featured };
    if (productId) data.id = productId;
    const saved = await upsertProduct(data);
    const savedId = saved?.id || productId;

    toast.success('Product saved!');
    if (!productId && savedId) {
      window.location.href = `${pageUrl('admin/product-form/')}?id=${savedId}`;
    } else {
      btn.disabled = false;
      btn.textContent = 'Save Product';
    }
  } catch (err) {
    toast.error(err.message || 'Could not save product.');
    btn.disabled = false;
    btn.textContent = 'Save Product';
  }
}
