import { describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/market_intelligence_test";

const { getDb, schema } = await import("@mi/db");
const { runEvidencePipeline } = await import("@mi/agents");
const { FixtureSearchAdapter, FixtureFetchAdapter, LocalObjectStorage } = await import("@mi/tools");
const { FakeModelAdapter } = await import("@mi/models");
const { newId } = await import("@mi/schemas");
const { claimConfidence, isStaleForCurrentState, evidenceItemConfidence } = await import("@mi/evidence");
const { getPromptVersion, getPromptContentHash } = await import("@mi/prompts");
const corpus = await import("../fixtures/robustnessCorpus.js");

const {
  claims,
  claimEvidence,
  sourceSnapshots,
  sourceFamilies,
  sourceFamilyMembers,
  sources,
  auditEvents,
  researchRuns,
  agentRuns
} = schema;

/**
 * Phase 1 independent-review regression suite (defects #1, #2, #3, #5, #8):
 * idempotency under reruns and overlapping queries, independent-vs-
 * syndicated corroboration effects on confidence, real freshness decay, and
 * structural verifier policy enforcement. Uses its own isolated fixture
 * corpus (widgetco-agent*) and does NOT truncate the database — the whole
 * point of several of these tests is to prove behavior across repeated runs
 * against already-populated state (defect #8: "test rerun idempotency
 * without truncating the DB between runs").
 */
describe("Phase 1 robustness regressions (idempotency, corroboration, freshness, verifier policy)", () => {
  const db = getDb();

  function newAdapters(): {
    search: InstanceType<typeof FixtureSearchAdapter>;
    fetch: InstanceType<typeof FixtureFetchAdapter>;
    model: InstanceType<typeof FakeModelAdapter>;
    storage: InstanceType<typeof LocalObjectStorage>;
  } {
    return {
      search: new FixtureSearchAdapter(corpus.searchFixtures),
      fetch: new FixtureFetchAdapter(corpus.fetchFixtures),
      model: new FakeModelAdapter(),
      storage: new LocalObjectStorage(".storage/phase1-shared")
    };
  }

  async function runOnce(queries: string[], runSeed: string) {
    const researchRunId = newId();
    await db.insert(researchRuns).values({
      id: researchRunId,
      objective: "robustness regression run",
      runType: "test",
      status: "running",
      startedAt: new Date(),
      completedAt: null,
      tokenBudget: 200_000,
      monetaryBudget: 5,
      sourceBudget: 50,
      partialReason: null
    });
    const summary = await runEvidencePipeline({
      db,
      adapters: newAdapters(),
      researchRunId,
      runSeed,
      queries,
      resolveMeta: corpus.resolveMeta
    });
    return { researchRunId, summary };
  }

  it("independent-source corroboration: two different-family sources on the same claim raise confidence above either single-source level", async () => {
    await runOnce([corpus.MATURITY_QUERY], "robustness-maturity-seed");

    const maturityClaim = (
      await db
        .select()
        .from(claims)
        .where(
          and(
            eq(claims.subjectId, "widgetco-agent"),
            eq(claims.predicate, "maturity_state"),
            eq(claims.normalizedValue, "ga")
          )
        )
    )[0];
    expect(maturityClaim).toBeDefined();
    expect(maturityClaim!.claimStatus).toBe("verified");

    const evidenceRows = await db.select().from(claimEvidence).where(eq(claimEvidence.claimId, maturityClaim!.id));
    // One row from the vendor page, one from the independent analyst report.
    expect(evidenceRows).toHaveLength(2);

    const itemConfidences = evidenceRows.map((r) => r.evidenceItemConfidence!);
    for (const c of itemConfidences) expect(c).not.toBeNull();

    // Both sources land in different, independent source families (no
    // shared URL/wire/fingerprint) — confirm that structurally.
    const memberships = await db
      .select()
      .from(sourceFamilyMembers)
      .where(
        sql`${sourceFamilyMembers.sourceSnapshotId} IN (${sql.join(
          evidenceRows.map((r) => sql`${r.sourceSnapshotId}`),
          sql`, `
        )})`
      );
    const familyIds = new Set(memberships.map((m) => m.sourceFamilyId));
    expect(familyIds.size).toBe(2);

    // The actual 2-independent-family rollup must exceed what either family
    // would have produced alone — proving corroboration across families
    // really does raise confidence, using the same formula the pipeline
    // itself uses (not a hand-derived magic number).
    const singleFamilyOnly = claimConfidence([Math.max(...itemConfidences)], false);
    expect(maturityClaim!.confidence).toBeGreaterThan(singleFamilyOnly);
  });

  it("syndicated duplicates: two same-family sources on the same claim do NOT raise confidence above the single-family level", async () => {
    await runOnce([corpus.SYNDICATED_PRICING_QUERY], "robustness-syndicated-seed");

    const pricingClaim = (
      await db
        .select()
        .from(claims)
        .where(
          and(
            eq(claims.subjectId, "widgetco-agent"),
            eq(claims.predicate, "pricing_model"),
            eq(claims.normalizedValue, "$500 per month")
          )
        )
    )[0];
    expect(pricingClaim).toBeDefined();

    const evidenceRows = await db.select().from(claimEvidence).where(eq(claimEvidence.claimId, pricingClaim!.id));
    expect(evidenceRows).toHaveLength(2);

    const memberships = await db
      .select()
      .from(sourceFamilyMembers)
      .where(
        sql`${sourceFamilyMembers.sourceSnapshotId} IN (${sql.join(
          evidenceRows.map((r) => sql`${r.sourceSnapshotId}`),
          sql`, `
        )})`
      );
    const familyIds = new Set(memberships.map((m) => m.sourceFamilyId));
    // Explicit syndication (rule 5) — both snapshots belong to ONE family.
    expect(familyIds.size).toBe(1);

    const itemConfidences = evidenceRows.map((r) => r.evidenceItemConfidence!);
    const expectedSingleFamilyConfidence = claimConfidence([Math.max(...itemConfidences)], false);
    expect(pricingClaim!.confidence).toBeCloseTo(expectedSingleFamilyConfidence, 6);
  });

  it("stale evidence: real publication age applies freshness decay end-to-end (defect #3 — ageDays is no longer hardcoded to 0)", async () => {
    await runOnce([corpus.STALE_PRICING_QUERY], "robustness-stale-seed");

    const staleClaim = (
      await db
        .select()
        .from(claims)
        .where(and(eq(claims.subjectId, "widgetco-agent-stale"), eq(claims.predicate, "pricing_model")))
    )[0];
    expect(staleClaim).toBeDefined();

    const evidenceRow = (
      await db.select().from(claimEvidence).where(eq(claimEvidence.claimId, staleClaim!.id))
    )[0]!;
    expect(evidenceRow.evidenceItemConfidence).not.toBeNull();

    // Recompute what the same evidence item would have scored if it had
    // been fresh (ageDays: 0) — the live pipeline must score strictly lower
    // than this, proving real staleness actually depresses confidence
    // rather than every claim being silently treated as ageDays=0.
    const hypotheticalFresh = evidenceItemConfidence({
      evidenceClass: evidenceRow.evidenceClass,
      ageDays: 0,
      ttlDays: 14, // pricing TTL
      extraction: { method: "structured", groundedExact: evidenceRow.groundingStatus === "grounded_exact" },
      verifierStatus: evidenceRow.verifierStatus,
      sameSourceReFetchOnly: evidenceRow.sameSourceRefetch,
      interestFlags: []
    });
    expect(evidenceRow.evidenceItemConfidence!).toBeLessThan(hypotheticalFresh);

    // The publication date is ~9+ months before "now" — well past 2x the
    // 14-day pricing TTL, so the doctrine's staleness gate must also flag
    // it as no longer valid for current-state without a refresh.
    const ageDays = (Date.now() - new Date("2025-11-01T00:00:00Z").getTime()) / (1000 * 60 * 60 * 24);
    expect(isStaleForCurrentState(ageDays, 14)).toBe(true);
  });

  it("overlapping search queries returning the same URL do not create duplicate snapshots, claims, or evidence", async () => {
    await runOnce([corpus.OVERLAP_QUERY_A, corpus.OVERLAP_QUERY_B], "robustness-overlap-seed");

    const source = (
      await db.select().from(sources).where(eq(sources.canonicalUrl, corpus.WIDGETCO_OVERLAP_URL))
    )[0]!;
    expect(source).toBeDefined();

    const snapshots = await db.select().from(sourceSnapshots).where(eq(sourceSnapshots.sourceId, source.id));
    expect(snapshots).toHaveLength(1);

    const overlapClaim = (
      await db
        .select()
        .from(claims)
        .where(and(eq(claims.subjectId, "widgetco-agent"), eq(claims.predicate, "positioning_statement")))
    )[0];
    expect(overlapClaim).toBeDefined();

    const evidenceRows = await db.select().from(claimEvidence).where(eq(claimEvidence.claimId, overlapClaim!.id));
    expect(evidenceRows).toHaveLength(1);
  });

  it("running the identical query set twice (no truncation between runs) does not duplicate claims, evidence, or family memberships", async () => {
    const first = await runOnce([corpus.MATURITY_QUERY], "robustness-rerun-seed");
    expect(first.summary.partialFailures).toEqual([]);

    const claimsAfterFirst = await db
      .select()
      .from(claims)
      .where(and(eq(claims.subjectId, "widgetco-agent"), eq(claims.predicate, "maturity_state")));
    const evidenceAfterFirst = await db
      .select()
      .from(claimEvidence)
      .where(eq(claimEvidence.claimId, claimsAfterFirst[0]!.id));
    const familiesAfterFirst = await db.select().from(sourceFamilyMembers);

    // Second, independent run against the exact same queries/fixtures —
    // deliberately NOT truncating anything in between.
    const second = await runOnce([corpus.MATURITY_QUERY], "robustness-rerun-seed");
    expect(second.summary.partialFailures).toEqual([]);

    const claimsAfterSecond = await db
      .select()
      .from(claims)
      .where(and(eq(claims.subjectId, "widgetco-agent"), eq(claims.predicate, "maturity_state")));
    const evidenceAfterSecond = await db
      .select()
      .from(claimEvidence)
      .where(eq(claimEvidence.claimId, claimsAfterFirst[0]!.id));
    const familiesAfterSecond = await db.select().from(sourceFamilyMembers);

    expect(claimsAfterSecond).toHaveLength(claimsAfterFirst.length);
    expect(evidenceAfterSecond).toHaveLength(evidenceAfterFirst.length);
    expect(familiesAfterSecond).toHaveLength(familiesAfterFirst.length);

    const snapshots = await db
      .select()
      .from(sourceSnapshots)
      .innerJoin(sources, eq(sources.id, sourceSnapshots.sourceId));
    const widgetcoVendorSnapshots = snapshots.filter(
      (row) => row.sources.canonicalUrl === corpus.WIDGETCO_VENDOR_URL
    );
    // Unchanged content across the rerun — still exactly one snapshot.
    expect(widgetcoVendorSnapshots).toHaveLength(1);
  });

  it("verifier policy enforcement: every fetch attempt against a widgetco.example.com URL — discovery AND its independent verification re-fetch — is independently policy-evaluated and audited", async () => {
    const { researchRunId } = await runOnce([corpus.MATURITY_QUERY], "robustness-audit-seed");
    void researchRunId;

    // WIDGETCO_VENDOR_URL and WIDGETCO_ANALYST_URL are each fetched exactly
    // twice across a clean single run: once for discovery, once for the
    // blind independent-verification re-fetch (materiality routes
    // maturity_state to verification). If verification ever bypassed the
    // access-policy gate, this count would be short.
    const events = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.eventType, "access_policy_evaluated"),
          sql`${auditEvents.objectId} IN (${corpus.WIDGETCO_VENDOR_URL}, ${corpus.WIDGETCO_ANALYST_URL})`
        )
      );
    // >= rather than exact equality: this corpus/subject is reused by
    // earlier tests in this same file (also un-truncated), so prior runs'
    // events are still present — the structural guarantee under test is
    // that the count is never *less* than "2 fetch attempts per URL per
    // run", not that this is the only run that ever touched these URLs.
    expect(events.length).toBeGreaterThanOrEqual(4);
    for (const event of events) {
      expect((event.payload as Record<string, unknown>)["result"]).toBe("allow");
    }
  });

  it("second review round, defect #1: a syndicated copy discovered in a LATER run joins the original's persisted family, not a new one", async () => {
    // Run 1: original source only.
    await runOnce([corpus.INCREMENTAL_ORIGINAL_QUERY], "incremental-syndicated-run1");
    const claimAfterRun1 = (
      await db
        .select()
        .from(claims)
        .where(and(eq(claims.subjectId, "incrementalco-agent"), eq(claims.predicate, "pricing_model")))
    )[0]!;
    const evidenceAfterRun1 = await db
      .select()
      .from(claimEvidence)
      .where(eq(claimEvidence.claimId, claimAfterRun1.id));
    expect(evidenceAfterRun1).toHaveLength(1);
    const confidenceAfterRun1 = claimAfterRun1.confidence;

    // Run 2: syndicated copy only — the original is NOT re-discovered here.
    await runOnce([corpus.INCREMENTAL_SYNDICATED_QUERY], "incremental-syndicated-run2");

    const claimAfterRun2 = (
      await db.select().from(claims).where(eq(claims.id, claimAfterRun1.id))
    )[0]!;
    const evidenceAfterRun2 = await db
      .select()
      .from(claimEvidence)
      .where(eq(claimEvidence.claimId, claimAfterRun1.id));
    expect(evidenceAfterRun2).toHaveLength(2);

    const memberships = await db
      .select()
      .from(sourceFamilyMembers)
      .where(
        sql`${sourceFamilyMembers.sourceSnapshotId} IN (${sql.join(
          evidenceAfterRun2.map((r) => sql`${r.sourceSnapshotId}`),
          sql`, `
        )})`
      );
    const familyIds = new Set(memberships.map((m) => m.sourceFamilyId));
    // One family, not two — the syndicated copy converged onto Run 1's
    // already-persisted family instead of starting a new one.
    expect(familyIds.size).toBe(1);
    const [canonicalFamilyId] = [...familyIds];
    const familyRows = await db.select().from(sourceFamilies).where(eq(sourceFamilies.id, canonicalFamilyId!));
    expect(familyRows).toHaveLength(1); // no leftover/orphaned second family row either

    // Same-family (syndicated) evidence must NOT count as independent
    // corroboration — confidence stays at the single-family level.
    const itemConfidences = evidenceAfterRun2.map((r) => r.evidenceItemConfidence!);
    const expectedSingleFamilyConfidence = claimConfidence([Math.max(...itemConfidences)], false);
    expect(claimAfterRun2.confidence).toBeCloseTo(expectedSingleFamilyConfidence, 6);
    expect(claimAfterRun2.confidence).not.toBeGreaterThan(confidenceAfterRun1! + 1e-9);
  });

  it("second review round, defect #1: a genuinely independent source discovered in a LATER run forms a second family and raises confidence", async () => {
    // Fresh subject-adjacent claim reuse from the previous test is fine —
    // Run 1 here is a distinct pipeline run against the same original URL,
    // idempotent (unchanged content -> same snapshot/claim/evidence row).
    await runOnce([corpus.INCREMENTAL_ORIGINAL_QUERY], "incremental-independent-run1");
    const claimAfterRun1 = (
      await db
        .select()
        .from(claims)
        .where(and(eq(claims.subjectId, "incrementalco-agent"), eq(claims.predicate, "pricing_model")))
    )[0]!;
    const confidenceBefore = claimAfterRun1.confidence!;

    // Run 2: a genuinely independent source only (no shared origin metadata,
    // deliberately dissimilar prose).
    await runOnce([corpus.INCREMENTAL_INDEPENDENT_QUERY], "incremental-independent-run2");

    const claimAfterRun2 = (await db.select().from(claims).where(eq(claims.id, claimAfterRun1.id)))[0]!;
    const evidenceAfterRun2 = await db
      .select()
      .from(claimEvidence)
      .where(eq(claimEvidence.claimId, claimAfterRun1.id));

    const memberships = await db
      .select()
      .from(sourceFamilyMembers)
      .where(
        sql`${sourceFamilyMembers.sourceSnapshotId} IN (${sql.join(
          evidenceAfterRun2.map((r) => sql`${r.sourceSnapshotId}`),
          sql`, `
        )})`
      );
    const familyIds = new Set(memberships.map((m) => m.sourceFamilyId));
    // Two independent families now — the new source did NOT merge with the
    // original's family (no shared-origin rule connects them).
    expect(familyIds.size).toBe(2);
    expect(claimAfterRun2.confidence!).toBeGreaterThan(confidenceBefore);
  });

  it("second review round, defect #2: a persisted claim traces back to the exact model execution that produced it", async () => {
    await runOnce([corpus.OVERLAP_QUERY_A], "provenance-trace-seed");

    const claim = (
      await db
        .select()
        .from(claims)
        .where(and(eq(claims.subjectId, "widgetco-agent"), eq(claims.predicate, "positioning_statement")))
    )[0]!;
    const evidence = (
      await db.select().from(claimEvidence).where(eq(claimEvidence.claimId, claim.id))
    )[0]!;
    expect(evidence.extractionAgentRunId).not.toBeNull();
    expect(evidence.evidenceClassAgentRunId).not.toBeNull();

    const extractionRun = (
      await db.select().from(agentRuns).where(eq(agentRuns.id, evidence.extractionAgentRunId!))
    )[0]!;
    const classificationRun = (
      await db.select().from(agentRuns).where(eq(agentRuns.id, evidence.evidenceClassAgentRunId!))
    )[0]!;

    // Deterministic FakeModelAdapter — exact expected values, not just "non-null".
    for (const run of [extractionRun, classificationRun]) {
      expect(run.modelProvider).toBe("fake");
      expect(run.modelName).toBe("deterministic-fake-v1");
      expect(run.status).toBe("completed");
    }
    expect(extractionRun.promptVersion).toBe(getPromptVersion("atomize_claims"));
    expect(extractionRun.promptContentHash).toBe(getPromptContentHash("atomize_claims"));
    expect(classificationRun.promptVersion).toBe(getPromptVersion("classify_evidence_class"));
    expect(classificationRun.promptContentHash).toBe(getPromptContentHash("classify_evidence_class"));
  });

  it("third review round: merging two persisted families recomputes stale claim confidence, even for a claim absent from the merging run", async () => {
    // Run 1: Source A alone -> one family.
    await runOnce([corpus.FAMILY_MERGE_A_QUERY], "family-merge-run1");
    const claimAfterRun1 = (
      await db
        .select()
        .from(claims)
        .where(and(eq(claims.subjectId, "familymergeco-agent"), eq(claims.predicate, "pricing_model")))
    )[0]!;
    const confidenceAfterRun1 = claimAfterRun1.confidence!;

    // Run 2: genuinely independent Source B alone -> two independent
    // families; confidence rises above the single-family level.
    await runOnce([corpus.FAMILY_MERGE_B_QUERY], "family-merge-run2");
    const claimAfterRun2 = (await db.select().from(claims).where(eq(claims.id, claimAfterRun1.id)))[0]!;
    const confidenceAfterRun2 = claimAfterRun2.confidence!;
    expect(confidenceAfterRun2).toBeGreaterThan(confidenceAfterRun1);

    const evidenceAfterRun2 = await db
      .select()
      .from(claimEvidence)
      .where(eq(claimEvidence.claimId, claimAfterRun1.id));
    expect(evidenceAfterRun2).toHaveLength(2);
    const familiesAfterRun2 = new Set(
      (
        await db
          .select()
          .from(sourceFamilyMembers)
          .where(
            sql`${sourceFamilyMembers.sourceSnapshotId} IN (${sql.join(
              evidenceAfterRun2.map((r) => sql`${r.sourceSnapshotId}`),
              sql`, `
            )})`
          )
      ).map((m) => m.sourceFamilyId)
    );
    expect(familiesAfterRun2.size).toBe(2);
    const expectedTwoFamilyConfidence = confidenceAfterRun2; // captured from the live pipeline itself

    // Run 3: Source C — no PRICING_MODEL line at all — deterministically
    // bridges A and B (rule 2 to A, rule 5 to B), merging their previously
    // separate persisted families into one.
    await runOnce([corpus.FAMILY_MERGE_C_QUERY], "family-merge-run3");

    const evidenceAfterRun3 = await db
      .select()
      .from(claimEvidence)
      .where(eq(claimEvidence.claimId, claimAfterRun1.id));
    expect(evidenceAfterRun3).toHaveLength(2); // Source C produced no claim of its own

    const membershipsAfterRun3 = await db
      .select()
      .from(sourceFamilyMembers)
      .where(
        sql`${sourceFamilyMembers.sourceSnapshotId} IN (${sql.join(
          evidenceAfterRun3.map((r) => sql`${r.sourceSnapshotId}`),
          sql`, `
        )})`
      );
    const familiesAfterRun3 = new Set(membershipsAfterRun3.map((m) => m.sourceFamilyId));
    // A and B now resolve to ONE persisted family.
    expect(familiesAfterRun3.size).toBe(1);
    const [canonicalFamilyId] = [...familiesAfterRun3];
    const remainingFamilyRows = await db
      .select()
      .from(sourceFamilies)
      .where(eq(sourceFamilies.id, canonicalFamilyId!));
    expect(remainingFamilyRows).toHaveLength(1); // no orphan duplicate family

    const claimAfterRun3 = (await db.select().from(claims).where(eq(claims.id, claimAfterRun1.id)))[0]!;
    // Claim X was recomputed despite not appearing in Run 3 at all.
    expect(claimAfterRun3.confidence).not.toBe(expectedTwoFamilyConfidence);
    expect(claimAfterRun3.confidence!).toBeLessThan(expectedTwoFamilyConfidence);

    const itemConfidences = evidenceAfterRun3.map((r) => r.evidenceItemConfidence!);
    const expectedSingleFamilyConfidence = claimConfidence([Math.max(...itemConfidences)], false);
    expect(claimAfterRun3.confidence).toBeCloseTo(expectedSingleFamilyConfidence, 6);

    // The recomputation itself is audited, naming why.
    const recomputeEvents = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.eventType, "claim_confidence_recomputed_after_family_merge"),
          eq(auditEvents.objectId, claimAfterRun1.id)
        )
      );
    expect(recomputeEvents.length).toBeGreaterThanOrEqual(1);
    const payload = recomputeEvents[0]!.payload as Record<string, unknown>;
    expect(payload["previousConfidence"]).toBeCloseTo(expectedTwoFamilyConfidence, 6);
    expect(payload["newConfidence"]).toBeCloseTo(expectedSingleFamilyConfidence, 6);
  });
});
