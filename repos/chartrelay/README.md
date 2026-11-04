# ChartRelay

ChartRelay is a working SaaS MVP for deterministic chart rendering. It turns validated JSON into accessible SVG and PNG, returns an explainable chart-quality review, persists production renders, meters monthly usage, and includes accounts, hashed API keys, dashboard, docs, pricing, and Stripe subscriptions.

## Run locally

Requirements: Node.js 22+ and npm.

```bash
cp .env.example .env.local   # then fill in SESSION_SECRET and the two Stripe secrets
npm ci
npm run check:env            # validates presence and prefixes; never prints secret values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). SQLite is initialized automatically at `.data/chartrelay.db`, including additive column migrations for older databases.

For local development, the app supplies a non-production session secret if `SESSION_SECRET` is absent. Production refuses to start authenticated operations without an explicit secret.

## Verify

```bash
npm ci
npm run lint      # oxlint with warnings treated as errors, then tsc --noEmit
npm test          # Vitest: renderer, QA, API keys, billing config, checkout, portal, webhooks
npm run build
npm audit
```

Tests use an in-memory SQLite database and mocked Stripe calls. Webhook tests sign payloads with a fake `whsec_` secret and verify them with the real Stripe SDK. No test touches the network.

If the project lives in an iCloud Drive folder (for example `~/Documents` with "Desktop & Documents" sync), see the iCloud entry in [`docs/PITFALLS.md`](docs/PITFALLS.md). Evicted files make Vitest, oxlint, and `next build` stall.

## Accounts

- Sign-up issues an API key immediately (shown once) and sends a confirmation email. A free workspace has **no renders at all** until the owner confirms their email, then 250 a month. A confirmed address is a condition of the free tier, which is what stops one person opening a thousand free accounts.
- Password reset (`/forgot-password`) emails a single-use link that expires after an hour. The response is identical whether or not the account exists. Resetting signs out every existing session and also confirms the email.
- Tokens are stored only as SHA-256 hashes. Verification links last 48 hours, and issuing a new link revokes the previous one.
- Rate limits are stored in SQLite, and expired rows are pruned automatically. Login allows 30 attempts per IP and 10 failures per account from one IP per 15 minutes; failures on one account from many IPs slow its sign-ins down instead of locking the owner out. The client IP is read from `X-Forwarded-For`, counting `TRUSTED_PROXY_HOPS` entries from the right (default 1), because the leftmost entries are client-controlled. Sign-up allows 10 per IP per hour, reset requests 10 per IP and 3 per email per hour, and verification resends 3 per hour. Login takes the same time for unknown emails as for wrong passwords.
- Email goes through `src/lib/email/send.ts`. In development it prints to the server console. In production, set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and `EMAIL_FROM`; production refuses to send without a provider rather than silently dropping mail.

## Billing

Billing is prepaid, never postpaid: nothing is charged past what the customer bought, and a workspace that runs out stops rather than accruing an overage. There are two ways to prepay.

Flat monthly USD subscriptions: Free (250 renders/month once the owner confirms their email, 0 before), Developer ($19, 5,000 renders), Pro ($59, 25,000 renders), and Business ($149, 100,000 renders). One-time render packs: $10 for 2,000 renders, usable for 12 months, buyable with or without a subscription. The monthly allowance is spent first and does not roll over; pack credit is spent second.

The ladder lives in `src/lib/usage/plans.ts` (no database import, so client components can read it) and is re-exported from `src/lib/usage/limits.ts`. Stripe price IDs come from `STRIPE_PRICE_DEVELOPER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` and `STRIPE_PRICE_PACK`. `plan` rows written before the rename still say `scale`; `normalisePlan` maps them to `business`.

- **Checkout** (`POST /api/billing/checkout`) creates or reuses one Stripe customer per workspace (idempotency-keyed). Before creating a session it checks Stripe for any live subscription. If one exists, it syncs it locally and returns a Customer Portal URL instead — where the customer changes plan, or retries a payment, rather than starting a second subscription. "Live" is everything that is not `canceled` or `incomplete_expired`, the same rule the account-deletion route applies; `incomplete` counts, because Stripe keeps that first invoice payable for about 23 hours and a second Checkout in that window double-charges the customer. It also expires older open Checkout Sessions, so two tabs cannot both be paid, and re-checks Stripe after expiring them. Concurrent checkout requests for one workspace are serialized: the second gets 409 while the first is being prepared. If an open session cannot be expired (it may be mid-payment), checkout answers 409 instead of creating another. Payment methods are dynamic (no `payment_method_types`), and Stripe Tax is not enabled.
- **Customer Portal** (`POST /api/billing/portal`) opens for any workspace with a Stripe customer. The dashboard shows a "Manage billing" action.
- **Webhooks** (`POST /api/billing/webhook`) verify the Stripe signature against the raw body. For every subscription event, the handler re-fetches the subscription from Stripe, so reordered deliveries converge on the current state. Re-fetching and applying are serialized per subscription id by a process-local promise chain — correct here because the server is deliberately a single process — so a delivery never applies a snapshot it fetched before another delivery's write. Three guards back that up, each preferring the newer state: a snapshot showing a subscription alive never overwrites a stored `canceled` or `incomplete_expired` state for that same subscription, its current period end never moves backwards, and a delivery whose Stripe event is strictly older than the last one applied for that subscription is ignored. The duplicate check, the workspace update, and the `stripe_events` record commit in one SQLite transaction, so a replayed event is skipped. A processing failure returns 500 and is not recorded, so Stripe retries it. Handled events: `checkout.session.completed` and `customer.subscription.created`, `.updated`, and `.deleted`.
- **Plan mapping** comes from the subscription's price and nothing else, so a Pro↔Business switch in the portal updates the workspace. `subscription.metadata.plan` is written once at Checkout and is never rewritten afterwards, so it is not consulted at all: a subscription whose current price matches none of the configured plan prices falls back to Free, and if Stripe is still charging for it, an actionable `[billing-alert]` error line names the price and the subscription.
- **Lifecycle:** `active` and `trialing` keep paid limits. `past_due` also keeps them while Stripe retries the card, and the dashboard shows a payment warning. This relies on Stripe's failed-payment setting cancelling (or marking unpaid) the subscription after the last retry; set it as described in [`docs/DEPLOY.md`](docs/DEPLOY.md) step 5. Canceling at period end keeps the plan and shows "Cancels soon" until Stripe deletes the subscription, and then the workspace returns to Free. An event about an older subscription can never downgrade the workspace's current subscription. If the current subscription ends while the customer still pays for another one, the workspace adopts that one instead of dropping to Free, and a `[billing-alert]` error line is logged whenever a workspace has two entitled subscriptions.
- **Errors** shown to users are generic. Stripe error types and request IDs are logged server-side only.

### Local webhook testing

```bash
stripe listen --forward-to http://localhost:3000/api/billing/webhook
```

Put the `whsec_...` value the listener prints into `STRIPE_WEBHOOK_SECRET` in `.env.local`, then restart `npm run dev`. That secret belongs to the CLI listener. A deployed Dashboard endpoint has its own signing secret.

## Product surface

- Public landing, pricing, API documentation, and interactive playground
- Email/password accounts with bcrypt password hashing and signed, HTTP-only sessions
- Workspaces and one-time-reveal API keys stored only as SHA-256 hashes
- Authenticated chart rendering with monthly plan limits and usage events
- Bar, line, area, pie, and scatter renderers
- Raw SVG plus immutable SVG and PNG asset URLs
- Deterministic accessibility summaries and explainable chart QA
- Stripe Checkout, Customer Portal, duplicate-subscription prevention, and signed, idempotent webhooks
- Responsive dashboard with plan and billing status, usage, key inventory, and recent renders

## API example

```bash
curl -X POST http://localhost:3000/api/v1/charts \
  -H "Authorization: Bearer $CHARTRELAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "bar",
    "title": "Revenue",
    "series": [{
      "name": "MRR",
      "data": [
        { "label": "August", "value": 31200 },
        { "label": "September", "value": 33900 }
      ]
    }]
  }'
