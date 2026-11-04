# ChartRelay Keys & Usage Billing Spec

Source of truth: the "ChartRelay Keys & Usage Billing Spec" doc (exported Oct 8, 2026). If this file and the doc disagree, ask Anthony.

Build the key and billing layer inside ChartRelay rather than buying a gateway: prepaid plans plus top-up render packs, a ledger in our own Postgres that enforces hard caps per request, and a merchant of record so EU and UK VAT are not ours to file. Nobody in the chart-API space ships an authenticated, metered MCP server, honest overage pricing and safe signed URLs together, so that is where we win.

## Competitors

The direct chart APIs are dated, and the key-management vendors either have no billing or charge more per request than a chart is worth.

**Chart and image APIs (who we take customers from)**

| Vendor | Pricing | Keys and signing | Weak spots |
| --- | --- | --- | --- |
| [Image-Charts](https://www.image-charts.com/pricing) | Watermarked free plan; Business $99/mo; Enterprise $249/mo | Account ID + HMAC-SHA256 over the query | Errors only in response headers; no published overage; no MCP |
| [QuickChart](https://quickchart.io/pricing/) | Free (rate-limited, AGPL); Pro $40/mo for 10K images | Key in query, body or Bearer; signature covers only the `chart` param and uses the API key as the HMAC secret | Bad keys silently fall back to free; errors rendered as images; MCP is third-party only |
| [Chart-Img](https://doc.chart-img.com/) | 50–3,000 requests/day tiers; watermark on Basic | `x-api-key` header or `key=` | TradingView screenshots only |
| [Datawrapper](https://www.datawrapper.de/pricing) | API metering started Oct 1, 2026; exports $0.01 → $0.008 | Not researched | Editor-first product |
| [AntV mcp-server-chart](https://glama.ai/mcp/servers/@antvis/mcp-server-chart) | Free, MIT | No auth | No keys, usage view or SLA; the real rival for agent users |
| [Plotly Chart Studio](https://plotly.com/chart-studio-updates/) | Shut down Oct 31, 2025 | — | Orphaned users to migrate |

**Key and billing infrastructure (build vs buy)**

| Vendor | What it gives you | Cost | Why not for us |
| --- | --- | --- | --- |
| [Unkey](https://unkey.com/api/pricing) | Hashed prefixed keys, per-key limits, credits, rotation | Free to 150K verifications/mo; $25+ after | No billing at all; adds a network hop per request |
| [Zuplo](https://zuplo.com/pricing) | Gateway + keys + native Stripe monetization | $25/mo, then $100 per extra 100K requests | ~$0.001 per request eats a ~$0.004 render's margin |
| [Kong Konnect](https://konghq.com/subscriptions) | Gateway + OpenMeter billing | $200 per extra 1M requests + 0.4% of billing | Enterprise weight for a solo product |
| [AWS API Gateway](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-usage-plans.html) | Usage plans and keys | $1–3.50 per 1M | AWS says quotas are "best-effort" and keys aren't for auth |
| [Autumn](https://useautumn.com/pricing) | Credit ledgers and spend caps on your Stripe | Free to $8K/mo billing | SDK fails open by default; not a merchant of record |
| [Polar](https://polar.sh/docs/merchant-of-record/fees) | Merchant of record with native meters | 5% + 50¢, +1.5% non-US cards | Higher fees; $15 per dispute |

Verdict: build the key layer and ledger ourselves (one table plus a cache inside the existing Railway service) and buy only the payment and tax side.

## How we beat them

1. **An official MCP server with authentication and metering**: `render_chart`, `get_usage`, `estimate_cost`, `get_credit_balance`. No chart competitor has one.
2. **Errors an agent can act on.** One JSON shape: `{error:{type,code,message,doc_url,top_up_url}, request_id}`. Out of credit = 402 `credits_exhausted` with a link the agent hands to its human.
3. **The balance on every response.** `X-ChartRelay-Credits-Remaining` plus IETF `RateLimit-*` and `Retry-After`.
4. **Hard spend caps by default.** Never bill past what was prepaid or capped. Failed renders and cache hits are never charged.
5. **Signed URLs that are actually safe.** Dedicated signing secret, every parameter signed in canonical order, optional expiry, two active secrets per key.
6. **Keys built for agents.** Per-key budget, scope limits and a kill switch.
7. **Published overage prices.** Render packs are listed on the pricing page.
8. **Migration shims.** Accept Image-Charts `cht=` URLs, QuickChart Chart.js configs and Plotly figure JSON.
9. **Leaked-key protection.** `cr_live_` prefix plus checksum; apply to GitHub's secret scanning partner program after launch.

Not a differentiator: "more chart types."

## Billing model

Billing is prepaid only, in two ways: a subscription that grants renders every month, or pay-as-you-go render packs with no subscription. Subscribers also use packs for overage. Keys are free; what customers buy is credit that their keys draw from. There is no postpaid billing in v1.

| Plan | Price | Renders/mo | Effective $/1K | Notes |
| --- | --- | --- | --- | --- |
| Free | $0 | 250 | — | Watermarked; email verified; no card |
| Developer | $19 | 5,000 | $3.80 | No watermark |
| Pro | $59 | 25,000 | $2.36 | Signed URLs, multiple keys |
| Business | $149 | 100,000 | $1.49 | Priority support, IP allowlist |
| Render pack | $10 | 2,000 | $5.00 | One-time; works with or without a plan; expires after 12 months; auto top-up optional |

Rules:

- Usage is drawn from the monthly allowance first and from packs second. The allowance resets each cycle with no rollover.
- The pack price is deliberately higher than any plan's rate, to steer frequent pack buyers toward a plan.
- Failed renders, renders rejected for validation and cache hits are never charged.
- Auto top-up buys one pack when the balance falls below a customer-set threshold, with a customer-set monthly cap (default: 3 packs).
- Plan changes are self-serve in our dashboard (Stripe's Customer Portal can cancel usage plans but can't change them).

**Pay-as-you-go accounts** (no subscription):

- Start on the Free tier. Buying any pack upgrades the account to pay-as-you-go: no watermark while pack credit remains, Developer-tier rate limits, and multiple keys.
- Usage takes from the 250 free renders first, then from packs. When both run out, the API returns 402 `credits_exhausted` with a `top_up_url`. Nothing is ever billed afterwards.
- No auto-renewal consent is needed unless auto top-up is on; turning it on uses the same unticked consent box and self-serve off switch as a subscription.
- The dashboard nudges toward a plan once a month's pack spending would have been cheaper on one (e.g. three packs, $30 for 6,000, versus Developer, $19 for 5,000).

**Free tier.** Replace the current unlimited watermarked free renders with 250/month and required email verification.

**Merchant of record.** A US LLC owes EU VAT on consumer sales from the first euro and UK VAT with no threshold.

1. Apply for **Stripe Managed Payments** (works with the existing Stripe account and Checkout). It can't attach invoice items, which is fine because packs are one-time Checkout payments. Unverified: exact fee, and whether one-time payments work alongside subscriptions. Statements show `LINK.COM*`.
2. If not approved within a week, or packs can't be sold through it, use **Polar** (5% + 50¢).
3. Stripe direct + Stripe Tax is cheapest but means OSS and UK VAT registration and quarterly filing. Not until revenue pays for an accountant.

## Keys and signed URLs

| Credential | Format | Where it goes | Exposure |
| --- | --- | --- | --- |
| Secret key | `cr_live_` / `cr_test_` + 32 random bytes (Base62) + 6-character CRC32 checksum | `Authorization: Bearer` | Server-side only |
| Public key ID | `pk_live_` + 16 characters | `kid=` in GET /chart URLs | Safe to publish |
| Signing secret | `crsig_` + 32 random bytes, two active per key | Customer's server computes `sig` | Server-side only |
| Short URL | `/c/{128-bit id}.png`, immutable | Emails, docs, agent output | Public, but only re-serves one chart |

**Storage and lifecycle**

- Store SHA-256 of the key; display only prefix + last 4. Full key shown once.
- Checksum rejects mistyped or fake keys before any database lookup.
- Several keys per account, each with name, scopes (`render`, `usage:read`, `keys:admin`), optional monthly budget, optional expiry, optional IP allowlist, `last_used_at`, and an `agent` tag.
- Rotation keeps the old key valid 7 days. Revocation is instant: cache TTL ≤ 30 s plus pub/sub bust.
- Test keys render watermarked output, are never billed, are rate-limited. The landing-page playground uses one.

**Signed GET /chart**

`GET /chart?{params}&kid=pk_live_…&exp=1767225600&sig=<hex>`

- `sig` = HMAC-SHA256(signing secret, canonical string: method, path, every query param except `sig`, sorted and URL-encoded).
- `exp` optional; without it the URL is permanent.
- "Require signed URLs" is on by default for live keys; unsigned GET with a live `kid` → 401.
- Optional referrer/domain allowlist per key. Identical signed URLs are CDN-cached; cache hits not billed.
- Agents and the MCP server never sign: they POST /charts and get `/c/{id}.png` back.
- Ship signing helpers for Node, Python and Go, plus a dashboard "sign this URL" tool.

## Metering and enforcement

Our Postgres ledger is the only source of truth for credit. The payment provider only records that money arrived.

**Tables**

- `credit_grants`: id, account_id, source (`plan_cycle` | `pack` | `free` | `goodwill`), renders, expires_at, payment_event_id (unique).
- `balances`: account_id, remaining, `CHECK (remaining >= 0)`; optional per-key `budget_remaining`.
- `usage_events`: append-only. id, account_id, key_id, request_id, idempotency_key, units, status (`reserved` | `charged` | `refunded`), format, cache_hit, created_at. Unique index on `(key_id, idempotency_key)`.
- `processed_webhooks`: provider event id as primary key.
- `audit_log`: key create/rotate/revoke, plan changes, admin actions, grants.

**Request path**

1. Check key checksum, then cache lookup by hash. Reject revoked, expired, wrong-scope or IP-blocked keys.
2. Rate limits per key, account and IP → 429 with `Retry-After`.
3. Validate input against tier limits (payload size, data points, output size, format) → 400/413 before any credit moves.
4. Cache hit → serve for 0 units.
5. Reserve atomically: `UPDATE balances SET remaining = remaining - 1 WHERE account_id = $1 AND remaining >= 1 RETURNING remaining`. No row → 402 `credits_exhausted`. Insert `usage_events` row as `reserved`.
6. Render with timeout and memory cap.
7. Success → `charged`. Failure → refund the unit and mark `refunded` in one transaction.
8. Return `X-ChartRelay-Credits-Remaining`, `RateLimit-*`, `X-Request-Id`.

**Idempotency.** Clients may send `Idempotency-Key`; otherwise derive from (key, body hash, minute). Retries return the stored result for 0 units. A sweeper refunds `reserved` rows older than 5 minutes.

**Reconciliation.** Nightly: grants vs paid orders from the merchant of record, and charged events vs balance changes. Drift emails Anthony and blocks new grants until resolved.

**Error contract**

| Status | `code` | When |
| --- | --- | --- |
| 400 | `invalid_chart_spec` | Spec fails validation (field path included) |
| 401 | `invalid_api_key` / `signature_required` / `signature_invalid` | Auth fails |
| 402 | `credits_exhausted` / `key_budget_exhausted` | No balance; body carries `top_up_url` |
| 403 | `scope_denied` / `ip_not_allowed` / `region_blocked` | Policy |
| 413 | `payload_too_large` | Over tier limits |
| 429 | `rate_limited` | With `Retry-After` |
| 5xx | `render_failed` | Never charged |

Alerts at 80/90/100% of allowance and of each key's budget, by email and optional webhook.

## Compliance checklist

MUST items block the first paid customer. Research, not legal advice. ⚖ = lawyer review.

| Item | Priority | What it takes |
| --- | --- | --- |
| Terms of Service ⚖ | MUST | Metering/billing, prepaid credits and expiry, suspension, refunds, AUP, no SLA on self-serve, liability cap = 12 months of fees, customer liable for leaked keys, export/sanctions clause, governing law |
| Privacy Policy | MUST | GDPR + UK GDPR: categories, purposes, lawful bases, retention, subprocessors, US transfers, rights |
| Data Processing Addendum ⚖ | MUST | Processor under Art. 28; click-through DPA with SCCs + UK addendum |
| Subprocessor list | MUST | Railway, Stripe/Polar, Resend, Cloudflare, analytics; sign each vendor's DPA |
| Payload retention | SHOULD | Don't store chart data; publish retention for short-URL images |
| EU/UK Art. 27 representative ⚖ | SHOULD | ~€100–300/yr |
| Cookie banner | Avoid | Essential cookies + cookieless analytics only |
| Refund and cancellation policy | MUST | Linked from pricing and checkout |
| Acceptable Use Policy | MUST | Illegal/infringing content, CSAM, phishing imagery, SSRF probing, metering bypass, key resale, sanctioned users |
| Stripe website checklist | MUST | Product description, prices with currency, support email, refund policy, privacy policy, HTTPS |
| Public business address | MUST | Home address private on the Stripe account; virtual mailbox on site, receipts, email footers |
| Auto-renewal consent | MUST | ROSCA + California ARL: unticked consent box, records kept 3+ years, online self-serve cancel, annual reminder |
| Statement descriptor | SHOULD | `CHARTRELAY.DEV` (Managed Payments uses `LINK.COM*`) |
| US sales tax ⚖ | MUST | Check home-state SaaS taxability; nexus monitoring |
| EU VAT / UK VAT | MUST | Merchant of record handles it |
| PCI DSS | MUST | SAQ A via hosted Checkout; strict CSP on pricing/checkout |
| Sanctions ⚖ | MUST | Block Cuba, Iran, North Korea, Crimea/DNR/LNR by card country and signup IP; decide Russia/Belarus |
| CAN-SPAM / PECR | MUST | Postal address + unsubscribe on marketing; EU/UK opt-in |
| Breach response | MUST | One-page runbook: 72h regulator notice as controller, customer notice as processor, US state laws |
| Accessibility | SHOULD | WCAG 2.2 AA |
| Trademark search | SHOULD | USPTO, EUIPO, WIPO, classes 9 and 42 |
| Trust pages | SHOULD | Status page, `/.well-known/security.txt`, Security page, changelog |
| SOC 2 | LATER | Only when a deal requires it |

## Security and abuse

**Renderer hardening**

- Remote fetches off by default. Where allowed: https only, resolve once and pin IP, block private/loopback/link-local (`169.254.169.254`) and IPv6 equivalents, re-check on every redirect. Block `file:`, `chrome:`, unneeded `data:`.
- Headless Chrome (if used): sandboxed container, JS off where possible, request interception enforcing the allowlist, no other egress.
- 10 s render timeout, memory cap, per-tier caps on payload, data points and output pixels.
- Fuzz parser and renderer with oversized, deeply nested and malformed input.

**Account and payment abuse**

- Card testing: hosted Checkout, login before payment, rate-limit Checkout session creation, Radar CVC and postal-code rules.
- Free-tier farming: verify email before issuing a key, disposable-domain blocklist, per-IP/ASN signup caps, flag shared card fingerprints.
- Key leaks: prefixed keys with checksum, per-key budgets, instant revoke.

**Platform**

- MFA on Railway, Stripe/Polar, Resend, Cloudflare, registrar, GitHub, email. Offer customers passkeys or TOTP.
- Cloudflare in front of Railway.
- Logs redact `Authorization`, `sig` and chart payloads.
- Daily Postgres backups; one restore tested before launch.
- Webhooks signature-verified and deduped; admin routes on a separate auth path.

## Stress test (each row is a required automated test)

| Scenario | What must happen |
| --- | --- |
| Payment webhook delivered twice | `processed_webhooks` rejects the second; credit granted once |
| Webhook never arrives | Success page polls; nightly reconciliation grants and logs |
| Client retries after timeout | Same `Idempotency-Key` returns cached result, 0 extra units |
| Server crashes mid-render | Sweeper refunds `reserved` rows older than 5 min |
| 100 parallel requests, 1 credit left | Exactly one succeeds; 99 get 402 |
| Customer disputes a charge | Grants reversed; keys pause if balance would go negative |
| Refund issued | Remaining credit from that grant clawed back |
| Key leaked on GitHub | Revoke, email owner; per-key budget caps damage |
| Signed URL posted publicly | Only that chart renders; cache absorbs; allowlist + budget cap spend |
| Signing secret rotated | Second secret keeps existing embeds working |
| 1,000 signups from one ASN | Signup cap + email verification stop key issuance |
| Spec requests `http://169.254.169.254` image | 400 `remote_fetch_blocked`, logged |
| 50 MB payload or 10M points | 413 before any credit moves |
| Postgres down | Fail closed: 503, no free renders |
| Merchant-of-record account frozen | Prepaid credit keeps working; purchases pause |
| Plan downgrade mid-cycle | Effective next cycle |
| Pack expires with credit left | Email at 14 and 3 days; expiry in Terms and checkout |
| Pay-as-you-go account hits zero | 402 with `top_up_url`; no charge, no watermark removal without credit |

## MCP, agents and subagents

**ChartRelay MCP server (product)**

| Tool | Purpose | Scope |
| --- | --- | --- |
| `render_chart` | Spec in, short URL + alt text out | `render` |
| `estimate_cost` | Units before rendering | `render` |
| `get_credit_balance` | Allowance, packs, key budget | `usage:read` |
| `get_usage` | By day, key, format | `usage:read` |
| `get_top_up_link` | Checkout URL for the human (agent never pays) | `usage:read` |

Bearer key or OAuth; same ledger as HTTP. Agents can't create keys or buy credit.

**Build subagents (Claude Code)**: Repo auditor → Ledger builder → Keys and signing builder → Payments builder → Security reviewer (fresh context) → Compliance writer → Verifier (fresh context, runs every stress-test row + Playwright signup → pay → render → 402).

MCP for the build: Stripe, GitHub, Postgres (read-only), Playwright, Railway if available.

**After launch**: reconciliation watcher, abuse monitor (proposes, never executes), support triage — only after a month of clean billing.

## Phase 1: gate to first paid customer

- [ ] Audit the existing repo against this spec
- [ ] Hashed, prefixed keys with checksums; show once; revoke
- [ ] Ledger with atomic reserve/charge/refund, idempotency, sweeper
- [ ] Free tier capped at 250 + email verification
- [ ] Merchant-of-record checkout for plans and packs (packs buyable with no plan); webhooks deduped
- [ ] 402/429 error contract and credit headers
- [ ] Usage page: balance, usage by day and key, invoices link
- [ ] Renderer SSRF and resource limits, with tests
- [ ] CSP, MFA, log redaction, backup restore tested
- [ ] Terms, Privacy, DPA, AUP, refund page, subprocessors (lawyer pass)
- [ ] Sanctions blocking, virtual mailbox address, support email, Resend domain verified
- [ ] Stripe keys rolled, Railway paid plan, live $19 purchase + refund verified
- [ ] All stress-test rows pass

Phase 2 (30 days after first revenue): signed URLs with dual secrets, metered MCP server, auto top-up + alerts + per-key budgets, migration shims, GitHub secret-scanning application, status page.

Phase 3 (on demand): projects/teams, postpaid for vetted Business accounts, ops agents, SOC 2.

## Open decisions (ask Anthony; do not guess)

- Free tier cap at 250/mo (recommended yes)
- Merchant of record: Managed Payments → Polar fallback (recommended) or Stripe direct
- Russia/Belarus: block or serve
- Pack expiry 12 months (recommended) or never
