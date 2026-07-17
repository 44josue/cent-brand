# CENT — Asset Setup Guide

Everything you need to plug in the logo, product images, and brand assets.

---

## Logo

The logo appears in:
- The main navbar (`js/components/nav.js`) — currently renders as text "CENT" using `font-family: var(--font-logo)` (Bebas Neue)
- The admin sidebar (`js/components/admin-shell.js`) — same text treatment
- The order receipt (order tracking page) — text

**If you have an SVG/PNG logo file:**

1. Place your logo file at: `public/logo.svg` (or `public/logo.png`)
2. In `js/components/nav.js`, find the navbar brand section and replace the text with:
   ```html
   <img src="/logo.svg" alt="CENT" height="28" style="display:block">
   ```
3. Do the same in `js/components/admin-shell.js` for the sidebar logo.
4. For the receipt on the order tracking page (`js/pages/order-tracking.js`), find the `CENT` text inside the receipt card and replace similarly.

**Favicon:**

1. Export your logo as a 32×32 PNG and a 180×180 PNG (for Apple touch icon)
2. Place them at:
   - `favicon.ico` — root of project
   - `favicon-32x32.png` — root of project
   - `apple-touch-icon.png` — root of project
3. Add these to the `<head>` of every HTML file, or add once to a shared base template:
   ```html
   <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
   <link rel="apple-touch-icon" href="/apple-touch-icon.png">
   ```
   All HTML files are in: `index.html`, `products/`, `product/`, `cart/`, `checkout/`, `checkout-payment/`, `order-tracking/`, `account/`, `login/`, `contact/`, `faq/`, `about/`, `collaborators/`, `privacy/`, `terms/`

---

## Product Images

Product images are uploaded through the admin panel at `/admin/product-form/`.

**Storage bucket:** `product-images` (public bucket in Supabase)

**How to upload:**
1. Go to **Admin → Products → [product name] → Edit**
2. In the **Media** section, click the `+` upload button
3. Select one or more images (JPG or PNG recommended)
4. Click an image to **set it as primary** (this is the main image shown in grids)
5. Images are stored at: `products/{product_id}/{timestamp}.{ext}`

**Recommended image dimensions:**
- **Product grid / listing:** 800×1067px (3:4 portrait ratio)
- **Product detail / hero:** 1200×1600px
- **Maximum file size:** keep under 2MB per image for fast loading

**Image optimization tip:**
Compress images using [Squoosh](https://squoosh.app) or [TinyPNG](https://tinypng.com) before uploading. A 1200×1600 product photo should be under 400KB after compression.

---

## Collaboration Logos & Banners

Collaboration assets are uploaded through **Admin → Collabs → [collab name] → Edit**.

| Field | Recommended size | Notes |
|---|---|---|
| Logo | 200×200px (1:1) | Shows as a small circular chip |
| Banner | 1600×600px (wide) | Used as the collab header on the home section |

---

## Site Sections (Hero / About text)

Text content for the home page hero, about section, etc. is managed at **Admin → CMS → Site Sections**.

Each section has a `key` (identifier), `body` (text/HTML), and optionally an `image_url`.

To change the hero image, set the `image_url` field for the `hero` section to a public image URL.

---

## CMS site images (home & about)

Section photos (home **Every Cent Matters**, about story/mission blocks) are managed at **Admin → CMS → Site Images**.

- Upload JPEG/PNG/WebP/GIF files to the **`cms-images`** bucket (public).
- Toggle up to **3** images as **live** and assign each to exactly one section.
- Metadata is stored in `site_sections` row `cms_media_library` (JSON `body.images`).

If uploads fail with a storage error, confirm the bucket and policies below exist.

---

## Supabase Storage Buckets

Verify these buckets exist in your Supabase project under **Storage**:

| Bucket name | Access | Used for |
|---|---|---|
| `product-images` | **Public** | Product photos, collab logos/banners |
| `cms-images` | **Public** | CMS section images (home/about) |
| `payment-proofs` | **Private** | Customer payment screenshots (admin only) |

### Create `cms-images` manually (if missing)

In **Storage → New bucket**:

1. Name: `cms-images`
2. Check **Public bucket**
3. Save

Then in **SQL Editor**, run:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('cms-images', 'cms-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "public read cms images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'cms-images');

CREATE POLICY "auth upload cms images"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'cms-images' AND auth.role() = 'authenticated');

CREATE POLICY "auth delete cms images"
ON storage.objects FOR DELETE TO public
USING (bucket_id = 'cms-images' AND auth.role() = 'authenticated');
```

Seed the CMS library row (once):

```sql
INSERT INTO site_sections (key, title, body, is_active)
VALUES ('cms_media_library', 'CMS media library', '{"images":[]}', true)
ON CONFLICT (key) DO NOTHING;
```

If they don't exist, create other buckets in the dashboard:
1. For `product-images`: check **Public bucket**
2. For `payment-proofs`: leave public unchecked

---

## Environment Variables

The only environment config needed is in `js/lib/supabase.js`. It should contain:

```js
const SUPABASE_URL = 'https://tgkikvzyxvtdvaukutju.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

**Never commit your `service_role` key to the codebase.** Only the `anon` (public) key belongs in client-side JS. The service role key is only used in Edge Functions.

---

## Deployment Checklist

Before going live:

- [ ] Add logo/favicon to all HTML `<head>` tags
- [ ] Confirm `product-images` and `cms-images` buckets are **public** in Supabase
- [ ] Confirm `payment-proofs` bucket is **private**
- [ ] Confirm `site_sections` row `cms_media_library` exists (see CMS site images above)
- [ ] Set Supabase Auth **Site URL** to your production domain (e.g. `https://cent.rw`)
- [ ] Set Supabase Auth **Redirect URLs** to include `https://cent.rw/**`
- [ ] Add your domain to Supabase Auth allowed origins
- [ ] Set email secrets (Resend API key) as Supabase Edge Function secrets
- [ ] Upload at least one active payment channel in **Admin → Channels**
- [ ] Add a test product with variants and images
- [ ] Do a full test order: add to cart → checkout → submit payment → verify tracking page

---

## Fonts

The site uses **Bebas Neue** for the CENT logo wordmark. It's loaded via Google Fonts. If you want to self-host it instead:

1. Download from [Google Fonts](https://fonts.google.com/specimen/Bebas+Neue)
2. Place in `public/fonts/BebasNeue-Regular.woff2`
3. Add to `css/tokens.css`:
   ```css
   @font-face {
     font-family: 'Bebas Neue';
     src: url('/fonts/BebasNeue-Regular.woff2') format('woff2');
     font-weight: 400;
     font-display: swap;
   }
   ```
4. Remove the Google Fonts `<link>` from HTML files.
