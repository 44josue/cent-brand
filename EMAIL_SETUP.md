# Email Setup Guide — CENT

Follow these steps once you have your domain (cent.rw or whatever you buy).

---

## Step 1 — Create a Resend account

1. Go to [resend.com](https://resend.com) and sign up (free tier is fine to start)
2. Verify your personal email

---

## Step 2 — Add and verify your domain in Resend

1. In the Resend dashboard, go to **Domains → Add Domain**
2. Enter your domain: `cent.rw`
3. Resend will give you **DNS records** to add — they look like this:

| Type | Name | Value |
|------|------|-------|
| TXT  | `resend._domainkey` | `p=...long key...` |
| MX   | `send` | `feedback-smtp.us-east-1.amazonses.com` |
| TXT  | `send` | `v=spf1 include:amazonses.com ~all` |

4. Log into your domain registrar (GoDaddy, Namecheap, etc.) and add those records
5. Back in Resend, click **Verify** — it can take 5–30 minutes for DNS to propagate
6. Once it shows **Verified ✓**, you're good

---

## Step 3 — Get your Resend API key

1. In Resend, go to **API Keys → Create API Key**
2. Name it `cent-production`
3. Give it **Full access** (or at minimum: sending emails)
4. Copy the key — you only see it once

---

## Step 4 — Add secrets to Supabase

Go to your [Supabase dashboard](https://supabase.com/dashboard) → **Project: cent** → **Edge Functions → Secrets**

Add these three secrets:

| Secret name | Value |
|-------------|-------|
| `RESEND_API_KEY` | The key from Step 3 |
| `FROM_EMAIL` | `hello@cent.rw` |
| `ADMIN_EMAIL` | `josue@cent.rw` (or wherever you want contact form messages) |

> **How to add a secret:** Click "Add new secret", type the name, paste the value, click Save.

---

## Step 5 — Test it

1. Place a test order on the site → you should receive an order confirmation email
2. In the admin panel, verify the payment → customer gets a "Payment Confirmed" email
3. Update the order status to "Packed" → customer gets an update email
4. Go to **Admin → Email** and send a test email to yourself

If emails don't arrive, check:
- Spam/junk folder first
- Resend dashboard → **Logs** — shows every send attempt and any errors
- Make sure the domain is showing **Verified** in Resend

---

## Emails that fire automatically (no action needed)

| Trigger | Who receives it |
|---------|-----------------|
| Customer places an order | Customer — order confirmation with items + total |
| Guest places an order | Guest — same confirmation to their entered email |
| Admin verifies payment | Customer — "Payment Confirmed" email |
| Admin marks as Packed | Customer — "Your order is packed" |
| Admin marks as Out for Delivery | Customer — "Your order is on its way" |
| Admin marks as Delivered | Customer — "Order delivered, enjoy your CENT!" |
| Admin cancels order | Customer — cancellation notice |
| Customer sends contact form | Admin email — contact message notification |

---

## Sending campaigns from Admin panel

Go to **Admin → Email Campaigns**:

- **Plain text mode** — just type your message, it gets wrapped in the CENT dark template automatically
- **HTML mode** — paste full HTML for full control
- **Templates** — Promotion, Newsletter, Order Update presets to get you started
- **Send to**: All customers, select specific ones, or paste any emails manually
- **Attach files** — drag and drop PDFs, images, etc.
- **Preview** — see exactly what the email looks like before sending

---

## Optional: Custom sender name

By default emails show as `hello@cent.rw`. To show a name like "CENT" or "CENT Streetwear":

In Supabase secrets, set `FROM_EMAIL` to:
```
CENT <hello@cent.rw>
```

---

## Summary checklist

- [ ] Sign up at resend.com
- [ ] Add domain `cent.rw` to Resend
- [ ] Add DNS records at your registrar
- [ ] Wait for domain to verify (green checkmark)
- [ ] Create API key in Resend
- [ ] Add `RESEND_API_KEY`, `FROM_EMAIL`, `ADMIN_EMAIL` to Supabase secrets
- [ ] Send a test order to confirm emails work
