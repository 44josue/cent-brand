import { renderAdminShell } from '../../components/admin-shell.js';
import { getAdminProfiles, getAdminGuestCustomers } from '../../lib/api.js';
import { formatDate, initTheme } from '../../lib/utils.js';

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

  let allProfiles = [], allGuests = [];

  try {
    const [profilesRes, guests] = await Promise.all([
      getAdminProfiles(),
      getAdminGuestCustomers(),
    ]);
    allProfiles = profilesRes.profiles || [];
    allGuests = guests;
    renderProfiles(allProfiles, document.getElementById('profiles-table'));
    renderGuests(allGuests, document.getElementById('guests-table'));
  } catch (err) {
    container.querySelector('#profiles-table').innerHTML = '<p style="color:var(--text-muted)">Could not load customers.</p>';
  }

  document.getElementById('customer-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderProfiles(allProfiles.filter(p =>
      (p.full_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q)
    ), document.getElementById('profiles-table'));
    renderGuests(allGuests.filter(g =>
      (g.guest_name || '').toLowerCase().includes(q) || (g.guest_email || '').toLowerCase().includes(q)
    ), document.getElementById('guests-table'));
  });
}

function renderProfiles(profiles, container) {
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
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Joined</th></tr></thead>
        <tbody>
          ${profiles.map(p => `
            <tr>
              <td style="font-weight:600;font-size:var(--text-sm)">${p.full_name || '—'}</td>
              <td style="font-size:var(--text-sm)">${p.email || '—'}</td>
              <td style="font-size:var(--text-sm);color:var(--text-muted)">${p.phone || '—'}</td>
              <td>${roleBadge(p.role)}</td>
              <td style="font-size:var(--text-xs);color:var(--text-muted)">${formatDate(p.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
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
              <td style="font-weight:600;font-size:var(--text-sm)">${g.guest_name || '—'}</td>
              <td style="font-size:var(--text-sm)">${g.guest_email || '—'}</td>
              <td style="font-size:var(--text-sm);color:var(--text-muted)">${g.guest_phone || '—'}</td>
              <td><span class="badge badge-default">Guest</span></td>
              <td style="font-size:var(--text-xs);color:var(--text-muted)">${formatDate(g.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}
