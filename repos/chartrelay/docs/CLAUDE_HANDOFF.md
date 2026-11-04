# Claude Code Handoff — ChartRelay

> **Historical document.** This is the original billing handoff. Its objectives are done: local test-mode billing passed a real end-to-end run. For current behavior read `README.md`, `docs/DEPLOY.md`, and `docs/PITFALLS.md`. Sections marked *historical* describe the state at handoff time, not today.

Work directly in this existing project (a git repository, branch `main`):

`/Users/jessicasalgado/Projects/chartrelay`

Do not use the old copy in the iCloud-synced `~/Documents` folder. It is a stale backup; never edit it. All paths below are relative to the repository root.

Do not start over, replace the architecture, create duplicate Stripe products, or expose secrets in terminal output, chat, Git history, screenshots, logs, or commits. Inspect the current files before changing anything. Preserve unrelated work. Operate autonomously until the acceptance criteria below are satisfied; ask the user only when a secret, external authorization, domain, or hosting choice is genuinely required.

## Objective

Finish ChartRelay as a test-mode, end-to-end subscription SaaS. A user must be able to register, receive an API key, render charts, upgrade to Pro or Scale through Stripe Checkout, return to the dashboard, have the workspace plan updated by verified and idempotent webhooks, open the Stripe Customer Portal, and avoid accidentally creating duplicate subscriptions.

## Product and architecture

ChartRelay is an agent-native chart API. It accepts validated JSON and returns deterministic SVG, PNG, accessibility text, explainable chart QA, immutable asset URLs, and usage information.

The project uses Next.js 16 App Router, React 19, TypeScript, Drizzle ORM, SQLite, Zod, Sharp, Stripe, bcrypt, JOSE sessions, Vitest, and Docker standalone output.

SQLite is intentional for the single-server pilot. Do not migrate databases merely to finish local test-mode billing. Document that Postgres and distributed rate limiting are required before horizontal scaling.

## Verified Stripe test catalog

Stripe account/sandbox: `Skyn sandbox`

Stripe account ID: `acct_1TU4YzLVPzjDg7SQ`

All objects below were created in test mode and verified with `livemode: false`.

| Plan | Product ID | Price ID | Recurrence |
| --- | --- | --- | --- |
| ChartRelay Pro | `prod_VIwdw5whZa1HTY` | `price_1UIKkVLVPzjDg7SQfKZ5bnKk` | USD $29 monthly |
| ChartRelay Scale | `prod_VIwdwl8NCv0wHN` | `price_1UIKkWLVPzjDg7SQ5cqW50RQ` | USD $99 monthly |

Do not recreate these products or prices. Retrieve them by ID if verification is needed. Stripe CLI 1.51.1 is installed. The CLI authorization was short-lived and later returned `Permission denied`; run `stripe login` again if CLI access is required.

## Environment state (historical)

At handoff time the ignored file `.env.local` contained the entries below with empty Stripe secrets. Today `npm run check:env` reports `SESSION_SECRET`, the `sk_test_` key, and the `whsec_` secret all set. Never read or print `.env.local`; use `npm run check:env`, which prints only prefixes.

```env
APP_URL=http://localhost:3000
DATABASE_PATH=./.data/chartrelay.db
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO=price_1UIKkVLVPzjDg7SQfKZ5bnKk
STRIPE_PRICE_SCALE=price_1UIKkWLVPzjDg7SQ5cqW50RQ
```

The user must place the Stripe secrets directly into `.env.local`. Never ask them to paste secrets into chat. Prefer a restricted test key beginning with `rk_test_`; accept `sk_test_` for local testing if that is what the user already has. The webhook signing secret begins with `whsec_`.

Verify secret presence and prefixes without printing values. Never read or echo the full secrets. `.env.local` is already ignored by Git.

The local `whsec_` returned by `stripe listen` is different from a deployed Dashboard webhook endpoint secret. Use the correct secret for the environment being tested.

