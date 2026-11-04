# Deploying ChartRelay to Railway

A step-by-step runbook for putting the existing `Dockerfile` on Railway as **one service with one persistent volume** at `/app/.data`. The SQLite database lives on that volume. Run exactly one instance. Do not scale horizontally (see README "Production configuration").

Work through the phases in order, and do not skip a gate:

1. [Before you start](#0-before-you-start)
2. [Roll the exposed Stripe sandbox keys](#1-roll-the-exposed-stripe-sandbox-keys)
3. [Create the Railway service](#2-create-the-railway-service)
4. [Set variables](#3-set-variables)
5. [Custom domain](#4-custom-domain)
6. [Stripe webhook endpoint (test mode)](#5-stripe-webhook-endpoint-test-mode)
7. [Transactional email with Resend](#8-transactional-email-with-resend) (do this before the acceptance checklist)
8. [Deployed test-mode acceptance checklist](#6-deployed-test-mode-acceptance-checklist) (gate)
9. [Live-mode switch checklist](#7-live-mode-switch-checklist)

Day-2 operations — logs, health, backups, rollback, incidents — are in [`OPERATIONS.md`](OPERATIONS.md).

Never paste secret values into chat, issues, commits, or screenshots. Enter them only in the Railway and Stripe dashboards.

---

## 0. Before you start

The owner must create these accounts personally. Nobody else should create them.

- [ ] **GitHub** account, with the code pushed to a **private** repository (for example `chartrelay`). `.env.local` and `.data/` must not be committed. Check with `git ls-files | grep -E '\.env|\.data'`, which should print nothing.
- [ ] **Railway** account (railway.com), on a plan that includes persistent volumes, with GitHub connected so Railway can read the private repo.
- [ ] **Stripe** account (already exists). You need Dashboard access to test mode now and to live mode later. Live mode needs the business activation form completed.
- [ ] **Transactional email provider.** The code supports **Resend** (resend.com). Create the account and verify the sending domain there (it will ask for DNS records).
- [ ] **Domain registrar** account holding the production domain (for example `chartrelay.example`). You will add DNS records for Railway and for the email provider.
- [ ] A local terminal with `openssl`, to generate `SESSION_SECRET`.

Also fill in the bracketed placeholders on `/terms` and `/privacy` (legal name, address, governing-law state, contact email, effective date) and get them reviewed before taking live payments. Both pages currently show "Draft — pending review. Not yet in effect."

---

## 1. Roll the exposed Stripe sandbox keys

The test-mode (sandbox) API key was shown on screen during local testing, so treat it as exposed. Roll it **before** using it anywhere new.

1. Stripe Dashboard, **test mode**: **Developers → API keys**.
2. Find the key used locally. It is a restricted key starting `rk_test_`, or the standard secret key starting `sk_test_`. Open its menu and choose **Roll key**. Pick expiry **Now** so the old value stops working right away.
3. Copy the new value **straight into** `.env.local` (for local development) and set it later as `STRIPE_SECRET_KEY` in Railway. Do not paste it anywhere else.
4. The local `stripe listen` webhook secret (`whsec_...`) is only for the CLI listener. The deployed endpoint gets its own secret in step 5, so there is nothing to roll there. If you think the CLI secret leaked too, run `stripe listen` again.
5. Locally, run `npm run check:env`. It prints only prefixes and confirms the format.

---

## 2. Create the Railway service

1. Railway dashboard: **New Project → Deploy from GitHub repo**, then pick the private `chartrelay` repo, branch `main`.
2. Railway reads `railway.json` at the repo root, which sets:
   - builder `DOCKERFILE` (uses the repo `Dockerfile`)
   - healthcheck path `/api/health`
   - restart policy `ON_FAILURE`
   Do not change these in the UI. Settings in `railway.json` override the dashboard.
3. **Stop the first deploy from finishing before the variables are set.** It is fine if it fails. Continue with the volume and variables, then redeploy.
4. **Add the persistent volume.** Open the project canvas, then **New → Volume** (or right-click the service → **Attach volume**). Attach it to the ChartRelay service with **mount path** `/app/.data`.
5. **Volume permissions.** The image runs as the non-root user `nextjs` (uid 1001), and Railway mounts volumes owned by root. Set the service variable `RAILWAY_RUN_UID=0` (step 3) so the app can write the SQLite file. If `/api/health` returns 503 or the logs show `SQLITE_CANTOPEN` or `attempt to write a readonly database`, this variable is the first thing to check.
6. **Single instance.** In service **Settings**, keep replicas at **1**. A service with a volume redeploys with a short gap in service, which is expected.
7. **Networking.** Service **Settings → Networking → Generate Domain** gives a `*.up.railway.app` URL for first tests. The container listens on the `PORT` Railway injects. The image defaults to 3000 and `HOSTNAME=0.0.0.0`.

---

## 3. Set variables

Service → **Variables**. Use **Raw Editor** or add them one by one. The table lists every variable the app reads (`grep -rn "process.env" src`), plus the Railway-specific one. Values below are **format examples only**.

| Variable | Required | Example format | Notes |
|---|---|---|---|
| `APP_URL` | Required | `https://chartrelay.example` | Public origin, with no trailing slash. Used in email links, Stripe return URLs, and chart asset URLs. Use the Railway URL first, then switch to the custom domain in step 4. |
| `DATABASE_PATH` | Required | `/app/.data/chartrelay.db` | Must be inside the volume mount. The image default is `./.data/chartrelay.db`, which resolves to the same place. Set it explicitly anyway. |
| `SESSION_SECRET` | Required | output of `openssl rand -base64 48` | At least 32 characters. The production server refuses to start when it is missing or shorter. Changing it signs everyone out. |
| `STRIPE_SECRET_KEY` | Required for billing | `rk_test_...` (test) / `rk_live_...` (live) | Use the **rolled** key from step 1. A restricted key is preferred; `sk_test_` also works. |
| `STRIPE_WEBHOOK_SECRET` | Required for billing | `whsec_...` | The **deployed endpoint's own** signing secret (step 5), not the `stripe listen` one. |
| `STRIPE_PRICE_DEVELOPER` | Required for billing | `price_...` | Monthly $19 Developer price ID in the **same mode** as the key. |
| `STRIPE_PRICE_PRO` | Required for billing | `price_...` | Monthly $59 Pro price ID in the **same mode** as the key. |
| `STRIPE_PRICE_BUSINESS` | Required for billing | `price_...` | Monthly $149 Business price ID in the **same mode** as the key. |
| `STRIPE_PRICE_PACK` | Required for billing | `price_...` | **One-time** $10 price ID for the 2,000-render pack (not recurring), in the **same mode** as the key. Without it, packs cannot be sold and a pay-as-you-go customer has no way to top up. |
| `STRIPE_LIVE_MODE` | Optional; live only | `enabled` | Leave **unset** in test mode. Live keys are refused unless this is exactly `enabled`. |
| `EMAIL_PROVIDER` | Required in production | `resend` | Without it, the server logs a `[config] WARNING` at startup and every verification and reset email fails. `resend` is the only supported value. `npm run check:env -- --production` reports it as FAIL. |
| `RESEND_API_KEY` | Required when `EMAIL_PROVIDER=resend` | `re_...` | From the Resend dashboard, sending access only. |
| `EMAIL_FROM` | Required when `EMAIL_PROVIDER=resend` | `ChartRelay <no-reply@chartrelay.example>` | Must be on a domain verified in Resend. |
| `TRUSTED_PROXY_HOPS` | Optional | `1` | Number of reverse proxies in front of the app that append to `X-Forwarded-For`. Rate limits use the entry this many positions from the right, which the proxy wrote; the leftmost entries are client-controlled. Defaults to `1`, which fits Railway's single edge proxy. Use `0` only when the app is reached directly (all clients then share one rate-limit bucket). |
| `RAILWAY_RUN_UID` | Required on Railway | `0` | Lets the container write to the root-owned volume (step 2.5). |
| `PNG_CACHE_MAX_BYTES` | Optional | `209715200` | Total bytes of rendered PNGs kept in SQLite (default 200 MB). Oldest are evicted and regenerated on demand. Keep it well under the volume size. |
| `SUPPORT_EMAIL` | Recommended | `help@chartrelay.example` | The published support address. `/support` and `/privacy` build their contact blocks from it. **Unset is a visible state:** both pages say the contact channel is being set up and publish no address. Anything that is not a plain, unambiguous address (spaces, `%`, `?`, `&`, `#`) is rejected and treated as unset. |
| `SUPPORT_RESPONSE_HOURS` | Optional | `24`, or `2 business days` | The reply-time expectation printed on `/support`. A bare number of hours is formatted (`24` → "24 hours"); anything else is printed as written. Defaults to `2 business days`. |
| `ADMIN_TOKEN` | Required for backups | output of `openssl rand -hex 32` | Enables `GET /api/admin/backup`, which `npm run backup` downloads (see `docs/OPERATIONS.md` §6.1). At least 24 characters. **Until it is set the route answers 404 and there is no self-hosted backup path.** Set it before you have data worth losing. |

Already set by the `Dockerfile`, so do **not** override them: `NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1`, `HOSTNAME=0.0.0.0`. `PORT` is injected by Railway.

The `CHARTRELAY_*` and `MCP_*` variables found by grep belong to the separate `mcp/` package, not the web service. Do not set them here.

Then **Deploy** (or redeploy). Railway waits for `GET /api/health` to return 200 before routing traffic. Check it:

```bash
curl -i https://<your-app>.up.railway.app/api/health
# HTTP/2 200 ... {"status":"ok"}
```

Railway uses the healthcheck only to gate a deploy. It does not keep monitoring afterwards. For ongoing alerts, point an external uptime monitor at `/api/health`.

---

## 4. Custom domain

1. Railway service **Settings → Networking → Custom Domain**, then enter `chartrelay.example` (and/or `www.`).
2. Railway shows a DNS record (a CNAME, plus a TXT verification record if asked). Add it at your registrar. For an apex domain, use the registrar's CNAME-flattening, ALIAS, or ANAME record, or use a `www` subdomain.
3. Wait until Railway shows the domain as active with a certificate.
4. Update `APP_URL` to `https://chartrelay.example` and redeploy.
5. In Resend, verify the same domain (its SPF and DKIM DNS records) so `EMAIL_FROM` delivers.

---

## 5. Stripe webhook endpoint (test mode)

1. Stripe Dashboard, **test mode**: **Developers → Webhooks → Add endpoint** (in Workbench this is **Add destination → Webhook endpoint**).
2. Endpoint URL: `https://chartrelay.example/api/billing/webhook` (use the final domain).
3. Select exactly these 4 events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Save, open the endpoint, and reveal its **Signing secret** (`whsec_...`). Put it in Railway as `STRIPE_WEBHOOK_SECRET` and redeploy.
5. Also in test mode, **Settings → Billing → Customer portal**: make sure the portal configuration is saved, so "Manage billing" works.
6. **Settings → Billing → Subscriptions and emails → Manage failed payments**: set "If all retries for a payment fail" to **cancel the subscription** (or mark it unpaid). `past_due` keeps paid limits while Stripe retries the card; if Stripe is left to keep the subscription past due forever, the workspace keeps paid limits without paying. Repeat this in live mode.

---

## 6. Deployed test-mode acceptance checklist

**Gate: all items must pass on the deployed site before anything in step 7.** Use Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC.

- [ ] `GET /api/health` returns `200 {"status":"ok"}`.
- [ ] `/`, `/pricing`, `/docs`, `/playground`, `/terms`, and `/privacy` load over HTTPS on the custom domain. The footer links to Terms and Privacy.
- [ ] Register a fresh account. The verification email **arrives in a real inbox** (not the server log), and its link opens the custom domain.
- [ ] The first API key is shown once. A `curl` render against `https://<domain>/api/v1/charts` with that key returns SVG and asset URLs on the custom domain.
- [ ] Password reset email arrives and works.
- [ ] `/pricing` → **Upgrade to Pro** → Stripe Checkout (test) → pay → redirect back to `/dashboard`.
- [ ] Stripe Dashboard → the webhook endpoint shows the 4 event types delivered with **HTTP 200**, and none failed.
- [ ] The dashboard shows plan **Pro** and the subscription status.
- [ ] Trying to buy again does not create a second subscription. It is sent to the billing portal instead.
- [ ] **Manage billing** opens the Customer Portal. Switch to Business, and the plan updates after the webhook. Cancel, and the cancellation date shows.
- [ ] Use **Resend** on a delivered event in the Stripe Dashboard. The app answers 200 and does not process it twice.
- [ ] **Persistence:** redeploy the service (Deployments → Redeploy). The account, API key, and plan are all still there afterwards, which proves the database is on the volume.
- [ ] Railway logs show no secret values, no `SQLITE` errors, no `[config]` warnings, and no `[billing-alert]` lines. Set up a log alert on `[billing-alert]`: it means a customer is paying for two subscriptions.

If any item fails, fix it and run the whole checklist again.

---

## 7. Live-mode switch checklist

Only after step 6 passes completely. The live and test modes of Stripe are separate: **nothing created in test mode exists in live mode.**

- [ ] Stripe account activation (business details, bank account) is complete, and `/terms` and `/privacy` are final (placeholders filled, "Draft" notice removed, reviewed).
- [ ] **Create the live prices in live mode:** a Developer product at $19/month USD recurring, a Pro product at $59/month USD recurring, a Business product at $149/month USD recurring, and a render-pack product at $10 USD **one-time** (not recurring) for 2,000 renders. Record all four live `price_...` IDs. Do not reuse test price IDs.
- [ ] **Stripe Tax stays OFF** until tax registrations are confirmed with your accountant. Do not enable automatic tax in Checkout or on the prices before then.
- [ ] Live **Customer portal** configuration saved (Settings → Billing → Customer portal, in live mode).
- [ ] Live failed-payment setting cancels (or marks unpaid) the subscription after all retries fail (step 5.6).
- [ ] Create a **live restricted key** (`rk_live_...`) with only the permissions the app uses (Customers, Checkout Sessions, Subscriptions, Customer portal). Enter it directly in Railway.
- [ ] Create the **live webhook endpoint** at the same URL with the same 4 events, and copy **its own** live signing secret.
- [ ] In Railway, replace the variables together: `STRIPE_SECRET_KEY` (live), `STRIPE_WEBHOOK_SECRET` (live endpoint), `STRIPE_PRICE_DEVELOPER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` and `STRIPE_PRICE_PACK` (live price IDs), and add `STRIPE_LIVE_MODE=enabled`. Redeploy.
- [ ] Workspaces created during test mode have **test** Stripe customer IDs that do not exist in live mode. Before launch, either start from a fresh database (stop the service, clear the volume, redeploy) or make sure no real customer uses a test-mode workspace.
- [ ] Do one real live purchase with your own card on Pro. Confirm the webhook returns 200 and the plan updates. Then cancel it and refund yourself in the Stripe Dashboard.
- [ ] Turn off or delete the test-mode webhook endpoint if it points at production, so test events do not reach the live app.
- [ ] Set up an external uptime monitor on `/api/health`, and a way to back up `/app/.data` (for example Railway volume backups, if your plan has them). `npm run check:uptime` probes the deployment on demand; [`OPERATIONS.md`](OPERATIONS.md) covers monitoring, backups and incidents.

---

## 8. Transactional email with Resend

Do this **before** the acceptance checklist in step 6 — two of its items (the verification email and the
password-reset email) cannot pass without it.

### Why it matters

Until `EMAIL_PROVIDER`, `RESEND_API_KEY` and `EMAIL_FROM` are all set in Railway, **verification and
password-reset emails are never delivered, and nothing tells the user.** `src/lib/email/send.ts` throws
in production when no provider is configured; the register and forgot-password routes catch that, log
`Verification email failed:` / `Password reset email failed:`, and still answer the browser normally.
Outside production the same emails are printed to the server console (`[dev email]`) instead, which is
why local testing never notices.

The user-visible consequence: a new account can never confirm its email, so it stays on the **100
renders/month** unverified cap instead of the free plan's 1,000 (`src/lib/usage/limits.ts`), and nobody
can recover a forgotten password. At startup the server also logs
`[config] WARNING: EMAIL_PROVIDER is not set to "resend"`.

`resend` is the only provider value the code supports (`src/lib/email/send.ts` posts to
`https://api.resend.com/emails`). Using anything else means writing code, not configuration.

### 8.1 Create the account

1. The owner signs up at **resend.com** personally, with the business email — not a personal address
   you would not want to become the public sender. Turn on two-factor authentication.
2. Confirm the plan covers your expected volume. Free tiers are small and usually rate-limited; a
   handful of signups a day is fine, a launch spike may not be.
3. Resend's dashboard wording and navigation change over time. Treat the labels below as a guide and
   follow the dashboard's own instructions where they differ — and **copy every DNS value from the
   dashboard verbatim**; never retype one from this document.

### 8.2 Verify a sending domain

You must send from a domain you control. A single unverified address will not work.

1. In Resend, add the domain you will send from. Prefer a **subdomain** such as
   `mail.chartrelay.example` or `send.chartrelay.example`: its DNS is independent of your root domain's
   existing mail, and a deliverability problem with marketing mail cannot drag down password resets.
2. Resend then shows a set of DNS records to create at your registrar (the same registrar where the
   Railway CNAME from step 4 lives). Add them exactly as shown. Use a short TTL (300s) while setting up.
3. Wait for Resend to mark the domain verified. DNS propagation is usually minutes, occasionally hours.

### 8.3 The DNS records

SPF, DKIM and DMARC are internet standards (RFC 7208, 6376 and 7489), so the *shape* below is stable
even as provider dashboards change. The **values in angle brackets come from the Resend dashboard** —
copy them, do not invent them.

| Purpose | Type | Name / host | Value |
|---|---|---|---|
| **SPF** — authorizes the provider's servers to send for the domain | `TXT` | the sending domain itself (e.g. `mail`, or `@` for the root) | `v=spf1 include:<host Resend gives you> ~all` |
| **DKIM** — publishes the public key that signs your mail | `CNAME` or `TXT` | a selector host such as `resend._domainkey` (Resend gives the exact selector) | the target host, or `v=DKIM1; k=rsa; p=<long public key>` |
| **DMARC** — tells receivers what to do when SPF/DKIM fail | `TXT` | `_dmarc` on the sending domain | `v=DMARC1; p=none; rua=mailto:dmarc@<your domain>; fo=1; adkim=r; aspf=r` |
| **MX / bounce handling** — only if Resend asks for it | `MX` | as shown | as shown |

Things that go wrong with these records, in order of how often:

- **Two SPF records.** A domain may publish exactly **one** `v=spf1` TXT record. If one already exists,
  merge the new `include:` into it rather than adding a second — two records mean SPF fails entirely.
- **Registrar appends the domain.** Many registrars turn the name `resend._domainkey` into
  `resend._domainkey.example.com` for you. Entering the fully-qualified name yourself produces
  `resend._domainkey.example.com.example.com`, which verifies as missing.
- **DKIM key split or truncated.** A DKIM TXT value is longer than 255 characters, so it must be entered
  as one logical value; most registrars handle the chunking, some silently cut it. Verify with
  `dig +short TXT resend._domainkey.mail.chartrelay.example` and compare against the dashboard.
- **Smart quotes or a trailing space** pasted from a document. Paste into a plain-text field first.
- **Proxied records.** If the DNS is behind a CDN proxy, TXT and the DKIM CNAME must be DNS-only.

Check all three from a terminal once the dashboard says verified:

```bash
dig +short TXT mail.chartrelay.example              # SPF
dig +short CNAME resend._domainkey.mail.chartrelay.example   # or TXT, depending on what Resend issued
dig +short TXT _dmarc.mail.chartrelay.example       # DMARC
```

**DMARC policy — start conservative.** Publish `p=none` first: receivers keep delivering as before and
only report. Send the `rua=` reports to a **role address on your own domain** (or a DMARC reporting
service); never publish a personal inbox in DNS. Watch the reports for one to two weeks, confirm every
legitimate source passes SPF or DKIM alignment, then tighten to `p=quarantine`, and only later
`p=reject`. Going straight to `p=reject` with a misconfigured record sends your own password-reset
emails to the void.

### 8.4 Create the API key and set the variables

1. In Resend, create an API key with **sending permission only**, scoped to the verified domain if the
   dashboard offers that. The value (format `re_…`) is shown once.
2. In Railway → service `chartrelay` → **Variables**, set all three together:
   - `EMAIL_PROVIDER=resend`
   - `RESEND_API_KEY=<the key>` — paste it straight from the Resend dashboard into Railway. Nowhere else:
     not into chat, a commit, a screenshot, or a note.
   - `EMAIL_FROM=ChartRelay <no-reply@mail.chartrelay.example>` — the address **must** be on the verified
     domain, and a `Name <address>` form is fine.
3. Redeploy. In the deploy logs, the `[config] WARNING` about `EMAIL_PROVIDER` must be gone. Locally,
   `npm run check:env -- --production` shows what a production environment is required to have (run it
   against your own local file — it never reads Railway).

### 8.5 Test with a real signup

Configuration is not proof. Test against the deployed site with an inbox you actually own:

- [ ] Register a new account at `https://<domain>/register` using a **real** address.
- [ ] The verification email **arrives in the inbox** (not the spam folder, not only the server log),
      from your `EMAIL_FROM`, within a minute or two.
- [ ] Its link points at `APP_URL`'s host and confirms the account when opened.
- [ ] The dashboard then shows the free limit as **1,000** renders/month rather than 100.
- [ ] `https://<domain>/forgot-password` sends a reset email that works.
- [ ] Resend's delivery log shows both messages **delivered**, with no bounce or complaint.
- [ ] Inspect the received message's authentication results — in Gmail, **Show original** — and confirm
      **SPF: PASS**, **DKIM: PASS**, **DMARC: PASS**. A `PASS` on all three is the point of §8.3.
- [ ] Repeat once with a different major provider (for example an Outlook/Hotmail address); providers
      disagree about new sending domains.

If mail lands in spam while all three authentication checks pass, that is reputation, not
configuration: a brand-new domain sends little mail and is trusted slowly. Keep volume low and steady at
first, and never send marketing from the same subdomain as password resets.

### 8.6 Until this is done

State it plainly on any status page or handoff: **email is not configured, so verification and reset
emails are silently dropped** (the server logs each failure), new accounts stay capped at 100
renders/month, and password recovery does not work. `docs/OPERATIONS.md` → "Emails not sending" covers
the symptoms and how to confirm a fix.

## Rollback

- Bad deploy: Railway → Deployments → pick the previous successful deployment → **Redeploy**. The volume and its data are kept.
- Billing emergency: remove `STRIPE_LIVE_MODE` (live keys are then refused), or disable the live webhook endpoint in Stripe. Existing subscriptions keep billing in Stripe, so manage them from the Stripe Dashboard.


## Current deployment (2026-09-22)

- Railway project `proactive-spontaneity` → service `chartrelay` → public domain `https://chartrelay-production.up.railway.app` (target port 3000).
- Volume `chartrelay-volume` is mounted at `/app/.data`, and `RAILWAY_RUN_UID=0` is set. Health checks confirm the database is writable.
- `SESSION_SECRET` is set to Railway's generator `${{secret(64)}}`, so the value was created by Railway and never handled by a person or agent. Don't replace it unless you intend to sign everyone out.
- Set so far: `APP_URL`, `DATABASE_PATH`, `PORT`, `RAILWAY_RUN_UID`, `TRUSTED_PROXY_HOPS`, `PNG_CACHE_MAX_BYTES` (100 MB, sized for the trial volume), `STRIPE_PRICE_PRO`, `STRIPE_PRICE_SCALE`, `SESSION_SECRET`.
- Still missing: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`. Until they're set, billing returns "not available", webhooks are refused, and emails are not sent.

### Deployed test-mode acceptance (passed 2026-09-22)

Verified against `https://chartrelay-production.up.railway.app` with the sandbox key and webhook endpoint `we_1UIYHMLVPzjDg7SQVzTFBrQr`:

- Checkout session created with the Pro price; Stripe Checkout rendered $29/month.
- Stripe delivered signed webhooks to the deployed endpoint; the workspace became `pro` with a 10,000 render limit and a renewal date.
- A second checkout while subscribed returned a Customer Portal URL instead of a new subscription; Stripe shows exactly one subscription for the customer.
- The Customer Portal opened for the subscribed workspace.
- Cancelling the subscription in Stripe returned the workspace to `free` within seconds.

Test data left in production: `@example.com` accounts from these checks, safe to delete. A `pm_card_visa` test payment method is attached to the test customer.

## Public copy that depends on this configuration

Two claims on the marketing pages are only true for a correctly configured deployment. Re-check
them whenever the variables below change.

- **"30 checks a minute per IP address"** (`/chart-check`, hero note and FAQ). The limit itself is
  in code (`src/app/api/demo/render/route.ts`), but the *per-IP* part depends on
  `TRUSTED_PROXY_HOPS`. `src/lib/security/rate-limit.ts` falls back to a single shared `"local"`
  bucket when the value is `0` or `X-Forwarded-For` is absent, which would make every visitor share
  one 30/minute allowance. Railway has one edge proxy and the default is `1`; the variable is set on
  the current deployment (see above). If the app is ever reached directly, change the copy to
  "per visitor" or fix the variable.
- **Currency and billing interval.** No landing page states a currency, because nothing in this
  repository pins `STRIPE_PRICE_DEVELOPER` / `STRIPE_PRICE_PRO` / `STRIPE_PRICE_BUSINESS` /
  `STRIPE_PRICE_PACK` to a particular currency or interval — they are opaque IDs from the environment.
  The live-mode checklist above says to create the three plans as $19, $59 and $149 per month USD
  recurring, and the render pack as a $10 USD one-time price. Once that is confirmed in the Stripe
  dashboard, record it here; only then should a page say "in USD".

### Domain (2026-09-22)

`chartrelay.dev` is registered at Namecheap and serves production.

- DNS: `ALIAS @ → t10nm01r.up.railway.app` (Namecheap's ALIAS is the apex-safe equivalent of the CNAME Railway asks for) and `TXT _railway-verify → railway-verify=…`.
- Mail: Namecheap email forwarding, `support@chartrelay.dev → the owner's inbox`, with Namecheap's SPF TXT record on the apex. When a sending provider is added, its SPF/DKIM records must be merged with this one rather than replacing it.
- `APP_URL=https://chartrelay.dev` drives canonicals, the sitemap, chart asset URLs and Stripe return URLs. `src/proxy.ts` redirects any other hostname to it for pages only.
- The Stripe webhook endpoint `we_1UIYHMLVPzjDg7SQVzTFBrQr` was edited in place to the new URL, so its signing secret is unchanged.
- The Railway trial allows one custom domain, so `www.chartrelay.dev` is not configured.
