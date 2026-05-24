const PREF_KEY = 'cent_cookies';

export function getCookieConsent() {
  try { return localStorage.getItem(PREF_KEY); } catch { return 'accepted'; }
}

export function hasCookieConsent() {
  return !!getCookieConsent();
}

export function initCookieConsent() {
  if (hasCookieConsent()) return;

  const banner = document.createElement('div');
  banner.id = 'cookie-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Cookie consent');
  banner.innerHTML = `
    <div class="cookie-inner">
      <div class="cookie-text">
        <div class="cookie-title">We use cookies</div>
        <div class="cookie-desc">
          We use browser storage to keep your cart, wishlist, and theme. No ads, no tracking, no third-party profiling.
          <a href="/privacy/" style="color:var(--accent);text-decoration:underline;margin-left:4px">Learn more</a>
        </div>
      </div>
      <div class="cookie-actions">
        <button class="btn btn-ghost btn-sm" id="cookie-essentials-btn">Essentials only</button>
        <button class="btn btn-primary btn-sm" id="cookie-accept-btn">Accept all</button>
      </div>
    </div>
  `;

  document.body.appendChild(banner);

  requestAnimationFrame(() => banner.classList.add('cookie-visible'));

  function dismiss(choice) {
    try { localStorage.setItem(PREF_KEY, choice); } catch {}
    banner.classList.remove('cookie-visible');
    banner.classList.add('cookie-hiding');
    setTimeout(() => banner.remove(), 400);

    if (choice === 'essentials') {
      // Clear non-essential storage
      try {
        localStorage.removeItem('cent_wishlist');
      } catch {}
    }
  }

  document.getElementById('cookie-accept-btn')?.addEventListener('click', () => dismiss('accepted'));
  document.getElementById('cookie-essentials-btn')?.addEventListener('click', () => dismiss('essentials'));
}
