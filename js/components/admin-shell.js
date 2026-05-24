import { requireAdmin, signOut } from '../lib/auth.js';
import { initTheme, toggleTheme, getTheme } from '../lib/utils.js';
import { supabase } from '../lib/supabase.js';
import { toast } from '../lib/utils.js';

export async function renderAdminShell(pageTitle = 'Dashboard', pageCallback = null) {
  initTheme();

  // Show skeleton immediately — auth + badge counts can take 300-800ms
  const shellEl = document.getElementById('admin-shell');
  if (shellEl) {
    shellEl.innerHTML = `
      <div class="admin-layout">
        <aside class="admin-sidebar">
          <div class="sidebar-header">
            <div class="skeleton" style="width:60px;height:28px;border-radius:4px"></div>
          </div>
          <nav class="sidebar-nav" style="gap:var(--space-2)">
            ${Array.from({ length: 9 }, (_, i) => `
              <div class="skeleton" style="height:36px;border-radius:8px;width:${i % 3 === 0 ? '70' : i % 3 === 1 ? '85' : '60'}%"></div>
            `).join('')}
          </nav>
        </aside>
        <div class="admin-main">
          <header class="admin-topbar">
            <div class="skeleton" style="width:120px;height:20px;border-radius:4px"></div>
            <div class="skeleton" style="width:32px;height:32px;border-radius:50%"></div>
          </header>
          <main class="admin-content">
            <div class="skeleton" style="height:32px;width:200px;border-radius:6px;margin-bottom:var(--space-6)"></div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-4);margin-bottom:var(--space-8)">
              ${Array.from({ length: 4 }, () => `<div class="skeleton" style="height:100px;border-radius:12px"></div>`).join('')}
            </div>
            <div class="skeleton" style="height:300px;border-radius:12px"></div>
          </main>
        </div>
      </div>
    `;
  }

  const auth = await requireAdmin();
  if (!auth) return null;

  const { profile } = auth;
  const initials = getInitials(profile.full_name || profile.email);
  const currentPath = window.location.pathname;

  const shell = document.getElementById('admin-shell');
  if (!shell) return auth;

  // Fetch badge counts
  const [pendingCount, unreadCount] = await Promise.all([
    getPendingCount(),
    getUnreadCount(),
  ]);

  shell.innerHTML = `
    <div class="admin-layout">
      <!-- Sidebar overlay for mobile -->
      <div class="sidebar-overlay" id="sidebar-overlay"></div>

      <!-- Sidebar -->
      <aside class="admin-sidebar" id="admin-sidebar" role="navigation" aria-label="Admin navigation">
        <div class="sidebar-header">
          <div>
            <a href="/admin/" class="sidebar-logo">cent</a>
            <div class="sidebar-logo-sub">Admin</div>
          </div>
        </div>

        <nav class="sidebar-nav">
          <a href="/admin/" class="sidebar-link ${currentPath === '/admin/' || currentPath === '/admin/index.html' ? 'active' : ''}">
            ${icon('grid')} Dashboard
          </a>

          <div class="sidebar-section-label">Commerce</div>

          <a href="/admin/orders/" class="sidebar-link ${isActive(currentPath, '/admin/orders') ? 'active' : ''}">
            ${icon('shopping-bag')} Orders
            ${pendingCount > 0 ? `<span class="sidebar-badge">${pendingCount}</span>` : ''}
          </a>

          <a href="/admin/customers/" class="sidebar-link ${isActive(currentPath, '/admin/customers') ? 'active' : ''}">
            ${icon('users')} Customers
          </a>

          <a href="/admin/products/" class="sidebar-link ${isActive(currentPath, '/admin/products') ? 'active' : ''}">
            ${icon('tag')} Products
          </a>
          <a href="/admin/collections/" class="sidebar-link ${isActive(currentPath, '/admin/collections') ? 'active' : ''}">
            ${icon('layers')} Collections
          </a>

          <div class="sidebar-section-label">Config</div>

          <a href="/admin/cms/" class="sidebar-link ${isActive(currentPath, '/admin/cms') ? 'active' : ''}">
            ${icon('file-text')} CMS
          </a>

          <a href="/admin/promotions/" class="sidebar-link ${isActive(currentPath, '/admin/promotions') ? 'active' : ''}">
            ${icon('percent')} Promotions
          </a>

          <a href="/admin/channels/" class="sidebar-link ${isActive(currentPath, '/admin/channels') ? 'active' : ''}">
            ${icon('credit-card')} Channels
          </a>

          <a href="/admin/collaborators/" class="sidebar-link ${isActive(currentPath, '/admin/collaborators') ? 'active' : ''}">
            ${icon('users')} Collabs
          </a>

          <a href="/admin/staff/" class="sidebar-link ${isActive(currentPath, '/admin/staff') ? 'active' : ''}">
            ${icon('shield')} Staff
          </a>

          <a href="/admin/contact/" class="sidebar-link ${isActive(currentPath, '/admin/contact') ? 'active' : ''}">
            ${icon('mail')} Messages
            ${unreadCount > 0 ? `<span class="sidebar-badge">${unreadCount}</span>` : ''}
          </a>
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="sidebar-avatar">${initials}</div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">${profile.full_name || profile.email}</div>
              <div class="sidebar-user-role">${profile.role}</div>
            </div>
          </div>
          <a href="/" class="sidebar-link">
            ${icon('external-link')} View Store
          </a>
          <button class="sidebar-link w-full" id="sidebar-signout" style="text-align:left;width:100%;cursor:pointer">
            ${icon('log-out')} Sign Out
          </button>
        </div>
      </aside>

      <!-- Main -->
      <div class="admin-main">
        <header class="admin-topbar">
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            <button class="sidebar-toggle-btn" id="sidebar-toggle" aria-label="Toggle sidebar">☰</button>
            <span class="topbar-title" id="page-title">${pageTitle}</span>
          </div>
          <div class="topbar-actions">
            <button class="nav-icon-btn" id="admin-theme-btn" aria-label="Toggle theme" title="Toggle theme">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.75">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"/>
              </svg>
            </button>
            <div class="topbar-avatar" title="${profile.email}">${initials}</div>
          </div>
        </header>

        <main class="admin-content" id="admin-page-content">
          <!-- page content injected here -->
        </main>
      </div>
    </div>
  `;

  // Events
  document.getElementById('sidebar-signout')?.addEventListener('click', async () => {
    await signOut();
    window.location.href = '/login/';
  });

  document.getElementById('admin-theme-btn')?.addEventListener('click', () => toggleTheme());

  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('admin-sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  sidebarToggle?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    sidebarOverlay?.classList.toggle('open');
  });

  sidebarOverlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('open');
  });

  // Invoke page-specific content callback
  if (pageCallback) {
    const contentEl = document.getElementById('admin-page-content');
    if (contentEl) await pageCallback(contentEl);
  }

  // Realtime: new orders to verify
  supabase
    .channel('admin-orders')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: 'status=eq.awaiting_payment_verification',
    }, (payload) => {
      const token = payload.new?.public_token?.slice(0, 8).toUpperCase();
      toast.info(
        `New payment to verify — Order #${token}`,
        'Action Needed'
      );
    })
    .subscribe();

  return auth;
}

async function getPendingCount() {
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'awaiting_payment_verification');
  return count || 0;
}

async function getUnreadCount() {
  const { count } = await supabase
    .from('contact_messages')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);
  return count || 0;
}

function isActive(path, fragment) {
  return path.includes(fragment);
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function icon(name) {
  const icons = {
    grid: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    'shopping-bag': `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z"/></svg>`,
    users: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg>`,
    tag: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z"/></svg>`,
    'file-text': `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>`,
    percent: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185ZM9.75 9h.008v.008H9.75V9Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 4.5h.008v.008h-.008V13.5Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/></svg>`,
    'credit-card': `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"/></svg>`,
    shield: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"/></svg>`,
    mail: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/></svg>`,
    'external-link': `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>`,
    'log-out': `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"/></svg>`,
  };
  return icons[name] || '';
}