## Important files

- Product overview and run instructions: `README.md`
- Environment template: `.env.example`
- Local secrets and verified price IDs: `.env.local`
- Package scripts and dependencies: `package.json`
- Stripe client and price mapping: `src/lib/billing/stripe.ts`
- Checkout route: `src/app/api/billing/checkout/route.ts`
- Customer portal route: `src/app/api/billing/portal/route.ts`
- Stripe webhook route: `src/app/api/billing/webhook/route.ts`
- Database schema: `src/lib/db/schema.ts`
- SQLite initialization: `src/lib/db/index.ts`
- Pricing UI: `src/app/pricing/page.tsx`
- Dashboard UI: `src/app/dashboard/page.tsx`
- Billing client button: `src/components/billing-button.tsx`
- Chart API route: `src/app/api/v1/charts/route.ts`
- Chart rendering engine: `src/lib/charts/render.ts`
- Chart QA engine: `src/lib/charts/qa.ts`
- Tests: `tests`
- CI workflow: `.github/workflows/ci.yml`
- Docker image: `Dockerfile`
- Known production pitfalls: `docs/PITFALLS.md`

## Work already completed

The app already has working registration, login, signed HTTP-only sessions, bcrypt password hashing, workspaces, one-time-reveal API keys stored only as SHA-256 hashes, usage metering, free/pro/scale limits, dashboard, pricing, API documentation, interactive playground, SVG rendering, PNG conversion, accessibility summaries, explainable chart QA, Stripe Checkout, Customer Portal route, webhook signature verification, Docker, and CI.

The latest billing changes added:

1. Verified Stripe Pro and Scale price IDs in `.env.local`.
2. A duplicate-subscription guard in the Checkout route. Existing active/trialing subscribers are sent to the Customer Portal instead of receiving another Checkout Session.
3. A `stripe_events` table for webhook idempotency.
4. `checkout.session.completed` handling that retrieves the Stripe subscription before updating the local workspace.
5. Subscription created, updated, and deleted handling.
6. Webhook retry behavior: processing failures return HTTP 500 and are not marked processed.

After these billing changes, `npm run build` passed. Next.js compiled successfully, completed strict TypeScript checking, and generated all 18 application routes.

*Historical, resolved:* at handoff time Vitest and oxlint intermittently stalled. The cause was the project living in an iCloud-synced folder whose files had been evicted (see `docs/PITFALLS.md`). Moving the repository to `~/Projects/chartrelay` fixed it; `npm run lint` and `npm test` now complete reliably and the suite has grown well beyond the original 8 tests.

## Execution plan

### 1. Securely complete environment configuration

Confirm `.env.local` has nonempty `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` with valid prefixes without exposing the values. Add a strong `SESSION_SECRET` of at least 32 random bytes if absent. Do not commit `.env.local`.

If local webhook testing is needed, run:

```bash
stripe login
stripe listen --forward-to http://localhost:3000/api/billing/webhook
```

Put the listener's new `whsec_...` value into `.env.local`, restart the app, and keep the listener running during Checkout testing.

### 2. Audit the billing implementation before mutation

Inspect the checkout, portal, webhook, schema, and SQLite initialization files listed above. Confirm the Stripe SDK API is used correctly for the installed version. Keep dynamic payment methods; do not hardcode `payment_method_types`. Preserve signature verification using the raw request body.

Confirm webhook idempotency works when the same Stripe event is delivered twice. Confirm event processing is transactionally safe enough for the single-server SQLite pilot. Improve it if a race or partial-update risk is found.

Confirm `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted` map the correct workspace and plan. Re-fetch authoritative Stripe subscription state rather than trusting unordered event payloads when practical.

### 3. Add focused billing tests

Add tests for:

