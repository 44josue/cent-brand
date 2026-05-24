import { renderNav } from '../components/nav.js';
import { renderFooter } from '../components/footer.js';
import { formatRWF, getParam, setParams, debounce, toast } from '../lib/utils.js';

renderNav();
renderFooter();

let getProducts, getCategories, getCollections, getCollaborators, getAvailableSizes;
let updateCartBadges;

const LIMIT = 24;
let currentPage = 1;
let totalProducts = 0;
let selectedSizes = [];

const state = {
  category: getParam('category') || '',
  collection: getParam('collection') || '',
  collab: getParam('collab') || '',
  sort: getParam('sort') || 'newest',
  inStockOnly: getParam('instock') === '1',
  priceMin: getParam('min') ? parseInt(getParam('min')) : null,
  priceMax: getParam('max') ? parseInt(getParam('max')) : null,
  sizes: getParam('sizes') ? getParam('sizes').split(',') : [],
};

selectedSizes = [...state.sizes];

Promise.all([import('../lib/api.js'), import('../lib/cart.js')]).then(([api, cart]) => {
  ({ getProducts, getCategories, getCollections, getCollaborators, getAvailableSizes } = api);
  ({ updateCartBadges } = cart);
  updateCartBadges();
  init();
}).catch(() => {
  const grid = document.getElementById('products-grid');
  if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:var(--space-12)">
    <p style="color:var(--text-muted);margin-bottom:var(--space-4)">Could not connect to store.</p>
    <button class="btn btn-secondary" onclick="location.reload()">Retry</button>
  </div>`;
});

async function init() {
  await Promise.all([loadFilters(), loadProducts()]);
  setupEvents();
  applyStateToUI();
  updatePageTitle();
}

function renderCollabsStrip(collabs) {
  const strip = document.getElementById('collabs-strip');
  if (!strip || !collabs.length) return;

  strip.style.display = 'block';
  strip.innerHTML = `
    <div class="collab-strip-label">Collaborations</div>
    <div class="collabs-strip">
      <button class="collab-chip ${!state.collab ? 'active' : ''}" data-collab="">All</button>
      ${collabs.map(c => `
        <button class="collab-chip ${state.collab === c.slug ? 'active' : ''}" data-collab="${c.slug}">
          ${c.logo_url ? `<img src="${c.logo_url}" alt="${c.name}" onerror="this.style.display='none'">` : ''}
          ${c.name}
        </button>
      `).join('')}
    </div>
  `;

  strip.querySelectorAll('.collab-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.collab = btn.dataset.collab;
      strip.querySelectorAll('.collab-chip').forEach(b => b.classList.toggle('active', b.dataset.collab === state.collab));
      // also sync the sidebar checkbox
      document.querySelectorAll('#collab-filters input').forEach(cb => { cb.checked = cb.value === state.collab; });
      setParams({ collab: state.collab || null });
      updatePageTitle();
      loadProducts(1);
    });
  });
}

async function loadFilters() {
  try {
    const [cats, cols, collabs, sizes] = await Promise.all([
      getCategories(), getCollections(), getCollaborators(), getAvailableSizes()
    ]);

    renderCollabsStrip(collabs);

    document.getElementById('category-filters').innerHTML = cats.length
      ? cats.map(c => `
          <label class="filter-option">
            <input type="checkbox" name="category" value="${c.slug}" ${state.category === c.slug ? 'checked' : ''}>
            ${c.name}
          </label>`).join('')
      : '<span style="font-size:var(--text-sm);color:var(--text-muted)">No categories</span>';

    document.getElementById('collection-filters').innerHTML = cols.length
      ? cols.map(c => `
          <label class="filter-option">
            <input type="checkbox" name="collection" value="${c.slug}" ${state.collection === c.slug ? 'checked' : ''}>
            ${c.name}
          </label>`).join('')
      : '<span style="font-size:var(--text-sm);color:var(--text-muted)">No collections</span>';

    const collabEl = document.getElementById('collab-filters');
    if (collabEl) {
      collabEl.innerHTML = collabs.length
        ? collabs.map(c => `
            <label class="filter-option">
              <input type="checkbox" name="collab" value="${c.slug}" ${state.collab === c.slug ? 'checked' : ''}>
              ${c.name}
            </label>`).join('')
        : '<span style="font-size:var(--text-sm);color:var(--text-muted)">None yet</span>';
    }

    const sizeEl = document.getElementById('size-filters');
    if (sizeEl) {
      sizeEl.innerHTML = sizes.length
        ? sizes.map(s => `<button class="size-btn ${selectedSizes.includes(s) ? 'selected' : ''}" data-size="${s}">${s}</button>`).join('')
        : '<span style="font-size:var(--text-sm);color:var(--text-muted)">No sizes found</span>';

      sizeEl.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const size = btn.dataset.size;
          const idx = selectedSizes.indexOf(size);
          if (idx >= 0) selectedSizes.splice(idx, 1);
          else selectedSizes.push(size);
          btn.classList.toggle('selected', selectedSizes.includes(size));
        });
      });
    }

    if (collabs.length) {
      document.getElementById('collab-filters')?.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
          document.querySelectorAll('#collab-filters input').forEach(cb => {
            if (cb !== e.target) cb.checked = false;
          });
        }
      });
    }
  } catch (err) {
    console.error('loadFilters:', err);
  }
}

async function loadProducts(page = 1) {
  const grid = document.getElementById('products-grid');
  const countEl = document.getElementById('product-count');

  if (!grid) return;

  grid.innerHTML = Array(6).fill('<div class="skeleton skeleton-card"></div>').join('');
  if (countEl) countEl.textContent = 'Loading...';

  try {
    const offset = (page - 1) * LIMIT;
    const products = await getProducts({
      categorySlug: state.category || undefined,
      collectionSlug: state.collection || undefined,
      collaboratorSlug: state.collab || undefined,
      sort: state.sort,
      inStockOnly: state.inStockOnly,
      sizes: selectedSizes,
      priceMin: state.priceMin,
      priceMax: state.priceMax,
      limit: LIMIT,
      offset,
    });

    totalProducts = products.length; // We'll use this for pagination
    currentPage = page;

    if (countEl) countEl.textContent = `${products.length} product${products.length !== 1 ? 's' : ''}`;

    if (!products.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:var(--space-16) var(--space-8)">
          <div style="font-size:4rem;margin-bottom:var(--space-4)">○</div>
          <h3 style="margin-bottom:var(--space-2)">No products found</h3>
          <p style="color:var(--text-muted);margin-bottom:var(--space-6)">Try adjusting your filters.</p>
          <button class="btn btn-secondary" id="empty-clear-btn">Clear Filters</button>
        </div>
      `;
      document.getElementById('empty-clear-btn')?.addEventListener('click', clearFilters);
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    grid.innerHTML = products.map(productCard).join('');
    renderPagination(page, Math.ceil(totalProducts / LIMIT));
    initWishlistBtns();
    initCardSliders();

  } catch (err) {
    console.error('loadProducts:', err);
    toast.error('Could not load products.');
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:var(--space-8)">Failed to load products.</p>';
  }
}

