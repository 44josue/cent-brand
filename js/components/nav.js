// Only import modules with no supabase dependency so the nav always renders
// even when the CDN is slow or unreachable on first load.
// cart.js / auth.js / api.js are loaded dynamically after the nav is visible.
// cookie-consent.js is loaded dynamically too — ad blockers commonly block any file
// named "cookie-consent", and a static import here would fail the whole nav.js module
// (and every page's script chain with it) if that one request gets blocked.
import { toggleTheme, getTheme, initTheme, formatRWF, debounce } from '../lib/utils.js';
import { getBasePath, pageUrl, assetUrl } from '../lib/paths.js';

export async function renderNav() {
  initTheme();
  import('./cookie-consent.js').then(({ initCookieConsent }) => initCookieConsent()).catch(() => {});

  const announcementBar = document.getElementById('announcement-bar');
  const navPlaceholder = document.getElementById('nav-placeholder');
  if (!navPlaceholder) return;

  loadAnnouncement(announcementBar);

  const currentPath = window.location.pathname;

  // 1. Dynamically find your repository base path
  // If on GitHub Pages, it yields '/cent-brand/', otherwise it safely defaults to '/' for local servers
  const basePath = getBasePath();

  navPlaceholder.innerHTML = `
    <nav class="navbar" role="navigation" aria-label="Main navigation">
      <div class="navbar-inner">

        <!-- Left links -->
        <ul class="nav-left nav-links" role="list">
          <li><a href="${basePath}" ${currentPath === basePath || currentPath === basePath + 'index.html' ? 'class="active"' : ''}>Home</a></li>
          <li><a href="${basePath}products/" ${currentPath.includes('/products') ? 'class="active"' : ''}>Shop</a></li>
          <li><a href="${basePath}about/" ${currentPath.includes('/about') ? 'class="active"' : ''}>About</a></li>
        </ul>

        <!-- Center logo -->
        <a href="${basePath}" class="nav-logo" aria-label="CENT Home">
          <img src="${assetUrl('assets/images/black logo.png')}" alt="CENT" class="nav-logo-img nav-logo-dark">
          <img src="${assetUrl('assets/images/white logo.png')}" alt="CENT" class="nav-logo-img nav-logo-light">
        </a>

        <!-- Right links + actions -->
        <div class="nav-right">
          <ul class="nav-links" role="list">
            <li><a href="${basePath}contact/" ${currentPath.includes('/contact') ? 'class="active"' : ''}>Contact</a></li>
          </ul>

          <div class="nav-actions">
            <button class="nav-icon-btn" id="search-btn" aria-label="Search" title="Search (Ctrl+K)">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>
              </svg>
            </button>

            <button class="nav-icon-btn" id="theme-btn" aria-label="Toggle theme">
              <svg id="theme-icon-sun" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="display:none">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"/>
              </svg>
              <svg id="theme-icon-moon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"/>
              </svg>
            </button>

            <a href="${basePath}cart/" class="nav-icon-btn" id="cart-btn" aria-label="Cart">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"/>
              </svg>
              <span class="cart-badge" aria-label="cart items" style="display:none">0</span>
            </a>

            <a href="${basePath}account/" class="nav-icon-btn" id="account-btn" aria-label="Account" style="position:relative">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/>
              </svg>
            </a>

            <button class="hamburger" id="hamburger-btn" aria-label="Open menu" aria-expanded="false">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Mobile nav overlay -->
    <div class="mobile-nav-overlay" id="mobile-nav-overlay"></div>

    <!-- Mobile drawer -->
    <nav class="mobile-nav" id="mobile-nav" aria-label="Mobile navigation">
      <div class="mobile-nav-header">
        <a href="${basePath}" class="nav-logo" aria-label="CENT Home">
          <img src="${assetUrl('assets/images/black logo.png')}" alt="CENT" class="nav-logo-img nav-logo-dark" height="44">
          <img src="${assetUrl('assets/images/white logo.png')}" alt="CENT" class="nav-logo-img nav-logo-light" height="44">
        </a>
        <button class="nav-icon-btn" id="mobile-nav-close" aria-label="Close menu">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="mobile-nav-links">
        <!-- Note: Fixed a hanging quote error here from your previous code -->
        <a href="${basePath}" ${currentPath === basePath || currentPath === basePath + 'index.html' ? 'class="active"' : ''}>Home</a>
        <a href="${basePath}products/" ${currentPath.includes('/products') ? 'class="active"' : ''}>Shop</a>
        <a href="${basePath}about/" ${currentPath.includes('/about') ? 'class="active"' : ''}>About</a>
        <a href="${basePath}contact/" ${currentPath.includes('/contact') ? 'class="active"' : ''}>Contact</a>
        <div class="mobile-nav-divider"></div>
        <a href="${basePath}account/" ${currentPath.includes('/account') ? 'class="active"' : ''}>Account</a>
        <a href="${basePath}cart/" ${currentPath.includes('/cart') ? 'class="active"' : ''}>Cart</a>
      </div>
      <div class="mobile-nav-footer">
        <div class="mobile-nav-actions">
          <button class="btn btn-secondary btn-sm" id="mobile-theme-btn" style="flex:1">Toggle Theme</button>
        </div>
      </div>
    </nav>

    <!-- Search overlay -->
    <div class="search-overlay hidden" id="search-overlay" role="dialog" aria-modal="true" aria-label="Search products">
      <button style="position:absolute;top:var(--space-6);right:var(--space-6);background:none;border:none;color:var(--text-muted);font-size:24px;cursor:pointer" id="search-close" aria-label="Close search">✕</button>
      <div class="search-overlay-inner">
        <div class="search-input-wrap">
          <input type="search" id="search-input" placeholder="Search products..." autocomplete="off" aria-label="Search products">
        </div>
        <div class="search-results" id="search-results"></div>
      </div>
    </div>
  `;

  updateThemeIcon();
  updateCartBadgesAsync();
  loadAuthState();

  // Theme
  document.getElementById('theme-btn')?.addEventListener('click', () => { toggleTheme(); updateThemeIcon(); });
  document.getElementById('mobile-theme-btn')?.addEventListener('click', () => { toggleTheme(); updateThemeIcon(); });

  // Hamburger
  document.getElementById('hamburger-btn')?.addEventListener('click', openMobileNav);
  document.getElementById('mobile-nav-close')?.addEventListener('click', closeMobileNav);
  document.getElementById('mobile-nav-overlay')?.addEventListener('click', closeMobileNav);

  // Search
  document.getElementById('search-btn')?.addEventListener('click', openSearch);
  document.getElementById('search-close')?.addEventListener('click', closeSearch);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeMobileNav(); closeSearch(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
  });

  initSearch();
}

