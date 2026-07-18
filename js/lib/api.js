import { supabase, EDGE_URL } from './supabase.js';
import { withCache, invalidate, invalidatePrefix } from './cache.js';

const TTL = { short: 2 * 60_000, medium: 5 * 60_000, long: 10 * 60_000 };

// ── PRODUCTS ─────────────────────────────────────────────────────────────────

export async function getProducts({ categorySlug, collectionSlug, collaboratorSlug, featured, sort, limit = 20, offset = 0, sizes = [], inStockOnly = false, priceMin = null, priceMax = null } = {}) {
  const isPriceSort = sort === 'price_asc' || sort === 'price_desc';

  let query = supabase
    .from('products')
    .select(`
      id, slug, name, description, is_featured, is_active, collaborator_id,
      categories:category_id(id, slug, name),
      collections:collection_id(id, slug, name),
      collaborators:collaborator_id(id, slug, name, brand_name, logo_url),
      product_variants(id, size, color, price_cents, stock, is_active),
      product_media(url, alt, is_primary, sort_order, variant_id)
    `)
    .eq('is_active', true);

  if (!isPriceSort) query = query.range(offset, offset + limit - 1);

  if (categorySlug) {
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', categorySlug).single();
    if (cat) query = query.eq('category_id', cat.id);
  }

  if (collectionSlug) {
    const { data: col } = await supabase.from('collections').select('id').eq('slug', collectionSlug).single();
    if (col) query = query.eq('collection_id', col.id);
  }

  if (collaboratorSlug) {
    const { data: collab } = await supabase.from('collaborators').select('id').eq('slug', collaboratorSlug).single();
    if (collab) query = query.eq('collaborator_id', collab.id);
    else return [];
  }

  if (featured !== undefined) query = query.eq('is_featured', featured);

  if (!isPriceSort) {
    switch (sort) {
      case 'featured':
        query = query.order('is_featured', { ascending: false }).order('created_at', { ascending: false }); break;
      default:
        query = query.order('created_at', { ascending: false });
    }
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;

  let products = (data || []).map(normalizeProduct).filter(p => {
    if (inStockOnly && !p.inStock) return false;
    if (sizes.length && !p.variants.some(v => sizes.includes(v.size) && v.stock > 0)) return false;
    if (priceMin !== null && (p.minPrice === null || p.minPrice < priceMin)) return false;
    if (priceMax !== null && (p.minPrice === null || p.minPrice > priceMax)) return false;
    return true;
  });

  if (sort === 'price_asc') {
    products.sort((a, b) => (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity));
    products = products.slice(offset, offset + limit);
  } else if (sort === 'price_desc') {
    products.sort((a, b) => (b.minPrice ?? -1) - (a.minPrice ?? -1));
    products = products.slice(offset, offset + limit);
  }

  return products;
}

export function getProductBySlug(slug) {
  return withCache('product:' + slug, TTL.short, async () => {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, slug, name, description, is_featured, is_active, created_at, collaborator_id,
        categories:category_id(id, slug, name),
        collections:collection_id(id, slug, name),
        collaborators:collaborator_id(id, slug, name, brand_name, logo_url),
        product_variants(id, sku, size, color, price_cents, stock, is_active),
        product_media(id, url, alt, is_primary, sort_order, variant_id)
      `)
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
    if (error) throw error;
    return normalizeProduct(data);
  });
}

export async function getProductById(id) {
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, slug, name, description, is_featured, is_active, category_id, collection_id, collaborator_id,
      product_variants(id, sku, size, color, price_cents, stock, is_active),
      product_media(id, url, alt, is_primary, sort_order)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getRelatedProducts(categoryId, excludeId, limit = 4) {
  if (!categoryId) return [];
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, slug, name,
      product_variants(price_cents, stock, is_active),
      product_media(url, is_primary)
    `)
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .neq('id', excludeId)
    .limit(limit);

  if (error) throw error;
  return (data || []).map(normalizeProduct);
}

export async function searchProducts(query, limit = 8) {
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, slug, name,
      categories:category_id(name),
      product_variants(price_cents, is_active),
      product_media(url, is_primary)
    `)
    .ilike('name', `%${query}%`)
    .eq('is_active', true)
    .limit(limit);

  if (error) throw error;
  return (data || []).map(normalizeProduct);
}

function normalizeProduct(p) {
  if (!p) return null;
  const variants = (p.product_variants || []).filter(v => v.is_active);
  const prices = variants.map(v => v.price_cents).filter(Boolean);
  const allMedia = [...(p.product_media || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  // Product-level media = no variant_id; variant media is served separately
  const media = allMedia.filter(m => !m.variant_id);
  const primary = media.find(m => m.is_primary) || media[0];

  return {
    ...p,
    variants,
    media,           // product-level only (no variant_id)
    allMedia: allMedia, // full list including variant media
    primaryImage: primary?.url || null,
    primaryAlt: primary?.alt || p.name,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    inStock: variants.some(v => v.stock > 0),
    collaborator: p.collaborators || null,
  };
}

// ── SIZES ─────────────────────────────────────────────────────────────────────

export function getAvailableSizes() {
  return withCache('sizes', TTL.medium, async () => {
    const { data, error } = await supabase
      .from('product_variants')
      .select('size')
      .eq('is_active', true)
      .not('size', 'is', null);
    if (error) throw error;
    const unique = [...new Set((data || []).map(v => v.size).filter(Boolean))];
    const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'OS', 'ONE SIZE'];
    return unique.sort((a, b) => {
      const ia = order.indexOf(a.toUpperCase());
      const ib = order.indexOf(b.toUpperCase());
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  });
}

// ── COLLABORATORS ─────────────────────────────────────────────────────────────

export function getCollaborators() {
  return withCache('collaborators', TTL.medium, async () => {
    const { data, error } = await supabase
      .from('collaborators')
      .select('id, slug, name, brand_name, description, logo_url, banner_url, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return data || [];
  });
}

export async function getCollaboratorBySlug(slug) {
  const { data, error } = await supabase
    .from('collaborators')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();
  if (error) throw error;
  return data;
}

export async function getAdminCollaborators() {
  const { data, error } = await supabase
    .from('collaborators')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function upsertCollaborator(collab) {
  if (collab.id) {
    const { error } = await supabase.from('collaborators').update(collab).eq('id', collab.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('collaborators').insert(collab);
    if (error) throw error;
  }
}

export async function deleteCollaborator(id) {
  const { error } = await supabase.from('collaborators').delete().eq('id', id);
  if (error) throw error;
}

// ── CATEGORIES / COLLECTIONS ──────────────────────────────────────────────────

export function getCategories() {
  return withCache('categories', TTL.long, async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('id, slug, name, description, parent_id, sort_order')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return data || [];
  });
}

export function getCollections() {
  return withCache('collections', TTL.long, async () => {
    const { data, error } = await supabase
      .from('collections')
      .select('id, slug, name, description')
      .eq('is_active', true);
    if (error) throw error;
    return data || [];
  });
}

export async function getAdminCollections() {
  const { data, error } = await supabase
    .from('collections')
    .select('id, slug, name, description, is_active, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function upsertCollection(row) {
  const { data, error } = await supabase
    .from('collections')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCollection(id) {
  const { error } = await supabase.from('collections').delete().eq('id', id);
  if (error) throw error;
}

// ── CART ──────────────────────────────────────────────────────────────────────

export async function getOrCreateCart(sessionToken, userId = null) {
  if (sessionToken) {
    const { data } = await supabase
      .from('carts')
      .select('id')
      .eq('session_token', sessionToken)
      .maybeSingle();
    if (data) return data.id;
  }

  const token = sessionToken || crypto.randomUUID();
  const { data, error } = await supabase
    .from('carts')
    .insert({ session_token: token, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function getCartItems(cartId) {
  const { data, error } = await supabase
    .from('cart_items')
    .select(`
      id, quantity,
      product_variants(
        id, size, color, price_cents, stock, is_active,
        products(id, slug, name, product_media(url, is_primary, sort_order))
      )
    `)
    .eq('cart_id', cartId);

  if (error) throw error;
  return (data || []).map(item => {
    const v = item.product_variants;
    const p = v?.products;
    const media = [...(p?.product_media || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const img = media.find(m => m.is_primary) || media[0];
    return {
      id: item.id,
      quantity: item.quantity,
      variantId: v?.id,
      size: v?.size,
      color: v?.color,
      priceCents: v?.price_cents,
      stock: v?.stock,
      variantActive: v?.is_active,
      productId: p?.id,
      productSlug: p?.slug,
      productName: p?.name,
      imageUrl: img?.url || null,
    };
  });
}

export async function upsertCartItem(cartId, variantId, quantity, unitPriceCents = 0) {
  const { data: existing } = await supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('cart_id', cartId)
    .eq('variant_id', variantId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: existing.quantity + quantity })
      .eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  } else {
    const { data, error } = await supabase
      .from('cart_items')
      .insert({ cart_id: cartId, variant_id: variantId, quantity, unit_price_cents: unitPriceCents })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }
}

export async function updateCartItemQty(itemId, quantity) {
  if (quantity <= 0) {
    return removeCartItem(itemId);
  }
  const { error } = await supabase.from('cart_items').update({ quantity }).eq('id', itemId);
  if (error) throw error;
}

export async function removeCartItem(itemId) {
  const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function clearCart(cartId) {
  const { error } = await supabase.from('cart_items').delete().eq('cart_id', cartId);
  if (error) throw error;
}

// ── ORDERS ────────────────────────────────────────────────────────────────────

export async function getOrderByToken(token) {
  // get_public_order is a SECURITY DEFINER RPC that validates the exact token
  // match server-side, so it can safely return the customer's name/email/phone
  // (and items/payment info) to a guest without exposing every customer's PII
  // the way a blanket "public_token IS NOT NULL" RLS policy would.
  const { data, error } = await supabase.rpc('get_public_order', { p_token: token });
  if (error) throw error;
  if (!data) throw new Error('Order not found');
  return data;
}

export async function getOrderById(id) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, public_token, status, payment_status, total_cents, subtotal_cents, shipping_cents, discount_cents, shipping_address, note, created_at, updated_at,
      customers(id, email, full_name, phone),
      payment_channels:payment_channel_id(id, name, number),
      order_items(id, product_name, size, color, unit_price_cents, quantity, image_url, variant_id),
      payment_submissions(id, payer_name, payer_phone, reference_code, amount_paid_cents, proof_storage_path, created_at, status),
      receipts(id, receipt_number, created_at)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getOrdersByCustomer(customerId) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, public_token, status, payment_status, total_cents, created_at, order_items(quantity)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getAdminOrders({ status, search, limit = 25, offset = 0 } = {}) {
  let query = supabase
    .from('orders')
    .select(`
      id, public_token, status, payment_status, total_cents, created_at,
      customers(full_name, email),
      payment_channels:payment_channel_id(name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  if (error) throw error;
  return { orders: data || [], total: count };
}

// ── PAYMENT CHANNELS ──────────────────────────────────────────────────────────

export function getPaymentChannels() {
  return withCache('payment_channels', TTL.long, async () => {
    const { data, error } = await supabase
      .from('payment_channels')
      .select('id, name, number, instructions, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return data || [];
  });
}

export async function getAllPaymentChannels() {
  const { data, error } = await supabase
    .from('payment_channels')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function upsertPaymentChannel(channel) {
  if (channel.id) {
    const { error } = await supabase.from('payment_channels').update(channel).eq('id', channel.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('payment_channels').insert(channel);
    if (error) throw error;
  }
}

export async function deletePaymentChannel(id) {
  const { error } = await supabase.from('payment_channels').delete().eq('id', id);
  if (error) throw error;
}

// ── PROMOTIONS ────────────────────────────────────────────────────────────────

export async function validatePromoCode(code) {
  const { data, error } = await supabase
    .from('promotions')
    .select('id, code, discount_type, discount_value, max_uses, uses_count, min_order_cents, valid_until, is_active')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;
  if (data.max_uses && data.uses_count >= data.max_uses) return null;
  if (data.valid_until && new Date(data.valid_until) < new Date()) return null;
  return data;
}

export async function getAdminPromotions() {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function upsertPromotion(promo) {
  if (promo.id) {
    const { error } = await supabase.from('promotions').update(promo).eq('id', promo.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('promotions').insert(promo);
    if (error) throw error;
  }
}

export async function deletePromotion(id) {
  const { error } = await supabase.from('promotions').delete().eq('id', id);
  if (error) throw error;
}

// ── CMS ───────────────────────────────────────────────────────────────────────

export async function getSiteSection(key) {
  const { data } = await supabase
    .from('site_sections')
    .select('*')
    .eq('key', key)
    .eq('is_active', true)
    .maybeSingle();
  return data;
}

export async function getAllSiteSections() {
  const { data, error } = await supabase.from('site_sections').select('*').order('key');
  if (error) throw error;
  return data || [];
}

export async function updateSiteSection(key, updates) {
  const { data, error } = await supabase
    .from('site_sections')
    .update(updates)
    .eq('key', key)
    .select('id');
  if (error) throw error;
  if (!data?.length) {
    const { error: insErr } = await supabase.from('site_sections').insert({ key, ...updates });
    if (insErr) throw insErr;
  }
}

export async function getFaqItems() {
  const { data, error } = await supabase
    .from('faq_items')
    .select('id, question, answer, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function getAllFaqItems() {
  const { data, error } = await supabase
    .from('faq_items')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function upsertFaqItem(item) {
  if (item.id) {
    const { error } = await supabase.from('faq_items').update(item).eq('id', item.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('faq_items').insert(item);
    if (error) throw error;
  }
}

export async function deleteFaqItem(id) {
  const { error } = await supabase.from('faq_items').delete().eq('id', id);
  if (error) throw error;
}

// ── CMS SITE IMAGES ───────────────────────────────────────────────────────────

export const CMS_IMAGE_SECTIONS = [
  { key: 'every_cent_matters', label: 'Home — Every Cent Matters' },
  { key: 'about_story', label: 'About — Born from the streets of Kigali' },
  { key: 'about_mission', label: 'About — Authentic. Affordable. Unapologetic.' },
];

const CMS_MEDIA_KEY = 'cms_media_library';
const MAX_LIVE_CMS_IMAGES = 3;

function parseCmsMediaBody(body) {
  if (!body) return [];
  try {
    const parsed = JSON.parse(body);
    return Array.isArray(parsed.images) ? parsed.images : [];
  } catch {
    return [];
  }
}

/** Admin: full media library (includes non-live). */
export async function getCmsMediaLibrary() {
  const { data, error } = await supabase
    .from('site_sections')
    .select('body')
    .eq('key', CMS_MEDIA_KEY)
    .maybeSingle();
  if (error) throw error;
  return parseCmsMediaBody(data?.body);
}

/** Storefront: live images keyed by section (max 3 live total). */
export async function getLiveCmsImagesBySection() {
  const { data } = await supabase
    .from('site_sections')
    .select('body')
    .eq('key', CMS_MEDIA_KEY)
    .eq('is_active', true)
    .maybeSingle();
  const images = parseCmsMediaBody(data?.body);
  const map = {};
  for (const img of images) {
    if (img.is_live && img.section_key && img.url) {
      map[img.section_key] = img.url;
    }
  }
  return map;
}

export async function saveCmsMediaLibrary(images) {
  const liveCount = images.filter(i => i.is_live).length;
  if (liveCount > MAX_LIVE_CMS_IMAGES) {
    throw new Error(`At most ${MAX_LIVE_CMS_IMAGES} images can be live on the site.`);
  }
  const usedSections = new Set();
  for (const img of images) {
    if (!img.is_live || !img.section_key) continue;
    if (usedSections.has(img.section_key)) {
      throw new Error('Each section can only have one live image.');
    }
    usedSections.add(img.section_key);
  }
  await updateSiteSection(CMS_MEDIA_KEY, {
    body: JSON.stringify({ images }),
    is_active: true,
    title: 'CMS media library',
  });
}

export const CMS_IMAGES_BUCKET = 'cms-images';

export async function uploadCmsImage(file) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(CMS_IMAGES_BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(CMS_IMAGES_BUCKET).getPublicUrl(path);
  return { url: publicUrl, storage_path: path };
}

// ── CUSTOMERS ─────────────────────────────────────────────────────────────────

export async function getAdminGuestCustomers({ search } = {}) {
  let query = supabase
    .from('customers')
    .select('id, guest_name, guest_email, guest_phone, created_at')
    .eq('is_guest', true)
    .order('created_at', { ascending: false });
  if (search) query = query.or(`guest_name.ilike.%${search}%,guest_email.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getAdminProfiles({ search, limit = 500 } = {}) {
  let query = supabase
    .from('profiles')
    .select('id, email, full_name, phone, role, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { profiles: data || [], total: count };
}

export async function getAdminCustomers({ search, limit = 25, offset = 0 } = {}) {
  let query = supabase
    .from('customers')
    .select('id, email, full_name, phone, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { customers: data || [], total: count };
}

// ── STAFF ─────────────────────────────────────────────────────────────────────

export async function getStaff() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at')
    .in('role', ['admin', 'ops'])
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function updateStaffRole(userId, role) {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) throw error;
}

// ── CONTACT MESSAGES ──────────────────────────────────────────────────────────

export async function getContactMessages({ onlyUnread = false } = {}) {
  let query = supabase
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false });
  if (onlyUnread) query = query.eq('is_read', false);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function markMessageRead(id) {
  const { error } = await supabase.from('contact_messages').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}

// ── ADMIN PRODUCT MUTATIONS ───────────────────────────────────────────────────

export async function upsertProduct(product) {
  if (product.id) {
    const { data, error } = await supabase.from('products').update(product).eq('id', product.id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase.from('products').insert(product).select().single();
    if (error) throw error;
    return data;
  }
}

export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

export async function getAdminProducts({ search, categoryId, isActive, limit = 25, offset = 0 } = {}) {
  let query = supabase
    .from('products')
    .select(`
      id, slug, name, is_featured, is_active, created_at, category_id, collection_id, collaborator_id,
      categories:category_id(name),
      collaborators:collaborator_id(name, brand_name),
      product_variants(id, price_cents, stock, is_active),
      product_media(url, is_primary, sort_order)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) query = query.ilike('name', `%${search}%`);
  if (categoryId) query = query.eq('category_id', categoryId);
  if (isActive !== undefined) query = query.eq('is_active', isActive);

  const { data, error, count } = await query;
  if (error) throw error;
  return { products: (data || []).map(normalizeProduct), total: count };
}

export async function upsertVariant(variant) {
  if (variant.id) {
    const { data: prev } = await supabase
      .from('product_variants').select('stock').eq('id', variant.id).single();
    const { data, error } = await supabase.from('product_variants').update(variant).eq('id', variant.id).select().single();
    if (error) throw error;
    if (prev?.stock === 0 && variant.stock > 0) {
      callEdge('notify-restock', { variantId: variant.id }).catch(() => {});
    }
    return data;
  } else {
    const { data, error } = await supabase.from('product_variants').insert(variant).select().single();
    if (error) throw error;
    return data;
  }
}

export async function getActivePromotionForProduct(productId, isFeatured = false) {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('promotions')
    .select('*, promotion_products(product_id)')
    .eq('is_active', true)
    .or(`valid_from.is.null,valid_from.lte.${now}`)
    .or(`valid_until.is.null,valid_until.gte.${now}`);
  if (!data?.length) return null;
  for (const promo of data) {
    if (promo.scope === 'site_wide') return promo;
    if (promo.scope === 'featured_only' && isFeatured) return promo;
    if (promo.scope === 'specific_products') {
      const ids = (promo.promotion_products || []).map(pp => pp.product_id);
      if (ids.includes(productId)) return promo;
    }
  }
  return null;
}

export function applyPromotion(priceCents, promo) {
  if (!promo) return priceCents;
  if (promo.discount_type === 'percentage') return Math.round(priceCents * (1 - promo.discount_value / 100));
  if (promo.discount_type === 'fixed') return Math.max(0, priceCents - promo.discount_value);
  return priceCents;
}

export async function getAdminPromotionProducts(promotionId) {
  const { data, error } = await supabase
    .from('promotion_products')
    .select('product_id, products(id, name, slug)')
    .eq('promotion_id', promotionId);
  if (error) throw error;
  return (data || []).map(r => r.products);
}

export async function setPromotionProducts(promotionId, productIds) {
  await supabase.from('promotion_products').delete().eq('promotion_id', promotionId);
  if (!productIds.length) return;
  await supabase.from('promotion_products').insert(productIds.map(pid => ({ promotion_id: promotionId, product_id: pid })));
}

export async function subscribeToRestock({ productId, variantId, email, size, color }) {
  const { error } = await supabase
    .from('stock_notifications')
    .upsert(
      { product_id: productId, variant_id: variantId, email: email.trim().toLowerCase(), size, color },
      { onConflict: 'variant_id,email', ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function getRestockSubscriberCount(variantId) {
  const { count } = await supabase
    .from('stock_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('variant_id', variantId)
    .is('notified_at', null);
  return count || 0;
}

export async function deleteVariant(id) {
  const { error } = await supabase.from('product_variants').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteProductMedia(id) {
  const { error } = await supabase.from('product_media').delete().eq('id', id);
  if (error) throw error;
}

export async function setPrimaryMedia(productId, mediaId) {
  await supabase.from('product_media').update({ is_primary: false }).eq('product_id', productId);
  await supabase.from('product_media').update({ is_primary: true }).eq('id', mediaId);
}

export async function insertProductMedia(record) {
  const { data, error } = await supabase.from('product_media').insert(record).select('id').single();
  if (error) throw error;
  return data;
}

export async function getVariantMedia(variantId) {
  const { data, error } = await supabase
    .from('product_media')
    .select('id, url, alt, is_primary, sort_order')
    .eq('variant_id', variantId)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

// ── EDGE FUNCTION CALLER ──────────────────────────────────────────────────────

export async function callEdge(fnName, body) {
  const session = (await supabase.auth.getSession()).data.session;
  const headers = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

  const res = await fetch(`${EDGE_URL}/${fnName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

// ── RECEIPTS ──────────────────────────────────────────────────────────────────

export async function createReceipt(orderId) {
  const receiptNumber = 'REC-' + Date.now().toString(36).toUpperCase();
  const { data, error } = await supabase
    .from('receipts')
    .insert({ order_id: orderId, receipt_number: receiptNumber })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── DASHBOARD STATS ───────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const [totalRes, pendingRes, verifiedTodayRes, revenueRes, customersRes] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'awaiting_payment_verification'),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('payment_status', 'verified')
      .gte('updated_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    supabase.from('orders').select('total_cents').eq('payment_status', 'verified'),
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('is_guest', false),
  ]);

  const totalRevenue = (revenueRes.data || []).reduce((s, o) => s + (o.total_cents || 0), 0);

  return {
    totalOrders: totalRes.count || 0,
    pendingVerification: pendingRes.count || 0,
    verifiedToday: verifiedTodayRes.count || 0,
    totalRevenueCents: totalRevenue,
    totalCustomers: customersRes.count || 0,
  };
}