function productCard(p) {
  const price = p.minPrice ? formatRWF(p.minPrice) : null;
  const hasMultiple = p.maxPrice && p.maxPrice !== p.minPrice;
  const images = (p.media || []).filter(m => !m.url?.match(/\.(mp4|webm|mov)$/i));
  const hasSlider = images.length > 1;
  const placeholder = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='533'%3E%3Crect width='400' height='533' fill='%23161616'/%3E%3C/svg%3E`;

  return `
    <article class="product-card" role="article" data-id="${p.id}">
      <div class="product-card-image" style="position:relative">
        <a href="/product/?slug=${p.slug}" class="product-card-img-link" tabindex="-1">
          ${hasSlider ? `
            <div class="card-slider" data-idx="0">
              ${images.map((m, i) => `
                <img src="${m.url}" alt="${m.alt || p.name}" loading="${i === 0 ? 'eager' : 'lazy'}" width="400" height="533"
                  class="card-slide ${i === 0 ? 'active' : ''}"
                  onerror="this.src='${placeholder}'">
              `).join('')}
            </div>
            <button class="card-slide-prev" aria-label="Previous image">‹</button>
            <button class="card-slide-next" aria-label="Next image">›</button>
            <div class="card-slide-dots">
              ${images.map((_, i) => `<span class="card-dot ${i === 0 ? 'active' : ''}"></span>`).join('')}
            </div>
          ` : `
            <img src="${images[0]?.url || placeholder}" alt="${p.primaryAlt || p.name}" loading="lazy" width="400" height="533"
              onerror="this.src='${placeholder}'">
          `}
        </a>

        ${p.collaborator ? `<div class="card-collab-badge">${p.collaborator.brand_name || p.collaborator.name}</div>` : ''}
        ${!p.inStock ? `<div class="card-oos-badge">Sold Out</div>` : ''}

        <button class="wishlist-btn ${isWishlisted(p.id) ? 'active' : ''}" data-id="${p.id}" aria-label="Wishlist" aria-pressed="${isWishlisted(p.id)}">
          ${isWishlisted(p.id) ? '♥' : '♡'}
        </button>
      </div>

      <div class="product-card-body">
        <a href="/product/?slug=${p.slug}" class="product-card-info" style="display:block;text-decoration:none">
          <div class="product-card-name">${p.name}</div>
          ${p.collaborator ? `<div class="product-card-collab">x ${p.collaborator.brand_name || p.collaborator.name}</div>` : ''}
          ${p.description ? `<p class="product-card-desc">${p.description.slice(0, 80)}${p.description.length > 80 ? '…' : ''}</p>` : ''}
          <div class="product-card-price">
            ${price
              ? (hasMultiple ? `<span class="from">from </span>` : '') + price
              : '<span style="color:var(--text-muted);font-size:var(--text-xs)">No price set</span>'}
          </div>
        </a>
        <a href="/product/?slug=${p.slug}" class="product-card-cta ${!p.inStock ? 'oos' : ''}">
          ${!p.inStock ? 'Sold Out' : 'Shop Now'}
        </a>
      </div>
    </article>
  `;
}

function initCardSliders() {
  document.querySelectorAll('.card-slider').forEach(slider => {
    const slides = slider.querySelectorAll('.card-slide');
    const dots = slider.closest('.product-card-image').querySelectorAll('.card-dot');
    let idx = 0;

    function goTo(i) {
      slides[idx].classList.remove('active');
      dots[idx]?.classList.remove('active');
      idx = (i + slides.length) % slides.length;
      slides[idx].classList.add('active');
      dots[idx]?.classList.add('active');
    }

    slider.closest('.product-card-image').querySelector('.card-slide-prev')?.addEventListener('click', e => {
      e.preventDefault(); goTo(idx - 1);
    });
    slider.closest('.product-card-image').querySelector('.card-slide-next')?.addEventListener('click', e => {
      e.preventDefault(); goTo(idx + 1);
    });
  });
}

function isWishlisted(id) {
  try { return JSON.parse(localStorage.getItem('cent_wishlist') || '[]').includes(id); } catch { return false; }
}

function initWishlistBtns() {
  document.querySelectorAll('.wishlist-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const id = btn.dataset.id;
      const list = JSON.parse(localStorage.getItem('cent_wishlist') || '[]');
      const idx = list.indexOf(id);
      if (idx >= 0) list.splice(idx, 1); else list.push(id);
      localStorage.setItem('cent_wishlist', JSON.stringify(list));
      const added = idx < 0;
      btn.classList.toggle('active', added);
      btn.textContent = added ? '♥' : '♡';
      toast[added ? 'success' : 'info'](added ? 'Added to wishlist' : 'Removed from wishlist');
    });
  });
}

function renderPagination(page, totalPages) {
  const el = document.getElementById('pagination');
  if (!el || totalPages <= 1) { if (el) el.innerHTML = ''; return; }

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  el.innerHTML = `
    <button class="page-btn" id="prev-page" ${page === 1 ? 'disabled' : ''}>‹</button>
    ${pages.map(p => p === '...'
      ? '<span style="padding:0 var(--space-2);color:var(--text-muted)">…</span>'
      : `<button class="page-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`
    ).join('')}
    <button class="page-btn" id="next-page" ${page === totalPages ? 'disabled' : ''}>›</button>
  `;

  el.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      loadProducts(parseInt(btn.dataset.page));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.getElementById('prev-page')?.addEventListener('click', () => {
    if (page > 1) { loadProducts(page - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });

  document.getElementById('next-page')?.addEventListener('click', () => {
    if (page < totalPages) { loadProducts(page + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
}

function setupEvents() {
  // Sort
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.value = state.sort;
    sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value;
      setParams({ sort: state.sort });
      loadProducts(1);
    });
  }

  // Size buttons — bound dynamically in loadFilters after sizes are fetched

  // In-stock toggle
  const inStockToggle = document.getElementById('in-stock-toggle');
  if (inStockToggle) {
    inStockToggle.checked = state.inStockOnly;
  }

  // Category/collection checkboxes — single select each
  ['category-filters', 'collection-filters'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox') {
        document.querySelectorAll(`#${id} input`).forEach(cb => {
          if (cb !== e.target) cb.checked = false;
        });
      }
    });
  });

  // Apply filters
  document.getElementById('apply-filters-btn')?.addEventListener('click', applyFilters);

  // Clear filters
  document.getElementById('clear-filters')?.addEventListener('click', clearFilters);

  // Mobile filter toggle
  const mobileBtn = document.getElementById('mobile-filter-btn');
  const sidebar = document.getElementById('filter-sidebar');
  const overlay = document.getElementById('filter-overlay');

  if (mobileBtn) {
    mobileBtn.style.display = window.innerWidth < 1024 ? 'flex' : 'none';
    window.addEventListener('resize', () => {
      mobileBtn.style.display = window.innerWidth < 1024 ? 'flex' : 'none';
    });
  }

  mobileBtn?.addEventListener('click', () => {
    sidebar?.classList.add('open');
    overlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
  });

  overlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('open');
    document.body.style.overflow = '';
  });

  // Update page title based on filters
  updatePageTitle();
}

