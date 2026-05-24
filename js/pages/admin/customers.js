import { renderAdminShell } from '../../components/admin-shell.js';
import { getAdminProfiles } from '../../lib/api.js';
import { formatDate, initTheme } from '../../lib/utils.js';

initTheme();
renderAdminShell('Customers', renderPage);

async function renderPage(container) {
  container.innerHTML = `
    <div class="admin-content">
      <div class="page-header">
        <h1>Users</h1>
        <div style="display:flex;gap:var(--space-2)">
          <input type="search" class="input input-sm" id="customer-search" placeholder="Search by name or email..." style="width:240px">
        </div>
      </div>
      <div id="customers-table"></div>
    </div>
  `;

  let allProfiles = [];

  try {
    const result = await getAdminProfiles();
    allProfiles = result.profiles || [];
    renderTable(allProfiles, document.getElementById('customers-table'));
  } catch (err) {
    document.getElementById('customers-table').innerHTML = '<p style="color:var(--text-muted)">Could not load users.</p>';
  }

  document.getElementById('customer-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allProfiles.filter(p =>
      (p.full_name || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q)
    );
    renderTable(filtered, document.getElementById('customers-table'));
  });
}

function renderTable(profiles, container) {
  if (!profiles.length) {
    container.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </div>
          <h3>No users yet</h3>
          <p>Everyone who creates an account will appear here.</p>
        </div>
      </div>
    `;
    return;
  }

  const roleBadge = (role) => {
    const map = { admin: 'badge-error', ops: 'badge-warning', customer: 'badge-default' };
    return `<span class="badge ${map[role] || 'badge-default'}">${role || 'customer'}</span>`;
  };

  container.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Joined</th>
        </tr></thead>
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
    </div>
  `;
}