async function updateCartBadgesAsync() {
  try {
    const { updateCartBadges } = await import('../lib/cart.js');
    updateCartBadges();
  } catch { /* supabase unavailable — cart badge stays hidden */ }
}

function updateThemeIcon() {
  const theme = getTheme();
  const sun = document.getElementById('theme-icon-sun');
  const moon = document.getElementById('theme-icon-moon');
  if (sun) sun.style.display = theme === 'dark' ? 'block' : 'none';
  if (moon) moon.style.display = theme === 'light' ? 'block' : 'none';
}

function openMobileNav() {
  const nav = document.getElementById('mobile-nav');
  const overlay = document.getElementById('mobile-nav-overlay');
  const btn = document.getElementById('hamburger-btn');
  nav?.classList.add('open');
  overlay?.classList.add('open');
  btn?.classList.add('open');
  btn?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('nav-open');
  nav?.querySelector('a')?.focus();
}

function closeMobileNav() {
  const nav = document.getElementById('mobile-nav');
  const overlay = document.getElementById('mobile-nav-overlay');
  const btn = document.getElementById('hamburger-btn');
  nav?.classList.remove('open');
  overlay?.classList.remove('open');
  btn?.classList.remove('open');
  btn?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('nav-open');
}

function openSearch() {
  document.getElementById('search-overlay')?.classList.remove('hidden');
  document.getElementById('search-input')?.focus();
  document.body.style.overflow = 'hidden';
}

