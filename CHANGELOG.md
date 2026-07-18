# CENT — Changelog

A running log of what's actually been done, session by session. `NEXT_SESSION.md`
is for what's still open — this file is for what's finished.

## Session 4 (2026-07-18, later — part 5)

- **Fixed `payment_submissions_amount_paid_cents_check` violation on the
  payment step.** Root cause: `totalCents` on the payment page comes either
  from the URL's `?total=` param or a DB fallback fetch — if that fallback
  fetch failed (most likely the `esm.sh` CDN's known intermittent
  `Failed to fetch`, seen recurring all session) it was silently swallowed
  and `totalCents` stayed `0`, which later got submitted as the payment
  amount and hit the DB's `> 0` check constraint as a raw, ugly error.
  Fixed three ways: the initial fetch now retries up to 3 times before
  giving up; `handleSubmit` re-checks and re-fetches the total immediately
  before submitting rather than trusting a possibly-stale `0`, and blocks
  submission with a clear message if it truly can't be determined; and
  `submit-payment` now validates the amount itself and returns a clean
  "please refresh and try again" error instead of ever letting the raw
  Postgres constraint message reach the customer. Verified directly against
  the deployed function that a `0` amount is now rejected cleanly.

## Session 4 (2026-07-18, later — part 4)

- **Verified admin order status changes actually work, for real this time.**
  Previously reported this as "already wired" based on a stale note without
  re-testing it live. Actually clicked through it now: Verify Payment →
  `payment_verified`, then Advance Status → `packed`, both confirmed in the
  database. It works; I just hadn't proven it this session before claiming so.
- **Fixed a real, live `duplicate key value violates unique constraint
  "customers_email_idx"` crash on placing an order while logged in.** Same
  root cause fixed for guest checkout back in session 1, but never applied
  to the logged-in path (`place-order`): if a `customers` row already
  existed for that email (e.g. from an earlier guest order), the blind
  `insert` collided with the unique email constraint. `place-order` now
  looks up by email first and links the existing row to the account
  instead of inserting a duplicate — verified directly against the deployed
  function with a real JWT (bypassed the browser for this one; Playwright
  itself was crashing on this exact login→checkout path for unrelated
  environment reasons worth another look if it recurs).

## Session 4 (2026-07-18, later — part 3)

- **Fixed the real "Pay on Arrival → Missing required fields" bug.** The
  client sent `amountPaidCents: 0` for POA orders, and `submit-payment`
  checked `!amountPaidCents` — `0` is falsy in JS, so every POA submission
  was rejected. Sends the real total now; server also checks `== null`
  instead of falsy, as a second line of defense.
- **Checkout now asks "how will you pay?" first.** Payment method (MTN /
  Airtel / **Pay on Arrival**, all three together for the first time) is
  step 1, then contact details (with a "Use my account info" button for
  logged-in users, and phone gets saved back to the account automatically
  if it was missing), then delivery location. Choosing Pay on Arrival
  carries through and auto-selects it on the payment step instead of
  making the customer choose twice. (Note: this is a reordered single-page
  flow, not separate wizard screens — a full multi-step rebuild wasn't
  attempted given session time, but every field and choice from the
  request is there.)
- **Nav avatar**: the account icon now shows the logged-in user's initials
  instead of a generic person icon, matching account/admin pages.
- **Password visibility toggle** added to every password field site-wide
  (login, signup, account security tab) via a reusable `initPasswordToggles()`
  helper — click the eye icon to reveal/hide.
- **Admin order export**: Orders page now has Export CSV and Export PDF
  buttons (respects the current status filter), for bringing order data
  into Excel or sharing a formatted report.
