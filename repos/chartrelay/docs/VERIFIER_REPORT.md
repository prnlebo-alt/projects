# Verifier report

Written 2026-10-09. Every row of the spec's stress-test table (docs/BILLING_SPEC.md), what proves it, and what does not.
"Proved" means an automated test fails if the behaviour breaks. Where something is only half built, the row says so.

Run it: `npm test` (828 tests), `cd mcp && npm test`, and the end-to-end journey below.

## The journey

`scripts/verify-journey.mjs` drives a real local server over HTTP: sign up, mint a key, 402 while unconfirmed, confirm
the email, render the free allowance (marked), spend down to one, 402 with `top_up_url`, pay (a signed pack webhook),
duplicate webhook, render unmarked, refund, 402 again. 20 checks, all passing on 2026-10-09.

```
DATABASE_PATH=... STRIPE_WEBHOOK_SECRET=... BASE_URL=http://localhost:3111 npm run verify:journey
```

It refuses any host but localhost. Three steps are done directly rather than over HTTP and are marked in the script:
confirming the email (the link goes by email), setting a balance to one render, and signing the Stripe event.
It is not a browser test: no Playwright is installed, and installing it downloads a browser binary, which wants the
owner's say-so.

## The table

| Scenario | Status | Evidence |
| --- | --- | --- |
| Payment webhook delivered twice | Proved | `tests/billing-packs.test.ts` (same event, and two events for one payment); journey |
| Webhook never arrives | Proved for packs | `tests/reconcile-and-notices.test.ts`: a paid pack with no credit is granted, once, and logged; a refunded one is not resurrected. Runs 2 minutes after boot and every 6 hours, and on the page the customer lands on after paying. Not covered: plan-cycle allowances (they are granted lazily, so no webhook is involved) |
| Client retries after timeout | Proved | `tests/charts-route.test.ts` "what a retry returns" (same chart, one charge) |
| Server crashes mid-render | Proved | `tests/ledger.test.ts` sweeper tests; the sweeper now runs every 5 minutes (`src/instrumentation-node.ts`) |
| 100 parallel requests, 1 credit | Proved | `tests/ledger.test.ts`, `tests/ledger-concurrency.test.ts` (25-credit variant, real threads), `tests/quota-race.test.ts` |
| Customer disputes a charge | **Partial** | Grant reversed and an alert logged (`tests/billing-packs.test.ts`). Keys are **not** paused when the balance would go negative |
| Refund issued | Proved | `tests/billing-packs.test.ts`, `tests/allowance.test.ts` (only that grant's credit), journey |
| Key leaked on GitHub | **Partial** | Revoke and per-key budget proved (`tests/key-policy-enforcement.test.ts`, `tests/api-key.test.ts`). Emailing the owner on revoke is not verified |
| Signed URL posted publicly | **Not wired** | `src/lib/auth/signing.ts` is tested in isolation; `/chart` does not use it. Blocked on the anonymous-`/chart` decision |
| Signing secret rotated | **Not wired** | Same. No rotation test exists |
| 1,000 signups from one ASN | Proved, with a caveat | Per-IP signup cap (`tests/account.test.ts`) and an unconfirmed account's key cannot render (`tests/stress-matrix.test.ts`, journey). Key *issuance* is not blocked, only its use. A cap per network (ASN), as opposed to per IP, is not built |
| Spec requests 169.254.169.254 | Proved | `tests/fetch-guard.test.ts` |
| 50 MB payload / 10M points | Proved | `tests/stress-matrix.test.ts`: 413, balance and usage rows untouched |
| Database down | Proved | `tests/stress-matrix.test.ts`: 503 `service_unavailable`, nothing stored. Startup refuses a missing volume (`assertVolumeMounted`) |
| Merchant-of-record frozen | Not testable | A property of the design (credit is in our ledger), not of any code path |
| Plan downgrade mid-cycle | Proved | `tests/stress-matrix.test.ts`: paid allowance stands to month end, free figure next month |
| Pack expires with credit left | Proved, except the legal copy | Expiry removes only that grant's unspent credit (`tests/allowance.test.ts`). The 14- and 3-day emails send once each, retry on failure, skip spent packs and allowances (`tests/reconcile-and-notices.test.ts`). Expiry wording in the Terms and at checkout is **not verified**, and checkout does not exist yet |
| Pay-as-you-go account hits zero | Proved | `tests/stress-matrix.test.ts`: 402 with `top_up_url`, mark stays until pack credit exists; journey |

## What this means

Fifteen rows are proved, two are partial (disputes, leaked keys), and two are not wired (signed URLs and secret rotation,
blocked on the anonymous `/chart` decision). One is a property of the design.
What is left of the spec's required list is pausing keys when a dispute would push the balance negative, and the signing work.
