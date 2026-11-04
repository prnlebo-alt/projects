# Billing build — decisions and environment

Companion to `docs/BILLING_SPEC.md`. Records what was decided, by whom, and what the build is actually
running against — so a reviewer can tell a deliberate choice from a drifted one.

## The spec's open decisions

| Decision | Answer | Decided by |
|---|---|---|
| Free tier capped at 250/mo + email verification | **Yes** | Anthony, 2026-10-08 |
| Merchant of record | **Apply for Stripe Managed Payments; Polar if not approved within a week or packs cannot be sold through it** | Anthony, 2026-10-08 |
| Pack expiry | **12 months** | Anthony, 2026-10-08 |
| Russia and Belarus | **Block both** | Delegated to Claude, 2026-10-08 |

**On Russia and Belarus.** Blocked alongside the comprehensively sanctioned destinations. Neither is
comprehensively embargoed for most SaaS, so this is stricter than the law requires. The reasoning is
asymmetry rather than law: this is a solo operator with no compliance function, card rails to both are
largely severed so the forgone revenue is close to nothing, and the cost of being wrong in the other
direction is out of all proportion to a $19 subscription. It is one list entry to reverse if that
changes.

## Decisions the spec did not raise

### The database stays SQLite for Phase 1

The spec says "a ledger in our own Postgres" and carries a stress-test row for Postgres being down.
The application runs better-sqlite3 on a Railway volume.

Every ledger behaviour the spec specifies is available in SQLite: `UPDATE … RETURNING` since 3.35,
`CHECK (remaining >= 0)`, unique indexes for idempotency, and real transactions. For the row that
matters most — a hundred parallel requests against one remaining credit — better-sqlite3's synchronous
transactions serialise on a single writer, which is a *stronger* guarantee than the Postgres version of
the same test, not a weaker one.

Migrating would also throw away work that is already proven: the volume, the backup script, and the
restore drill in `docs/RESTORE.md` that found the WAL trap. None of that carries over, and a database
migration on the critical path to a first paid customer buys nothing the ledger needs.

Recorded as a decision rather than an assumption, and easy to revisit: the schema below is written to be
portable, and the reserve is a single statement either way. **Anthony should overrule this if the doc
meant it strictly.**

## Build environment — what is actually available

The spec asks for Stripe, GitHub, Postgres, Playwright and Railway MCP servers. None of those MCP
servers are connected in this session. Substitutes, all verified present:

| Specified | Actually used | Status |
|---|---|---|
| Stripe MCP | **Stripe CLI 1.51.1** plus the REST API directly | Available; CLI can forward and trigger webhooks locally, which the MCP could not |
| GitHub MCP | `git` over SSH to `prnlebo-alt/chartrelay` | Available; no `gh` CLI installed |
| Postgres MCP (read-only) | `sqlite3` against the local database | Not applicable — see the database decision above |
| Playwright MCP | Chrome DevTools MCP and the in-app browser | Available; both drive a real browser for the signup → pay → render → 402 journey |
| Railway MCP | — | **Not available, and no Railway CLI.** Anything that must change Railway needs the owner |

## Prerequisites that are not code

These block the end of Phase 1 regardless of what is built:

1. **The Stripe account is not activated.** It is a sandbox (`Skyn sandbox`); the live account exists
   but its onboarding was never completed. Managed Payments cannot be applied for from a sandbox.
2. **There is no staging environment.** One Railway service auto-deploys `main` to production. A
   separate service and database are needed before anything billing-related can be exercised against a
   deployed target without touching production.
3. **A business address** is still unset, and the spec lists it as a MUST — it is needed on the Stripe
   account, the site, receipts and email footers.
4. **`EMAIL_PROVIDER` and `EMAIL_FROM`** are still unset in the environment check, and the free tier now
   *requires* email verification, which makes working email a hard dependency rather than a nicety.