- **Receipt sharing, redone**: choosing "Share Receipt" now opens a small
  choice panel — Image or PDF, plus a "blur order code" checkbox (checked
  by default) for when the receipt is headed to a public IG Story or
  WhatsApp status. The order code is now actually printed on the share
  card (it wasn't before) and gets a real canvas blur when hidden.
- **Featured products**: capped at 4 (was 3, then briefly uncapped —
  settled on 4 per the latest instruction), grid widened to 4 columns, and
  the card image aspect ratio was un-stretched back to a proper 4:5
  portrait (a `height:260px` override had made cards look squashed/wide).
- **Hero "CENT" wordmark**: removed a separate, smaller mobile font-size
  override so mobile uses the same fluid `clamp()` as desktop instead of a
  visually different formula; switched the font's `font-display` from
  `block` to `optional` so it renders instantly with a fallback font on
  slow connections instead of a blank pop-in delay.
- **Search input border**: fixed to a consistent 1px black in both themes
  (a leftover dark-mode override was still setting it to the muted border
  color).

## Session 4 (2026-07-18, later — part 2)

### Admin now gets emailed on everything order-related

Previously, admin only ever got an email for contact-form messages — every
order event only emailed the customer, and `submit-payment` (the moment a
payment actually needs a human to verify it) didn't email anyone at all.
Added an `admin@cent.rw` notification, in parallel with the existing
customer email, to all 7 order-lifecycle functions:

- `place-order` / `guest-place-order` — new order placed
- `submit-payment` — payment submitted, needs verification (previously sent
  no email whatsoever — this was the most important gap, since it's the
  one place that requires admin action)
- `admin-verify-payment`, `admin-reject-payment`, `admin-update-status`,
  `cancel-order` — a confirmation record of the action, addressed to admin

Each admin email links straight to the relevant `/admin/order-detail/`
page. Verified live: a full guest checkout → payment submission ran
cleanly through the updated functions with no errors (the new admin-email
calls correctly no-op since `RESEND_API_KEY` isn't set yet — they'll start
firing the moment it is).

## Session 4 (2026-07-18, later)

### Search — full redesign

Replaced the full-screen blurred search modal with a small dropdown panel
anchored under the navbar (80% of viewport width, no backdrop blur, plain
1px black border, floating shadow). Clicking anywhere outside it closes it,
but the typed query is preserved — reopening search (or accidentally
tapping outside mid-type) doesn't lose what was typed. Added real search
history: up to 5 recent searches shown on focus when the input is empty
(fewer shown with no "error" message if that's all there are), saved to
localStorage on Enter or on clicking a result. On mobile, the "Search" text
entry was removed from the hamburger drawer and replaced with a search icon
to the left of the hamburger in the top bar.

### State management / scroll & data caching

Added `js/lib/page-state.js` — sessionStorage-backed scroll position
tracking/restoration (bfcache-aware) and a short-TTL data cache. Wired into
the products/shop page (page number now lives in the URL so back-navigation
returns to the exact page and filters you were on; product listings are
cached per filter+page combo so returning to the listing after viewing a
product makes zero new network requests), and into product-detail, cart,
collaborators, and home pages for consistent scroll restoration.

### Account page — Security tab

Added working Change Email and Change Password forms (both re-authenticate
with the current password first via a new `reauthenticate()` helper).
Change email works today via Supabase Auth's own built-in mailer — a
separate system from the Resend-based order emails — so it isn't blocked
on Resend setup, though its free-tier send rate is low.

### Mobile navbar shape

Changed from a floating rounded "pill" to a plain edge-to-edge fixed bar on
phone/tablet widths, per explicit request — still pinned to the top and
visible while scrolling, just no longer a floating card shape.

### Email system — prepared for shop@ / dev@ / admin@cent.rw

- **All 9 email-sending edge functions now default to `shop@cent.rw`** (was a
  mix of `hello@cent.rw` and `orders@cent.rw` across different functions —
  inconsistent and not a real domain address). `send-contact` now defaults
  `ADMIN_EMAIL` to `admin@cent.rw`. Once a domain is verified with Resend, the
  **only secret that needs to be set is `RESEND_API_KEY`** — everything else
  already points at the right addresses.
- **The entire admin "Send Email" composer was completely non-functional** —
  found while wiring up the new signature feature. The client sent
  `{ subject, previewText, body, recipients, attachments }` but the
  `send-email` edge function expected a totally different shape
  (`recipientType`/`selectedEmails`/`manualEmails`/`htmlBody`). Every send
  attempt has always failed with "No recipients" regardless of what was
  entered. Rewrote the edge function to match the client's actual payload;
  the composer (manual comma/newline-separated recipients, customer
  picker, attachments, templates, HTML/plain toggle) was already
  well-built — it just never had a working backend.
- **Found the same bug's root cause affecting a second, unrelated feature**:
  `supabase.functions.invoke()` (used by the email composer and by the
  customer-facing "Cancel Order" button) sends browser-added headers like
  `x-client-info` that none of the edge functions' CORS policy allowed,
  so every call was silently blocked at the browser's preflight check
  before even reaching the function. This means **order cancellation has
  never worked** either. Broadened `Access-Control-Allow-Headers` to
  `authorization, x-client-info, apikey, content-type` across all 11 edge
  functions so this class of bug can't resurface elsewhere.
- **Added an auto-signature to the custom email composer**: appends the
  logged-in admin's name, title, email, and phone to the bottom of every
  outgoing email, closing with a randomly chosen "Best regards," or "Yours
  sincerely,". Added a `job_title` column to `profiles` and a matching
  field in the account page's Edit Profile modal (shown only to admin/ops)
  so this is fully dynamic per sender, not hardcoded. Verified live: the
  signature renders correctly in the composer's preview.

### UI fixes

- **Search bar**: border is a plain 1px black line now (was accidentally
  reverting to a lighter color in dark mode); the "X" close button is now
  a bare icon with no circle/background.
- **Nav logo hover** was dimming (`opacity:0.75`) instead of brightening —
  changed to `filter:brightness(1.3)`.
- **Featured products on the homepage were unusable** — capped at 3 products
  (was fetching up to 9), and fixed a real CSS bug where the product image
  container ignored its `max-height:260px` entirely: `.product-card-image`
  renders as an `<a>` tag on the homepage, and anchors default to
  `display:inline` in CSS, which makes the `height` property a no-op. Added
  `display:block` to the shared `.product-card-image` rule. Before this fix,
  every featured product card rendered ~625px tall instead of 260px,
  pushing the product name/price off-screen and forcing a scroll to see a
  single card.
- Hero button/scroll-indicator spacing (from the previous session) confirmed
  still correct.

## Session 3 (2026-07-18)

### Critical bugs found and fixed

- **Homepage was silently broken for every visitor.** `home.js` destructured
  `getLiveCmsImagesBySection` from the dynamic API import without declaring it
  in the `let` list above — a `ReferenceError` in strict mode (ES modules are
  always strict). That error was swallowed by a silent `.catch()`, so instead
  of a visible crash, the homepage just permanently showed "Could not connect"
  in the featured-products grid, and categories/CMS content/newsletter/cart
  drawer never initialized at all. This has likely been broken since the
  feature was added — not something introduced this session. Fixed by adding
  the missing declaration; verified live that featured products, categories,
  and CMS sections all render now, and the newsletter form actually submits.
- **Promo codes have never worked for any customer.** The `promotions` table
  had exactly one RLS policy (`is_admin()`), so the anon/customer-facing
  `validatePromoCode()` select was always silently blocked — every promo code
  entry, if there had been a UI for it, would've always said "invalid."
  Compounding that: **there was no promo code input on the checkout page at
  all** — `appliedPromo` was declared but never set anywhere, and the discount
  math used a nonexistent `discount_pct` field. Fixed all three: added a
  promo input + Apply button to checkout, added an RLS policy letting
  anon/authenticated read active promotions, and fixed the discount
  calculation to respect `discount_type` (percentage vs fixed) with a
  `min_order_cents` check. Verified live: `QATEST10` now applies a real 10%
  discount and updates the total; invalid codes are correctly rejected.
- **Payment proof photos were uploaded and then discarded.** Three separate
  bugs stacked on each other: (1) the storage RLS policy required
  `auth.role() = 'authenticated'`, so guest checkouts — the primary checkout
  path — could never upload a proof image at all; (2) even when upload
  succeeded, the client never sent the resulting path to the `submit-payment`
  edge function; (3) the edge function didn't have a column for it in its
  insert even if it had received one. Fixed all three: added an
  anon-inclusive upload policy, wired `proofPath` through the client call, and
  redeployed `submit-payment` (v4) to store it as `proof_storage_path`.
  Verified live end-to-end: uploaded a test proof image as a guest, then
  confirmed the admin order-detail page renders it via a working signed URL.
- **Admin Messages tab showed blank names/bodies for every contact message.**
  It read `msg.name`/`msg.message`, but the real columns (and what
  `send-contact` actually inserts) are `full_name`/`body`. The messages were
  always reaching the database correctly — they just displayed as "—" and
  empty in admin. Fixed the two render functions; verified a live contact
  form submission shows up correctly in the admin table now.

### Mobile / responsive fixes

- **Mobile nav layout**: logo is now pinned top-left and the hamburger
  top-right (was center-logo/right-actions, which read oddly once the
  desktop-only nav-left links disappeared). Removed the duplicated
  search/theme/cart/account icons from the mobile top bar — they already live
  in the drawer, so showing both was confusing ("why two cart links").
  Added a working search entry and a cart-count badge to the drawer, and the
  drawer now shows an "Admin Dashboard" link (in addition to, not instead of,
  "Account") for admin/ops users only.
- **Mobile drawer was unclickable at the top edge.** `.navbar` had a higher
  z-index (500) than the drawer (499), so the fixed top nav bar sat above the
  drawer's close button and silently ate its clicks. Found this by testing
  the actual hamburger-open/close flow with Playwright, not by inspection —
  worth remembering that z-index bugs like this don't show up in a screenshot
  review, only in an actual interaction test. Fixed by raising the drawer and
  its overlay above the navbar.
- **Admin tables no longer scroll sideways on phone.** All 11 admin
  list/table views (orders, customers, products, collections, promotions,
  channels, collaborators, staff, contact messages, email log, dashboard
  recent-orders) now collapse into stacked cards under 640px instead of
  forcing horizontal scroll — added a generic `data-table` responsive CSS
  rule plus `data-label` attributes on every cell across all 11 files.
- **Hero buttons overlapping the bouncing scroll indicator** on the homepage
  — added spacing below `.hero-ctas` so "Shop Now"/"Our Story" and the
  bounce-animated scroll circle no longer sit on top of each other.

### Verified working (already implemented, just not previously exercised live)

- Newsletter signup (writes to `subscribers`, confirmed row in DB)
- Multi-item cart (added two different products, both persisted)
- CMS "Site Sections" text save (edited and saved `about_story`, confirmed
  in DB, then reverted the test edit)
- Full guest order → payment submission → admin verification chain, including
  the promo code and proof-photo paths above

### Not touched this session (still open — see `NEXT_SESSION.md`)

- Resend/email sending (blocked on the user having a domain)
- Products/Customers admin create/edit/delete — not independently
  stress-tested this pass (CRUD code itself wasn't touched or found suspect)
- Wishlist and order-cancellation flows exist in the code and look correct on
  read-through, but weren't clicked through live this session

---

## Session 2 (2026-07-18, earlier)

- Reviewed all edge functions; fixed `search_path` on 4 DB functions; revoked
  public execute on 2 trigger-only functions.
- Fixed dashboard "Customers" stat always showing 0 (missing field in
  `getDashboardStats()`).
- Fixed admin Email tab querying nonexistent columns (`sent_at`/`status` →
  `created_at`); added missing RLS read policy on `email_logs`.
- Fixed public order-tracking page missing items/payment/customer name for
  guests — added RLS policies on `order_items`/`payment_submissions`, and
  built a `get_public_order()` RPC so the customer's real name shows without
  exposing a blanket customers-table policy.
- Admin stress test: created a real collaborator, found and fixed a
  `min_order_cents` NOT NULL crash in Promotions, edited a payment channel.
- Built the shareable receipt PNG feature (`generateShareCard()` in
  `receipt.js`) using the Web Share API for IG Story / WhatsApp sharing.
- Real tablet dead-zone bug found (hamburger and nav links both invisible
  between 769–899px) and fixed.

## Session 1

- Connected Supabase; fixed the ad-blocker-triggered sitewide nav/footer
  failure (static → dynamic import of `cookie-consent.js`); redesigned the
  navbar into the floating-pill layout; fixed ~60 hardcoded absolute-path
  bugs for GitHub Pages subpath hosting; fixed the admin panel's
  `document.write('<base>')` trick that broke every admin page's asset
  loading; removed Google sign-in; seeded real payment channels and demo
  products.
