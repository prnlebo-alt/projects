# Repo audit against `docs/BILLING_SPEC.md`

Read-only audit. Produced 2026-10-08 by the Repo Auditor subagent named in the spec (§MCP, agents and
subagents). No code, tests or configuration were changed.

Scope: the spec as exported Oct 8, 2026, at `docs/BILLING_SPEC.md:1-274`, against `src/`, `tests/`,
`mcp/`, `docs/`, `marketing/` and `scripts/` as they stand.

**How to read the verdicts.** A wrong "already done" is more expensive than a wrong "missing", so
anything that merely resembles the spec is reported as PARTIAL with the difference spelled out, and
nothing is marked DONE unless the code does what the spec says, not something adjacent to it.

---

## 0. Executive summary

The repo today is a **flat-subscription, counter-based quota product**. The spec describes a
**prepaid-credit ledger product**. These are not the same shape, and the overlap is smaller than the
file names suggest.

What genuinely exists and is reusable:

- SHA-256-at-rest API keys with a `cr_live_` prefix, instant revocation, and `last_used_at`
  (`src/lib/auth/key-utils.ts`, `src/lib/auth/api-keys.ts`, `src/lib/db/schema.ts:30-39`).
- A real atomicity discipline around metering: the quota check, the render write and the usage event
  are one synchronous `BEGIN IMMEDIATE` transaction (`src/app/api/v1/charts/route.ts:73-84`), with
  concurrency tests that pass (`tests/quota-race.test.ts:44-61`).
- Stripe subscription Checkout, Portal, signature-verified webhooks, and **webhook deduplication
  already implemented** via a `stripe_events` table (`src/lib/db/schema.ts:108-112`,
  `src/lib/billing/sync.ts:160-162,239-253`).
- A disciplined business-identity module and three named subprocessors (`src/lib/business.ts`).

What does not exist in any form:

- `credit_grants`, `balances`, `processed_webhooks` (under that name), `audit_log`.
- Any notion of a **credit balance**, a **grant**, a **pack**, an **expiry**, a **reservation**, a
  **refund**, an **idempotency key**, or a **sweeper**.
- HTTP **402** anywhere in the codebase (the only occurrences of the string are in the spec itself and
  one coincidental data value in `src/components/chart-studio.tsx:36`).
- Any `request_id` / `X-Request-Id`, any `X-ChartRelay-Credits-Remaining`, any IETF `RateLimit-*`
  headers.
- Any rate limiting at all on `POST /api/v1/charts`.
- One-time (non-subscription) purchases; the checkout route hard-codes `mode: "subscription"`.
- Scopes, per-key budgets, expiry, IP allowlists, rotation, test keys, signed URLs.

Two gaps are **correctness traps for the builder**, not merely missing features:

1. **The plan ladder in the spec is not the plan ladder in the code.** The spec says Free 250 /
   Developer $19 / Pro $59 / Business $149 (`docs/BILLING_SPEC.md:53-59`). The code says Free 1,000 /
   Pro $29 / Scale $99 (`src/lib/usage/plans.ts:8`, `README.md:44`), and `plan` is a SQLite
   `text(... enum ["free","pro","scale"])` column (`src/lib/db/schema.ts:21`) wired to exactly two env
   price IDs, `STRIPE_PRICE_PRO` / `STRIPE_PRICE_SCALE`
   (`src/lib/billing/stripe.ts:34-38,53-63`). Phase 1 is a rename *and* a renumber *and* a
   four-tier widening, touching the schema, the price-ID plumbing, `planForPrice`, the pricing page
   and the tests that pin those figures.
2. **The free tier the spec is replacing is bigger than the spec realises.** The spec says "replace the
   current unlimited watermarked free renders with 250/month" (`docs/BILLING_SPEC.md:76`). There are
   in fact **two** free surfaces: the metered `POST /api/v1/charts` quota (1,000/mo) *and* the
   deliberately unauthenticated, unmetered, unlimited `GET /chart`
   (`src/app/chart/route.ts:9-11`), which is the product's current headline and is promised as
   unlimited in eleven places on the public site. Section 9 lists all of them.

---

## 1. Keys

### What the two files do today

`src/lib/auth/key-utils.ts` is nine lines:

```
3  export function hashApiKey(key: string) {
4    return createHash("sha256").update(key).digest("hex");
5  }
7  export function createApiKeyValue() {
8    return `cr_live_${randomBytes(24).toString("base64url")}`;
9  }
```

`src/lib/auth/api-keys.ts` is 28 lines and does two things: `storeApiKey` (line 9) mints a value,
hashes it, stores `prefix = value.slice(0, 12)` (line 17) and returns the plaintext once;
`findApiKey` (line 24) looks up by `sha256(value)` with `isNull(revokedAt)` (line 26).

### The current key's actual format

`cr_live_` + `randomBytes(24).toString("base64url")`.

- 24 random bytes, **not 32**. 192 bits of entropy (plenty, but not what the spec specifies).
- **base64url**, not Base62. The alphabet includes `-` and `_`.
- 24 bytes encodes to exactly 32 base64url characters with no padding, so the total length is
  **40 characters**: `cr_live_` (8) + 32.
- **No checksum.** Nothing can reject a mistyped or fabricated key before the database lookup.
- **No `cr_test_` variant.** `cr_live_` is hard-coded at `key-utils.ts:8`; there is no test-key
  concept anywhere in the repo.

`tests/api-key.test.ts:5-11` pins only `/^cr_live_/`, inequality, and `length >= 40` — so the format
is under-specified by its own test and can be changed freely. `tests/api-key.test.ts:22-28` pins
SHA-256 against published FIPS 180-2 vectors, which is a genuinely good guard to keep.

### Spec-by-spec comparison

| Spec requirement (`BILLING_SPEC.md:86-99`) | Today | Verdict |
| --- | --- | --- |
| `cr_live_` / `cr_test_` prefix | `cr_live_` only (`key-utils.ts:8`) | PARTIAL — live prefix right, no test keys |
| 32 random bytes | 24 bytes (`key-utils.ts:8`) | DIFFERENT |
| Base62 | base64url (`key-utils.ts:8`) | DIFFERENT |
| 6-character CRC32 checksum | none | MISSING |
| SHA-256 at rest | yes (`key-utils.ts:4`), unique index (`schema.ts:34`) | DONE |
| Display prefix + **last 4** | prefix only; dashboard renders `{key.prefix}••••••••` (`src/app/dashboard/page.tsx:43`) | PARTIAL — no last4 stored or shown |
| Full key shown once | yes (`api/keys/route.ts:19`, `api/auth/register/route.ts:79`, notice string at `register/route.ts:47-48`, reveal UI at `src/components/key-manager.tsx:24`) | DONE |
| Several keys per account | schema allows it; `POST /api/keys` creates unlimited keys with no cap and no plan gate (`src/app/api/keys/route.ts:9-20`) | DONE (and un-gated, which the spec wants gated to Pro+) |
| Scopes (`render`, `usage:read`, `keys:admin`) | no column, no concept | MISSING |
| Optional monthly budget per key | no column, no concept | MISSING |
| Optional expiry | no column, no concept | MISSING |
| Optional IP allowlist | no column, no concept | MISSING |
| `agent` tag | no column | MISSING |
| `last_used_at` | column exists (`schema.ts:36`); written **only** in the POST render path (`api/v1/charts/route.ts:81`) | PARTIAL — see below |
| Rotation, old key valid 7 days | no rotation endpoint, no grace concept | MISSING |
| Revocation instant | `revokedAt` set at `api/keys/route.ts:32`, and `findApiKey` filters on it with **no cache at all** (`api-keys.ts:26`) | DONE, and stronger than the spec's "≤30 s cache TTL" |

### Three subtleties worth flagging explicitly

1. **`last_used_at` is not updated by `GET /chart`.** `entitledToUnmarked` calls `findApiKey`
   (`src/app/chart/route.ts:79-85`) and never touches the column. A customer whose entire usage is
   URL charts will show "Never used" on the dashboard forever
   (`src/app/dashboard/page.tsx:43`). Any "key leaked / unused key" reporting built on this column
   will be wrong for exactly the traffic the product currently leads with.
2. **There is no revoke affordance in the UI.** `DELETE /api/keys?id=` exists and works
   (`src/app/api/keys/route.ts:22-34`, covered by `tests/cross-site.test.ts:62`), but no component
   calls it — `src/components/key-manager.tsx` only has a create button (line 19). Phase 1's
   "show once; revoke" is API-complete and UI-incomplete.
3. **Keys are issued before email verification.** `register()` calls `storeApiKey(workspaceId)`
   unconditionally (`src/lib/auth/credentials.ts:59`) and the route returns the plaintext
   (`src/app/api/auth/register/route.ts:79`), before any confirmation. The spec's abuse control is
   "verify email before issuing a key" (`BILLING_SPEC.md:195`) and Phase 1 item 4 pairs the 250 cap
   *with* email verification. Today verification only changes the *quota*
   (`src/lib/usage/plans.ts:12-17`), never whether a key exists. Reversing this changes the sign-up
   response shape and the two places that document it
   (`src/components/quickstart-card.tsx`, `src/app/docs/page.tsx`), which
   `tests/docs-consistency.test.ts` pins.

Also absent, for completeness: **no public key IDs (`pk_live_`), no signing secrets (`crsig_`), no
`/c/{id}.png` short URLs, no `kid`/`exp`/`sig` handling.** The signed-URL half of
`BILLING_SPEC.md:84-110` is Phase 2 and is 0% present. `reports/SECURITY_REVIEW.md:67,80` already
identifies the `?key=` in a URL problem and sketches the signing fix, which is useful prior art.

---

## 2. Ledger

