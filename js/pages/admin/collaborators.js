import { renderAdminShell } from '../../components/admin-shell.js';
import { getAdminCollaborators, upsertCollaborator, deleteCollaborator } from '../../lib/api.js';
import { toast, slugify, initTheme } from '../../lib/utils.js';
import { supabase } from '../../lib/supabase.js';

initTheme();
renderAdminShell('Collaborations', renderPage);

async function renderPage(container) {
  container.innerHTML = `
    <div class="admin-content">
      <div class="page-header">
        <div>
          <h1>Collaborations</h1>
          <p style="color:var(--text-muted);font-size:var(--text-sm);margin-top:var(--space-1)">
            CENT × Brand collections. Products can be tagged under a collab in the product form.
          </p>
        </div>
        <button class="btn btn-primary btn-sm" id="add-collab-btn">+ New Collab</button>
      </div>

      <div id="collabs-list"></div>

      <!-- Modal -->
      <div class="modal-overlay hidden" id="collab-modal">
        <div class="modal" style="max-width:560px">
          <div class="modal-header">
            <h3 id="collab-modal-title">New Collaboration</h3>
            <button class="modal-close" id="collab-modal-close">✕</button>
          </div>
          <div style="padding:var(--space-6);display:flex;flex-direction:column;gap:var(--space-4)">
            <input type="hidden" id="collab-edit-id">
            <div class="input-group">
              <label class="input-label">Collab Name * <span style="color:var(--text-muted);font-weight:400">(e.g. CENT × Kigali Roasters)</span></label>
              <input type="text" class="input" id="collab-name" placeholder="CENT × Brand Name">
            </div>
            <div class="input-group">
              <label class="input-label">Brand Name</label>
              <input type="text" class="input" id="collab-brand" placeholder="e.g. Kigali Roasters">
            </div>
            <div class="input-group">
              <label class="input-label">Slug (URL path)</label>
              <input type="text" class="input" id="collab-slug" placeholder="auto-generated">
            </div>
            <div class="input-group">
              <label class="input-label">Description</label>
              <textarea class="input" id="collab-description" rows="3" placeholder="What's this collab about?"></textarea>
            </div>
            <div class="input-group">
              <label class="input-label">Logo URL</label>
              <div style="display:flex;gap:var(--space-2)">
                <input type="url" class="input" id="collab-logo" placeholder="https://...">
                <label class="btn btn-secondary btn-sm" style="cursor:pointer;white-space:nowrap" for="collab-logo-file">Upload</label>
                <input type="file" id="collab-logo-file" accept="image/*" style="display:none">
              </div>
              <div id="collab-logo-preview" style="margin-top:var(--space-2)"></div>
            </div>
            <div class="input-group">
              <label class="input-label">Banner URL</label>
              <div style="display:flex;gap:var(--space-2)">
                <input type="url" class="input" id="collab-banner" placeholder="https://...">
                <label class="btn btn-secondary btn-sm" style="cursor:pointer;white-space:nowrap" for="collab-banner-file">Upload</label>
                <input type="file" id="collab-banner-file" accept="image/*" style="display:none">
              </div>
            </div>
            <div class="input-group">
              <label class="input-label">Sort Order</label>
              <input type="number" class="input" id="collab-sort" value="0" min="0">
            </div>
            <label style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer">
              <input type="checkbox" id="collab-active" checked>
              <span style="font-size:var(--text-sm)">Active (visible on site)</span>
            </label>
            <button class="btn btn-primary w-full" id="collab-save-btn">Save</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('add-collab-btn')?.addEventListener('click', () => openModal(null));
  document.getElementById('collab-modal-close')?.addEventListener('click', closeModal);

  document.getElementById('collab-name')?.addEventListener('input', (e) => {
    const slugEl = document.getElementById('collab-slug');
    if (!document.getElementById('collab-edit-id').value) {
      slugEl.value = slugify(e.target.value);
    }
  });

  document.getElementById('collab-logo')?.addEventListener('input', (e) => {
    const preview = document.getElementById('collab-logo-preview');
    preview.innerHTML = e.target.value
      ? `<img src="${e.target.value}" style="height:48px;border-radius:var(--radius);border:1px solid var(--border)" onerror="this.style.display='none'">`
      : '';
  });

  document.getElementById('collab-logo-file')?.addEventListener('change', (e) => {
    handleImageUpload(e.target.files[0], 'collab-logo');
  });

  document.getElementById('collab-banner-file')?.addEventListener('change', (e) => {
    handleImageUpload(e.target.files[0], 'collab-banner');
  });

  loadCollabs();
}

async function handleImageUpload(file, inputId) {
  if (!file) return;
  try {
    const ext = file.name.split('.').pop();
    const path = `collabs/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
    document.getElementById(inputId).value = publicUrl;
    if (inputId === 'collab-logo') {
      document.getElementById('collab-logo-preview').innerHTML =
        `<img src="${publicUrl}" style="height:48px;border-radius:var(--radius);border:1px solid var(--border)">`;
    }
    toast.success('Uploaded!');
  } catch (err) {
    toast.error(err.message || 'Upload failed.');
  }
}

