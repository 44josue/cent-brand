import { renderAdminShell } from '../../components/admin-shell.js';
import { getAdminCollections, upsertCollection, deleteCollection } from '../../lib/api.js';
import { toast, slugify, initTheme } from '../../lib/utils.js';

initTheme();
renderAdminShell('Collections', renderPage);

async function renderPage(container) {
  container.innerHTML = `
    <div class="admin-content">
      <div class="page-header">
        <h1>Collections</h1>
        <button class="btn btn-primary btn-sm" id="add-collection-btn">+ New Collection</button>
      </div>
      <div id="collections-list"></div>

      <div class="modal-overlay hidden" id="collection-modal">
        <div class="modal" style="max-width:480px">
          <div class="modal-header">
            <h3 id="collection-modal-title">New Collection</h3>
            <button class="modal-close" id="collection-modal-close">✕</button>
          </div>
          <div style="padding:var(--space-6);display:flex;flex-direction:column;gap:var(--space-4)">
            <input type="hidden" id="collection-edit-id">
            <div class="input-group">
              <label class="input-label">Name *</label>
              <input type="text" class="input" id="collection-name" placeholder="e.g. Summer Drop 2026">
            </div>
            <div class="input-group">
              <label class="input-label">Slug</label>
              <input type="text" class="input" id="collection-slug" placeholder="auto-generated">
            </div>
            <div class="input-group">
              <label class="input-label">Description</label>
              <textarea class="input" id="collection-desc" rows="3" placeholder="Optional description shown on the collection page"></textarea>
            </div>
            <label style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer">
              <input type="checkbox" id="collection-active" checked>
              <span style="font-size:var(--text-sm)">Active (visible on storefront)</span>
            </label>
            <button class="btn btn-primary w-full" id="collection-save-btn">Save Collection</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('add-collection-btn')?.addEventListener('click', () => openModal(null));
  document.getElementById('collection-modal-close')?.addEventListener('click', () => closeModal());
  document.getElementById('collection-name')?.addEventListener('input', (e) => {
    const slugEl = document.getElementById('collection-slug');
    if (!document.getElementById('collection-edit-id').value) {
      slugEl.value = slugify(e.target.value);
    }
  });

  loadCollections();
}

function openModal(collection) {
  document.getElementById('collection-modal-title').textContent = collection ? 'Edit Collection' : 'New Collection';
  document.getElementById('collection-edit-id').value = collection?.id || '';
  document.getElementById('collection-name').value = collection?.name || '';
  document.getElementById('collection-slug').value = collection?.slug || '';
  document.getElementById('collection-desc').value = collection?.description || '';
  document.getElementById('collection-active').checked = collection?.is_active !== false;
  document.getElementById('collection-modal').classList.remove('hidden');

  document.getElementById('collection-save-btn').onclick = async () => {
    const name = document.getElementById('collection-name').value.trim();
    const slug = document.getElementById('collection-slug').value.trim() || slugify(name);
    const description = document.getElementById('collection-desc').value.trim() || null;
    const is_active = document.getElementById('collection-active').checked;
    const id = document.getElementById('collection-edit-id').value || undefined;

    if (!name) { toast.error('Name is required.'); return; }

    const btn = document.getElementById('collection-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      const row = { name, slug, description, is_active };
      if (id) row.id = id;
      await upsertCollection(row);
      toast.success('Collection saved!');
      closeModal();
      loadCollections();
    } catch (err) {
      toast.error(err.message || 'Could not save collection.');
    }
    btn.disabled = false;
    btn.textContent = 'Save Collection';
  };
}

function closeModal() {
  document.getElementById('collection-modal').classList.add('hidden');
}

async function loadCollections() {
  const el = document.getElementById('collections-list');
  el.innerHTML = '<div class="skeleton skeleton-rows"></div>';

  try {
    const collections = await getAdminCollections();

    if (!collections.length) {
      el.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            </div>
            <h3>No collections yet</h3>
            <p>Create a collection like "Summer Drop 2026" then assign products to it.</p>
          </div>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>Name</th><th>Slug</th><th>Description</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            ${collections.map(c => `
              <tr>
                <td data-label="Name" style="font-weight:600;font-size:var(--text-sm)">${c.name}</td>
                <td data-label="Slug" style="font-size:var(--text-xs);color:var(--text-muted);font-family:var(--font-mono)">${c.slug}</td>
                <td data-label="Description" style="font-size:var(--text-xs);color:var(--text-muted);max-width:220px">${c.description || '—'}</td>
                <td data-label="Status"><span class="badge ${c.is_active ? 'badge-success' : 'badge-default'}">${c.is_active ? 'Active' : 'Hidden'}</span></td>
                <td>
                  <div style="display:flex;gap:var(--space-2)">
                    <button class="btn btn-secondary btn-sm edit-btn" data-id="${c.id}">Edit</button>
                    <button class="btn btn-ghost btn-sm delete-btn" data-id="${c.id}" style="color:var(--error)">✕</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;

    document.querySelectorAll('.edit-btn').forEach(btn => {
      const col = collections.find(c => c.id === btn.dataset.id);
      btn.addEventListener('click', () => openModal(col));
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this collection? Products assigned to it will not be deleted.')) return;
        try {
          await deleteCollection(btn.dataset.id);
          toast.success('Collection deleted.');
          loadCollections();
        } catch (err) {
          toast.error(err.message || 'Could not delete.');
        }
      });
    });
  } catch (err) {
    el.innerHTML = '<p style="color:var(--text-muted)">Could not load collections.</p>';
  }
}