### Which specified tables exist

| Spec table (`BILLING_SPEC.md:118-122`) | Exists? |
| --- | --- |
| `credit_grants` | **No.** Nothing resembling a grant, a source, an expiry or a `payment_event_id`. |
| `balances` | **No.** No balance is stored anywhere; the "remaining" figure is always derived by `SUM()` over `usage_events`. |
| `usage_events` | **Name collision only** — see below. |
| `processed_webhooks` | **Functionally yes, different name**: `stripe_events` (`src/lib/db/schema.ts:108-112`, DDL at `src/lib/db/index.ts:50-52`). Provider event id as primary key, exactly as the spec asks. |
| `audit_log` | **No.** Key create/rotate/revoke, plan changes and grants are not logged to any table. `activation_events` (`schema.ts:72-78`) is a product-funnel table and its own doc comment says it is "deliberately not analytics"; it is not an audit log and should not be conscripted as one. |

### The existing `usage_events` table, exactly

`src/lib/db/schema.ts:54-60`:

```
id            text PRIMARY KEY
workspace_id  text NOT NULL -> workspaces.id ON DELETE CASCADE
kind          text NOT NULL                   -- always the literal "render" in practice
quantity      integer NOT NULL DEFAULT 1      -- always 1 in practice
created_at    text NOT NULL                   -- ISO-8601 string
```

Index: `idx_usage_workspace_created ON usage_events(workspace_id, created_at)`
(`src/lib/db/index.ts:64`).

How it is used: written in exactly one place, `recordUsage()`
(`src/lib/usage/limits.ts:50-52`), always `quantity: 1`, always inside the caller's transaction. Read
in exactly one place, `usageTotal()` (`src/lib/usage/limits.ts:18-24`), as
`coalesce(sum(quantity), 0)` filtered to `created_at >= startOfMonth()`. That is the whole lifecycle.

### Compared against the specified `usage_events`

The spec wants: `id, account_id, key_id, request_id, idempotency_key, units, status
(reserved|charged|refunded), format, cache_hit, created_at`, with a unique index on
`(key_id, idempotency_key)`.

Present: `id`, `account_id` (as `workspace_id`), `units` (as `quantity`), `created_at`.
Absent: `key_id`, `request_id`, `idempotency_key`, `status`, `format`, `cache_hit`, and the unique
index. Six of ten columns and the one index that makes idempotency work.

Note `key_id` in particular: the table **cannot attribute usage to a key today**, so the spec's
"usage by day, key, format" (`BILLING_SPEC.md:239`) and per-key budgets are not derivable from
existing rows even retroactively. `renders.api_key_id` exists (`schema.ts:44`) and is populated
(`api/v1/charts/route.ts:80`), so historic attribution could be reconstructed by joining through
`renders` — but only for POST renders, and only until a render row is deleted.

### Evolve or replace?

**Evolve, with a caveat.** The migration function is additive by design
(`src/lib/db/index.ts:67-78`) and `ALTER TABLE ... ADD COLUMN` on SQLite is cheap. Adding the six
missing columns and backfilling `status = 'charged'`, `units = quantity` is mechanical. The caveat:
the semantics change from "append-only counter of completed renders" to "append-only log of
reservations in three states", and `usageTotal()` would then be summing rows that include
`reserved` and `refunded`. Every reader must be updated in the same change, and there is exactly one
reader (`src/lib/usage/limits.ts:18`), so the blast radius is small.

The stronger argument for evolving rather than replacing is that `startOfMonth()`-based summing is
being retired anyway: once `balances` exists, the authoritative remaining figure comes from
`balances.remaining`, and `usage_events` becomes a log rather than the source of truth. That makes the
old table's shortcomings (no status, no idempotency) a non-issue for correctness of the *balance* and
only an issue for the *usage page*.

One real trap: `usage_events` has `ON DELETE CASCADE` from `workspaces`. An append-only financial log
that vanishes when an account is deleted is a reconciliation problem the spec's nightly check
(`BILLING_SPEC.md:137`) will trip over. The repo already solved this once for Stripe customers with
the `deleted_customers` tombstone (`schema.ts:102-106`); the same pattern will be needed here.

### Atomic reserve? Idempotency? Sweeper?

- **Atomic reserve: no, but the atomicity discipline is there.** There is no reservation. What exists
  is a check-then-insert inside one synchronous transaction:
  `src/app/api/v1/charts/route.ts:73-84` opens `db.transaction(..., { behavior: "immediate" })`,
  calls `assertWithinLimit` (which re-counts inside the tx, `src/lib/usage/limits.ts:42-47`), then
  writes the render and the usage event. The comment block at `route.ts:63-72` is unusually candid
  and worth reading before touching it: it states that the guarantee holds **within one process
  only**, and that two servers sharing the file would each begin from their own snapshot.
  `tests/quota-race.test.ts:44-61` proves exactly-one-admitted at 20 and 40 concurrent requests
  against the real route handler.

  What this is *not*: it is a `SELECT SUM(...)` + `INSERT`, not
  `UPDATE balances SET remaining = remaining - 1 ... RETURNING`. It is O(rows this month) per request
  rather than O(1), and it cannot express a per-key budget or a pack-before-allowance draw order.

- **Idempotency: none.** No `Idempotency-Key` header is read anywhere in `src/`. A client that retries
  after a timeout is charged twice today — there is no stored result to return. The spec's
  stress-test row "Client retries after timeout" (`BILLING_SPEC.md:212`) currently fails.

- **Sweeper: none.** There is nothing to sweep (no `reserved` state), and no background job
  infrastructure of any kind in the app process. The only periodic work is `pruneRateLimits`, which
  is piggybacked on request traffic (`src/lib/security/rate-limit.ts:20-22`) rather than scheduled.
  Scheduled work in this project currently lives outside the app, as `scripts/*.mjs` plus external
  cron/scheduled tasks (`docs/STATUS.md:3` describes a scheduled Claude task; `scripts/backup.mjs`,
  `scripts/uptime-check.mjs`). A sweeper will need either that pattern or a new in-process timer.

---

## 3. Quota and metering today

### The plans

`src/lib/usage/plans.ts:8`:

```
export const planLimits = { free: 1_000, pro: 10_000, scale: 100_000 } as const;
```

`src/lib/usage/plans.ts:12`: `UNVERIFIED_FREE_LIMIT = 100`.
`src/lib/usage/plans.ts:14-17`: `limitFor(plan, emailVerified)` returns 100 for an unverified free
workspace, otherwise the plan's number, defaulting unknown plan strings to `free`.

Prices live only in copy and in Stripe: $29 Pro, $99 Scale (`src/app/pricing/page.tsx:58-59`,
`README.md:44`, `marketing/PLAN.md:36`). The DB enum is `["free","pro","scale"]`
(`src/lib/db/schema.ts:21`).

**Against the spec's ladder** (`BILLING_SPEC.md:53-59`): every tier differs in name, price and
allowance, and the spec has four tiers plus a pack where the code has three tiers and no pack.
`planForPrice` (`src/lib/billing/stripe.ts:58-63`) maps exactly two env vars; a third and fourth plan
need new env vars, new `billingConfigProblems` entries (`stripe.ts:34-38`),
a widened schema enum, and updates to `describeBilling`'s label ladder
(`src/lib/billing/status.ts:26`) and `UNMARKED_PLANS` (`src/app/chart/route.ts:39`).

### How a render is counted and capped

One enforcement point, and only one: **`POST /api/v1/charts`**
(`src/app/api/v1/charts/route.ts:73-84`).

Order of operations in that route: cross-site guard (41) → auth (43-44) → body read with 256 KB cap
(45-46) → schema parse (47-48) → options parse (52-53) → **render, outside the transaction** (56) →
QA blocking decision (60) → transaction: read owner's `emailVerifiedAt` (74), `assertWithinLimit`
(75), throw if QA blocks (79), insert render (80), touch `last_used_at` (81), `recordUsage` (82).

Consequences worth naming:

- **The render happens before the quota check.** CPU is spent on a request that is then refused with
  429. The spec wants validation and limits checked "before any credit moves"
  (`BILLING_SPEC.md:128-130`) — which this satisfies for *credit*, but it means an exhausted account
  can still burn unbounded CPU, and with no rate limit on this route (§6) that is an abuse surface.
- Rejected renders are correctly not metered, and the tests pin it
  (`tests/charts-contract.test.ts:50,61,66,108`).
- Cache hits: there is no render cache on this path, so "cache hits never billed" is vacuously true.

### `GET /chart` is unmetered and unlimited — confirmed

The route's own header comment, `src/app/chart/route.ts:9-11`:

> It is deliberately unauthenticated and unmetered. Renders are free and unlimited; what a paid plan
> buys is the removal of the watermark […]

Confirmed in code: the route imports `findApiKey` (line 15) but never `assertWithinLimit` or
`recordUsage`; the only gate is a per-IP abuse ceiling of 240/min (lines 36, 105). A key, if passed,
is consulted **only** to decide whether to draw the watermark (`entitledToUnmarked`, lines 79-85,
called at 128).

### Every place that assumes `GET /chart` is unmetered

Code:
- `src/app/chart/route.ts:9-11` (route contract), `:32-35` (rate-limit rationale), `:107` (429 copy
  says "Charts are unlimited"), `:128-129` (key used for watermark only).
- `src/lib/charts/watermark.ts:4` — module doc: "renders are unlimited and unmetered, and what a paid
  plan buys […]". The monetisation model is written into the watermark module's rationale.
- `src/app/chart/route.ts:39` `UNMARKED_PLANS = new Set(["pro","scale"])` — the only place plan maps
  to watermark; a spec-era free tier with 250 credits still needs a watermark rule, and `pro`/`scale`
  will not be the plan names.

