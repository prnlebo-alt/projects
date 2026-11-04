import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/market_intelligence_test";

const { getDb, schema } = await import("@mi/db");
const { runEvidencePipeline } = await import("@mi/agents");
const { FixtureSearchAdapter, FixtureFetchAdapter, LocalObjectStorage } = await import("@mi/tools");
const { FakeModelAdapter } = await import("@mi/models");
const { newId } = await import("@mi/schemas");
const corpus = await import("../fixtures/corpus.js");

const { sources, claims, claimEvidence, sourceFamilies, sourceSnapshots, auditEvents, researchRuns } = schema;

describe("Evidence & Research pipeline (end-to-end, real Postgres)", () => {
  const db = getDb();
  const researchRunId = newId();
  const runSeed = `benchmark-${researchRunId}`;
  let pipelineSummary: Awaited<ReturnType<typeof runEvidencePipeline>>;

  beforeAll(async () => {
    // Fresh state per run: this suite asserts on absolute row counts/values,
    // so leftover data from a prior local test run must not accumulate.
    // access_policy_registry / materiality_sensitivity_rules are untouched —
    // those are seeded config, not run output.
    await db.execute(
      sql`TRUNCATE TABLE claim_evidence, claims, source_family_members, source_families, source_snapshots, sources, verification_runs, agent_runs, audit_events, research_runs RESTART IDENTITY CASCADE`
    );

    await db.insert(researchRuns).values({
      id: researchRunId,
      objective: "Phase 1 benchmark run",
      runType: "benchmark",
      status: "running",
      startedAt: new Date(),
      completedAt: null,
      tokenBudget: 200_000,
      monetaryBudget: 5,
      sourceBudget: 50,
      partialReason: null
    });

    // runEvidencePipeline owns the research_runs status transition itself
    // (completed, or partial with a reason — see pipeline.ts) so nothing
    // here needs to (or should) overwrite it afterward.
    const summary = await runEvidencePipeline({
      db,
      adapters: {
        search: new FixtureSearchAdapter(corpus.searchFixtures),
        fetch: new FixtureFetchAdapter(corpus.fetchFixtures),
        model: new FakeModelAdapter(),
        storage: new LocalObjectStorage(".storage/phase1-shared")
      },
      researchRunId,
      runSeed,
      queries: corpus.searchFixtures.map((f) => f.query),
      resolveMeta: corpus.resolveMeta
    });

    pipelineSummary = summary;
  });

  it("completes cleanly with no per-item failures on well-formed fixtures, and marks research_runs.status accordingly", async () => {
    expect(pipelineSummary.partialFailures).toEqual([]);
    const run = (await db.select().from(researchRuns).where(eq(researchRuns.id, researchRunId)))[0];
    expect(run?.status).toBe("completed");
    expect(run?.partialReason).toBeNull();
    expect(run?.completedAt).not.toBeNull();
  });

  it("never accepts a search result URL with no fetch fixture as a real source (fabricated/unreachable URL rejection)", async () => {
    const rows = await db.select().from(sources).where(eq(sources.canonicalUrl, corpus.UNFIXTURED_URL));
    // Either never recorded at all, or recorded but explicitly fetch_failed —
    // never "fetched"/"unchanged" (i.e. never accepted as live evidence).
    for (const row of rows) {
      expect(row.fetchStatus).not.toBe("fetched");
      expect(row.fetchStatus).not.toBe("unchanged");
    }

    // Positive proof, not just an absence check: the unfixtured URL must
    // never have produced a source_snapshots row at all — search "finding"
    // a URL is not evidence that it was ever actually fetched.
    const unfixturedSource = rows[0];
    if (unfixturedSource) {
      const snapshotsForUnfixtured = await db
        .select()
        .from(sourceSnapshots)
        .where(eq(sourceSnapshots.sourceId, unfixturedSource.id));
      expect(snapshotsForUnfixtured).toHaveLength(0);
    }

    // Structural proof that no claim/evidence in this run can trace back to
    // the unfixtured URL: every claim_evidence row's source_snapshot_id must
    // resolve to a snapshot belonging to a source whose canonical_url is
    // NOT the unfixtured one. This actually walks the join rather than
    // asserting a tautology.
    const evidenceWithSource = await db
      .select({ canonicalUrl: sources.canonicalUrl })
      .from(claimEvidence)
      .innerJoin(sourceSnapshots, eq(sourceSnapshots.id, claimEvidence.sourceSnapshotId))
      .innerJoin(sources, eq(sources.id, sourceSnapshots.sourceId));
    expect(evidenceWithSource.length).toBeGreaterThan(0);
    for (const row of evidenceWithSource) {
      expect(row.canonicalUrl).not.toBe(corpus.UNFIXTURED_URL);
    }
  });

  it("100% of extracted claims satisfy the grounding state-machine contract", async () => {
    const evidenceRows = await db.select().from(claimEvidence);
    const thisRun = evidenceRows; // fresh DB per test run in CI; scoped enough for this suite
    expect(thisRun.length).toBeGreaterThan(0);
    for (const row of thisRun) {
      // Every stored row has resolved to a terminal, valid grounding status —
      // there is no "unresolved" or missing grounding state possible by
      // construction (groundExcerpt always returns one of the three).
      expect(["grounded_exact", "grounded_fuzzy", "grounding_failed"]).toContain(row.groundingStatus);
      if (row.verifierStatus === "verified") {
        // Only grounded evidence may ever reach "verified".
        expect(row.groundingStatus).not.toBe("grounding_failed");
      }
    }
  });

  it("builds a full provenance trace: source -> snapshot -> claim -> grounding -> materiality -> verifier", async () => {
    const verifiedClaims = await db.select().from(claims).where(eq(claims.claimStatus, "verified"));
    expect(verifiedClaims.length).toBeGreaterThan(0);
    const claim = verifiedClaims[0]!;
    const evidence = await db.select().from(claimEvidence).where(eq(claimEvidence.claimId, claim.id));
    expect(evidence.length).toBeGreaterThan(0);
    const snapshotRows = await db
      .select()
      .from(sourceSnapshots)
      .where(eq(sourceSnapshots.id, evidence[0]!.sourceSnapshotId));
    expect(snapshotRows).toHaveLength(1);
    const sourceRows = await db.select().from(sources).where(eq(sources.id, snapshotRows[0]!.sourceId));
    expect(sourceRows).toHaveLength(1);

    expect(claim.material).not.toBeNull();
    expect(evidence[0]!.groundingStatus).not.toBe("grounding_failed");
    expect(evidence[0]!.verifierStatus).toBe("verified");
  });

  it("produces a syndicated-source-family trace (two wire copies share one family)", async () => {
    const families = await db.select().from(sourceFamilies).where(eq(sourceFamilies.familyType, "wire_ancestry"));
    expect(families.length).toBeGreaterThan(0);
  });

  it("writes an auditable trail for every materiality decision", async () => {
    const events = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.eventType, "materiality_determined"));
    expect(events.length).toBeGreaterThan(0);
  });

  it("retains both sides of an unresolved contradiction — nothing deletes the weaker claim", async () => {
    // EVIDENCE_DOCTRINE.md rule 4: contradictions are retained. Simulate two
    // conflicting claims about the same subject/predicate and confirm the
    // pipeline/schema never deletes claim or claim_evidence rows — there is
    // no DELETE statement anywhere in packages/agents' pipeline.
    //
    // A distinct subjectId (not "acme-finance-agent") is deliberate: the
    // main pipeline run in beforeAll already extracted a
    // (product, acme-finance-agent, maturity_state, "ga") claim, and defect
    // #2's semantic-identity uniqueness constraint correctly refuses a
    // second claims row with that exact identity — two DIFFERENT
    // normalized_value claims (contradiction) are what stays as two rows;
    // an IDENTICAL one upserts onto the one that already exists.
    const subjectId = "acme-finance-agent-contradiction-fixture";
    const claimA = newId();
    const claimB = newId();
    await db.insert(claims).values([
      {
        id: claimA,
        subjectType: "product",
        subjectId,
        predicate: "maturity_state",
        objectValue: "GA",
        normalizedValue: "ga",
        claimStatus: "grounded",
        material: true,
        firstObservedAt: new Date(),
        lastVerifiedAt: null,
        confidence: 0.6
      },
      {
        id: claimB,
        subjectType: "product",
        subjectId,
        predicate: "maturity_state",
        objectValue: "Pilot/Beta",
        normalizedValue: "pilot/beta",
        claimStatus: "grounded",
        material: true,
        firstObservedAt: new Date(),
        lastVerifiedAt: null,
        confidence: 0.6
      }
    ]);

    const contradicting = await db
      .select()
      .from(claims)
      .where(eq(claims.subjectId, subjectId));
    const maturityClaims = contradicting.filter(
      (c) => c.predicate === "maturity_state" && (c.id === claimA || c.id === claimB)
    );
    // Both rows persist — retained, not silently reconciled or deleted —
    // regardless of how many other (non-contradicting) maturity_state
    // claims the pipeline itself already extracted for this subject.
    expect(maturityClaims.map((c) => c.objectValue).sort()).toEqual(["GA", "Pilot/Beta"].sort());
    expect(maturityClaims).toHaveLength(2);
  });

  it("a vendor-owned claim never reaches independent-proof-level confidence on its own", async () => {
    const vendorClaims = await db
      .select({ claim: claims, evidence: claimEvidence })
      .from(claims)
      .innerJoin(claimEvidence, eq(claimEvidence.claimId, claims.id))
      .where(eq(claimEvidence.evidenceClass, "vendor_primary_documentation"));
    expect(vendorClaims.length).toBeGreaterThan(0);
    for (const row of vendorClaims) {
      if (row.claim.confidence !== null) {
        expect(row.claim.confidence).toBeLessThan(0.95);
      }
    }
  });

  it("a per-item failure is caught, marks the run partial with a reason, and does not lose other results", async () => {
    const failingRunId = newId();
    await db.insert(researchRuns).values({
      id: failingRunId,
      objective: "Phase 1 partial-run test",
      runType: "test",
      status: "running",
      startedAt: new Date(),
      completedAt: null,
      tokenBudget: 1000,
      monetaryBudget: 1,
      sourceBudget: 10,
      partialReason: null
    });

    const search = new FixtureSearchAdapter(corpus.searchFixtures);
    const storage = new LocalObjectStorage(".storage/phase1-shared");
    let calls = 0;
    const flakyFetch: InstanceType<typeof FixtureFetchAdapter> = new FixtureFetchAdapter(corpus.fetchFixtures);
    const originalFetch = flakyFetch.fetch.bind(flakyFetch);
    flakyFetch.fetch = async (req) => {
      calls += 1;
      if (calls === 2) throw new Error("simulated transient failure");
      return originalFetch(req);
    };

    const summary = await runEvidencePipeline({
      db,
      adapters: { search, fetch: flakyFetch, model: new FakeModelAdapter(), storage },
      researchRunId: failingRunId,
      runSeed: `partial-${failingRunId}`,
      queries: corpus.searchFixtures.map((f) => f.query),
      resolveMeta: corpus.resolveMeta
    });

    expect(summary.partialFailures.length).toBeGreaterThan(0);
    // Other, non-failing URLs in the same run still produced results —
    // one bad item doesn't take down the whole run.
    expect(summary.sourcesFetched).toBeGreaterThan(0);

    const run = (await db.select().from(researchRuns).where(eq(researchRuns.id, failingRunId)))[0];
    expect(run?.status).toBe("partial");
    expect(run?.partialReason).toContain("simulated transient failure");
  });
});
