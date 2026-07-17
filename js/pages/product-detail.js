import { renderNav } from '../components/nav.js';
import { renderFooter } from '../components/footer.js';
import { formatRWF, getParam, toast, modal, renderMarkdown } from '../lib/utils.js';
import { pageUrl } from '../lib/paths.js';

renderNav();
renderFooter();

const slug = getParam('slug');
if (!slug) { window.location.href = pageUrl('products/'); }

let getProductBySlug, getRelatedProducts, subscribeToRestock;
let addToCart, updateCartBadges, getLocalCart;

Promise.all([
  import('../lib/api.js'),
  import('../lib/cart.js'),
]).then(([api, cart]) => {
  ({ getProductBySlug, getRelatedProducts, subscribeToRestock } = api);
  ({ addToCart, updateCartBadges, getLocalCart } = cart);
  updateCartBadges();
  if (slug) loadProduct();
}).catch(() => {
  const layout = document.getElementById('product-layout');
  if (layout) layout.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:var(--space-16)">
      <h2>Could not connect</h2>
      <button class="btn btn-secondary" onclick="location.reload()" style="margin-top:var(--space-4)">Retry</button>
    </div>
  `;
});

let currentProduct = null;
let selectedVariant = null;
let currentQty = 1;
let currentImageIdx = 0;
let currentMedia = [];

async function loadProduct() {
  try {
    const product = await getProductBySlug(slug);
    if (!product) { window.location.href = pageUrl('products/'); return; }

    currentProduct = product;
    document.title = `${product.name} — CENT`;

    // Breadcrumb
    document.getElementById('breadcrumb-name').textContent = product.name;
    if (product.categories) {
      const catLink = document.getElementById('breadcrumb-category');
      catLink.textContent = product.categories.name;
      catLink.href = `${pageUrl('products/')}?category=${product.categories.slug}`;
    }

    renderProductLayout(product);

    // Load related products
    if (product.categories?.id) {
      loadRelated(product.categories.id, product.id);
    }

  } catch (err) {
    console.error('loadProduct:', err);
    document.getElementById('product-layout').innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:var(--space-16)">
        <h2>Product not found</h2>
        <a href="${pageUrl('products/')}" class="btn btn-primary" style="margin-top:var(--space-4)">Browse Products</a>
      </div>
    `;
  }
}

