import { getBasePath, pageUrl, assetUrl } from '../lib/paths.js';

export function renderFooter() {
  const placeholder = document.getElementById('footer-placeholder');
  if (!placeholder) return;

  const base = getBasePath();

  placeholder.innerHTML = `
    <footer>
      <div class="footer-main">
        <div class="footer-brand">
          <a href="${pageUrl()}" class="footer-logo">
            <img src="${assetUrl('assets/images/black logo.png')}" alt="CENT" class="footer-logo-img footer-logo-dark">
            <img src="${assetUrl('assets/images/white logo.png')}" alt="CENT" class="footer-logo-img footer-logo-light">
          </a>
          <p>Rwanda's premier streetwear destination. Every piece tells a story. Every cent matters.</p>
          <p class="footer-tagline">Made in Rwanda &mdash; Worn Everywhere</p>
          <div class="footer-social">
            <a href="https://www.instagram.com/cen.t_brand/" id="footer-instagram" target="_blank" rel="noopener noreferrer" aria-label="Instagram" title="Instagram">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </a>
            <a href="#" id="footer-tiktok" aria-label="TikTok" title="TikTok">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/></svg>
            </a>
            <a href="#" id="footer-twitter" aria-label="X (Twitter)" title="X">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
          </div>
        </div>

        <div class="footer-col">
          <h5>Shop</h5>
          <ul>
            <li><a href="${pageUrl('products/')}">All Products</a></li>
            <li><a href="${pageUrl('products/?sort=newest')}">New Arrivals</a></li>
            <li><a href="${pageUrl('products/?featured=true')}">Featured</a></li>
            <li><a href="${pageUrl('collaborators/')}">Collaborations</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h5>Help</h5>
          <ul>
            <li><a href="${pageUrl('faq/')}">FAQ</a></li>
            <li><a href="${pageUrl('contact/')}">Contact Us</a></li>
            <li><a href="${pageUrl('order-tracking/')}">Track Order</a></li>
            <li><a href="${pageUrl('account/')}">My Account</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h5>Company</h5>
          <ul>
            <li><a href="${pageUrl('about/')}">About CENT</a></li>
            <li><a href="mailto:info@cent.rw">info@cent.rw</a></li>
            <li><a href="tel:+250788123456">+250 788 123 456</a></li>
            <li><span style="color:var(--text-muted)">Kigali, Rwanda</span></li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <p>&copy; ${new Date().getFullYear()} CENT. All rights reserved.</p>
        <p><span style="font-weight:400">Powered by </span><a href="https://www.instagram.com/after.4__/" target="_blank" rel="noopener noreferrer" style="font-weight:700;color:#a0a0a0;text-decoration:none">AfterFour</a></p>
        <div class="footer-legal-links">
          <a href="${pageUrl('privacy/')}">Privacy Policy</a>
          <span>&middot;</span>
          <a href="${pageUrl('terms/')}">Terms of Use</a>
        </div>
      </div>
    </footer>
  `;

  // Load social links from CMS (non-blocking)
  import('../lib/api.js').then(({ getSiteSection }) => {
    return getSiteSection('contact_info');
  }).then(row => {
    if (!row?.body) return;
    let data;
    try { data = JSON.parse(row.body); } catch { return; }
    const ig = document.getElementById('footer-instagram');
    if (ig && data.instagram) { ig.href = data.instagram; ig.target = '_blank'; ig.rel = 'noopener noreferrer'; }
    const tt = document.getElementById('footer-tiktok');
    if (tt && data.tiktok) { tt.href = data.tiktok; tt.target = '_blank'; tt.rel = 'noopener noreferrer'; }
    const tw = document.getElementById('footer-twitter');
    if (tw && data.twitter) { tw.href = data.twitter; tw.target = '_blank'; tw.rel = 'noopener noreferrer'; }
  }).catch(() => {});
}

