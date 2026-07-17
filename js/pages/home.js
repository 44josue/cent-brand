import { renderNav } from '../components/nav.js';
import { renderFooter } from '../components/footer.js';
import { initTheme, formatRWF, toast, modal } from '../lib/utils.js';
import { pageUrl } from '../lib/paths.js';

// These are filled after dynamic imports resolve
let getProducts, getCategories, getSiteSection, getCollaborators;
let addToCart, updateCartBadges, getLocalCart;

// Render nav/footer immediately — no supabase dependency at parse time
initTheme();
renderNav();
renderFooter();

// Load supabase-dependent modules after nav is already visible
Promise.all([
  import('../lib/api.js'),
  import('../lib/cart.js'),
]).then(([api, cart]) => {
  ({ getProducts, getCategories, getSiteSection, getCollaborators, getLiveCmsImagesBySection } = api);
  ({ addToCart, updateCartBadges, getLocalCart } = cart);
  updateCartBadges();
  loadHomeLayout();
  loadCategories();
  loadCmsContent();
  initNewsletterForm();
  initCartDrawer();
}).catch(() => {
  const grid = document.getElementById('featured-grid');
  if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:var(--space-12);color:var(--text-muted)">Could not connect — <button class="btn btn-secondary btn-sm" onclick="location.reload()">Retry</button></div>`;
});

// ── HOME LAYOUT (reads CMS toggle for featured visibility) ────────────────────

async function loadHomeLayout() {
  let showFeatured = true;
  try {
    const layout = await getSiteSection('home_layout');
    if (layout?.body) {
      const cfg = JSON.parse(layout.body);
      showFeatured = cfg.show_featured !== false;
    }
  } catch { /* defaults */ }

  if (showFeatured) {
    loadFeaturedProducts();
  } else {
    const section = document.querySelector('.featured-section');
    if (section) section.style.display = 'none';
  }

  loadCollaborations();
}

// ── FEATURED CAROUSEL ─────────────────────────────────────────────────────────

let carouselProducts = [];
let carouselIndex = 0;
const VISIBLE = 3;

