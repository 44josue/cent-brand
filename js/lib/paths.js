/** Base path for GitHub Pages (`/cent-brand/`) vs local/production root (`/`). */
export function getBasePath() {
  if (typeof window === 'undefined') return '/';
  if (window.location.hostname.includes('github.io')) {
    const seg = window.location.pathname.split('/').filter(Boolean)[0];
    if (seg) return `/${seg}/`;
  }
  return '/';
}

/** Site page URL, e.g. pageUrl('products/') → /cent-brand/products/ */
export function pageUrl(path = '') {
  const base = getBasePath();
  const clean = String(path).replace(/^\//, '');
  return base + clean;
}

/** Static asset under repo root, e.g. assetUrl('assets/images/icon.png') */
export function assetUrl(path = '') {
  return pageUrl(path.replace(/^\//, ''));
}