function renderProductLayout(product) {
  const layout = document.getElementById('product-layout');
  if (!layout) return;

  const media = product.media || [];
  const variants = product.variants || [];
  const sizes = [...new Set(variants.map(v => v.size).filter(Boolean))];
  const colors = [...new Set(variants.map(v => v.color).filter(Boolean))];

  // Default to first in-stock variant
  selectedVariant = variants.find(v => v.stock > 0) || variants[0];
  currentImageIdx = 0;

  const mainImg = media[0]?.url || '';

  layout.innerHTML = `
    <div class="gallery">
      <div class="gallery-main">
        <img id="gallery-main-img" src="${mainImg}" alt="${product.name}" width="600" height="800"
          onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22800%22%3E%3Crect width=%22600%22 height=%22800%22 fill=%22%23161616%22/%3E%3C/svg%3E'"
          loading="eager">
        ${media.length > 1 ? `
          <button class="gallery-prev" id="gallery-prev" aria-label="Previous image">‹</button>
          <button class="gallery-next" id="gallery-next" aria-label="Next image">›</button>
        ` : ''}
      </div>
      ${media.length > 1 ? `
        <div class="gallery-thumbs" id="gallery-thumbs">
          ${media.map((m, i) => `
            <button class="gallery-thumb ${i === 0 ? 'active' : ''}" data-idx="${i}" aria-label="View image ${i + 1}">
              <img src="${m.url}" alt="${m.alt || product.name}" loading="lazy"
                onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2272%22 height=%2296%22%3E%3Crect width=%2272%22 height=%2296%22 fill=%22%23161616%22/%3E%3C/svg%3E'">
            </button>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <div class="product-info">
      <h1>${product.name}</h1>
      <div class="product-price" id="product-price">
        ${selectedVariant ? formatRWF(selectedVariant.price_cents) : 'N/A'}
      </div>
      <p class="product-short-desc">${product.description ? product.description.slice(0, 200) + (product.description.length > 200 ? '...' : '') : ''}</p>

      ${sizes.length ? `
        <div style="margin-bottom:var(--space-6)">
          <div class="picker-label">
            Size <span class="size-guide-link" id="size-guide-link">Size Guide</span>
          </div>
          <div style="display:flex;gap:var(--space-2);flex-wrap:wrap" id="size-picker">
            ${sizes.map(s => {
              const v = variants.find(v => v.size === s);
              const oos = !v || v.stock === 0;
              const sel = selectedVariant?.size === s;
              return `<button class="size-btn ${oos ? 'oos' : ''} ${sel ? 'selected' : ''}" data-size="${s}" ${oos ? 'disabled' : ''}>${s}</button>`;
            }).join('')}
          </div>
        </div>
      ` : ''}

      ${colors.length ? `
        <div style="margin-bottom:var(--space-6)">
          <div class="picker-label">Color: <span style="font-weight:400;color:var(--text-muted)" id="color-label">${selectedVariant?.color || ''}</span></div>
          <div style="display:flex;gap:var(--space-2);flex-wrap:wrap" id="color-picker">
            ${colors.map(c => {
              const v = variants.find(v => v.color === c);
              const oos = !v || (v.stock !== null && v.stock === 0);
              const sel = selectedVariant?.color === c;
              return `<button class="color-swatch ${oos ? 'oos' : ''} ${sel ? 'selected' : ''}" data-color="${c}"
                style="background:${c.toLowerCase()}" title="${c}${oos ? ' (out of stock)' : ''}"></button>`;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <div class="stock-indicator" id="stock-indicator" aria-live="polite">
        ${stockLabel(selectedVariant)}
      </div>

      <div id="notify-section" class="${selectedVariant?.stock === 0 ? '' : 'hidden'}" style="margin-top:var(--space-4)">
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:var(--space-4)">
          <div style="font-size:var(--text-sm);font-weight:600;margin-bottom:var(--space-1)">Get notified when it restocks</div>
          <div style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:var(--space-3)">We'll email you the moment this size is back.</div>
          <div style="display:flex;gap:var(--space-2)" id="notify-form">
            <input type="email" class="input input-sm" id="notify-email" placeholder="your@email.com" style="flex:1">
            <button class="btn btn-secondary btn-sm" id="notify-submit-btn">Notify me</button>
          </div>
          <div id="notify-success" class="hidden" style="font-size:var(--text-sm);color:var(--success);margin-top:var(--space-2)">✓ You're on the list — we'll email you when it's back.</div>
        </div>
      </div>

      <div class="add-to-cart-section">
        <div class="add-to-cart-row" style="align-items:center">
          <div style="flex-shrink:0">
            <div class="qty-stepper" aria-label="Quantity">
              <button id="qty-minus" aria-label="Decrease quantity" ${currentQty <= 1 ? 'disabled' : ''}>−</button>
              <input type="number" id="qty-input" value="1" min="1" max="${selectedVariant?.stock || 1}" aria-label="Quantity">
              <button id="qty-plus" aria-label="Increase quantity">+</button>
            </div>
          </div>
          <button class="btn btn-primary btn-lg w-full" id="add-to-cart-btn"
            ${!selectedVariant || selectedVariant.stock === 0 ? 'disabled' : ''}>
            Add to Cart
          </button>
        </div>
        <div style="display:flex;gap:var(--space-2)">
          <button class="btn btn-secondary" id="wishlist-btn" aria-label="Add to wishlist" aria-pressed="${isWishlisted(product.id)}" style="flex:1">
            ${isWishlisted(product.id) ? '♥ Wishlisted' : '♡ Wishlist'}
          </button>
          <button class="btn btn-secondary" id="share-product-btn" aria-label="Share product" style="flex:1">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:4px"><path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Z"/></svg>
            Share
          </button>
        </div>
      </div>
    </div>
  `;

  // Set initial media to the selected variant's images (or product-level if none)
  currentMedia = media;

  // Gallery events — always use currentMedia so variant swaps work
  document.getElementById('gallery-prev')?.addEventListener('click', () => navigateGallery(-1, currentMedia));
  document.getElementById('gallery-next')?.addEventListener('click', () => navigateGallery(1, currentMedia));
  document.querySelectorAll('.gallery-thumb').forEach(btn => {
    btn.addEventListener('click', () => setGalleryImage(parseInt(btn.dataset.idx), currentMedia));
  });

  if (media.length > 1) {
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') navigateGallery(-1, currentMedia);
      if (e.key === 'ArrowRight') navigateGallery(1, currentMedia);
    });
  }

  // Size picker
  document.querySelectorAll('#size-picker .size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#size-picker .size-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const size = btn.dataset.size;
      const colorSel = document.querySelector('#color-picker .color-swatch.selected')?.dataset.color;
      selectedVariant = variants.find(v => v.size === size && (colorSel ? v.color === colorSel : true))
        || variants.find(v => v.size === size);
      updateProductState();
    });
  });

  // Color picker
  document.querySelectorAll('#color-picker .color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#color-picker .color-swatch').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const color = btn.dataset.color;
      const colorLabel = document.getElementById('color-label');
      if (colorLabel) colorLabel.textContent = color;
      const sizeSel = document.querySelector('#size-picker .size-btn.selected')?.dataset.size;
      selectedVariant = variants.find(v => v.color === color && (sizeSel ? v.size === sizeSel : true))
        || variants.find(v => v.color === color);
      updateProductState();
    });
  });

  // Quantity
  const qtyInput = document.getElementById('qty-input');
  const qtyMinus = document.getElementById('qty-minus');
  const qtyPlus = document.getElementById('qty-plus');

  qtyMinus?.addEventListener('click', () => { if (currentQty > 1) { currentQty--; updateQtyInput(); } });
  qtyPlus?.addEventListener('click', () => {
    const max = selectedVariant?.stock || 1;
    if (currentQty < max) { currentQty++; updateQtyInput(); }
  });
  qtyInput?.addEventListener('change', () => {
    const max = selectedVariant?.stock || 1;
    currentQty = Math.max(1, Math.min(parseInt(qtyInput.value) || 1, max));
    updateQtyInput();
  });

  // Add to cart
  document.getElementById('add-to-cart-btn')?.addEventListener('click', handleAddToCart);

  // Wishlist
  document.getElementById('wishlist-btn')?.addEventListener('click', () => {
    const list = JSON.parse(localStorage.getItem('cent_wishlist') || '[]');
    const idx = list.indexOf(product.id);
    if (idx >= 0) list.splice(idx, 1); else list.push(product.id);
    localStorage.setItem('cent_wishlist', JSON.stringify(list));
    const added = idx < 0;
    document.getElementById('wishlist-btn').textContent = added ? '♥ Wishlisted' : '♡ Wishlist';
    document.getElementById('wishlist-btn').setAttribute('aria-pressed', added);
    toast[added ? 'success' : 'info'](added ? 'Added to wishlist' : 'Removed from wishlist');
  });

  // Share product
  document.getElementById('share-product-btn')?.addEventListener('click', async () => {
    const url = window.location.href;
    const title = product.name;
    if (navigator.share) {
      try { await navigator.share({ title, text: `Check out ${title} on CENT`, url }); return; } catch {}
    }
    const { copyToClipboard } = await import('../lib/utils.js');
    await copyToClipboard(url);
    toast.success('Product link copied!');
  });

  // Notify me when restocked
  document.getElementById('notify-submit-btn')?.addEventListener('click', async () => {
    const emailEl = document.getElementById('notify-email');
    const email = emailEl?.value.trim();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      toast.error('Enter a valid email address.');
      emailEl?.focus();
      return;
    }
    const btn = document.getElementById('notify-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      await subscribeToRestock({
        productId: product.id,
        variantId: selectedVariant?.id,
        email,
        size: selectedVariant?.size || null,
        color: selectedVariant?.color || null,
      });
      document.getElementById('notify-form')?.classList.add('hidden');
      document.getElementById('notify-success')?.classList.remove('hidden');
    } catch {
      toast.error('Could not save. Please try again.');
      btn.disabled = false;
      btn.textContent = 'Notify me';
    }
  });

  // Size guide
  document.getElementById('size-guide-link')?.addEventListener('click', () => {
    document.querySelector('#size-guide-modal .modal-close')?.addEventListener('click', () => modal.close('size-guide-modal'), { once: true });
    modal.open('size-guide-modal');
  });

  // Full description
  if (product.description) {
    const section = document.getElementById('full-desc-section');
    const body = document.getElementById('full-desc-body');
    if (section && body) {
      section.classList.remove('hidden');
      body.innerHTML = renderMarkdown(product.description);
    }
  }

  // Cart drawer
  document.getElementById('cart-drawer-close')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cart-drawer-overlay')?.addEventListener('click', closeCartDrawer);
}

function navigateGallery(dir, media) {
  currentImageIdx = (currentImageIdx + dir + media.length) % media.length;
  setGalleryImage(currentImageIdx, media);
}

function setGalleryImage(idx, media) {
  currentImageIdx = idx;
  const img = document.getElementById('gallery-main-img');
  if (img) {
    img.style.opacity = '0.6';
    img.src = media[idx].url;
    img.alt = media[idx].alt || '';
    img.onload = () => img.style.opacity = '1';
  }
  document.querySelectorAll('.gallery-thumb').forEach(b => b.classList.toggle('active', parseInt(b.dataset.idx) === idx));
}

function updateProductState() {
  const priceEl = document.getElementById('product-price');
  const stockEl = document.getElementById('stock-indicator');
  const addBtn = document.getElementById('add-to-cart-btn');
  const notifySection = document.getElementById('notify-section');

  if (priceEl) priceEl.textContent = selectedVariant ? formatRWF(selectedVariant.price_cents) : 'N/A';
  if (stockEl) stockEl.textContent = stockLabel(selectedVariant);
  if (addBtn) addBtn.disabled = !selectedVariant || selectedVariant.stock === 0;

  // Swap gallery to variant-specific images
  if (selectedVariant && currentProduct) {
    const allMedia = currentProduct.allMedia || currentProduct.media || [];
    const variantMedia = allMedia.filter(m => m.variant_id === selectedVariant.id);
    const displayMedia = variantMedia.length ? variantMedia : (currentProduct.media || []).filter(m => !m.variant_id);
    if (displayMedia.length) {
      currentMedia = displayMedia;
      currentImageIdx = 0;
      const main = document.getElementById('gallery-main-img');
      if (main) { main.src = displayMedia[0].url; main.alt = displayMedia[0].alt || ''; }
      const thumbs = document.getElementById('gallery-thumbs');
      if (thumbs) {
        thumbs.innerHTML = displayMedia.map((m, i) => `
          <button class="gallery-thumb ${i === 0 ? 'active' : ''}" data-idx="${i}" aria-label="View image ${i + 1}">
            <img src="${m.url}" alt="${m.alt || ''}" loading="lazy">
          </button>`).join('');
        thumbs.querySelectorAll('.gallery-thumb').forEach(btn => {
          btn.addEventListener('click', () => setGalleryImage(parseInt(btn.dataset.idx), currentMedia));
        });
      }
    }
  }

  const oos = !selectedVariant || selectedVariant.stock === 0;
  if (notifySection) {
    notifySection.classList.toggle('hidden', !oos);
    // Reset form on variant change
    document.getElementById('notify-form')?.classList.remove('hidden');
    document.getElementById('notify-success')?.classList.add('hidden');
    const emailInput = document.getElementById('notify-email');
    if (emailInput) emailInput.value = '';
  }

  const max = selectedVariant?.stock || 1;
  currentQty = Math.min(currentQty, max);
  updateQtyInput();
}

function updateQtyInput() {
  const input = document.getElementById('qty-input');
  const minus = document.getElementById('qty-minus');
  const plus = document.getElementById('qty-plus');
  if (input) input.value = currentQty;
  if (minus) minus.disabled = currentQty <= 1;
  if (plus) plus.disabled = currentQty >= (selectedVariant?.stock || 1);
}

function stockLabel(variant) {
  if (!variant) return '';
  if (variant.stock === 0) return '✕ Out of stock';
  if (variant.stock <= 5) return `⚠ Only ${variant.stock} left in stock`;
  return '✓ In stock';
}

function isWishlisted(id) {
  try { return JSON.parse(localStorage.getItem('cent_wishlist') || '[]').includes(id); } catch { return false; }
}

async function handleAddToCart() {
  if (!selectedVariant || !currentProduct) return;
  const btn = document.getElementById('add-to-cart-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Adding...';

  try {
    await addToCart({
      variantId: selectedVariant.id,
      quantity: currentQty,
      productName: currentProduct.name,
      size: selectedVariant.size,
      color: selectedVariant.color,
      priceCents: selectedVariant.price_cents,
      imageUrl: currentProduct.primaryImage,
    });
    openCartDrawer();
    toast.success(`${currentProduct.name} added to cart`);
    btn.disabled = false;
    btn.textContent = 'Add to Cart';
  } catch {
    toast.error('Could not add to cart. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Add to Cart';
  }
}

function openCartDrawer() {
  const overlay = document.getElementById('cart-drawer-overlay');
  const drawer = document.getElementById('cart-drawer');
  if (!overlay || !drawer) return;
  overlay.classList.remove('hidden');
  drawer.classList.remove('closed');
  document.body.style.overflow = 'hidden';
  renderDrawerContents();
}

function closeCartDrawer() {
  document.getElementById('cart-drawer-overlay')?.classList.add('hidden');
  document.getElementById('cart-drawer')?.classList.add('closed');
  document.body.style.overflow = '';
}

function renderDrawerContents() {
  const body = document.getElementById('cart-drawer-body');
  if (!body) return;
  const state = getLocalCart();
  if (!state.items.length) {
    body.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:var(--space-8)">Cart is empty.</p>';
    return;
  }
  body.innerHTML = state.items.map(item => `
    <div style="display:flex;gap:var(--space-3);padding:var(--space-3) 0;border-bottom:1px solid var(--border)">
      <img src="${item.imageUrl || ''}" alt="${item.productName}" style="width:56px;height:75px;object-fit:cover;border-radius:var(--radius);background:var(--bg-card)" loading="lazy">
      <div>
        <div style="font-size:var(--text-sm);font-weight:600">${item.productName}</div>
        ${item.size ? `<div style="font-size:var(--text-xs);color:var(--text-muted)">${item.size}${item.color ? ' · '+item.color : ''}</div>` : ''}
        <div style="font-size:var(--text-sm);font-weight:700;margin-top:2px">${formatRWF(item.priceCents)} × ${item.quantity}</div>
      </div>
    </div>
  `).join('');
}

async function loadRelated(categoryId, excludeId) {
  try {
    const products = await getRelatedProducts(categoryId, excludeId, 4);
    if (!products.length) return;

    const section = document.getElementById('related-section');
    const grid = document.getElementById('related-grid');
    if (!section || !grid) return;

    section.classList.remove('hidden');
    grid.innerHTML = products.map(p => `
      <article class="product-card">
        <a href="${pageUrl('product/')}?slug=${p.slug}" class="product-card-image">
          <img src="${p.primaryImage || ''}" alt="${p.name}" loading="lazy" width="400" height="533"
            onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22533%22%3E%3Crect width=%22400%22 height=%22533%22 fill=%22%23161616%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 fill=%22%23444%22 font-size=%2236%22 letter-spacing=%224%22 font-family=%22system-ui%22%3Ecent%3C/text%3E%3C/svg%3E'">
        </a>
        <a href="${pageUrl('product/')}?slug=${p.slug}" class="product-card-body" style="display:block;text-decoration:none">
          <div class="product-card-name">${p.name}</div>
          <div class="product-card-price">${p.minPrice ? formatRWF(p.minPrice) : 'N/A'}</div>
        </a>
      </article>
    `).join('');
  } catch { /* silent */ }
}