- Pro and Scale plan-to-price mapping.
- Unauthorized Checkout access.
- Missing Stripe configuration.
- Active subscriber duplicate prevention.
- Invalid webhook signatures.
- Duplicate webhook event skipping.
- Checkout completion updating the correct workspace plan.
- Subscription deletion reverting the workspace to `free`.

Mock Stripe network calls. Do not hit live mode. Do not weaken or delete existing tests.

Fix the Vitest worker/bootstrap stall. Start with a clean `npm ci`. Keep the test scope narrow and avoid scanning `.next`, `node_modules`, or generated standalone output. If Oxlint remains unreliable, replace it with a deterministic lint command rather than silently removing linting.

### 4. Run the local end-to-end flow

Start from a clean local database. Run the Next.js app and Stripe webhook listener. Register a fresh account. Confirm the initial API key appears once. Render one authenticated chart. Start Pro Checkout from `/pricing`. Complete payment with a Stripe test card. Return to `/dashboard`.

Verify that the workspace becomes `pro`, the subscription ID and customer ID are stored, usage limit changes to 10,000, and the same subscription event can be replayed without double processing. Click Pro or Scale again and confirm an active subscriber is sent to the Customer Portal instead of receiving a second subscription. Test cancellation and verify the plan returns to `free` when the subscription is actually deleted.

Never use live-mode objects or real payment details.

### 5. Finish the billing UX

Add a visible “Manage billing” action to the dashboard for workspaces with a Stripe customer. Show the current plan and subscription status clearly. Surface billing failures without exposing Stripe internals. Keep pricing copy synchronized with actual quotas and prices.

Do not add trials, annual pricing, coupons, usage-based billing, or proration until the current flat monthly flow works end to end.

### 6. Final verification

Run and report exact results for:

```bash
npm ci
npm run lint
npm test
npm run build
npm audit
```

Then perform the manual Checkout/webhook/portal flow. Report failures honestly. Do not call the task complete if tests stall, Checkout is unverified, webhook delivery fails, or duplicate-subscription prevention is untested.

### 7. Deployment after local acceptance

Do not deploy until the test-mode local flow passes. Then initialize Git if necessary, create a private repository, and deploy the existing Dockerfile to a single persistent server. Railway with a persistent volume mounted at `/app/.data` matches the current SQLite architecture. Configure production environment variables in the host, not in Git.

Create a deployed Stripe webhook endpoint at:

`https://<production-domain>/api/billing/webhook`

Subscribe to at least:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Use the deployed endpoint's own signing secret. Complete another full test-mode Checkout on the deployed site before switching any Stripe object to live mode.

Before horizontal scaling, migrate SQLite to managed Postgres and replace the process-local demo rate limiter with shared storage. Before accepting sensitive chart data, replace public immutable asset URLs with signed or authenticated delivery.

## Acceptance criteria

Do not stop at “the code compiles.” The handoff is complete only when all of the following are true:

- The two existing Stripe test prices are used; no duplicates were created.
- Secrets remain local and never appear in Git, logs, screenshots, or chat.
- Lint, tests, production build, and dependency audit complete successfully.
- A fresh user can subscribe to Pro and the local workspace updates to `pro` through a signed webhook.
- Scale Checkout uses the $99 monthly test price.
- Replaying a webhook does not process it twice.
- An active subscriber cannot accidentally create a second subscription.
- The Customer Portal opens for subscribed users.
- Cancellation/deletion returns the workspace to the free plan at the correct lifecycle point.
- The dashboard communicates plan and billing state accurately.
- README and environment documentation match the final implementation.

## Non-goals

Do not implement live-mode billing, tax collection, annual plans, trials, coupons, metered billing, team seats, or multi-region infrastructure in this pass. Stripe Tax must remain disabled until the business confirms its tax registrations and collection obligations.

## Required final report

Return a concise report containing: files changed, commands and results, local end-to-end evidence, Stripe test objects used, unresolved risks, and the exact next production deployment action. Never include secret values.