Docs/copy (full list in §9).

Tests: no test asserts that `GET /chart` is unmetered — `tests/chart-url.test.ts` and
`tests/chart-url-unicode.test.ts` cover parsing and header safety only. So metering this route
breaks no test, which is both convenient and a gap (the current promise is untested).

---

## 4. Payments

`src/lib/billing/` holds three files and no payment-provider abstraction.

### What works today

- **Checkout** (`src/app/api/billing/checkout/route.ts`): session-authenticated, plan-only
  (`requestSchema = z.object({ plan: z.enum(["pro","scale"]) })`, line 12),
  `mode: "subscription"` hard-coded (line 109). It is unusually defensive: a process-local in-flight
  set (17, 38-39), an idempotency key on customer creation (71), an authoritative Stripe
  re-check for live subscriptions before creating a session (80-89), and expiry of older open
  sessions with a refusal if any expiry fails (92-97).
- **Portal** (`src/app/api/billing/portal/route.ts`): creates a `billingPortal` session; also used as
  the fallback when a second checkout is blocked (`checkout/route.ts:52-55`).
- **Webhooks** (`src/app/api/billing/webhook/route.ts`): raw-body signature verification with an
  explicit comment not to parse first (line 16-17), 400 on missing/invalid signature, 503 when the
  secret is unconfigured, 500 (so Stripe retries) on processing failure (24-28).
- **Plan sync** (`src/lib/billing/sync.ts`): handles four event types (10-15), re-fetches the
  subscription from Stripe so reordered deliveries converge (227), and derives plan from the
  **current price only**, never `subscription.metadata.plan` (47-50) — a deliberate past fix.
  Three independent out-of-order guards: stored monotonic signals (103-109), a process-local
  `created` watermark (84-94, 140-141), and a per-subscription promise-chain mutex (178-191).
- **Config validation** (`src/lib/billing/stripe.ts:25-40`) plus `scripts/check-env.mjs:19-22`.

### Webhook deduplication — yes, already there

This is the one ledger-adjacent spec table that already exists. `stripe_events(id PK, type,
processed_at)` (`src/lib/db/schema.ts:108-112`). Dedupe is checked twice: optimistically before the
lock (`sync.ts:210`) and again **inside the same transaction as the write**
(`sync.ts:240`), with the insert at `sync.ts:252`. That is the correct pattern and it satisfies the
spec's `processed_webhooks` semantics and the stress-test row "Payment webhook delivered twice"
(`BILLING_SPEC.md:210`) — for subscription events. `tests/billing-race.test.ts` exercises it.

Caveat for the builder: the dedupe covers **event ids**, and the spec's `credit_grants` wants a
separate `payment_event_id UNIQUE`. Two different guards for two different things; granting credit
inside the same transaction as the `stripe_events` insert would make them one, which is the right
move.

### What must change for one-time pack purchases

1. `requestSchema` (`checkout/route.ts:12`) accepts only plan enums — needs a pack product.
2. `mode: "subscription"` (line 109) → `mode: "payment"` for packs, and the whole
   "block a second checkout when a live subscription exists" fast path (62-64, 84-89) must **not**
   apply to packs: the spec says packs are buyable with no plan and as subscriber overage
   (`BILLING_SPEC.md:51,59`). As written, an existing Pro subscriber attempting any checkout is
   redirected to the Portal instead.
3. `HANDLED_EVENT_TYPES` (`sync.ts:10-15`) has no `payment_intent.succeeded`,
   `charge.refunded`, `charge.dispute.created`, or `invoice.paid`. Packs need at least the first; the
   spec's dispute and refund rows (`BILLING_SPEC.md:215-216`) need the next two.
4. `lockKeyOf` (`sync.ts:194-200`) returns `null` for anything that is not a subscription event, so a
   pack payment would take no lock. For a credit grant that is probably fine given the
   `payment_event_id` unique index, but it should be a deliberate decision.
5. `applyStripeEvent` has a latent bug the builder will meet: at `sync.ts:222`,
   `const subscriptionId = customerIdOf(session.subscription)` uses the *customer* helper to extract
   a **subscription** id. It works (both are `string | {id}`) and `lockKeyOf:195` does the same, but
   the name is wrong and will mislead whoever extends this for `payment_intent`.
6. There is no price ID for a pack: `billingConfigProblems` requires exactly `STRIPE_PRICE_PRO` and
   `STRIPE_PRICE_SCALE` (`stripe.ts:34-38`), mirrored in `scripts/check-env.mjs:21-22`.

### What must change to swap in a merchant of record

There is **no provider abstraction**. `Stripe` is imported directly in
`src/lib/billing/stripe.ts:1`, `src/lib/billing/sync.ts:1`, and
`src/app/api/billing/webhook/route.ts:2`; `Stripe.Subscription` and `Stripe.Event` appear in the
signatures of the exported functions `billingStateFromSubscription`, `applySubscription`,
`processStripeEvent` and `findWorkspace` (`sync.ts:37,117,209,56`). The workspace table stores
Stripe-specific columns (`stripe_customer_id`, `stripe_subscription_id`,
`src/lib/db/schema.ts:22-23`) with a unique index on the customer id
(`src/lib/db/index.ts:97`). `deleted_customers` is keyed by `stripe_customer_id`
(`schema.ts:103`).

Of the two options in the spec, **Stripe Managed Payments** is far cheaper here: it works with the
existing Stripe account and Checkout (`BILLING_SPEC.md:80`), so none of the above changes. **Polar**
(`BILLING_SPEC.md:81`) would require a provider-neutral seam: generic `billing_provider`,
`provider_customer_id`, `provider_subscription_id` columns, a provider-agnostic event type, and
rewriting `sync.ts` around it. That is a multi-day change, and it is the single strongest argument
for resolving the open decision at `BILLING_SPEC.md:272` *before* the ledger is built rather than
after.

---

## 5. Error contract

### What the API returns today

`POST /api/v1/charts` (`src/app/api/v1/charts/route.ts`):

| Situation | Status | Body |
| --- | --- | --- |
| Cross-site, cookie-auth'd | 403 | `{error:"Cross-site request refused."}` (`security/request.ts:64,66`) |
| No/invalid Bearer key, no session | 401 | `{error:"Provide a valid Bearer API key."}` (line 44) |
| Body > 256 KB | 413 | `{error:"Request body is larger than 256 KB."}` (`security/request.ts:8`) |
| Unparseable JSON | 400 | `{error:..., details:{reason}}` (`security/request.ts:16`) |
| Schema failure | 400 | `{error:"Invalid chart specification.", details: […]}` (line 48) |
| QA blocking | 422 | `{error, code:"quality-rejected", blocking, warnings, override}` (lines 93-99) |
| **Quota exhausted** | **429** | `{error:"Monthly render limit reached (N)."}` (line 91) |
| Render failure | 500 | `{error:"The chart could not be rendered…"}` (line 102) |

`GET /api/v1/charts/[id]`: 400 unknown param / bad format (lines 15, 17), 404 not found (19), 500
raster failure (26).

`GET /chart`: 429 (rate limit) and 400 (parse/render), both returned **as an SVG or PNG image**, with
the reason in an `x-chartrelay-error` header (`src/app/chart/route.ts:110,115,125`). Documented at
`src/app/docs/page.tsx` under `#url-errors`.

### Against the spec's table (`BILLING_SPEC.md:141-149`)

| Spec | Today |
| --- | --- |
| 400 `invalid_chart_spec` with field path | Status right, field paths right (`validationDetails`), **but no `code`, no `type`, no nesting under `error`** |
| 401 `invalid_api_key` | Status right, no code |
| 401 `signature_required` / `signature_invalid` | N/A — no signing |
| **402 `credits_exhausted` / `key_budget_exhausted`** | **Does not exist. Quota exhaustion is 429** (`route.ts:91`) |
| 403 `scope_denied` / `ip_not_allowed` / `region_blocked` | 403 exists only as the cross-site refusal; none of these three codes or concepts exist |
| 413 `payload_too_large` | Status right, no code |
| 429 `rate_limited` | 429 is **overloaded**: it means both rate limiting and quota exhaustion today |
| 5xx `render_failed`, never charged | Status right, never charged (the throw rolls the transaction back), no code |

The 429-for-quota decision is **documented as deliberate and contract-level**, which makes reversing
it a breaking change with a paper trail:

- `src/app/docs/page.tsx` errors table: "429 — The workspace reached its monthly render limit. **Only
  quota exhaustion returns 429.**"
- `src/lib/usage/limits.ts:31`: "The only error the render API maps to HTTP 429."
- `mcp/index.js:89` branches on 429 to print "Monthly render limit reached… Upgrade at …/pricing".
- `src/app/page.tsx:214-215` and `src/app/pricing/page.tsx` FAQ both tell customers it is a 429.
- `tests/charts-contract.test.ts` and `tests/quota-race.test.ts:49,58,67` assert 429 counts.

### `request_id`? Anything like the spec's envelope?

**No `request_id` and no `X-Request-Id` anywhere in `src/`.** The only `requestId` in the repo is
Stripe's own, read for a log line (`src/lib/billing/stripe.ts:73`). There is no correlation id
generated, logged or returned, which also means the spec's "logged, with a request id"
expectations (e.g. `BILLING_SPEC.md:221`) have nothing to build on.

Every error body today is a **flat** `{error: "<sentence>"}` with optional `details` / `code` /
`blocking`. The spec wants `{error:{type,code,message,doc_url,top_up_url}, request_id}`. This is a
total reshape of every JSON route, not an addition. Note that `mcp/index.js:85-91` and
`src/components/chart-checker.tsx:127` parse the current flat shape, as do several tests.