async function loadCollabs() {
  const el = document.getElementById('collabs-list');
  el.innerHTML = '<div class="skeleton skeleton-rows"></div>';
  try {
    const collabs = await getAdminCollaborators();

    if (!collabs.length) {
      el.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            </div>
            <h3>No collaborations yet</h3>
            <p>Create a collab, then assign products to it in the product form.</p>
          </div>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Collab</th><th>Slug</th><th>Sort</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${collabs.map(c => `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:var(--space-3)">
                    ${c.logo_url ? `<img src="${c.logo_url}" style="width:32px;height:32px;object-fit:contain;border-radius:var(--radius-sm);border:1px solid var(--border)" onerror="this.style.display='none'">` : ''}
                    <div>
                      <div style="font-weight:600;font-size:var(--text-sm)">${c.name}</div>
                      ${c.brand_name ? `<div style="font-size:var(--text-xs);color:var(--text-muted)">${c.brand_name}</div>` : ''}
                    </div>
                  </div>
                </td>
                <td><span class="font-mono" style="font-size:var(--text-xs);color:var(--text-muted)">${c.slug}</span></td>
                <td style="font-size:var(--text-sm)">${c.sort_order}</td>
                <td><span class="badge ${c.is_active ? 'badge-success' : 'badge-default'}">${c.is_active ? 'Active' : 'Hidden'}</span></td>
                <td>
                  <div style="display:flex;gap:var(--space-2)">
                    <a href="/products/?collab=${c.slug}" target="_blank" class="btn btn-ghost btn-sm">View</a>
                    <button class="btn btn-secondary btn-sm edit-collab-btn" data-id="${c.id}">Edit</button>
                    <button class="btn btn-ghost btn-sm del-collab-btn" data-id="${c.id}" style="color:var(--error)">Delete</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.querySelectorAll('.edit-collab-btn').forEach(btn => {
      const c = collabs.find(x => x.id === btn.dataset.id);
      btn.addEventListener('click', () => openModal(c));
    });
    document.querySelectorAll('.del-collab-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this collaboration? Products assigned to it will have no collab tag.')) return;
        try {
          await deleteCollaborator(btn.dataset.id);
          toast.success('Deleted.'); loadCollabs();
        } catch (err) { toast.error(err.message); }
      });
    });
  } catch (err) {
    console.error(err);
    el.innerHTML = '<p style="color:var(--text-muted)">Could not load collaborations.</p>';
  }
}

function openModal(c) {
  document.getElementById('collab-modal-title').textContent = c ? 'Edit Collaboration' : 'New Collaboration';
  document.getElementById('collab-edit-id').value = c?.id || '';
  document.getElementById('collab-name').value = c?.name || '';
  document.getElementById('collab-brand').value = c?.brand_name || '';
  document.getElementById('collab-slug').value = c?.slug || '';
  document.getElementById('collab-description').value = c?.description || '';
  document.getElementById('collab-logo').value = c?.logo_url || '';
  document.getElementById('collab-banner').value = c?.banner_url || '';
  document.getElementById('collab-sort').value = c?.sort_order ?? 0;
  document.getElementById('collab-active').checked = c?.is_active !== false;
  document.getElementById('collab-logo-preview').innerHTML = c?.logo_url
    ? `<img src="${c.logo_url}" style="height:48px;border-radius:var(--radius);border:1px solid var(--border)" onerror="this.style.display='none'">`
    : '';
  document.getElementById('collab-modal').classList.remove('hidden');

  document.getElementById('collab-save-btn').onclick = async () => {
    const name = document.getElementById('collab-name').value.trim();
    const slug = document.getElementById('collab-slug').value.trim() || slugify(name);
    if (!name || !slug) { toast.error('Name is required.'); return; }

    const btn = document.getElementById('collab-save-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

    try {
      const id = document.getElementById('collab-edit-id').value || undefined;
      const row = {
        name,
        slug,
        brand_name: document.getElementById('collab-brand').value.trim() || null,
        description: document.getElementById('collab-description').value.trim() || null,
        logo_url: document.getElementById('collab-logo').value.trim() || null,
        banner_url: document.getElementById('collab-banner').value.trim() || null,
        sort_order: parseInt(document.getElementById('collab-sort').value) || 0,
        is_active: document.getElementById('collab-active').checked,
      };
      if (id) row.id = id;
      await upsertCollaborator(row);
      toast.success('Saved!');
      closeModal();
      loadCollabs();
    } catch (err) {
      toast.error(err.message || 'Could not save.');
    }

    btn.disabled = false; btn.textContent = 'Save';
  };
}

function closeModal() {
  document.getElementById('collab-modal').classList.add('hidden');
}
