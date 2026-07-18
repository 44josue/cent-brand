import { renderAdminShell } from '../../components/admin-shell.js';
import { supabase } from '../../lib/supabase.js';
import { toast, initTheme } from '../../lib/utils.js';

initTheme();
renderAdminShell('Channels', renderPage);

async function renderPage(container) {
  container.innerHTML = `
    <div class="admin-content">
      <div class="page-header">
        <h1>Payment Channels</h1>
        <button class="btn btn-primary btn-sm" id="add-channel-btn">+ Add Channel</button>
      </div>
      <p style="color:var(--text-muted);font-size:var(--text-sm);margin-bottom:var(--space-6)">
        Configure payment methods shown to customers at checkout (MTN MoMo, Airtel Money, bank transfer, etc.)
      </p>
      <div id="channels-list"></div>

      <!-- Modal -->
      <div class="modal-overlay hidden" id="channel-modal">
        <div class="modal">
          <div class="modal-header">
            <h3 id="channel-modal-title">New Channel</h3>
            <button class="modal-close" id="channel-modal-close">✕</button>
          </div>
          <div style="padding:var(--space-6);display:flex;flex-direction:column;gap:var(--space-4)">
            <input type="hidden" id="channel-edit-id">
            <div class="input-group">
              <label class="input-label">Name *</label>
              <input type="text" class="input" id="channel-name" placeholder="e.g. MTN MoMo">
            </div>
            <div class="input-group">
              <label class="input-label">Phone / Account Number</label>
              <input type="text" class="input" id="channel-number" placeholder="e.g. 0788000000">
            </div>
            <div class="input-group">
              <label class="input-label">Instructions (shown to customer)</label>
              <textarea class="input" id="channel-instructions" rows="3" placeholder="Send to 0788000000 · Include order number as reference"></textarea>
            </div>
            <div class="input-group">
              <label class="input-label">Sort Order</label>
              <input type="number" class="input" id="channel-sort" value="0" min="0">
            </div>
            <label style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer">
              <input type="checkbox" id="channel-active" checked>
              <span style="font-size:var(--text-sm)">Active (visible to customers)</span>
            </label>
            <button class="btn btn-primary w-full" id="channel-save-btn">Save</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('add-channel-btn')?.addEventListener('click', () => openModal(null));
  document.getElementById('channel-modal-close')?.addEventListener('click', closeModal);

  loadChannels();
}

async function loadChannels() {
  const el = document.getElementById('channels-list');
  el.innerHTML = '<div class="skeleton skeleton-rows"></div>';
  try {
    const { data: channels } = await supabase
      .from('payment_channels')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!channels?.length) {
      el.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
            </div>
            <h3>No payment channels</h3>
            <p>Add MTN MoMo, Airtel Money, or bank transfer to let customers pay.</p>
          </div>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Number</th><th>Instructions</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${channels.map(c => `
              <tr>
                <td data-label="Name" style="font-weight:600">${c.name}</td>
                <td data-label="Number" style="font-size:var(--text-sm);color:var(--text-muted)">${c.number || '—'}</td>
                <td data-label="Instructions" style="font-size:var(--text-xs);color:var(--text-muted);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.instructions || '—'}</td>
                <td data-label="Status"><span class="badge ${c.is_active ? 'badge-success' : 'badge-default'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <div style="display:flex;gap:var(--space-2)">
                    <button class="btn btn-secondary btn-sm edit-ch-btn" data-id="${c.id}">Edit</button>
                    <button class="btn btn-ghost btn-sm del-ch-btn" data-id="${c.id}" style="color:var(--error)">Delete</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.querySelectorAll('.edit-ch-btn').forEach(btn => {
      const ch = channels.find(c => c.id === btn.dataset.id);
      btn.addEventListener('click', () => openModal(ch));
    });
    document.querySelectorAll('.del-ch-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this channel?')) return;
        await supabase.from('payment_channels').delete().eq('id', btn.dataset.id);
        toast.success('Deleted.'); loadChannels();
      });
    });
  } catch (err) {
    console.error(err);
    el.innerHTML = '<p style="color:var(--text-muted)">Could not load channels.</p>';
  }
}

function openModal(ch) {
  document.getElementById('channel-modal-title').textContent = ch ? 'Edit Channel' : 'New Channel';
  document.getElementById('channel-edit-id').value = ch?.id || '';
  document.getElementById('channel-name').value = ch?.name || '';
  document.getElementById('channel-number').value = ch?.number || '';
  document.getElementById('channel-instructions').value = ch?.instructions || '';
  document.getElementById('channel-sort').value = ch?.sort_order ?? 0;
  document.getElementById('channel-active').checked = ch?.is_active !== false;
  document.getElementById('channel-modal').classList.remove('hidden');

  document.getElementById('channel-save-btn').onclick = async () => {
    const name = document.getElementById('channel-name').value.trim();
    if (!name) { toast.error('Name is required.'); return; }

    const btn = document.getElementById('channel-save-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

    const id = document.getElementById('channel-edit-id').value || undefined;
    const row = {
      name,
      number: document.getElementById('channel-number').value.trim() || null,
      instructions: document.getElementById('channel-instructions').value.trim() || null,
      sort_order: parseInt(document.getElementById('channel-sort').value) || 0,
      is_active: document.getElementById('channel-active').checked,
    };
    if (id) row.id = id;

    const { error } = await supabase.from('payment_channels').upsert(row);
    if (error) toast.error(error.message);
    else { toast.success('Saved!'); closeModal(); loadChannels(); }

    btn.disabled = false; btn.textContent = 'Save';
  };
}

function closeModal() {
  document.getElementById('channel-modal').classList.add('hidden');
}
