import { renderAdminShell } from '../../components/admin-shell.js';
import { getAdminProfiles, getAdminGuestCustomers, callEdge } from '../../lib/api.js';
import { formatDate, initTheme, toast } from '../../lib/utils.js';
import { supabase } from '../../lib/supabase.js';

initTheme();
renderAdminShell('Customers', renderPage);

async function renderPage(container) {
  container.innerHTML = `
    <div class="admin-content">
      <div class="page-header">
        <h1>Customers</h1>
        <input type="search" class="input input-sm" id="customer-search" placeholder="Search name or email..." style="width:240px">
      </div>

      <h3 style="font-size:var(--text-base);font-weight:600;margin-bottom:var(--space-3);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em;font-size:var(--text-xs)">Registered Accounts</h3>
      <div id="profiles-table" style="margin-bottom:var(--space-10)"></div>

      <h3 style="font-size:var(--text-xs);font-weight:600;margin-bottom:var(--space-3);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em">Guest Customers</h3>
      <div id="guests-table"></div>
    </div>
  `;

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
    renderProfiles(allProfiles, document.getElementById('profiles-table'), me?.id, bannedIds);
    renderGuests(allGuests, document.getElementById('guests-table'));
  } catch (err) {
    container.querySelector('#profiles-table').innerHTML = '<p style="color:var(--text-muted)">Could not load customers.</p>';
  }

  document.getElementById('customer-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderProfiles(allProfiles.filter(p =>
      (p.full_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q)
    ), document.getElementById('profiles-table'), me?.id, bannedIds);
    renderGuests(allGuests.filter(g =>
      (g.guest_name || '').toLowerCase().includes(q) || (g.guest_email || '').toLowerCase().includes(q)
    ), document.getElementById('guests-table'));
  });
}

function renderProfiles(profiles, container, myId, bannedIds) {
  if (!profiles.length) {
    container.innerHTML = `<div class="card"><p style="color:var(--text-muted);font-size:var(--text-sm)">No registered accounts found.</p></div>`;
    return;
  }
  const roleBadge = (role) => {
    const map = { admin: 'badge-error', ops: 'badge-warning', customer: 'badge-default' };
    return `<span class="badge ${map[role] || 'badge-default'}">${role || 'customer'}</span>`;
  };
  container.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Joined</th><th></th></tr></thead>
        <tbody>
          ${profiles.map(p => {
            const isSelf = p.id === myId;
            const isAdmin = p.role === 'admin';
            const isBanned = bannedIds.has(p.id);
            const actions = (isSelf || isAdmin) ? '' : `
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
              <td data-label="" style="display:flex;gap:var(--space-2);justify-content:flex-end">${actions}</td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
    </div>`;

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
    container.innerHTML = `<div class="card"><p style="color:var(--text-muted);font-size:var(--text-sm)">No guest orders yet.</p></div>`;
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
              <td data-label="Role"><span class="badge badge-default">Guest</span></td>
              <td data-label="Joined" style="font-size:var(--text-xs);color:var(--text-muted)">${formatDate(g.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}
