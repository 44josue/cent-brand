# CENT — Testing & Fix Status (handoff notes)

Last updated: 2026-07-18. Written because we hit ~84% of the Claude session
budget mid-QA-pass — this is where to pick back up.

## ✅ Fixed and verified this session (confirmed working via live tests against real Supabase)

- **Nav/footer/theme toggle silently broken sitewide** — root cause was a
  static `import` of `cookie-consent.js` in `nav.js`. Ad blockers commonly
  block any file named "cookie-consent", and since it was a static import,
  blocking it failed the *entire* module graph for every page (nav, footer,
  cart badges, everything). Fixed by making it a dynamic import with
  `.catch()`. Verified by deliberately blocking the file and confirming the
  site still works.
- **Admin panel completely broken on any non-GitHub-Pages hosting** — all 13
  admin pages used a `document.write('<base href=...">')` trick to compute
  relative paths, which modern browsers' preload scanners can race and
  break. Replaced with plain hardcoded relative paths per file. Verified all
  12 sidebar tabs load with zero errors.
- **Admin topbar had a dead gap above it** — regression from the fix below
  (global `body { padding-top: var(--nav-height) }` was leaking into admin's
  own layout). Fixed with a `body { padding-top: 0 }` override in
  `admin.css`. Verified via CSS cascade inspection (couldn't get a live
  screenshot — admin requires real login — but the fix is deterministic:
  confirmed file order + rule content directly).
- **Floating nav didn't stay fixed on scroll** — `position: sticky` was
  silently broken by `overflow-x: hidden` on `body`/`html` (a well-known
  browser quirk). Switched nav to `position: fixed` + compensating
  `body { padding-top }`. Verified live.
- **`products.js` had a broken SVG placeholder** — single-quoted SVG
  attributes inside a single-quoted `onerror="..."` handler broke image
  fallback with a real JS syntax error whenever a product image 404'd.
  Fixed and verified.
- **GitHub Pages subpath bugs (~60 locations across 25+ files)** — hardcoded
  absolute paths (`href="/checkout/"` etc.) would 404 under
  `username.github.io/cent-brand/`. Routed everything through the existing
  `pageUrl()`/`getBasePath()` helper. Verified via a simulated subpath host.
- **`auth.js` OAuth/password-reset redirects** — same absolute-path bug in a
  different shape (`window.location.origin + hardcoded path`). Fixed.
- **`login.js` default redirect** — hardcoded `'/'` fallback. Fixed.
- **Removed dead `signInWithGoogle()`** — no UI ever called it.
- **Checkout hardcoded payment channel IDs that didn't match the real
  database** — every real checkout attempt would have failed with a foreign
  key violation. Now fetches real channels via `getPaymentChannels()`, same
  as the payment page already did. **Verified with a real order placed
  end-to-end.**
- **`guest-place-order` edge function crashed for any returning guest email**
  (no upsert on the `customers.email` unique constraint) — deployed a fixed
  version (now v3) that looks up-or-creates instead of blind-inserting.
  **Verified live** — reproduced the crash, deployed the fix, confirmed a
  repeat email now succeeds.
- **`guest-place-order` silently ignored promo codes** — queried a
  non-existent `promo_codes` table instead of the real `promotions` table,
  and didn't handle `discount_type` (percentage vs fixed). Fixed to match
  the logic already correct in the logged-in `place-order` function.
- **`guest-place-order` inserted an invalid `payment_status` enum value**
  (`'unpaid'` isn't in the `none/submitted/verified/rejected` enum) — caught
  via live testing after the above fix, corrected, redeployed as v3,
  verified.
- **Static fallback nav + footer added to every page** — so nav/footer are
  visible even if JS fails entirely (ad blocker, `file://`, whatever). Also
  fixed nav layout per your requests (About moved left, spacing, floating
  pill style, logo size/lift).
- Seeded real test data: 2 payment channels (MTN MoMo + Airtel Money, using
  your real DB IDs), 6 more products across your existing real categories
  (kept your original "Josh tshirt" and 10 real categories untouched), 18
  variants total. One real test order exists from the live E2E test
  (`e2e-test-customer@example.com`, Track Shorts, MTN MoMo) — safe to delete
  or keep as a demo example in the admin orders list.

## ⚠️ Not yet tested — pick up here next session

1. **Full admin panel walkthrough with real login.** I don't have your
   admin password, so I could only verify admin pages load without errors
   (pre-login) and audited the code by reading it. Nothing was clicked
   through as a logged-in admin — orders list, product editor, CMS,
   promotions, staff management, etc. all need an actual human (or a test
   admin account) driving them at least once.
2. **The other 8 edge functions weren't reviewed line-by-line**: only
   `place-order` and `guest-place-order` got a full read. Still unchecked:
   `submit-payment`, `admin-verify-payment`, `admin-reject-payment`,
   `admin-update-status`, `send-contact`, `send-email-blast`,
   `notify-restock`, `cancel-order`, `send-email`. Given the pattern found
   in `guest-place-order` (wrong table names, invalid enum values), it's
   worth a pass over these too.
3. **RLS/security advisor findings not acted on** — `get_advisors` flagged
   several `WARN`-level items (function `search_path` mutable on 4
   functions, public storage buckets allowing listing, a couple of
   `SECURITY DEFINER` functions callable by `anon`). None looked critical on
   inspection, but none were fixed either — worth a deliberate pass.
4. **Full responsive/visual sweep** — only spot-checked a handful of pages
   at mobile/tablet width early on (all clean at the time), not re-run after
   all the later nav/footer/checkout changes.
5. **Signup flow untested live** — checkout (guest) was tested end-to-end,
   but real account signup → email confirmation → login was not. Worth
   checking whether Supabase Auth requires email confirmation (affects
   whether a test account can be created and used immediately).
6. **Order status update flow** (admin marking an order as verified /
   packed / delivered) — depends on `admin-update-status` and
   `admin-verify-payment`, neither of which were read this session.

## Quick-start for next session

- Supabase project ref: `tgkikvzyxvtdvaukutju` (name: "cent")
- Local dev: `python -m http.server 8080` from repo root (no build step)
- The test order from this session: search `orders` table for
  `e2e-test-customer@example.com` if you want to see/delete it
