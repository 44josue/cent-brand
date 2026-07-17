import { renderAdminShell } from '../../components/admin-shell.js';
import { getDashboardStats, getAdminOrders } from '../../lib/api.js';
import { formatRWF, formatDate, statusBadge, shortToken, initTheme } from '../../lib/utils.js';
import { pageUrl } from '../../lib/paths.js';

initTheme();

renderAdminShell('Dashboard', renderPage);

async function renderPage(container) {
  container.innerHTML = `
    <div class="admin-content">
      <div class="page-header" style="margin-bottom:var(--space-6)">
        <div>
          <h1>Dashboard</h1>
          <p style="font-size:var(--text-sm);color:var(--text-muted);margin-top:var(--space-1)">${new Date().toLocaleDateString('en-RW', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
        </div>
      </div>

      <div id="stats-grid" class="stats-grid">
        ${[0,1,2,3].map(() => `
          <div class="stat-card">
            <div class="skeleton" style="width:36px;height:36px;border-radius:var(--radius);margin-bottom:var(--space-4)"></div>
            <div class="skeleton skeleton-text" style="width:50%;margin-bottom:var(--space-2)"></div>
            <div class="skeleton skeleton-text" style="width:70%;height:2rem"></div>
          </div>
        `).join('')}
      </div>

      <div style="margin-top:var(--space-8)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4)">
          <h2 style="font-size:var(--text-xl)">Recent Orders</h2>
          <a href="${pageUrl('admin/orders/')}" class="btn btn-secondary btn-sm">View All</a>
        </div>
        <div id="recent-orders">
          <div class="skeleton skeleton-rows" style="border-radius:var(--radius-lg)"></div>
        </div>
      </div>
    </div>
  `;

  loadStats();
  loadRecentOrders();
}

async function loadStats() {
  try {
    const stats = await getDashboardStats();
    const pending = stats.pendingOrders || 0;

    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card">
        <div class="stat-card-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <div class="stat-label">Total Revenue</div>
        <div class="stat-value">${formatRWF(stats.totalRevenueCents || 0)}</div>
        <div class="stat-sub">From verified payments</div>
      </div>

      <div class="stat-card">
        <div class="stat-card-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        </div>
        <div class="stat-label">Total Orders</div>
        <div class="stat-value">${stats.totalOrders || 0}</div>
        <div class="stat-sub">All time</div>
      </div>

      <div class="stat-card">
        <div class="stat-card-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        </div>
        <div class="stat-label">Customers</div>
        <div class="stat-value">${stats.totalCustomers || 0}</div>
        <div class="stat-sub">Registered accounts</div>
      </div>

      <div class="stat-card ${pending > 0 ? 'stat-card-alert' : ''}">
        <div class="stat-card-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        </div>
        <div class="stat-label">Awaiting Verification</div>
        <div class="stat-value">${pending}</div>
        <div class="stat-sub">${pending > 0
          ? `<a href="${pageUrl('admin/orders/')}?status=awaiting_payment_verification" style="color:var(--warning);font-weight:600">Review ${pending} payment${pending !== 1 ? 's' : ''} →</a>`
          : 'All clear'
        }</div>
      </div>
    `;
  } catch (err) {
    console.error('loadStats:', err);
  }
}

async function loadRecentOrders() {
  const container = document.getElementById('recent-orders');
  if (!container) return;
  try {
    const { orders } = await getAdminOrders({ limit: 8 });
    if (!orders?.length) {
      container.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            </div>
            <h3>No orders yet</h3>
            <p>Once customers start buying, their orders will show up right here.</p>
          </div>
        </div>
      `;
      return;
    }
    container.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th>Total</th><th></th>
          </tr></thead>
          <tbody>
            ${orders.map(o => `
              <tr>
                <td><span class="font-mono" style="font-size:var(--text-xs)">#${shortToken(o.public_token)}</span></td>
                <td style="font-size:var(--text-sm)">${o.customers?.full_name || o.customers?.email || '—'}</td>
                <td style="font-size:var(--text-xs);color:var(--text-muted)">${formatDate(o.created_at)}</td>
                <td>${statusBadge(o.status)}</td>
                <td style="font-weight:700;font-size:var(--text-sm)">${formatRWF(o.total_cents)}</td>
                <td><a href="${pageUrl('admin/order-detail/')}?token=${o.public_token}" class="btn btn-secondary btn-sm">View</a></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.error('loadRecentOrders:', err);
    container.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h3>Couldn't load orders</h3>
          <p>There was a problem fetching recent orders. Try refreshing the page.</p>
        </div>
      </div>
    `;
  }
}