function applyFilters() {
  const catCb = document.querySelector('#category-filters input:checked');
  const colCb = document.querySelector('#collection-filters input:checked');
  const collabCb = document.querySelector('#collab-filters input:checked');

  state.category = catCb?.value || '';
  state.collection = colCb?.value || '';
  state.collab = collabCb?.value || '';
  state.inStockOnly = document.getElementById('in-stock-toggle')?.checked || false;
  state.priceMin = parseInt(document.getElementById('price-min')?.value) || null;
  state.priceMax = parseInt(document.getElementById('price-max')?.value) || null;
  state.sizes = [...selectedSizes];

  setParams({
    category: state.category || null,
    collection: state.collection || null,
    collab: state.collab || null,
    sort: state.sort,
    instock: state.inStockOnly ? '1' : null,
    min: state.priceMin || null,
    max: state.priceMax || null,
    sizes: state.sizes.length ? state.sizes.join(',') : null,
  });

  // Close mobile sidebar
  document.getElementById('filter-sidebar')?.classList.remove('open');
  document.getElementById('filter-overlay')?.classList.remove('open');
  document.body.style.overflow = '';

  updatePageTitle();
  loadProducts(1);
}

function clearFilters() {
  state.category = '';
  state.collection = '';
  state.collab = '';
  state.inStockOnly = false;
  state.priceMin = null;
  state.priceMax = null;
  state.sizes = [];
  selectedSizes = [];

  document.querySelectorAll('#category-filters input, #collection-filters input, #collab-filters input').forEach(cb => cb.checked = false);
  document.getElementById('in-stock-toggle').checked = false;
  document.getElementById('price-min').value = '';
  document.getElementById('price-max').value = '';
  document.querySelectorAll('#size-filters .size-btn').forEach(b => b.classList.remove('selected'));

  document.querySelectorAll('.collab-chip').forEach(b => b.classList.toggle('active', b.dataset.collab === ''));
  setParams({ category: null, collection: null, collab: null, instock: null, min: null, max: null, sizes: null });
  updatePageTitle();
  loadProducts(1);
}