Nothing emits `X-ChartRelay-Credits-Remaining`. The closest is the body field
`usage: {used, limit}` on a 201 (`src/app/api/v1/charts/route.ts:89`), surfaced by the MCP server
(`mcp/index.js:44`).

---

## 6. Rate limiting

`src/lib/security/rate-limit.ts` is a **fixed-window counter in SQLite**:
`rate_limits(key PK, window_start, count)` (`src/lib/db/schema.ts:90-94`),
`consumeRateLimit(key, limit, windowMs)` in a transaction (lines 28-41), `peekRateLimit` for
read-without-increment (44-49), and `pruneRateLimits` piggybacked on traffic (15-22).
`clientIp` (69-75) is carefully written: it counts `TRUSTED_PROXY_HOPS` from the **right** of
`X-Forwarded-For`, documenting that the leftmost entry is attacker-controlled.

Its own doc comment (lines 25-27) says: "Replace with shared storage (e.g. Redis) before running more
than one instance."

### Per-key? Per-account? Per-IP?

**Per-IP only, and not on the metered route.** Every call site:

| Route | Key shape | Limit |
| --- | --- | --- |
| `GET /chart` | `chart-url:{ip}` | 240/min (`src/app/chart/route.ts:36,105`) |
| `POST /api/demo/render` | `demo-ip:{ip}` | 30/min (`demo/render/route.ts:11`) |
| `POST /api/auth/register` | `register-ip:{ip}` | 10/hour (`register/route.ts:56`) |
| `POST /api/auth/login` | `login-ip:{ip}` + per-(account,ip) pair + per-account | `login/route.ts:25-43` |
| password forgot/reset, verify resend, account delete/export, survey, admin backup, admin verify-email | per-IP, some also per-user | see grep in §Appendix |
| **`POST /api/v1/charts`** | **none** | **none** |
| **`GET /api/v1/charts/[id]`** | **none** | **none** |

So: **no per-key limit, no per-account limit anywhere**, and the two routes that do metered work and
PNG rasterisation have no limiter at all. The login route is the only one with a non-IP dimension
(per-account and per-pair), so the primitive is capable of it; nothing uses it for API keys.

The spec wants "rate limits per key, account and IP → 429 with `Retry-After`"
(`BILLING_SPEC.md:127`). One of three dimensions, on the wrong routes.

### Headers

- **`Retry-After`: yes, consistently.** Emitted on every 429 in the repo — `chart/route.ts:110`,
  `demo/render/route.ts:12`, `register/route.ts:57`, `login/route.ts:15`,
  `admin/users/verify-email/route.ts:49`, `admin/backup/route.ts:29`,
  `account/delete/route.ts:26`, `account/export/route.ts:114`. Asserted in several tests
  (`tests/account.test.ts:226`, `tests/account-lifecycle.test.ts:136,336`,
  `tests/admin-backup.test.ts:157`). Documented at `src/app/docs/page.tsx` (`retry-after`, 429 row).
- **IETF `RateLimit-Limit` / `RateLimit-Remaining` / `RateLimit-Reset`: none.** Zero occurrences.
  `RateLimitResult` (`rate-limit.ts:5`) returns only `{allowed, retryAfterSeconds}`;
  `peekRateLimit` additionally returns `count`, so limit/remaining/reset are all computable without
  schema changes — the plumbing is missing, not the data.

---

## 7. Renderer hardening

### Does the renderer fetch anything remote? SSRF surface?

**No, and this is the strongest-standing part of the repo against the spec.**

A grep across `src/lib/charts/` for `fetch(`, `import(`, `require(`, `XMLHttpRequest`, `xlink:href`,
`<image` and `url(` returns only two hits, both the SVG namespace declaration string
`xmlns="http://www.w3.org/2000/svg"` (`src/lib/charts/editorial.ts:281`,
`src/lib/charts/render.ts:304`). There is:

- **no headless browser** — rasterisation is `sharp` (libvips) on an in-memory SVG string
  (`src/lib/charts/raster.ts:27`), not Puppeteer/Chrome;
- **no user-supplied URL** anywhere in the chart schema (`src/lib/charts/schema.ts:19-42`) — the
  deepest a caller reaches is `label`, `name`, `color` (`/^#[0-9a-fA-F]{6}$/`, line 27) and numbers;
- **no `<image>`, no `xlink:href`, no CSS `url()`** emitted into the SVG, so there is nothing for
  libvips to dereference.

So the spec's stress-test row "Spec requests `http://169.254.169.254` image → 400
`remote_fetch_blocked`" (`BILLING_SPEC.md:221`) has **no reachable code path to test**: the schema
rejects the field before any fetch concept exists. The honest Phase 1 position is a *test that pins
the absence* (a spec carrying a URL-ish field is stripped/rejected, and the SVG output contains no
`href`/`url(`), plus the defence-in-depth items that *are* missing:

- Asset CSP is already inert: `default-src 'none'; style-src 'unsafe-inline'; sandbox` applied to
  `/api/v1/charts/:id` and `/chart` (`next.config.ts:21,40,44`) and set again on the response
  (`src/app/api/v1/charts/[id]/route.ts:9,29`), with `nosniff`. Good.
- `sharp` is given no explicit `failOn` / `density` hardening beyond `limitInputPixels`.

### Current payload / data-point / output limits

| Limit | Value | Where |
| --- | --- | --- |
| Request body | 256 KB → **413** | `src/lib/security/request.ts:4`, checked on `Content-Length` then streamed (24-40) |
| Querystring (`GET /chart`) | 8 KB → 400 | `src/lib/charts/url.ts:22` |
| Series per spec | 1–12 | `schema.ts:41` |
| Points per series | 1–100 | `schema.ts:28` |
| Max points total | 1,200 (12 × 100) | implied |
| Value magnitude | ±1e15 | `schema.ts:17,22` with a long justification at 8-16 |
| Label / series name | 1–80 chars | `schema.ts:21,26` |
| Title / subtitle | 120 / 180 | `schema.ts:34-35` |
| Canvas | 320–2400 × 240–1600 | `schema.ts:36-37` |
| Raster input pixels | 2400×1600 = 3.84 Mpx | `raster.ts:7,27` |
| Concurrent rasterisations | 2, with a FIFO queue | `raster.ts:9,15-24` |
| Stored PNG | ≤512 KB each; 200 MB total with LRU-by-age eviction | `raster.ts:31,33-37,40-55` |

These are **uniform, not per-tier**. The spec wants "per-tier caps on payload, data points and output
pixels" (`BILLING_SPEC.md:189`) and 413 "before any credit moves" (`:128`). The 413 already precedes
metering (body read at `api/v1/charts/route.ts:45`, transaction at 73), so the ordering is right; the
tiering is absent. The spec's "50 MB payload or 10M points → 413" row (`:222`) passes today via the
256 KB cap, though via a different mechanism than the spec imagines.

### Render timeout? Memory cap?

**Neither.**

- No timeout: `renderStyled` (`src/app/api/v1/charts/route.ts:56`) is synchronous and CPU-bound, with
  no `AbortSignal`, no watchdog, no worker. A grep for `timeout|setTimeout|AbortSignal` across
  `src/lib/charts/` returns nothing. The spec's "10 s render timeout"
  (`BILLING_SPEC.md:189`) does not exist. The only `timeout` in the data path is better-sqlite3's
  5 s busy timeout (`src/lib/db/index.ts:107`).
- No memory cap: there is no container memory limit in `Dockerfile` or `railway.json`, and no
  `--max-old-space-size`. `MAX_CONCURRENT_RASTERS = 2` bounds libvips concurrency, which is a partial
  proxy, and `limitInputPixels` bounds a single raster.
- Because rendering is synchronous and in-process, a pathological spec blocks the event loop for the
  whole server. With no rate limit on `POST /api/v1/charts` (§6), that compounds.

No fuzzing of the parser or renderer exists (`BILLING_SPEC.md:190`). `tests/` has extensive
edge-case and golden-image coverage (`reports/golden/`, ~190 images; `tests/render*.test.ts`,
`tests/chart-url-unicode.test.ts`) but these are curated cases, not generated input.

---

## 8. MCP server

**Location:** `mcp/` — a separate npm package `@chartrelay/mcp` v0.1.0
(`mcp/package.json`), 118 lines in `mcp/index.js`, with its own `package-lock.json` and README. It is
**not** part of the Next.js app and does not import from `src/`.

**Transport:** stdio only (`StdioServerTransport`, `mcp/index.js:117`). No HTTP/SSE transport, so it
runs on the customer's machine, not as a hosted endpoint.

**Tools exposed: exactly one.** `render_chart` (`mcp/index.js:107-112`), which POSTs the spec to
`${CHARTRELAY_API_URL}/api/v1/charts` with `Authorization: Bearer ${CHARTRELAY_API_KEY}`
(`:76-80`) and formats the reply as text plus an optional inline PNG (`:93-101`).

**Does it authenticate?** It passes a key through; it does not itself authenticate anyone. The key
comes from the `CHARTRELAY_API_KEY` env var (`:8`) and the server refuses to call out when it is
empty (`:73`). There is no OAuth, no scope handling, no per-tool authorisation. Authentication and
metering happen entirely in the HTTP route it wraps — which is the right architecture for the spec's
"same ledger as HTTP" (`BILLING_SPEC.md:241`), but means the MCP server inherits whatever the route
does, including today's 429-for-quota and absence of 402.

**Against the spec's five tools** (`BILLING_SPEC.md:233-239`):

