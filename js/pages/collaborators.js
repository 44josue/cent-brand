import { renderNav } from '../components/nav.js';
import { renderFooter } from '../components/footer.js';
import { getCollaborators } from '../lib/api.js';
import { initTheme } from '../lib/utils.js';
import { pageUrl } from '../lib/paths.js';

initTheme();
renderNav();
renderFooter();

async function init() {
  const grid = document.getElementById('collabs-grid');
  if (!grid) return;

  try {
    const collabs = await getCollaborators();

    if (!collabs.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:var(--space-16);color:var(--text-muted)">
          <p style="font-size:var(--text-lg)">No collaborations yet — check back soon.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = collabs.map(c => `
      <a href="${pageUrl('products/')}?collab=${c.slug}" class="collab-card">
        ${c.banner_url
          ? `<img src="${c.banner_url}" alt="${c.name}" class="collab-banner" loading="lazy" onerror="this.style.display='none'">`
          : `<div class="collab-banner-placeholder">
              <span style="font-size:var(--text-xs);letter-spacing:0.15em;text-transform:uppercase;color:var(--text-muted)">CENT × ${c.brand_name || c.name}</span>
             </div>`
        }
        <div class="collab-card-body">
          ${c.logo_url ? `<img src="${c.logo_url}" alt="${c.brand_name || c.name}" class="collab-logo" loading="lazy" onerror="this.style.display='none'">` : ''}
          <div class="collab-info">
            <div class="collab-name">${c.name}</div>
            ${c.brand_name ? `<div class="collab-brand">× ${c.brand_name}</div>` : ''}
            ${c.description ? `<div class="collab-desc">${c.description}</div>` : ''}
            <span class="collab-cta">Shop Collection</span>
          </div>
        </div>
      </a>
    `).join('');
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted)">Could not load collaborations.</p>';
  }
}

init();
