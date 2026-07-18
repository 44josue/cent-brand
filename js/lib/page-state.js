// Scroll-position + lightweight data caching so that going "back" to a
// listing page returns you to the same page/filters/scroll spot instead of
// resetting to the top with a fresh fetch every time.
//
// Everything here is sessionStorage-backed (cleared when the tab closes) and
// keyed by the full URL (pathname + search), so different filter/page
// combinations never collide with each other.

// Browsers restore scroll automatically by default, but that fights with our
// own async content rendering (the page is still short when the browser
// tries to restore, so it snaps back to 0). Taking manual control lets us
// restore scroll ourselves, after content has actually rendered.
try { history.scrollRestoration = 'manual'; } catch { /* unsupported */ }

function scrollKey(key) {
  return `cent_scroll:${key || (location.pathname + location.search)}`;
}

function cacheKey(key) {
  return `cent_cache:${key}`;
}

export function saveScrollPosition(key) {
  try {
    sessionStorage.setItem(scrollKey(key), JSON.stringify({ y: window.scrollY, t: Date.now() }));
  } catch { /* storage unavailable */ }
}

/**
 * Restores a previously-saved scroll position for this key, if any exists
 * and isn't stale. Call after the page's real content has rendered (not on
 * a skeleton/loading state), otherwise the browser will just clamp the
 * scroll back to the bottom of a too-short page.
 */
export function restoreScrollPosition(key, maxAgeMs = 30 * 60 * 1000) {
  try {
    const raw = sessionStorage.getItem(scrollKey(key));
    if (!raw) return false;
    const { y, t } = JSON.parse(raw);
    if (Date.now() - t > maxAgeMs) return false;
    window.scrollTo(0, y);
    return true;
  } catch { return false; }
}

/** Auto-saves scroll position for `key` as the user scrolls and right before they navigate away. */
export function trackScrollPosition(key) {
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { saveScrollPosition(key); ticking = false; });
  }, { passive: true });
  window.addEventListener('pagehide', () => saveScrollPosition(key));

  // If the browser restores this page from bfcache (back/forward without a
  // real reload), our scripts don't re-run — but scrollRestoration:'manual'
  // means the browser won't fix scroll on its own either, so we have to.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) restoreScrollPosition(key);
  });
}

/** Simple sessionStorage cache with a TTL, for data that's fine to show stale-for-a-moment (product listings, filters). */
export function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(cacheKey(key));
    if (!raw) return null;
    const { data, expires } = JSON.parse(raw);
    if (Date.now() > expires) { sessionStorage.removeItem(cacheKey(key)); return null; }
    return data;
  } catch { return null; }
}

export function cacheSet(key, data, ttlMs = 5 * 60 * 1000) {
  try {
    sessionStorage.setItem(cacheKey(key), JSON.stringify({ data, expires: Date.now() + ttlMs }));
  } catch { /* storage full or unavailable — just skip caching */ }
}