| Spec tool | Scope | Status |
| --- | --- | --- |
| `render_chart` | `render` | **PARTIAL.** Exists and is well-built, but returns `urls.png`/`urls.svg` (i.e. `/api/v1/charts/{id}?format=…`) rather than the spec's `/c/{id}.png` short URL (`BILLING_SPEC.md:109,91`), and carries no scope concept. Alt text is returned (`:43`), as the spec wants. |
| `estimate_cost` | `render` | **MISSING.** |
| `get_credit_balance` | `usage:read` | **MISSING.** No balance exists to report. |
| `get_usage` | `usage:read` | **MISSING.** Closest thing is the `Usage this month: used/limit` line appended to a successful render (`mcp/index.js:44`) — a side-effect of rendering, not a query. There is no usage-read API endpoint for it to call. |
| `get_top_up_link` | `usage:read` | **MISSING.** No pack, no top-up URL. |

**Error handling quality, and where it will break.** `mcp/index.js:85-91` branches on 400/401/413/422/429/5xx and turns each into agent-actionable text; the 422 handler (`formatQualityRejection`, `:58-70`) is genuinely good and reproduces both remediation paths. When the error contract moves to 402 + the `{error:{type,code,…}}` envelope, **every one of these branches must be rewritten**, including `formatResult`'s `body.usage` read (`:44`). The 429 branch (`:89`) currently says "Monthly render limit reached… Upgrade at /pricing", which will be the wrong message once 429 means rate limiting.

**Distribution reality:** unpublished to npm, private repo, shared with beta users directly. This is
stated in `mcp/README.md:18-24`, on `/mcp`, and on the landing page
(`src/app/page.tsx:152,223`), and is **pinned by tests** — `tests/availability-claims.test.ts:46-61`
asserts the page says "has not been published to npm" and "the repository it lives in is private",
and asserts it never says "clone the repository". Any change to the MCP distribution story must go
through that test.

The spec's claim that "nobody in the chart-API space ships an authenticated, metered MCP server"
(`BILLING_SPEC.md:5,37`) is the differentiator; today the repo ships an authenticated-by-proxy,
quota-counted, single-tool MCP server. That is closer than zero but it is not the five-tool metered
server the spec sells, and it is Phase 2 in the spec's own plan (`:265`).

---

## 9. Free tier: the complete list of unlimited / unmetered promises

The spec reverses a public promise (`BILLING_SPEC.md:76`). Below is every occurrence I found, by
surface. I searched `*.ts`, `*.tsx`, `*.js`, `*.mjs`, `*.md`, `*.json`, `*.css` across the repo
(excluding `node_modules`, `.next`, lockfiles) for `unlimited`, `unmetered`, `no cap`, `uncapped`,
`no limit`, `without limit`, `never counted`, `free forever`, `as many`, `no monthly cap`, then
read each hit in context.

### A. Public pages — customer-facing, highest risk

| File:line | What it says |
| --- | --- |
| `src/app/pricing/page.tsx:17` | Page **meta description**: "Unlimited charts by URL on every plan…" — this one also reaches search results and link previews |
| `src/app/pricing/page.tsx:50` | Section subtitle: "Charts drawn from a URL are unlimited on every tier, including the free one" |
| `src/app/pricing/page.tsx:57` | **Free plan card** bullet: "Unlimited charts by URL, carrying a small chartrelay.dev mark" |
| `src/app/pricing/page.tsx:58` | Pro card bullet: "Unlimited charts by URL, with no mark" |
| `src/app/pricing/page.tsx:59` | Scale card bullet: "Unlimited charts by URL, with no mark" |
| `src/app/pricing/page.tsx:77-79` | **FAQ**: "Are charts by URL really unlimited?" → "Yes. GET /chart is not metered and does not count against any monthly figure on this page, on any plan including the free one… there is no monthly ceiling and no overage." |
| `src/app/pricing/page.tsx:68` | Section body: "A plan changes two things: it removes the chartrelay.dev mark from charts drawn by URL, and it sets how many charts you may **store** in a calendar month" |
| `src/app/integrations/page.tsx:105` | "Renders through this endpoint are unlimited, unmetered, and never count against a plan's monthly quota." |
| `src/app/integrations/page.tsx:128` | "An abuse ceiling rather than a quota. Renders stay unlimited…" |
| `src/app/integrations/page.tsx:281` | FAQ "Do I need an account?" → "`GET /chart` is unauthenticated and unmetered, and a render through it never counts against a plan's monthly quota." |
| `src/app/integrations/page.tsx:282` | FAQ **"Is there really no limit?"** → "On renders, no — that is the deliberate trade…" |
| `src/app/integrations/page.tsx:301` | "renders are unlimited either way" |
| `src/app/docs/page.tsx:188` | URL limits list: "Not a quota — an abuse ceiling. Renders stay unlimited and unmetered…" |
| `src/app/docs/page.tsx:191` | `#url-mark` section: "Renders are unlimited and unmetered; what a paid plan buys is the removal of that mark." |
| `src/app/studio/page.tsx:36` | FAQ: "Charts drawn from a URL need no account and no key, and they are unlimited." |
| `src/app/studio/page.tsx:70` | Inline note: "Charts by URL are unlimited and need no key." |

### B. Error and UI strings shipped to users

| File:line | What it says |
| --- | --- |
| `src/app/chart/route.ts:107` | The **429 message drawn onto the error image**: "Too many requests from this address. **Charts are unlimited**, but please cache the ones you have already drawn." |

### C. Code comments that encode the business model

These are not customer-visible but they are the rationale a future maintainer will read and trust.

| File:line | What it says |
| --- | --- |
| `src/app/chart/route.ts:9-11` | Route contract: "deliberately unauthenticated and unmetered. Renders are free and unlimited; what a paid plan buys is the removal of the watermark, which is a better trade than a monthly cap" |
| `src/app/chart/route.ts:32-35` | "Renders are unlimited by design, but a single client hammering an uncached URL still costs real CPU" |
| `src/lib/charts/watermark.ts:4` | "This is how the category monetises: renders are unlimited and unmetered, and what a paid plan buys…" |

### D. Internal docs and marketing

| File:line | What it says |
| --- | --- |
| `docs/STATUS.md:5` | "The product now leads with charts-in-a-URL (GET /chart), unlimited and unmetered, monetised by removing the free-tier mark rather than by capping renders." |
| `docs/STATUS.md:57-58` | "Unauthenticated, unmetered and unlimited on every tier" |
| `docs/BOARD.md:38` | Lists "unlimited-with-a-mark pricing" as a settled product decision |
| `reports/SECURITY_REVIEW.md:67` | "unmetered; the key is *only* consulted to decide whether to draw the watermark" |
| `reports/SECURITY_REVIEW.md:80` | "keep the endpoint unauthenticated and unmetered" — a recommendation that the spec now contradicts |
| `marketing/LAUNCH_COPY.md:19` | Proof line: "1,000 free renders monthly (confirmed email)" — not "unlimited", but the **wrong number** post-spec |
| `marketing/LAUNCH_COPY.md:51` | "Free tier is 1,000 renders a month once you confirm your email (100 before); paid plans are $29 and $99 flat." |
| `marketing/PLAN.md:36` | Competitor table row describing our paid tiers as "$29 Pro (10k), $99 Scale (100k)" |
| `README.md:36` | "Free workspaces get 100 renders a month until the owner confirms their email, then 1,000." |
| `README.md:44` | "Free (1,000 renders/month…), Pro ($29, 10,000 renders), and Scale ($99, 100,000 renders)" |

### E. Not promises — do not change

`src/app/compare/page.tsx:43,122,142,228` all say "unlimited" about **QuickChart's** pricing, not
ours, each with a checked-on date. `tests/admin-backup.test.ts:148` uses the word in a test name
about token guessing. Leave all five alone.

### F. Numbers that also become wrong (not "unlimited", but same change)

Every surface printing `1,000` / `100` / `10,000` / `100,000` / `$29` / `$99` must move to the spec's
250 / 5,000 / 25,000 / 100,000 and $19 / $59 / $149. These read from
`src/lib/usage/plans.ts` in most cases (`pricing/page.tsx:17,57-59`, `dashboard/page.tsx:29,41`,
`billing/status.ts:48`), so changing the constants moves them together — **except** the three
hard-coded ones: `src/app/page.tsx:215` ("raises the limit from 100 to 1,000"),
`src/lib/billing/status.ts:48` (the literal `"raise it to 1,000"` in the unverified detail string),
and `src/lib/usage/limits.ts:45`. The README and marketing files are hand-written and will not move.

### Count

**16 customer-facing page strings** (incl. one meta description and one error image),
**1 shipped error string**, **3 load-bearing code comments**, **11 doc/marketing lines**. Plus the
plan-number surfaces in §F. If one is missed, the most damaging ones are
`src/app/pricing/page.tsx:17` (meta description, cached by search engines),
`src/app/pricing/page.tsx:77-79` (an explicit "Yes… no monthly ceiling and no overage"), and
`src/app/integrations/page.tsx:282` ("Is there really no limit?").

---

## 10. Compliance surface

