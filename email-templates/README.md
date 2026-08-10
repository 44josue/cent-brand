# CENT Email Templates

Dark-themed HTML templates for every email CENT sends. These are the design
source of truth — the live edge functions in Supabase (`place-order`,
`admin-update-status`, etc.) send inline versions of this same markup, and
`{{tokens}}` here show exactly what each one fills in dynamically.

## Logo

Every template loads the logo from the live site instead of embedding it,
since email clients can't read relative paths:

```html
<img src="https://cent.rw/assets/images/white%20logo.png" alt="CENT" height="36">
```

That's `https://cent.rw` + `/assets/images/white logo.png` (the same file
already deployed to `public_html/assets/images/` on the cPanel host), with the
space percent-encoded as `%20` since raw spaces break in some email clients'
URL parsing. If you ever rename that file to something without a space (e.g.
`logo-white.png`), update the `src` in every template below to match.

Templates use the **white** logo variant because every template has a dark
(`#0a0a0a`) background — do not swap in the black logo unless you also flip
the background to light.

## Files

| File | Sent when |
|---|---|
| `order-received.html` | Customer places an order (before payment) |
| `payment-confirmed.html` | Admin verifies a payment submission |
| `payment-rejected.html` | Admin rejects a payment submission |
| `order-packed.html` | Admin marks order as Packed |
| `order-out-for-delivery.html` | Admin marks order as Out for Delivery |
| `order-delivered.html` | Admin marks order as Delivered |
| `order-cancelled.html` | Order is cancelled (by admin or customer) |
| `admin-new-order-notification.html` | Internal — new order lands in inbox |
| `contact-form-notification.html` | Internal — someone submits the Contact page form |
| `signup-welcome-confirmation.html` | New account created — reference design for Supabase Auth's "Confirm signup" template |
| `password-reset.html` | Reference design for Supabase Auth's "Reset password" template |
| `newsletter-campaign.html` | Starting point for Admin → Email campaigns |

## Senders

- `orders@cent.rw` (no-reply) — every order-lifecycle email above
- `support@cent.rw` — contact notifications, admin-sent campaigns, and (once
  wired up) signup/password-reset emails

## Merge tokens

Each file lists its own `{{tokens}}` in an HTML comment at the top. They're
plain `{{snake_case}}` placeholders — swap them for real values wherever you
plug this into a mail sender (a template engine, or Resend's own template
support if you migrate to it later).