function applyStateToUI() {
  const sortEl = document.getElementById('sort-select');
  if (sortEl) sortEl.value = state.sort;

  if (state.priceMin) document.getElementById('price-min').value = state.priceMin;
  if (state.priceMax) document.getElementById('price-max').value = state.priceMax;
  if (state.inStockOnly) document.getElementById('in-stock-toggle').checked = true;

  selectedSizes.forEach(s => {
    const btn = document.querySelector(`#size-filters .size-btn[data-size="${s}"]`);
    if (btn) btn.classList.add('selected');
  });
}

function updatePageTitle() {
  const titleEl = document.getElementById('page-title');
  if (!titleEl) return;

  if (state.collab) {
    const collabLabel = document.querySelector(`#collab-filters input[value="${state.collab}"]`)?.parentElement?.textContent?.trim();
    titleEl.textContent = collabLabel || 'Collab Drop';
  } else if (state.category) {
    const catLabel = document.querySelector(`#category-filters input[value="${state.category}"]`)?.parentElement?.textContent?.trim();
    titleEl.textContent = catLabel || 'Products';
  } else if (state.collection) {
    const colLabel = document.querySelector(`#collection-filters input[value="${state.collection}"]`)?.parentElement?.textContent?.trim();
    titleEl.textContent = colLabel ? `Collection: ${colLabel}` : 'Products';
  } else {
    titleEl.textContent = 'All Products';
  }
}
