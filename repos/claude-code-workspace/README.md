# Market Intelligence & Opportunity Hunter

A persistent, evidence-first market-intelligence system for Agentic
Salesforce solutions in the PE-backed mid-market space. See `CLAUDE.md` and
`PHASE1_BUILD_DIRECTIVE.md` for the frozen architecture and operating
contract, and `docs/ARCHITECTURE.md` for the full v1.0 specification.

**Current status: Phase 1 (Evidence Engine) — gate PASSED.** See
[`docs/evidence/phase1-gate.md`](docs/evidence/phase1-gate.md) for the
machine-generated evidence, and `docs/TASK_BOARD.md` for phase-by-phase
progress. Phase 2+ is not started — CLAUDE.md is explicit that Phase 1 may
not expand into Phase 2 merely because code is convenient to write.

## What Phase 1 builds

A durable pipeline that discovers permitted public sources, stores immutable
snapshots, deterministically clusters syndicated copies into source
families, atomizes grounded claims, classifies evidence, distinguishes
independent corroboration from syndication, deterministically selects
material claims for independent (blind) verification, and preserves a
complete audit trail — all runnable without any paid model or search
provider (deterministic fixture/fake adapters by default).

## Repository shape

```text
/apps
  /web      Next.js admin-inspection shell (health check + evidence-store counts; UI proper is Phase 7)
  /worker   Node worker process — runs one bounded Evidence & Research pass
/packages
  /schemas  Zod contracts, enums, env validation, deterministic ID/hash/audit-sample utils
  /db       Drizzle schema + migrations for the Phase 1 tables, DB client, audit-event writer
  /tools    Search/Fetch/Browser provider-neutral adapters, access-policy gate, object storage
  /models   Provider-neutral ModelAdapter (deterministic fake + Qwen stub)
  /prompts  Versioned prompt templates + content hashing
  /evidence Grounding, source-family clustering, materiality, evidence-confidence math, verification
  /agents   Evidence & Research pipeline orchestration; Phase 2+ role stubs
  /scoring  Empty by design — Phase 4 (opportunity/threat scoring)
  /testing  Frozen labeled corpus + benchmark metrics + Phase 1 gate report generator
/docs       Frozen v1.0 architecture, evidence doctrine, scoring spec, ADRs, task board, evidence/
```

## Local setup

Requires Node 20+ and a reachable PostgreSQL 16 instance.

```bash
docker compose up -d postgres         # or point DATABASE_URL at your own Postgres
cp .env.example .env                  # defaults already work with docker-compose
npm install
npm run db:migrate -w @mi/db
npm run db:seed -w @mi/db             # materiality rules + access-policy registry
npm run check                         # typecheck + lint + test + build
```

`npm test` runs the full suite, including an end-to-end integration test
that exercises the real pipeline against Postgres
(`packages/testing/src/benchmark/pipeline.integration.test.ts`). No API key
is required for any of this — see `.env.example`.

To regenerate the Phase 1 gate report after running the tests:

```bash
npm run gate:phase1
```

## Engineering defaults

TypeScript end-to-end, PostgreSQL + Drizzle, a separate Node worker process,
Playwright for JS-rendered pages, an S3-compatible object-storage
abstraction (local-filesystem by default), Next.js for the (currently
minimal) web/API shell. See `docs/ARCHITECTURE.md` §23 for the full stack
and `CLAUDE.md` for the constitutional evidence rules every package here is
built to satisfy.
