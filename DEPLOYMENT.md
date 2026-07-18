# CENT — Deployment & Resend Setup

## 1. Deploying the site (GitHub Pages)

This is a static site (no build step), so deployment is just pushing to GitHub and enabling Pages.

1. Push your `master` branch to GitHub (you're already on `origin/44josue/cent-brand`).
2. On GitHub: **Settings → Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch".
4. Branch: `master`, folder: `/ (root)`. Save.
5. GitHub gives you a URL like `https://44josue.github.io/cent-brand/`. It can take a minute or two to go live after each push.

The site already handles being served from that `/cent-brand/` subpath correctly (that was a big chunk of the bug-fixing work this project went through) — you don't need to change any paths.

**Custom domain (optional, e.g. `cent.rw`):** if you buy a domain, add it under Settings → Pages → "Custom domain", and add a `CNAME` file to the repo root pointing at it (GitHub gives you the exact instructions once you type the domain in). Once that's live, note that a few places in the codebase have `https://cent.rw` hardcoded (QR codes, share links, email templates) — search for `cent.rw` if you want those to match your real domain instead.

## 2. Setting up Resend (for order/status emails)

Right now, **no emails send** — not because anything is broken, but because `RESEND_API_KEY` isn't set. Every edge function checks for it first and silently skips the email step if it's missing, so the app fully works without it (orders, checkout, admin actions all function normally — customers just won't get emails yet).

### Step 1 — Get a domain
Resend requires a **verified domain** to send email to arbitrary recipients (your customers). Their free sandbox domain (`onboarding@resend.dev`) only lets you send test emails to your own Resend account email — not to real customers. So this step needs a real domain first (e.g. `cent.rw`, or even a cheap `.com` if `.rw` isn't available yet).

### Step 2 — Verify the domain in Resend
1. Sign up at [resend.com](https://resend.com).
2. Go to **Domains → Add Domain**, enter your domain.
3. Resend gives you 3–4 DNS records (SPF, DKIM, sometimes a tracking CNAME). Add these at your domain registrar's DNS settings.
4. Wait for verification (usually minutes, sometimes up to a few hours for DNS propagation). Resend shows a green "Verified" once it's done.

### Step 3 — Get an API key
**Resend dashboard → API Keys → Create API Key.** Copy it — you won't see it again.

### Step 4 — Add the secrets to Supabase
These are **edge function secrets**, not something you put in the website code. Every edge function already defaults to the right addresses below, so **the only secret you actually have to set is `RESEND_API_KEY`** — the other two are only needed if you want different addresses than the defaults.

In the Supabase dashboard, **Project Settings → Edge Functions → Secrets**, add:

| Secret name | Value | Notes |
|---|---|---|
| `RESEND_API_KEY` | the key from Step 3 | **required** — this is the only one you must set |
| `FROM_EMAIL` | defaults to `shop@cent.rw` | optional — only set this to override the default. Whatever you use must be `something@yourverifieddomain` |
| `ADMIN_EMAIL` | defaults to `admin@cent.rw` | optional — where contact-form submissions get forwarded |

The three inboxes this site is built around are `shop@cent.rw` (all order/customer emails), `dev@cent.rw` (reserved for technical/developer correspondence — not wired into any automated flow yet, since nothing currently sends dev alerts), and `admin@cent.rw` (contact-form notifications, and the bootstrap-admin email in step 3 below). Set up all three as real inboxes when you verify the domain with Resend, even though only `shop@` and `admin@` are used by code today.

(If you prefer the CLI instead of the dashboard: `supabase secrets set RESEND_API_KEY=re_xxx --project-ref tgkikvzyxvtdvaukutju`.)

No redeployment of the edge functions is needed — they read these as environment variables at request time, so emails start working the moment the secret is saved.

### What starts working once this is set
- Order confirmation emails (guest + logged-in checkout)
- Payment verified / rejected emails
- Order status update emails (packed, out for delivery, delivered, cancelled)
- Contact form → notifies `ADMIN_EMAIL`
- Admin's manual email tool (Email Campaigns tab) and newsletter blasts
- Restock notification emails

### Testing without a domain yet
Until you have a domain, you can still confirm the *code path* works: sign up for Resend, use their sandbox key, and set `FROM_EMAIL` to `onboarding@resend.dev`. Emails will only actually deliver to the email address on your own Resend account, but this proves the integration is wired correctly before you're ready to verify a real domain.

## 3. Admin bootstrap email

There's one more setting worth knowing about: `js`/Postgres trigger `auto_promote_admin()` automatically promotes any signup using a specific email to the `admin` role — this is how the very first admin account gets created without needing manual database access. It defaults to `admin@cent.rw` if no override is set.

To change it, run this once in the Supabase SQL editor:
```sql
alter database postgres set app.admin_email = 'youractualemail@example.com';
```
Do this **before** you sign up with that email, then sign up normally through the site's Create Account form.