| Spec item (`BILLING_SPEC.md:157-181`) | Today |
| --- | --- |
| **Terms of Service** | **PARTIAL.** `src/app/terms/page.tsx`, 13 numbered sections. Has billing/cancellation (§4, lines 46-49), no-SLA (§5, line 52), disclaimers, liability cap (§8), indemnity (§9), termination (§10), governing law (§11). **Missing for the new model:** prepaid credits and their expiry, metering as the billing basis, suspension for abuse, customer liability for leaked keys, export/sanctions. Line 48 says "we do not give refunds or credits for partial months", which does not contemplate packs. Governing law and effective date are omitted entirely unless `LEGAL_GOVERNING_STATE` / `LEGAL_EFFECTIVE_DATE` are set (`src/lib/business.ts:103-115`) — deliberate, per the comments. No lawyer pass evidenced. |
| **Privacy Policy** | **PARTIAL.** `src/app/privacy/page.tsx`, nine sections: what we collect, how we use it, who we share it with, public chart URLs, retention (line 64, detailed), security, rights, children, international. Reads as a US-style policy; **no GDPR/UK-GDPR lawful-bases table, no Art. 13/14 structure, no named transfer mechanism (SCCs)**. |
| **DPA** | **MISSING.** No `/dpa` route, no document, no click-through, no SCCs or UK addendum. |
| **AUP** | **MISSING.** No acceptable-use page. The behaviours the spec wants named (CSAM, phishing imagery, SSRF probing, metering bypass, key resale, sanctioned users) appear nowhere. |
| **Refund / cancellation policy** | **PARTIAL.** Two sentences inside Terms §4 (`terms/page.tsx:48`) plus a prorated-refund promise on discontinuation (line 52). **Not a standalone page and not linked from pricing or checkout**, which is what the spec and the Stripe website checklist require. |
| **Subprocessor list** | **PARTIAL and good.** `SUBPROCESSORS` in `src/lib/business.ts:90-94`: Railway (hosting + database), Resend (account email), Stripe (payments). The doc comment (83-89) explains the rule — anything receiving a visitor's IP belongs here, including a font host, which is why self-hosted fonts mean none is listed. Consumed by the privacy page. **Not a public standalone page**, no DPA-signed status recorded, and the list will need Cloudflare and any merchant of record added. |
| **`/.well-known/security.txt`** | **MISSING.** No `public/` directory in the repo at all; `robots.ts` and `sitemap.ts` are the only well-known-ish routes. There is a security-reporting *section* on `/support` (`src/app/support/page.tsx:144-165`) with a pre-filled subject (`:26`), which is the content a `security.txt` would point at. |
| **Status page** | **MISSING.** `docs/STATUS.md` is an internal file maintained by a scheduled agent (`docs/STATUS.md:3`); it is not served. `scripts/uptime-check.mjs` exists but publishes nothing. `/api/health` (`src/app/api/health/route.ts`) is a probe, not a status page. |
| **Public business address** | **PARTIAL by design.** `postalAddress()` (`src/lib/business.ts:58-61`) reads `BUSINESS_POSTAL_ADDRESS` and returns `null` with no fallback; callers must omit the line entirely (54-57). `hasPostalAddress` gates non-transactional email (`:64`, and see `scripts/check-env.mjs:34`). The variable is unset, so **no address is published today** — correct per the comments, blocking for the spec's MUST. |
| **Statement descriptor `CHARTRELAY.DEV`** | Not set in code; a Stripe dashboard setting. Not evidenced. |
| **Auto-renewal consent (ROSCA / CA ARL)** | **MISSING.** No unticked consent box at checkout: `BillingButton` (`src/components/billing-button.tsx:32-35`) POSTs `{plan}` straight to `/api/billing/checkout` on click, with no consent capture and no record kept. (Note its prop type is `plan: "pro" \| "scale"`, so it is another file the new plan ladder touches.) Self-serve cancel **does** exist via the Portal (`src/app/api/billing/portal/route.ts`), and Terms §4 points at it. |
| **Sanctions blocking** | **MISSING.** No country or IP geo logic anywhere. |
| **Cookie banner (avoid)** | **Satisfied.** Essential cookies only; `activation_events` is first-party and deliberately carries no IP or user agent (`src/lib/db/schema.ts:62-71`). No third-party analytics. |
| **PCI SAQ A / strict CSP** | **PARTIAL.** Hosted Checkout only, so SAQ A is the right scope. CSP is site-wide (`next.config.ts:7-18`) with `script-src 'self' 'unsafe-inline'` — Next.js inline bootstrap, per the comment at lines 5-6. The spec wants a *strict* CSP on pricing/checkout specifically; `'unsafe-inline'` is not strict. Asset routes get a properly inert policy (`:21,40,44`). |
| **Backups / restore tested** | **PARTIAL.** `scripts/backup.mjs` + `/api/admin/backup` using `VACUUM INTO`; `docs/RESTORE.md` records a rehearsed 2026-09-24 drill. Its own closing section (`RESTORE.md:70-74`) says restoring **onto the Railway volume** is still untested. Railway managed backups are a Pro-plan feature and the deployment is on Hobby (`RESTORE.md:30-32`). |
| **MFA, log redaction, breach runbook, Art. 27 rep, accessibility, trademark, SOC 2** | Not code; no evidence in repo. Log redaction is *partially* honoured by discipline — `logStripeError` never prints payloads or keys (`src/lib/billing/stripe.ts:70-78`), `billingConfigProblems` never includes secret values (`:24-25`) — but there is no redaction middleware and no `Authorization`-stripping log layer. |

### `src/lib/business.ts` — what it provides

A single identity module, 115 lines, no dependencies, env-driven, with unusually explicit reasoning
about why each value may be absent:

- `LEGAL_NAME = "MadPugExperiment LLC"` (line 17) — hard-coded, "a legal entity's name is not a
  deployment setting".
- `DISPLAY_NAME = "MPE Labs"` (line 26) — brand, deliberately separate from the legal name because
  "a brand name in a terms page is what a dispute gets argued over later".
- `registeredDba(env)` (36-38) — `LEGAL_DBA` or `null`; unset until the Florida §865.09 fictitious-name
  filing exists.
- `contractingParty(env)` (41-44) — `"<LLC>, doing business as <dba>"` or just the LLC.
- `supportEmail(env)` (47-49) — `SUPPORT_EMAIL` or `support@chartrelay.dev`. **Note:** a *second*,
  stricter `supportEmail` exists in `src/lib/support.ts:27-31` that returns `null` rather than a
  fallback, for the `/support` page. Two functions, same name, different null-behaviour — worth
  knowing before wiring receipts or email footers.
- `postalAddress(env)` (58-61) — `BUSINESS_POSTAL_ADDRESS` or `null`, no default, with the strongest
  comment in the file (1-12, 51-57): the owner runs the company from home and a home address on a
  terms page is permanent once scraped.
- `hasPostalAddress(env)` (64) — gates marketing email (CAN-SPAM).
- `businessIdentity(env)` (73-81) — the one block legal pages and email footers both print, so they
  cannot disagree.
- `SUBPROCESSORS` (90-94) — the three above.
- `effectiveDate(env)` (103-105), `governingLawState(env)` (113-115) — `null` until decided; clauses
  omitted rather than printed with placeholders.

Pinned by `tests/business-identity.test.ts`. This module is Phase-1-ready as-is; what it lacks is
**values**, not code — and `scripts/check-env.mjs:28-37` already reports each missing one as
advisory with an explanation of what it silently disables.

---

## 11. The database question: SQLite on a Railway volume vs. Postgres

The spec says "a ledger in our own Postgres" (`BILLING_SPEC.md:5`), names Postgres in the tables
section (`:114`), requires `UPDATE ... RETURNING` (`:130`), `CHECK (remaining >= 0)` (`:119`), unique
indexes for idempotency (`:118,120`), "100 parallel requests, 1 credit left → exactly one succeeds"
(`:214`), "Postgres down → fail closed: 503, no free renders" (`:223`), and "daily Postgres backups;
one restore tested before launch" (`:203`).

The app runs **better-sqlite3 13.0.3** (`package.json`) against a file on a Railway volume
(`DATABASE_PATH=./.data/chartrelay.db`, `Dockerfile:37`; volume `chartrelay-volume` mounted at
`/app/.data` per `docs/STATUS.md`), in WAL mode (`src/lib/db/index.ts:14`).

### What SQLite can satisfy — verified, not assumed

I probed the bundled driver directly (in-memory database, no project files touched):

```
sqlite_version: 3.53.4
UPDATE balances SET remaining = remaining - 1 WHERE account_id = ? AND remaining >= 1
  RETURNING remaining   ->  {"remaining":0}
CHECK (remaining >= 0) on a second decrement  ->  CHECK constraint failed: remaining >= 0
```

So, concretely:

| Specified behaviour | SQLite here |
| --- | --- |
| Atomic `UPDATE … WHERE remaining >= 1 RETURNING remaining` | **Yes.** `RETURNING` landed in SQLite 3.35; this is 3.53.4. Verified above. |
| `CHECK (remaining >= 0)` | **Yes.** Verified above; the constraint fires. Note `foreign_keys = ON` is already set (`src/lib/db/index.ts:15`), and CHECK needs no pragma. |
| Unique indexes for idempotency, e.g. `(key_id, idempotency_key)` | **Yes.** Already used for `api_keys.key_hash` (`schema.ts:34`) and a partial unique index on `workspaces.stripe_customer_id` (`src/lib/db/index.ts:97`). |
| `processed_webhooks` / `stripe_events` PK dedupe | **Yes, and already shipped** (§4). |
| 100 parallel requests, 1 credit left → exactly one succeeds | **Yes, within one process.** better-sqlite3 is synchronous, so a `db.transaction(..., {behavior:"immediate"})` callback containing no `await` cannot be interleaved — the mechanism already in use at `src/app/api/v1/charts/route.ts:73-84` and proven at 20 and 40 concurrent requests in `tests/quota-race.test.ts:44-61`. A single `UPDATE … WHERE remaining >= 1 RETURNING` is *strictly stronger* than that, because it is one statement and does not depend on the no-`await` discipline. Extending the existing test from 40 to 100 is trivial. |
| Append-only `usage_events` with three states | Yes. |
| Daily backups + tested restore | **Partially.** `VACUUM INTO` snapshots work and a restore drill is documented (`docs/RESTORE.md:63-68`); restoring onto the Railway volume itself is explicitly untested (`:70-74`). |

### What SQLite cannot satisfy

