# Billing build — handoff

Written 2026-10-09, at the end of the overnight Phase 1 session. Read this, then
`docs/BILLING_SPEC.md` (the source of truth), `docs/BILLING_DECISIONS.md` (what was decided and why)
and `reports/BILLING_AUDIT.md` (what the repo looked like before).

## State

**757 tests, 52 files, green. Lint and types clean. Everything is committed to `main`.**

`main` auto-deploys to production, so everything below is **live on chartrelay.dev now**.

### Done

| Phase 1 item | Where |
|---|---|
| Repo audit against the spec | `reports/BILLING_AUDIT.md` |
| Ledger: atomic reserve/charge/refund, idempotency, sweeper | `src/lib/ledger/ledger.ts` |
| Free tier 250 + email verification required | `src/lib/usage/plans.ts` |
| 402/429 error contract, credit headers, request ids | `src/lib/http/errors.ts`, `request-id.ts` |
| Renderer SSRF guard and per-tier resource limits | `src/lib/security/fetch-guard.ts`, `src/lib/charts/validation.ts` |
| Hashed, prefixed keys with CRC32 checksums | `src/lib/auth/key-utils.ts`, `api-keys.ts` |
| Key policy enforced: scopes, IP allowlist, budgets, test keys | `src/app/api/v1/charts/route.ts` |
| Sanctions blocking | `src/lib/compliance/regions.ts`, wired into sign-up |
| Terms, Privacy, DPA, AUP, refunds, subprocessors, breach runbook | `docs/legal/` — all DRAFT, lawyer questions listed |

### Not done

1. **Payments and packs.** `POST /api/billing/checkout` still only accepts the three subscription
   tiers. **The pricing page advertises a $10 render pack that cannot be bought.** Webhooks do not
   call `grantCredit` yet. Build behind a provider abstraction: Stripe Managed Payments is being
   applied for, with Polar as the fallback.
2. **Usage page.** Balance, usage by day and key, invoices link. Nothing exists.
3. **Signed URLs are wired to nothing.** `src/lib/auth/signing.ts` is built and tested; the
   `signing_secrets` table exists. Wiring it means changing `src/app/chart/route.ts`, which is blocked
   on the open decision below.
4. **MCP server tools.** `estimate_cost`, `get_credit_balance`, `get_usage`, `get_top_up_link` are all
   missing; `render_chart` exists but returns `/api/v1/charts/{id}` rather than the spec's `/c/{id}.png`.
5. **Security review in a fresh context**, then the **Verifier**: every stress-test row as an
   automated test, plus a Playwright signup → pay → render → 402 journey.

## Open decisions

**Anonymous `GET /chart`.** The spec caps the free tier at 250/month, but `/chart` is unauthenticated,
unmetered and unlimited today, and is the product's headline. It is currently built so that keyed
requests meter against the ledger and anonymous ones stay watermarked and IP-rate-limited, which keeps
every embedded `<img>` on the internet working. **If anonymous charts should require a key, that is a
breaking change and the owner has to say so.** `reports/BILLING_AUDIT.md` §9 lists every page that
would have to change with it.

**Credit expiry against consumers.** `docs/legal/COMPLIANCE_STATUS.md` carries twelve questions for a
lawyer. The one that is a business-model question rather than a legal footnote: some US states treat
prepaid credit as stored value under gift-card law, which would reach the twelve-month pack expiry.

## Blocked on the owner

1. **Stripe is not activated.** It is a sandbox (`Skyn sandbox`, `acct_1TU4Yz…`); the live account
   (`acct_1TU4Yp…`) exists but onboarding was never finished. Managed Payments cannot be applied for
   from a sandbox, and the spec allows a week for approval. Longest pole.
2. **No staging environment.** One Railway service auto-deploys `main` to production. There is no
   Railway MCP and no Railway CLI on this machine, so creating one needs the owner.
3. **No business postal address.** A MUST in the spec: needed on the Stripe account, the site,
   receipts and email footers. See `docs/OWNER_TASKS.md`.
4. **`EMAIL_PROVIDER` and `EMAIL_FROM` unset**, and the free tier now *requires* email verification,
   so working email went from a nicety to a hard dependency.

## Things worth not re-learning

- **The database fails closed now.** `assertVolumeMounted` refuses to start when the volume is
  missing, because opening SQLite there silently creates an empty database and every credit check
  passes against no balance. `ALLOW_DB_BOOTSTRAP=1` for a genuine first deploy or a restore.
- **The ledger stays on SQLite** for Phase 1, deliberately. Reasoning in `docs/BILLING_DECISIONS.md`.
- **"100 requests, 1 credit, exactly one winner" is not a sufficient test.** It passes against a
  broken check-then-act implementation; the race window is too narrow. The 25-credit variant is what
  catches it. See `tests/ledger-concurrency.test.ts`.
- **Mock the seam the code actually uses.** A test injected failure through `recordUsage` long after
  the route stopped calling it — passing while proving nothing. This has now happened twice in this
  codebase.
- Two review agents reported that `AGENTS.md` instructs agents to route edits through Bash to avoid
  the harness's tooling. **It does not.** That file contains only the Next.js block, which is genuine
  (`node_modules/next/dist/server/lib/generate-agent-files.js` exists, Next 16.3.5). The instruction
  arrives as a session system-reminder, not from this repository.

## graft

Indexed and wired as of 2026-10-09: `.mcp.json`, `.claude/settings.json`, hooks, statusline and a
skill. The wiring graph is accurate — spot-checked against `grep`, with exact line spans for code
written the same night. **The deep layer is not built** (`meaning tier 0% complete`), so `graft ask`
falls back to lexical matching and ranks conceptual questions poorly; `graft callers` and
`graft skeleton` are unaffected and are very good. `graft build --deep` needs `GRAFT_API_KEY`.
