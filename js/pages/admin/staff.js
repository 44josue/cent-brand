import { renderAdminShell } from '../../components/admin-shell.js';
import { getStaff, updateStaffRole } from '../../lib/api.js';
import { supabase } from '../../lib/supabase.js';
import { formatDate, toast, initTheme } from '../../lib/utils.js';

initTheme();
renderAdminShell('Staff', renderPage);

async function renderPage(container) {
  container.innerHTML = `
    <div class="admin-content">
      <div class="page-header">
        <h1>Staff & Roles</h1>
        <button class="btn btn-primary btn-sm" id="invite-btn">+ Assign Role</button>
      </div>
      <p style="color:var(--text-muted);font-size:var(--text-sm);margin-bottom:var(--space-6)">
        Manage admin and ops users. Role <strong>admin</strong> has full access; <strong>ops</strong> can manage orders only.
      </p>
      <div id="staff-list"></div>

      <!-- Invite modal -->
      <div class="modal-overlay hidden" id="invite-modal">
        <div class="modal">
          <div class="modal-header">
            <h3>Assign Staff Role</h3>
            <button class="modal-close" id="invite-modal-close">✕</button>
          </div>
          <div style="padding:var(--space-6);display:flex;flex-direction:column;gap:var(--space-4)">
            <div class="input-group">
              <label class="input-label">Email *</label>
              <input type="email" class="input" id="invite-email" placeholder="user@example.com">
            </div>
            <div class="input-group">
              <label class="input-label">Role</label>
              <select class="input" id="invite-role">
                <option value="ops">ops (orders only)</option>
                <option value="admin">admin (full access)</option>
              </select>
            </div>
            <p style="font-size:var(--text-xs);color:var(--text-muted)">
              The user must already have a CENT account. Their role will be updated immediately.
            </p>
            <button class="btn btn-primary w-full" id="invite-save-btn">Update Role</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('invite-btn')?.addEventListener('click', () => {
    document.getElementById('invite-email').value = '';
    document.getElementById('invite-role').value = 'ops';
    document.getElementById('invite-modal').classList.remove('hidden');
  });
  document.getElementById('invite-modal-close')?.addEventListener('click', () => {
    document.getElementById('invite-modal').classList.add('hidden');
  });

  document.getElementById('invite-save-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('invite-email').value.trim();
    const role = document.getElementById('invite-role').value;
    if (!email) { toast.error('Email is required.'); return; }

    const btn = document.getElementById('invite-save-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (!profile) {
      toast.error('No CENT account found for that email.');
    } else {
      try {
        await updateStaffRole(profile.id, role);
        toast.success(`Role updated to "${role}".`);
        document.getElementById('invite-modal').classList.add('hidden');
        loadStaff();
      } catch (err) {
        toast.error(err.message || 'Could not update role.');
      }
    }

    btn.disabled = false; btn.textContent = 'Update Role';
  });

  loadStaff();
}

async function loadStaff() {
  const el = document.getElementById('staff-list');
  el.innerHTML = '<div class="skeleton skeleton-rows"></div>';
  try {
    const staff = await getStaff();

    if (!staff?.length) {
      el.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            </div>
            <h3>No staff assigned</h3>
            <p>Assign a role to a CENT account holder to give them admin or ops access.</p>
          </div>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Since</th><th></th></tr></thead>
          <tbody>
            ${staff.map(s => `
              <tr>
                <td data-label="Name" style="font-weight:600">${s.full_name || '—'}</td>
                <td data-label="Email" style="font-size:var(--text-sm);color:var(--text-muted)">${s.email}</td>
                <td data-label="Role"><span class="badge ${s.role === 'admin' ? 'badge-warning' : 'badge-default'}">${s.role}</span></td>
                <td data-label="Since" style="font-size:var(--text-xs);color:var(--text-muted)">${formatDate(s.created_at)}</td>
                <td data-label="Actions">
                  <button class="btn btn-ghost btn-sm demote-btn" data-id="${s.id}" style="color:var(--error)">Remove Role</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.querySelectorAll('.demote-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove staff role? They will become a regular customer.')) return;
        try {
          await updateStaffRole(btn.dataset.id, 'customer');
          toast.success('Role removed.');
          loadStaff();
        } catch (err) {
          toast.error(err.message || 'Could not remove role.');
        }
      });
    });
  } catch {
    el.innerHTML = '<p style="color:var(--text-muted)">Could not load staff.</p>';
  }
}