1. **More than one application process or instance.** This is the real constraint, and the repo says
   so in three places in its own words: `src/lib/security/rate-limit.ts:25-27` ("Replace with shared
   storage (e.g. Redis) before running more than one instance"),
   `src/app/api/v1/charts/route.ts:70-72` ("This holds within one process only. Two servers sharing
   the database file would each begin from their own snapshot"), and
   `src/lib/billing/sync.ts:171-177` (the per-subscription mutex "is real mutual exclusion **for this
   deployment**… If this is ever deployed as more than one process the lock stops covering the whole
   system"). Note that a **single-statement `UPDATE … RETURNING` reserve would survive multi-process**
   — SQLite's file locking is cross-process — but three other things in the current design would not:
   the checkout `inFlight` set (`checkout/route.ts:17`), the subscription mutex
   (`sync.ts:178`), and the `lastAppliedEventCreated` watermark (`sync.ts:84`). So SQLite does not
   block horizontal scaling of the *ledger*; the process-local coordination elsewhere does.
2. **Zero-downtime deploys with a volume.** A Railway volume attaches to one service instance;
   rolling deploys mean two processes briefly share the file, which is the case the comments above
   warn about. Today's `restartPolicyType: "ON_FAILURE"` (`railway.json`) and single service make this
   a restart-with-downtime model.
3. **`SELECT ... FOR UPDATE`, advisory locks, `LISTEN/NOTIFY`.** None exist. The spec's "cache TTL
   ≤ 30 s plus pub/sub bust" for revocation (`BILLING_SPEC.md:98`) assumes pub/sub. Today there is no
   cache at all, so revocation is already instant and this is moot — but it will matter if a cache is
   added.
4. **"Postgres down → fail closed."** The *behaviour* is satisfiable and partly present:
   `/api/health` returns 503 when `select 1` fails (`src/app/api/health/route.ts:11-16`). But the
   failure *mode* is different. A SQLite file does not "go down"; it goes **missing or read-only**,
   which is worse — `src/lib/db/index.ts:106` does `fs.mkdirSync` and `new DatabaseDriver(path)`,
   which on an unmounted volume **silently creates a fresh, empty database** rather than erroring. A
   fresh empty database is a fail-**open** ledger: zero usage rows, so `usageTotal()` returns 0 and
   every quota check passes. `docs/STATUS.md` records that one smoke-test account "was lost with a
   pre-volume deployment" — this has already happened once, before there was money involved. **This
   is the single most important finding in this section** and it needs an explicit guard (assert the
   volume is mounted and the schema is populated before serving) under *either* database.

### What migrating would cost and break

- **The volume.** `chartrelay-volume` at `/app/.data` becomes dead weight; `DATABASE_PATH`
  (`Dockerfile:37`, `src/lib/db/index.ts:7`) and the Dockerfile's `mkdir -p .data` (`:34`) go away.
  Railway Postgres is a separate paid service.
- **The data layer.** `src/lib/db/index.ts` is 155 lines of better-sqlite3-specific machinery:
  `pragma("journal_mode = WAL")`, `pragma("user_version")` as the data-repair marker (84-94),
  `pragma("table_info(...)")`-driven additive migrations (68-78), the `SQLITE_BUSY` retry loop with
  `Atomics.wait` (109-117), the `SCHEMA_VERSION` hot-reload hack (130-141), and the `Proxy` export
  (145-151). Essentially all of it is replaced, and the `sqlite()` escape hatch (153-155) used by
  `/api/health` and the backup route goes with it.
- **Synchronous → asynchronous.** This is the expensive part, and it is not mechanical. The entire
  metering correctness argument rests on better-sqlite3 being synchronous:
  `src/lib/usage/limits.ts:15-16,34-41` ("holding one blocks the event loop… the callback contains no
  `await`… An async version of this check is not safe to add back"), and
  `src/app/api/v1/charts/route.ts:63-72`. Under `node-postgres` every call is a promise, so
  `db.transaction((tx) => {...})` with a synchronous body is gone and the no-`await` invariant
  becomes unenforceable by construction. The replacement must be a single
  `UPDATE … RETURNING` (which is *better*, but is a different design) plus real transactions with
  explicit isolation. Call sites using `.get()` / `.run()` / `.all()` synchronously are spread across
  `src/lib/usage/limits.ts`, `src/lib/security/rate-limit.ts`, `src/lib/billing/sync.ts`,
  `src/lib/auth/*`, `src/app/dashboard/page.tsx`, `src/lib/charts/raster.ts` and most routes.
- **`docs/RESTORE.md` is invalidated end to end.** Every step is SQLite-specific: the WAL warning
  (`:6-22` — the `-wal` file holding nearly all the data, and "copying `chartrelay.db` on its own
  restores an empty database"), `VACUUM INTO` (`:20`), `PRAGMA integrity_check` (`:40`), placing the
  file with no `-wal`/`-shm` beside it (`:54-55`), and the forward-migration-on-open behaviour
  (`:57-59`). The rehearsed drill (`:63-68`) no longer proves anything about the new system. A
  Postgres runbook is `pg_dump`/`pg_restore` + PITR and must be re-rehearsed from scratch — which the
  spec requires before launch (`BILLING_SPEC.md:203`).
- **Backups.** `scripts/backup.mjs` and `/api/admin/backup` are `VACUUM INTO`-based and are replaced.
  Railway Postgres has its own backup story, which removes the Hobby-plan gap noted at
  `RESTORE.md:30-32`.
- **Tests.** `vitest.config.ts` and the suite run against `:memory:` SQLite
  (`src/lib/db/index.ts:8`), and tests manipulate the schema directly (e.g.
  `tests/quota-race.test.ts:21-26`, `tests/charts-contract.test.ts:10`). 42 test files, ~548 tests
  (`docs/STATUS.md`) now need a Postgres instance (testcontainers or a service in CI) or a
  compatibility seam. This is a large, boring, unavoidable cost.
- **Also goes:** the `blob` PNG cache in `renders.png` (`schema.ts:50`) and its byte-budget eviction
  built on `length(png)` and a partial index on an expression (`src/lib/db/index.ts:101`,
  `src/lib/charts/raster.ts:40-55`) — expressible in Postgres with `bytea` and `octet_length`, but
  needs rewriting, and storing images in Postgres is a worse idea than storing them in SQLite.

### Recommendation

**Build the Phase 1 ledger on the existing SQLite file. Do not migrate now.** Reasoning:

1. **Every ledger primitive the spec names is available and verified** — `UPDATE … RETURNING`,
   `CHECK (remaining >= 0)`, unique indexes, and single-statement atomic reserve. The 100-parallel
   stress-test row is satisfiable, and the existing 40-parallel test already demonstrates the weaker
   version of it passing.
2. **A single-statement reserve is cross-process safe** under SQLite's file locking, so building it
   does not entrench the single-process assumption — it actually *reduces* the repo's dependence on
   the no-`await` invariant that is currently load-bearing.
3. **The migration's dominant cost is the sync→async rewrite of every call site plus re-rehearsing
   the restore runbook**, neither of which buys a Phase 1 capability. Spending that before the first
   paid customer is the wrong order: the spec's own gate is "first paid customer"
   (`BILLING_SPEC.md:249`), and Postgres does not move that gate closer.
4. **The actual risk is not SQLite; it is the silent-empty-database failure mode** (above). That must
   be fixed regardless of engine, and it is a day of work rather than a migration.

Conditions that should flip this decision — write them down now so the trigger is not a judgement
call later:

- Needing more than one app instance for availability or zero-downtime deploys.
- Reserve latency becoming measurable under real load (unlikely: one indexed UPDATE).
- A compliance or procurement requirement for managed PITR backups.
- Any multi-region plan.

Interim hardening that is cheap and should be part of Phase 1 either way:

- **Fail closed on a missing volume.** Refuse to start, or serve 503, when the database file does not
  exist and has no schema — rather than creating an empty one (`src/lib/db/index.ts:106-107`). This
  is the highest-value single change in this section.
- Keep `/api/health` as the readiness probe it already is, and extend it to assert the ledger tables
  exist and are non-degenerate, not just `select 1`.
- Write the ledger so the reserve is **one statement**, not a read-then-write, so a later Postgres
  move is a driver swap for that path rather than a redesign.
- Run `scripts/backup.mjs` on a schedule and complete the untested step at `docs/RESTORE.md:70-74`
  (restore onto the Railway volume) before the first paid customer. The spec requires a tested
  restore (`BILLING_SPEC.md:203`, Phase 1 item 9) and today's drill does not cover the platform.

I am **not** treating this as settled. The one fact that would change my answer is if the merchant-of-
record decision (`BILLING_SPEC.md:272`) lands on Polar, because the resulting `sync.ts` rewrite is the
natural moment to also change engines and pay the sync→async cost once instead of twice.

---

## 12. Phase 1 gap table

Mapping `docs/BILLING_SPEC.md:251-263`.

| # | Phase 1 item | Verdict | One-line justification | Files |
| --- | --- | --- | --- | --- |
| 1 | Audit the existing repo against this spec | **DONE** | This document. | `reports/BILLING_AUDIT.md` |
| 2 | Hashed, prefixed keys with checksums; show once; revoke | **PARTIAL** | SHA-256 at rest, `cr_live_` prefix, shown once and instant revoke all work; **no checksum, no `cr_test_`, 24 bytes of base64url not 32 of Base62, prefix-only display with no last4, and no revoke button in the UI**. | `src/lib/auth/key-utils.ts:3-9`, `src/lib/auth/api-keys.ts:9-28`, `src/lib/db/schema.ts:30-39`, `src/app/api/keys/route.ts`, `src/components/key-manager.tsx:24`, `src/app/dashboard/page.tsx:43`, `tests/api-key.test.ts` |
| 3 | Ledger with atomic reserve/charge/refund, idempotency, sweeper | **MISSING** | No `credit_grants`, `balances` or `audit_log`; the existing `usage_events` is a 5-column monthly counter with no `key_id`, `status` or `idempotency_key`; no reservation, no idempotency, no sweeper. The one asset is the transaction discipline to reuse. | `src/lib/db/schema.ts:54-60`, `src/lib/db/index.ts:38-41`, `src/lib/usage/limits.ts`, `src/app/api/v1/charts/route.ts:73-84`, `tests/quota-race.test.ts` |
| 4 | Free tier capped at 250 + email verification | **MISSING** | Free is 1,000 (100 unverified) on `POST /api/v1/charts` and **unlimited and unmetered** on `GET /chart`; verification changes the quota but a key is issued before it. | `src/lib/usage/plans.ts:8,12`, `src/app/chart/route.ts:9-11`, `src/lib/auth/credentials.ts:59`, plus all of §9 |
| 5 | MoR checkout for plans and packs (packs buyable with no plan); webhooks deduped | **PARTIAL** | **Webhook dedupe is done and done well** (`stripe_events`, checked inside the write transaction). Everything else is missing: `mode: "subscription"` hard-coded, no pack price or product, no one-time payment events handled, no merchant of record, and the duplicate-checkout guard would wrongly redirect a subscriber buying a pack to the Portal. | `src/lib/db/schema.ts:108-112`, `src/lib/billing/sync.ts:10-15,160-162,239-253`, `src/app/api/billing/checkout/route.ts:12,62-64,109`, `src/lib/billing/stripe.ts:34-38,53-63` |
| 6 | 402/429 error contract and credit headers | **MISSING** | **No 402 anywhere**; quota exhaustion returns 429 and that is documented as the contract; no `{error:{type,code,message,doc_url,top_up_url}, request_id}` envelope, no `request_id`, no `X-ChartRelay-Credits-Remaining`, no `RateLimit-*`. `Retry-After` is the one piece present. | `src/app/api/v1/charts/route.ts:44,48,91,102`, `src/lib/usage/limits.ts:31`, `src/app/docs/page.tsx` (`#errors`), `mcp/index.js:85-91` |
| 7 | Usage page: balance, usage by day and key, invoices link | **PARTIAL** | Dashboard shows plan, `used / limit` for the month, and active key count; **no balance (none exists), no by-day breakdown, no by-key breakdown (the table has no `key_id`), no invoices link** — only a Portal button, which reaches invoices indirectly. | `src/app/dashboard/page.tsx:25,29,41-43`, `src/lib/usage/limits.ts:27-29`, `src/components/billing-button.tsx`, `src/app/api/billing/portal/route.ts` |
| 8 | Renderer SSRF and resource limits, with tests | **PARTIAL** | **SSRF surface is genuinely absent** — no remote fetch, no headless browser, no URL field in the schema, inert asset CSP — but that absence is **untested**, and there is **no render timeout, no memory cap, no per-tier limits, and no fuzzing**. Payload/point/pixel caps exist but are uniform. | `src/lib/charts/schema.ts:17-42`, `src/lib/charts/raster.ts:7,9,27,31`, `src/lib/security/request.ts:4`, `src/lib/charts/url.ts:22`, `next.config.ts:21,40,44` |
| 9 | CSP, MFA, log redaction, backup restore tested | **PARTIAL** | Site CSP ships but uses `script-src 'unsafe-inline'` (not strict, by Next.js necessity); asset CSP is properly inert; log hygiene is by discipline in the Stripe helpers rather than a redaction layer; backup exists with a rehearsed local restore but the **Railway-volume restore is explicitly untested**; MFA is an external account setting with no evidence. | `next.config.ts:7-30`, `src/lib/billing/stripe.ts:24-25,70-78`, `scripts/backup.mjs`, `src/app/api/admin/backup/route.ts`, `docs/RESTORE.md:63-74` |
| 10 | Terms, Privacy, DPA, AUP, refund page, subprocessors (lawyer pass) | **PARTIAL** | Terms and Privacy exist as real documents; subprocessors exist in code and feed the privacy page. **DPA missing, AUP missing, refund page missing (two sentences inside Terms §4, not linked from pricing or checkout), no GDPR lawful-bases section, no lawyer pass evidenced**, and Terms do not mention prepaid credits, expiry or leaked-key liability. | `src/app/terms/page.tsx:29-75`, `src/app/privacy/page.tsx:33-81`, `src/lib/business.ts:90-94`, `tests/business-identity.test.ts` |
| 11 | Sanctions blocking, virtual mailbox address, support email, Resend domain verified | **PARTIAL** | Support email is configurable and degrades honestly when unset; the postal-address mechanism exists and is **deliberately unset**, so no address is published; Resend is wired with production-required env checks but domain verification is external and `docs/STATUS.md` says email is not configured; **sanctions blocking does not exist in any form**. | `src/lib/support.ts:27-31`, `src/lib/business.ts:47-64`, `src/lib/email/send.ts`, `scripts/check-env.mjs:24-34`, `docs/STATUS.md:5` |
| 12 | Stripe keys rolled, Railway paid plan, live $19 purchase + refund verified | **MISSING** | Stripe is in test mode with live mode explicitly gated off (`STRIPE_LIVE_MODE` must equal `"enabled"`); Railway is on Hobby; and **there is no $19 price — the ladder is $29/$99**, so the verification named here cannot be performed until item 5 lands. | `src/lib/billing/stripe.ts:30`, `scripts/check-env.mjs:19`, `docs/STATUS.md:5`, `docs/RESTORE.md:30-32`, `src/app/pricing/page.tsx:58-59` |
| 13 | All stress-test rows pass | **MISSING** | Of the 18 rows at `BILLING_SPEC.md:208-227`: **1 passes** (webhook delivered twice, via `stripe_events`); **1 passes by a different mechanism** (50 MB payload → 413, via the 256 KB cap); **1 is not reachable** (`169.254.169.254` — no remote-fetch path exists to block, so it needs an absence test instead); **1 is adjacent** (100 parallel / 1 credit — the quota equivalent passes at 40 in `tests/quota-race.test.ts`, but there is no credit to exhaust); and **14 have no implementation to test**. "Postgres down → fail closed" currently fails in the worst direction: a missing volume yields a silent empty database and therefore a fail-**open** quota. | `tests/billing-race.test.ts`, `tests/quota-race.test.ts:44-61`, `tests/charts-contract.test.ts`, `src/lib/db/index.ts:106-107`, `src/app/api/health/route.ts` |

**Tally: 1 DONE, 8 PARTIAL, 4 MISSING.**

---

## Appendix: things I could not determine from the repo

Stated rather than guessed:

- **Whether MFA is enabled** on Railway, Stripe, Resend, Cloudflare, the registrar, GitHub or email
  (`BILLING_SPEC.md:200`). No repo artefact can show this.
- **Whether Cloudflare is in front of Railway** (`:201`). No evidence either way in
  `railway.json`, `next.config.ts` or `docs/DEPLOY.md`; `TRUSTED_PROXY_HOPS` defaults to 1
  (`src/lib/security/rate-limit.ts:57`), which is described as "correct behind Railway"
  (`scripts/check-env.mjs:38`) and would need to become 2 behind Cloudflare. **If Cloudflare is
  already in front and this is still 1, per-IP rate limits are currently attributing traffic to the
  wrong address** — worth checking before relying on them.
- **Whether the Resend sending domain is verified** (Phase 1 item 11). `docs/STATUS.md:5` says email
  is not configured; the code is ready (`src/lib/email/send.ts`, `scripts/check-env.mjs:24-26`).
- **The Stripe dashboard settings** the code depends on: the failed-payment retry behaviour that
  `README.md:50` says must be set per `docs/DEPLOY.md` step 5, the statement descriptor, and Radar
  rules (`BILLING_SPEC.md:194`).
- **Whether Stripe Managed Payments has been applied for** (`:80`), and therefore which of the two
  open merchant-of-record paths the payments work should target. This is a blocking input to item 5,
  and §4 explains why the answer materially changes the cost.
- **Live-mode Stripe price IDs** for any new ladder; `.env.local` was not read (it is secret material
  and reading it is unnecessary for this audit).
- **Whether `GET /chart` traffic is actually significant.** The metering change in item 4 is far more
  disruptive if it is, and nothing in the repo records request volumes;
  `scripts/metrics-weekly.mjs` and `activation_events` track the funnel, not URL-chart requests.

## Appendix: full rate-limit call-site inventory

For §6, the complete `consumeRateLimit` / `peekRateLimit` inventory:
`src/app/api/account/delete/route.ts:56,58`; `src/app/api/account/export/route.ts:112`;
`src/app/api/activation/survey/route.ts:25`; `src/app/api/admin/backup/route.ts:27`;
`src/app/api/admin/users/verify-email/route.ts:47`; `src/app/api/auth/login/route.ts:25,29,37,42,43`;
`src/app/api/auth/password/forgot/route.ts:27,30`; `src/app/api/auth/password/reset/route.ts:11`;
`src/app/api/auth/register/route.ts:56`; `src/app/api/auth/verify/resend/route.ts:24`;
`src/app/api/demo/render/route.ts:11`; `src/app/chart/route.ts:105`.
Absent from: `src/app/api/v1/charts/route.ts`, `src/app/api/v1/charts/[id]/route.ts`,
`src/app/api/billing/checkout/route.ts` (the spec wants Checkout session creation rate-limited,
`BILLING_SPEC.md:194`), `src/app/api/billing/portal/route.ts`, `src/app/api/keys/route.ts`.