async function loadFeaturedProducts() {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;

  try {
    carouselProducts = await getProducts({ featured: true, limit: 9 });
    if (!carouselProducts.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;padding:var(--space-12) var(--space-6);text-align:center">
          <div style="font-size:2.5rem;margin-bottom:var(--space-4)">🛍</div>
          <p style="font-weight:700;font-size:var(--text-lg);margin-bottom:var(--space-2)">New drops coming soon</p>
          <p style="color:var(--text-muted);margin-bottom:var(--space-6)">No featured products yet — check back soon.</p>
          <a href="${pageUrl('products/')}" class="btn btn-primary">Browse All Products</a>
        </div>`;
      return;
    }
    renderCarousel();
    initWishlistButtons();
    initQuickView(carouselProducts);
    initCarouselArrows();
  } catch {
    grid.innerHTML = `
      <div style="grid-column:1/-1;padding:var(--space-12) var(--space-6);text-align:center">
        <p style="color:var(--text-muted);margin-bottom:var(--space-4)">Could not load products.</p>
        <button class="btn btn-secondary btn-sm" onclick="location.reload()">Retry</button>
      </div>`;
  }
}

function renderCarousel() {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;
  grid.innerHTML = carouselProducts.map(productCard).join('');
  updateCarouselArrows();
}

function initCarouselArrows() {
  document.getElementById('carousel-next')?.addEventListener('click', () => {
    if (carouselIndex + VISIBLE < carouselProducts.length) {
      carouselIndex++;
      scrollCarousel();
    }
  });

  document.getElementById('carousel-prev')?.addEventListener('click', () => {
    if (carouselIndex > 0) {
      carouselIndex--;
      scrollCarousel();
    }
  });
}

function scrollCarousel() {
  const track = document.getElementById('featured-grid');
  if (!track) return;
  const card = track.querySelector('.product-card');
  if (!card) return;
  const cardW = card.offsetWidth + 16;
  track.style.transform = `translateX(-${carouselIndex * cardW}px)`;
  updateCarouselArrows();
}

function updateCarouselArrows() {
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');
  if (prevBtn) prevBtn.style.display = carouselIndex > 0 ? 'flex' : 'none';
  if (nextBtn) nextBtn.style.display = (carouselIndex + VISIBLE < carouselProducts.length) ? 'flex' : 'none';
}

// ── COLLABORATIONS ────────────────────────────────────────────────────────────

async function loadCollaborations() {
  const section = document.getElementById('collabs-home-section');
  const grid = document.getElementById('collabs-home-grid');
  if (!section || !grid) return;

  try {
    const collabs = await getCollaborators();
    if (!collabs.length) return;

    section.style.display = 'block';
    grid.innerHTML = collabs.map(c => `
      <a href="${pageUrl(`products/?collab=${c.slug}`)}" class="collab-home-card">
        ${c.banner_url
          ? `<img src="${c.banner_url}" alt="${c.name}" class="collab-home-banner" loading="lazy" onerror="this.style.display='none'">`
          : `<div class="collab-home-banner-ph">CENT × ${c.brand_name || c.name}</div>`}
        <div class="collab-home-body">
          ${c.logo_url ? `<img src="${c.logo_url}" alt="${c.brand_name || c.name}" class="collab-home-logo" loading="lazy" onerror="this.remove()">` : ''}
          <div>
            <div class="collab-home-name">${c.name}</div>
            ${c.brand_name ? `<div class="collab-home-sub">× ${c.brand_name}</div>` : ''}
            <div class="collab-home-cta">Shop Collection →</div>
          </div>
        </div>
      </a>
    `).join('');
  } catch { /* silently skip */ }
}

// ── CATEGORIES ────────────────────────────────────────────────────────────────

async function loadCategories() {
  const strip = document.getElementById('categories-strip');
  if (!strip) return;
  try {
    const cats = await getCategories();
    strip.innerHTML = `
      <a href="${pageUrl('products/')}" class="category-chip">All</a>
      ${cats.map(c => `<a href="${pageUrl(`products/?category=${c.slug}`)}" class="category-chip">${c.name}</a>`).join('')}
    `;
  } catch {
    strip.innerHTML = '';
  }
}

// ── CMS CONTENT ───────────────────────────────────────────────────────────────

async function loadCmsContent() {
  try {
    const [ecm, liveImages] = await Promise.all([
      getSiteSection('every_cent_matters'),
      getLiveCmsImagesBySection(),
    ]);
    if (ecm?.body) {
      const el = document.getElementById('ecm-body');
      if (el) el.textContent = ecm.body;
    }
    const imgUrl = liveImages.every_cent_matters || ecm?.image_url;
    if (imgUrl) {
      const container = document.getElementById('ecm-image');
      if (container) {
        container.innerHTML = `<img src="${imgUrl}" alt="Every Cent Matters" style="width:100%;height:100%;object-fit:cover;object-position:center top">`;
      }
    }
  } catch { /* use defaults */ }
}

// ── PRODUCT CARD ──────────────────────────────────────────────────────────────

function productCard(p) {
  const price = p.minPrice ? formatRWF(p.minPrice) : 'N/A';
  const hasMultiple = p.maxPrice && p.maxPrice !== p.minPrice;
  const img = p.primaryImage || '';
  const wishlisted = isWishlisted(p.id);

  return `
    <article class="product-card" data-slug="${p.slug}" role="article">
      <a href="${pageUrl(`product/?slug=${p.slug}`)}" class="product-card-image" tabindex="-1" aria-hidden="true">
        <img src="${img}" alt="${p.primaryAlt || p.name}" loading="lazy" width="400" height="533"
          onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22533%22%3E%3Crect width=%22400%22 height=%22533%22 fill=%22%23161616%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 fill=%22%23525252%22 font-size=%2214%22 font-family=%22system-ui%22%3Ecent%3C/text%3E%3C/svg%3E'">
        <button class="quick-view-btn" data-id="${p.id}" aria-label="Quick view ${p.name}">Quick View</button>
        <button class="wishlist-btn ${wishlisted ? 'active' : ''}" data-id="${p.id}" aria-label="Add to wishlist" aria-pressed="${wishlisted}">
          ${wishlisted ? '♥' : '♡'}
        </button>
      </a>
      <a href="${pageUrl(`product/?slug=${p.slug}`)}" class="product-card-body" style="display:block;text-decoration:none">
        <div class="product-card-name">${p.name}</div>
        <div class="product-card-price">
          ${hasMultiple ? '<span class="from">from </span>' : ''}${price}
        </div>
        <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:var(--space-1)">Buy Now &rarr;</div>
      </a>
    </article>
  `;
}

function isWishlisted(id) {
  try { return JSON.parse(localStorage.getItem('cent_wishlist') || '[]').includes(id); }
  catch { return false; }
}

function toggleWishlist(id) {
  try {
    const list = JSON.parse(localStorage.getItem('cent_wishlist') || '[]');
    const idx = list.indexOf(id);
    if (idx >= 0) list.splice(idx, 1); else list.push(id);
    localStorage.setItem('cent_wishlist', JSON.stringify(list));
    return idx < 0;
  } catch { return false; }
}

function initWishlistButtons() {
  document.querySelectorAll('.wishlist-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const added = toggleWishlist(btn.dataset.id);
      btn.classList.toggle('active', added);
      btn.setAttribute('aria-pressed', added);
      btn.textContent = added ? '♥' : '♡';
      toast[added ? 'success' : 'info'](added ? 'Added to wishlist' : 'Removed from wishlist');
    });
  });
}

// ── QUICK VIEW ────────────────────────────────────────────────────────────────

function initQuickView(products) {
  document.querySelectorAll('.quick-view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const product = products.find(p => p.id === btn.dataset.id);
      if (product) openQuickView(product);
    });
  });
  document.querySelector('#quick-view-modal .modal-close')?.addEventListener('click', () => {
    modal.close('quick-view-modal');
  });
}

function openQuickView(product) {
  const nameEl = document.getElementById('qv-name');
  const body = document.getElementById('qv-body');
  if (!nameEl || !body) return;

  nameEl.textContent = product.name;
  const variants = product.variants || [];
  const sizes = [...new Set(variants.map(v => v.size).filter(Boolean))];
  const colors = [...new Set(variants.map(v => v.color).filter(Boolean))];
  let selectedVariant = variants.find(v => v.stock > 0) || variants[0];

  const renderQv = () => `
    <div class="qv-grid">
      <img src="${product.primaryImage || ''}" alt="${product.name}" class="qv-img"
        onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22533%22%3E%3Crect width=%22400%22 height=%22533%22 fill=%22%23161616%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 fill=%22%23444%22 font-size=%2236%22 letter-spacing=%224%22 font-family=%22system-ui%22%3Ecent%3C/text%3E%3C/svg%3E'">
      <div>
        <div style="font-size:var(--text-2xl);font-weight:700;margin-bottom:var(--space-1)" id="qv-price">
          ${selectedVariant ? formatRWF(selectedVariant.price_cents) : 'N/A'}
        </div>
        ${sizes.length ? `
          <div style="margin-top:var(--space-4)">
            <div style="font-size:var(--text-sm);font-weight:600;margin-bottom:var(--space-2)">Size</div>
            <div style="display:flex;gap:var(--space-2);flex-wrap:wrap" id="qv-sizes">
              ${sizes.map(s => {
                const v = variants.find(v => v.size === s);
                const oos = !v || v.stock === 0;
                return `<button class="size-btn ${oos ? 'oos' : ''} ${selectedVariant?.size === s ? 'selected' : ''}" data-size="${s}" ${oos ? 'disabled' : ''}>${s}</button>`;
              }).join('')}
            </div>
          </div>` : ''}
        ${colors.length ? `
          <div style="margin-top:var(--space-4)">
            <div style="font-size:var(--text-sm);font-weight:600;margin-bottom:var(--space-2)">Color</div>
            <div style="display:flex;gap:var(--space-2)">
              ${colors.map(c => `<button class="color-swatch ${selectedVariant?.color === c ? 'selected' : ''}" data-color="${c}" style="background:${c}" title="${c}"></button>`).join('')}
            </div>
          </div>` : ''}
        <div style="margin-top:var(--space-4);font-size:var(--text-sm);color:var(--text-muted)" id="qv-stock">
          ${stockLabel(selectedVariant)}
        </div>
        <div style="margin-top:var(--space-6);display:flex;flex-direction:column;gap:var(--space-2)">
          <button class="btn btn-primary btn-lg" id="qv-add-btn" ${!selectedVariant || selectedVariant.stock === 0 ? 'disabled' : ''}>Add to Cart</button>
          <a href="${pageUrl(`product/?slug=${product.slug}`)}" class="btn btn-secondary">View Full Details</a>
        </div>
      </div>
    </div>
  `;

  body.innerHTML = renderQv();

  const updateState = () => {
    document.getElementById('qv-price').textContent = selectedVariant ? formatRWF(selectedVariant.price_cents) : 'N/A';
    document.getElementById('qv-stock').textContent = stockLabel(selectedVariant);
    const btn = document.getElementById('qv-add-btn');
    if (btn) btn.disabled = !selectedVariant || selectedVariant.stock === 0;
  };

  body.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      body.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedVariant = variants.find(v => v.size === btn.dataset.size && v.stock > 0) || variants.find(v => v.size === btn.dataset.size);
      updateState();
    });
  });

  body.querySelectorAll('.color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      body.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedVariant = variants.find(v => v.color === btn.dataset.color && v.stock > 0) || variants.find(v => v.color === btn.dataset.color);
      updateState();
    });
  });

  document.getElementById('qv-add-btn')?.addEventListener('click', async () => {
    if (!selectedVariant) return;
    const btn = document.getElementById('qv-add-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Adding...';
    try {
      await addToCart({
        variantId: selectedVariant.id,
        quantity: 1,
        productName: product.name,
        size: selectedVariant.size,
        color: selectedVariant.color,
        priceCents: selectedVariant.price_cents,
        imageUrl: product.primaryImage,
      });
      modal.close('quick-view-modal');
      openCartDrawer();
      toast.success(`${product.name} added to cart`);
    } catch {
      toast.error('Could not add to cart. Try again.');
      btn.disabled = false;
      btn.textContent = 'Add to Cart';
    }
  });

  modal.open('quick-view-modal');
}

function stockLabel(v) {
  if (!v) return '';
  if (v.stock === 0) return '✕ Out of stock';
  if (v.stock <= 5) return `⚠ Only ${v.stock} left`;
  return '✓ In stock';
}

// ── CART DRAWER ───────────────────────────────────────────────────────────────

function initCartDrawer() {
  document.getElementById('cart-drawer-close')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cart-drawer-overlay')?.addEventListener('click', closeCartDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCartDrawer(); });
  window.__openCartDrawer = openCartDrawer;
}

function openCartDrawer() {
  document.getElementById('cart-drawer-overlay')?.classList.remove('hidden');
  document.getElementById('cart-drawer')?.classList.remove('closed');
  document.body.style.overflow = 'hidden';
  renderDrawerContents();
}

function closeCartDrawer() {
  document.getElementById('cart-drawer-overlay')?.classList.add('hidden');
  document.getElementById('cart-drawer')?.classList.add('closed');
  document.body.style.overflow = '';
}

function renderDrawerContents() {
  const state = getLocalCart();
  const body = document.getElementById('cart-drawer-body');
  if (!body) return;

  const count = state.items.reduce((s, i) => s + i.quantity, 0);
  const total = state.items.reduce((s, i) => s + i.priceCents * i.quantity, 0);

  const countEl = document.getElementById('drawer-count');
  const totalEl = document.getElementById('drawer-total');
  if (countEl) countEl.textContent = `(${count})`;
  if (totalEl) totalEl.textContent = formatRWF(total);

  if (!state.items.length) {
    body.innerHTML = `
      <div class="empty-state" style="padding:var(--space-8) 0">
        <p>Your cart is empty.</p>
        <a href="${pageUrl('products/')}" class="btn btn-primary" style="margin-top:var(--space-4)">Shop Now</a>
      </div>
    `;
    return;
  }

  body.innerHTML = state.items.map(item => `
    <div style="display:flex;gap:var(--space-3);padding:var(--space-3) 0;border-bottom:1px solid var(--border)">
      <img src="${item.imageUrl || ''}" alt="${item.productName}" width="64" height="85"
        style="width:64px;height:85px;object-fit:cover;border-radius:var(--radius);background:var(--bg-card);flex-shrink:0"
        onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2285%22%3E%3Crect width=%2264%22 height=%2285%22 fill=%22%23161616%22/%3E%3C/svg%3E'">
      <div style="flex:1;min-width:0">
        <div style="font-size:var(--text-sm);font-weight:600">${item.productName}</div>
        ${item.size ? `<div style="font-size:var(--text-xs);color:var(--text-muted)">${item.size}${item.color ? ' · ' + item.color : ''}</div>` : ''}
        <div style="font-size:var(--text-sm);font-weight:700;margin-top:2px">${formatRWF(item.priceCents * item.quantity)}</div>
        <div style="font-size:var(--text-xs);color:var(--text-muted)">${item.quantity} × ${formatRWF(item.priceCents)}</div>
      </div>
    </div>
  `).join('');
}

// ── NEWSLETTER ────────────────────────────────────────────────────────────────

function initNewsletterForm() {
  document.getElementById('newsletter-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('newsletter-email').value.trim();
    const msg = document.getElementById('newsletter-msg');
    const btn = document.getElementById('newsletter-btn');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      const { supabase } = await import('../lib/supabase.js');
      await supabase.from('subscribers').upsert({ email }, { onConflict: 'email' });
    } catch {
      // fallback to localStorage if table doesn't exist yet
      const subs = JSON.parse(localStorage.getItem('cent_subscribers') || '[]');
      if (!subs.includes(email)) { subs.push(email); localStorage.setItem('cent_subscribers', JSON.stringify(subs)); }
    }

    btn.textContent = 'Subscribed!';
    if (msg) { msg.style.display = 'block'; msg.style.color = 'var(--success)'; msg.textContent = "You're on the list. Watch your inbox for drops."; }
    document.getElementById('newsletter-email').value = '';
  });
}
