import { renderAdminShell } from '../../components/admin-shell.js';
import { getAdminProfiles, getAdminGuestCustomers, callEdge } from '../../lib/api.js';
import { formatDate, initTheme, toast } from '../../lib/utils.js';
import { supabase } from '../../lib/supabase.js';

initTheme();
renderAdminShell('Users', renderPage);

async function renderPage(container) {
  container.innerHTML = `
    <div class="admin-content">
      <div class="page-header">
        <h1>Users</h1>
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
          <input type="search" class="input input-sm" id="customer-search" placeholder="Search name or email..." style="width:220px">
          <select class="input input-sm" id="role-filter" style="width:130px">
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="ops">Ops</option>
            <option value="customer">Customer</option>
          </select>
          <select class="input input-sm" id="status-filter" style="width:130px">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>
        </div>
      </div>

      <h3 style="font-size:var(--text-base);font-weight:600;margin-bottom:var(--space-3);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em;font-size:var(--text-xs)">Registered Accounts</h3>
      <div id="profiles-table" style="margin-bottom:var(--space-10)"></div>

      <h3 style="font-size:var(--text-xs);font-weight:600;margin-bottom:var(--space-3);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em;display:flex;align-items:center;gap:var(--space-2)">
        One-Time Customers
        <span class="tooltip-trigger" tabindex="0" style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;background:var(--bg-card);border:1px solid var(--border);color:var(--text-muted);font-size:10px;cursor:help;text-transform:none;letter-spacing:normal;font-weight:700">
          ?
          <span class="tooltip-body" style="display:none;position:absolute;bottom:130%;left:50%;transform:translateX(-50%);width:240px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:var(--space-3);font-size:var(--text-xs);color:var(--text-secondary);box-shadow:var(--shadow-lg);z-index:10;line-height:1.5">These are people who checked out without creating an account. There's no login to ban or promote — the only record is the shipping/contact info from their order(s), kept for order history and support.</span>
        </span>
      </h3>
      <div id="guests-table"></div>
    </div>
  `;

  const tooltipTrigger = container.querySelector('.tooltip-trigger');
  const tooltipBody = tooltipTrigger?.querySelector('.tooltip-body');
  if (tooltipTrigger && tooltipBody) {
    const show = () => { tooltipBody.style.display = 'block'; };
    const hide = () => { tooltipBody.style.display = 'none'; };
    tooltipTrigger.addEventListener('mouseenter', show);
    tooltipTrigger.addEventListener('mouseleave', hide);
    tooltipTrigger.addEventListener('focus', show);
    tooltipTrigger.addEventListener('blur', hide);
  }

  let allProfiles = [], allGuests = [], bannedIds = new Set();
  const { data: { user: me } } = await supabase.auth.getUser();

  try {
    const [profilesRes, guests, statusRes] = await Promise.all([
      getAdminProfiles(),
      getAdminGuestCustomers(),
      callEdge('admin-manage-user', { action: 'list_status' }).catch(() => ({ statuses: {} })),
    ]);
    allProfiles = profilesRes.profiles || [];
    allGuests = guests;
    bannedIds = new Set(Object.entries(statusRes.statuses || {}).filter(([, v]) => v).map(([id]) => id));
    applyFilters();
  } catch (err) {
    container.querySelector('#profiles-table').innerHTML = '<p style="color:var(--text-muted)">Could not load customers.</p>';
  }

  function applyFilters() {
    const q = (document.getElementById('customer-search')?.value || '').toLowerCase();
    const role = document.getElementById('role-filter')?.value || '';
    const status = document.getElementById('status-filter')?.value || '';

    const filteredProfiles = allProfiles.filter(p => {
      if (q && !((p.full_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q))) return false;
      if (role && (p.role || 'customer') !== role) return false;
      const isBanned = bannedIds.has(p.id);
      if (status === 'active' && isBanned) return false;
      if (status === 'banned' && !isBanned) return false;
      return true;
    });
    renderProfiles(filteredProfiles, document.getElementById('profiles-table'), me?.id, bannedIds);

    // Guests have no role/ban status — a role or status filter simply excludes them all.
    const filteredGuests = (role || status) ? [] : allGuests.filter(g =>
      (g.guest_name || '').toLowerCase().includes(q) || (g.guest_email || '').toLowerCase().includes(q)
    );
    renderGuests(filteredGuests, document.getElementById('guests-table'));
  }

  document.getElementById('customer-search')?.addEventListener('input', applyFilters);
  document.getElementById('role-filter')?.addEventListener('change', applyFilters);
  document.getElementById('status-filter')?.addEventListener('change', applyFilters);
}