```

## Run the production build locally

```bash
npm run build     # also copies .next/static into the standalone server (postbuild)
PORT=3000 npm start
```

The production server refuses to start when `SESSION_SECRET` is missing or shorter than 32 characters, and logs a `[config] WARNING` when no email provider is configured.

## Production configuration

Set `APP_URL`, `DATABASE_PATH`, and a strong `SESSION_SECRET` in the host's environment, never in Git. For billing, set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_DEVELOPER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`, and `STRIPE_PRICE_PACK`. Live-mode keys are refused unless `STRIPE_LIVE_MODE=enabled` is also set. Point a Stripe webhook endpoint at `https://<domain>/api/billing/webhook` and subscribe it to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`. Use that endpoint's own signing secret.

For a step-by-step Railway deployment (volume, variables, custom domain, Stripe webhook, test-mode acceptance, live-mode switch), follow [`docs/DEPLOY.md`](docs/DEPLOY.md). `railway.json` configures the Dockerfile build, the `/api/health` healthcheck (HTTP 200 `{"status":"ok"}` after a SQLite query, 503 on failure), and restart-on-failure. Draft `/terms` and `/privacy` pages are linked from the footer and must be completed and reviewed before live launch.

The bundled SQLite database suits a single persistent server; mount a persistent volume at `/app/.data` when running the Docker image. It is not the final database architecture for horizontally scaled serverless deployment. Move the Drizzle schema to Postgres, and the demo rate limiter to shared storage, before running more than one instance.

## Security notes

Chart inputs are validated with Zod, and request bodies over 256 KB are refused with 413. User strings are XML-escaped before entering SVG, and characters XML forbids (stray control characters from spreadsheet exports) are dropped. PNGs are rasterized once per chart, with bounded concurrency, and stored. Pages send CSP, `X-Frame-Options: DENY`, HSTS, `nosniff`, and `Referrer-Policy` headers; SVG assets are served with a sandboxing CSP. Cookie-issuing auth routes require `application/json` and refuse cross-site origins. Signing out revokes every session of that user. Passwords are bcrypt-hashed. API key values are never stored. Billing webhooks verify Stripe signatures. Render URLs are intentionally public and immutable; add signed asset access if customer data must remain private.

## Repository layout

| Path | Contents |
|---|---|
| `src/` | Next.js app: pages, API routes, and libraries (`lib/auth`, `lib/billing`, `lib/charts`, `lib/db`, `lib/email`, `lib/security`, `lib/usage`) |
| `tests/` | Vitest suites (no network; in-memory SQLite; Stripe mocked) |
| `mcp/` | `@chartrelay/mcp`, the MCP server package (separate `package.json`; unpublished) |
| `marketing/` | Go-to-market plan and launch copy drafts |
| `docs/` | Handoff, deployment runbook, pitfalls, best practices, customization notes |
| `scripts/` | Operational scripts (`check-env.mjs`, `copy-static.mjs`) |
| `.github/workflows/` | CI |