function closeSearch() {
  document.getElementById('search-overlay')?.classList.add('hidden');
  const res = document.getElementById('search-results');
  const inp = document.getElementById('search-input');
  if (res) res.innerHTML = '';
  if (inp) inp.value = '';
  document.body.style.overflow = '';
}

function initSearch() {
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  if (!input || !results) return;

  const doSearch = debounce(async (q) => {
    if (!q.trim()) { results.innerHTML = ''; return; }
    results.innerHTML = '<p style="color:var(--text-muted);font-size:var(--text-sm)">Searching...</p>';
    try {
      const { searchProducts } = await import('../lib/api.js');
      const products = await searchProducts(q);
      if (!products.length) {
        results.innerHTML = '<p style="color:var(--text-muted);font-size:var(--text-sm)">No products found.</p>';
        return;
      }
      results.innerHTML = products.map(p => `
        <a href="../product/?slug=${p.slug}" class="search-result-item" onclick="document.getElementById('search-overlay').classList.add('hidden');document.body.style.overflow=''">
          <img src="${p.primaryImage || ''}" alt="${p.name}" class="search-result-img" loading="lazy"
            onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2264%22%3E%3Crect width=%2248%22 height=%2264%22 fill=%22%23161616%22/%3E%3C/svg%3E'">
          <div>
            <div style="font-weight:600;font-size:var(--text-sm);color:var(--text-primary)">${p.name}</div>
            <div style="font-size:var(--text-xs);color:var(--text-muted)">${p.categories?.name || ''}</div>
            <div style="font-size:var(--text-sm);font-weight:700;margin-top:2px">${p.minPrice ? formatRWF(p.minPrice) : 'N/A'}</div>
          </div>
        </a>
      `).join('');
    } catch {
      results.innerHTML = '<p style="color:var(--text-muted);font-size:var(--text-sm)">Search failed.</p>';
    }
  }, 300);

  input.addEventListener('input', (e) => doSearch(e.target.value));
}

async function loadAuthState() {
  try {
    const { getCurrentProfile, getPendingOrderForUser } = await import('../lib/auth.js');
    const profile = await getCurrentProfile();
    if (!profile) return;

    if (['admin', 'ops'].includes(profile.role)) {
      const btn = document.getElementById('account-btn');
      if (btn) { btn.href = pageUrl('admin/'); btn.title = 'Admin Dashboard'; }
    }

    // Pending order pulse dot
    const { supabase: sb } = await import('../lib/supabase.js');
    const { data: customer } = await sb.from('customers').select('id').eq('profile_id', profile.id).maybeSingle();
    if (customer) {
      const pending = await getPendingOrderForUser(customer.id);
      if (pending) {
        const btn = document.getElementById('account-btn');
        if (btn) {
          const dot = document.createElement('span');
          dot.className = 'pulse-dot';
          btn.appendChild(dot);
        }
      }
    }
  } catch { /* not logged in or supabase unavailable */ }
}

async function loadAnnouncement(container) {
  if (!container || sessionStorage.getItem('cent_announcement_dismissed')) return;
  try {
    const { getSiteSection } = await import('../lib/api.js');
    const section = await getSiteSection('announcement_bar');
    if (!section?.body) return;
    container.innerHTML = `
      <div class="announcement-bar">
        <span>${section.body}</span>
        <button class="close-btn" aria-label="Dismiss">✕</button>
      </div>
    `;
    container.querySelector('.close-btn')?.addEventListener('click', () => {
      container.innerHTML = '';
      sessionStorage.setItem('cent_announcement_dismissed', '1');
    });
  } catch { /* no announcement — supabase unreachable */ }
}