function renderProfiles(profiles, container, myId, bannedIds) {
  if (!profiles.length) {
    container.innerHTML = `<div class="card"><p style="color:var(--text-muted);font-size:var(--text-sm)">No matching accounts found.</p></div>`;
    return;
  }
  const roleBadge = (role) => {
    const map = { admin: 'badge-error', ops: 'badge-warning', customer: 'badge-default' };
    return `<span class="badge ${map[role] || 'badge-default'}">${role || 'customer'}</span>`;
  };
  container.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Joined</th><th>Action</th></tr></thead>
        <tbody>
          ${profiles.map(p => {
            const isSelf = p.id === myId;
            const isAdmin = p.role === 'admin';
            const isBanned = bannedIds.has(p.id);
            const roleActions = isSelf ? '' : (isAdmin
              ? `<button class="btn btn-ghost btn-sm cust-role-btn" data-id="${p.id}" data-action="demote">Make Customer</button>`
              : `<button class="btn btn-ghost btn-sm cust-role-btn" data-id="${p.id}" data-action="promote">Make Admin</button>`);
            const banDeleteActions = (isSelf || isAdmin) ? '' : `
              <button class="btn btn-ghost btn-sm cust-ban-btn" data-id="${p.id}" data-action="${isBanned ? 'unban' : 'ban'}">${isBanned ? 'Unban' : 'Ban'}</button>
              <button class="btn btn-ghost btn-sm cust-delete-btn" data-id="${p.id}" data-name="${p.full_name || p.email || 'this account'}" style="color:var(--error)">Delete</button>
            `;
            return `
            <tr>
              <td data-label="Name" style="font-weight:600;font-size:var(--text-sm)">${p.full_name || '—'} ${isBanned ? '<span class="badge badge-error" style="margin-left:6px">Banned</span>' : ''}</td>
              <td data-label="Email" style="font-size:var(--text-sm)">${p.email || '—'}</td>
              <td data-label="Phone" style="font-size:var(--text-sm);color:var(--text-muted)">${p.phone || '—'}</td>
              <td data-label="Role">${roleBadge(p.role)}</td>
              <td data-label="Joined" style="font-size:var(--text-xs);color:var(--text-muted)">${formatDate(p.created_at)}</td>
              <td data-label="Action" style="display:flex;gap:var(--space-2);justify-content:flex-end;flex-wrap:wrap">${roleActions}${banDeleteActions}</td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  container.querySelectorAll('.cust-role-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const verb = action === 'promote' ? 'make this user an admin' : 'remove admin access from this user';
      if (!confirm(`Are you sure you want to ${verb}?`)) return;
      btn.disabled = true;
      try {
        await callEdge('admin-manage-user', { userId: btn.dataset.id, action });
        toast.success(action === 'promote' ? 'User is now an admin.' : 'User is now a regular customer.');
        window.location.reload();
      } catch (err) {
        toast.error(err.message || 'Could not update role.');
        btn.disabled = false;
      }
    });
  });

  container.querySelectorAll('.cust-ban-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      btn.disabled = true;
      try {
        await callEdge('admin-manage-user', { userId: btn.dataset.id, action });
        toast.success(action === 'ban' ? 'Account banned.' : 'Account unbanned.');
        btn.textContent = action === 'ban' ? 'Unban' : 'Ban';
        btn.dataset.action = action === 'ban' ? 'unban' : 'ban';
        const nameCell = btn.closest('tr').querySelector('td');
        if (action === 'ban' && !nameCell.querySelector('.badge-error')) {
          nameCell.insertAdjacentHTML('beforeend', ' <span class="badge badge-error" style="margin-left:6px">Banned</span>');
        } else if (action === 'unban') {
          nameCell.querySelector('.badge-error')?.remove();
        }
      } catch (err) {
        toast.error(err.message || 'Could not update account.');
      }
      btn.disabled = false;
    });
  });

  container.querySelectorAll('.cust-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Permanently delete ${btn.dataset.name}'s account? This cannot be undone.`)) return;
      btn.disabled = true;
      try {
        await callEdge('admin-manage-user', { userId: btn.dataset.id, action: 'delete' });
        toast.success('Account deleted.');
        btn.closest('tr').remove();
      } catch (err) {
        toast.error(err.message || 'Could not delete account.');
        btn.disabled = false;
      }
    });
  });
}

function renderGuests(guests, container) {
  if (!guests.length) {
    container.innerHTML = `<div class="card"><p style="color:var(--text-muted);font-size:var(--text-sm)">No orders yet.</p></div>`;
    return;
  }
  container.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Type</th><th>Date</th></tr></thead>
        <tbody>
          ${guests.map(g => `
            <tr>
              <td data-label="Name" style="font-weight:600;font-size:var(--text-sm)">${g.guest_name || '—'}</td>
              <td data-label="Email" style="font-size:var(--text-sm)">${g.guest_email || '—'}</td>
              <td data-label="Phone" style="font-size:var(--text-sm);color:var(--text-muted)">${g.guest_phone || '—'}</td>
              <td data-label="Role"><span class="badge badge-default">Customer</span></td>
              <td data-label="Joined" style="font-size:var(--text-xs);color:var(--text-muted)">${formatDate(g.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}
