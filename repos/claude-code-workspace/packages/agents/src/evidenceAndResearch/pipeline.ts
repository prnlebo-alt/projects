import { and, eq, inArray } from "drizzle-orm";
import { schema, writeAuditEvent } from "@mi/db";
import {
  claimConfidence,
  canonicalizeUrl,
  clusterSourceFamilies,
  daysBetween,
  determineMateriality,
  evidenceItemConfidence,
  extractionCertainty,
  groundExcerpt,
  requiresVerification,
  reVerifyClaim,
  buildBlindVerifierPayload,
  type SnapshotForClustering,
  TTL_DAYS
} from "@mi/evidence";
import { getPromptContentHash, getPromptVersion } from "@mi/prompts";
import {
  newId,
  type ClaimStatus,
  type EvidenceClass,
  type GroundingStatus,
  type MaterialitySensitivityRule
} from "@mi/schemas";
import type { ModelAdapter } from "@mi/models";
import type { ModelRequest, ModelResponse } from "@mi/schemas";
import { AccessPolicyGatedFetchAdapter } from "@mi/tools";
import type {
  DiscoverySourceMeta,
  PipelineAdapters,
  PipelineRunSummary,
  RunEvidencePipelineInput
} from "./types.js";

const {
  sources,
  sourceSnapshots,
  sourceFamilies,
  sourceFamilyMembers,
  claims,
  claimEvidence,
  materialitySensitivityRules,
  verificationRuns,
  researchRuns,
  agentRuns
} = schema;

interface WorkingSnapshot {
  snapshotId: string;
  sourceId: string;
  canonicalUrl: string;
  normalizedText: string;
  fetchedAt: Date;
  meta: DiscoverySourceMeta;
}

/** claims.claim_status forward-progress ordering (defect #2/#5: an upsert must never regress an already-stronger claim). */
const CLAIM_STATUS_RANK: Record<ClaimStatus, number> = {
  pending_grounding: 0,
  grounding_failed: 1,
  grounded: 2,
  pending_verification: 2,
  verification_failed: 2,
  verification_unresolved: 2,
  verified: 3
};

/**
 * Evidence & Research role, concrete Phase 1 implementation
 * (PHASE1_BUILD_DIRECTIVE.md "Required implementation sequence"):
 * discover -> access-policy gate -> snapshot -> source-family clustering ->
 * claim extraction -> grounding -> materiality/audit sampling ->
 * independent verification -> audit trail.
 *
 * A failure processing one URL or one extracted claim is caught and
 * recorded rather than aborting the whole run (Engineering Defaults:
 * "graceful budget exhaustion... mark run `partial`, never publish
 * half-calculated final scores"). The run's `research_runs` row is the
 * durable boundary: it always ends in `completed` or `partial`, never left
 * `running` by an uncaught per-item error.
 */
export async function runEvidencePipeline(
  input: RunEvidencePipelineInput
): Promise<PipelineRunSummary> {
  const { db, researchRunId, runSeed, resolveMeta } = input;
  const summary: PipelineRunSummary = {
    urlsDiscovered: 0,
    sourcesSkippedByPolicy: 0,
    sourcesFetched: 0,
    snapshotsCreated: 0,
    familiesCreated: 0,
    claimsExtracted: 0,
    claimsGroundingFailed: 0,
    claimsMaterial: 0,
    claimsAudited: 0,
    claimsVerified: 0,
    claimsVerificationFailed: 0,
    claimsVerificationUnresolved: 0,
    partialFailures: []
  };

  // Defect #1: wrap the caller-supplied fetch adapter exactly once, here,
  // and never touch `input.adapters.fetch` again below. Every fetch this
  // pipeline performs — discovery *and* the blind independent-verification
  // re-fetch — goes through this single gated instance, so there is no code
  // path left that can accidentally bypass the access-policy gate.
  const adapters: PipelineAdapters = {
    ...input.adapters,
    fetch: new AccessPolicyGatedFetchAdapter(db, input.adapters.fetch)
  };

  const materialityRules: MaterialitySensitivityRule[] = (
    await db.select().from(materialitySensitivityRules)
  ).map((r) => ({
    id: r.id,
    predicatePattern: r.predicatePattern,
    fieldType: r.fieldType,
    affectedDimensions: r.affectedDimensions,
    affectedActionGate: r.affectedActionGate,
    material: r.material,
    ruleVersion: r.ruleVersion,
    active: r.active
  }));

  // --- 1. Discovery + 2. Access policy + 3. Snapshot pipeline ---
  const rawWorkingSnapshots: WorkingSnapshot[] = [];

  for (const query of input.queries) {
    const searchResponse = await adapters.search.search({ query, maxResults: 25 });
    summary.urlsDiscovered += searchResponse.results.length;

    for (const result of searchResponse.results) {
      try {
        const snapshot = await processDiscoveredUrl({
          db,
          adapters,
          url: result.url,
          resolveMeta,
          summary
        });
        if (snapshot) rawWorkingSnapshots.push(snapshot);
      } catch (err) {
        summary.partialFailures.push({ stage: "source", ref: result.url, error: String(err) });
      }
    }
  }

  // Defect #5: overlapping search queries can return the same URL more than
  // once in a single run. Dedupe by snapshot before clustering/extraction —
  // everything downstream must see each snapshot exactly once per run.
  const workingSnapshots = [...new Map(rawWorkingSnapshots.map((s) => [s.snapshotId, s])).values()];

  // --- 4. Source-family clustering, incremental across runs ---
  // Defect (second review round, #1): a snapshot that already has a
  // persisted family membership is never re-clustered against itself, but a
  // brand-new snapshot THIS run must still be compared against relevant
  // *persisted* snapshots from prior runs — not only against other new
  // snapshots in this same run — or a syndicated copy discovered in run N+1
  // wrongly starts its own family instead of joining run N's.
  await reconcileSourceFamilies(db, adapters, workingSnapshots, summary);

  // --- 5-10. Claim extraction/grounding/classification/materiality/verification ---
  for (const snapshot of workingSnapshots) {
    try {
      await processSnapshotClaims({
        db,
        adapters,
        snapshot,
        materialityRules,
        runSeed,
        researchRunId,
        summary
      });
    } catch (err) {
      summary.partialFailures.push({ stage: "claim", ref: snapshot.snapshotId, error: String(err) });
    }
  }

  await db.insert(verificationRuns).values({
    id: newId(),
    researchRunId,
    claimCount: summary.claimsExtracted,
    verifiedCount: summary.claimsVerified,
    failedCount: summary.claimsVerificationFailed,
    unresolvedCount: summary.claimsVerificationUnresolved,
    auditedNonmaterialCount: summary.claimsAudited,
    completedAt: new Date()
  });

  const isPartial = summary.partialFailures.length > 0;
  await db
    .update(researchRuns)
    .set({
      status: isPartial ? "partial" : "completed",
      completedAt: new Date(),
      partialReason: isPartial
        ? summary.partialFailures.map((f) => `[${f.stage}:${f.ref}] ${f.error}`).join("; ").slice(0, 2000)
        : null
    })
    .where(eq(researchRuns.id, researchRunId));

  return summary;
}

/**
 * Incremental source-family reconciliation (second review round, defect #1).
 * Compares this run's brand-new snapshots against BOTH each other AND every
 * already-persisted, already-clustered snapshot (fetched from DB/storage —
 * full-table pool; fine at Phase 1 fixture/benchmark scale, a later phase
 * can bound the candidate set without changing this function's semantics).
 * The same deterministic rules in clusterSourceFamilies() decide every edge;
 * this function only decides which existing `source_families` row a
 * resulting cluster must converge onto.
 *
 * A cluster containing no persisted snapshot is a genuinely new family.
 * A cluster containing persisted snapshot(s) from exactly one existing
 * family adopts that family — no new family row, new members attach to it.
 * A cluster bridging two-or-more previously-separate existing families
 * (a new snapshot's rules connect both) merges them onto one canonical
 * family (lexicographically smallest id) and repoints every member of the
 * others — true convergence, not just "good enough for this run".
 */
async function reconcileSourceFamilies(
  db: RunEvidencePipelineInput["db"],
  adapters: PipelineAdapters,
  workingSnapshots: WorkingSnapshot[],
  summary: PipelineRunSummary
): Promise<void> {
  const existingMemberships =
    workingSnapshots.length > 0
      ? await db
          .select({ sourceSnapshotId: sourceFamilyMembers.sourceSnapshotId })
          .from(sourceFamilyMembers)
          .where(
            inArray(
              sourceFamilyMembers.sourceSnapshotId,
              workingSnapshots.map((s) => s.snapshotId)
            )
          )
      : [];
  const alreadyClustered = new Set(existingMemberships.map((m) => m.sourceSnapshotId));
  const newSnapshots = workingSnapshots.filter((s) => !alreadyClustered.has(s.snapshotId));
  summary.familiesCreated = 0;
  if (newSnapshots.length === 0) return;

  // Persisted candidate pool: every snapshot the DB already knows belongs to
  // a family, reconstructed with the same fields clusterSourceFamilies()
  // needs — persisted on `sources` precisely so this reconstruction is
  // possible across separate runs (see schema.ts sources.wireService etc.).
  const allPersistedMemberships = await db.select().from(sourceFamilyMembers);
  const persistedFamilyBySnapshot = new Map(
    allPersistedMemberships.map((m) => [m.sourceSnapshotId, m.sourceFamilyId])
  );
  const newSnapshotIds = new Set(newSnapshots.map((s) => s.snapshotId));
  const persistedSnapshotIds = [...persistedFamilyBySnapshot.keys()].filter(
    (id) => !newSnapshotIds.has(id)
  );

  const persistedRepresentatives: Array<SnapshotForClustering & { existingFamilyId: string }> = [];
  if (persistedSnapshotIds.length > 0) {
    const persistedSnapshots = await db
      .select()
      .from(sourceSnapshots)
      .where(inArray(sourceSnapshots.id, persistedSnapshotIds));
    const persistedSourceIds = [...new Set(persistedSnapshots.map((s) => s.sourceId))];
    const persistedSources =
      persistedSourceIds.length > 0
        ? await db.select().from(sources).where(inArray(sources.id, persistedSourceIds))
        : [];
    const sourceById = new Map(persistedSources.map((s) => [s.id, s]));

    for (const snap of persistedSnapshots) {
      const source = sourceById.get(snap.sourceId);
      if (!source) continue;
      const normalizedText = (await adapters.storage.get(snap.normalizedTextLocation)).toString("utf-8");
      persistedRepresentatives.push({
        snapshotId: snap.id,
        sourceId: snap.sourceId,
        canonicalUrl: source.canonicalUrl,
        canonicalPublisherItemId: source.canonicalPublisherItemId,
        normalizedText,
        publishedAt: source.publishedAt,
        wireService: source.wireService,
        wireItemId: source.wireItemId,
        syndicatedFromSnapshotId: null, // resolved below via the combined URL map
        existingFamilyId: persistedFamilyBySnapshot.get(snap.id)!
      });
    }
  }

  const combinedByCanonicalUrl = new Map<string, string>();
  for (const p of persistedRepresentatives) combinedByCanonicalUrl.set(p.canonicalUrl, p.snapshotId);
  for (const s of newSnapshots) combinedByCanonicalUrl.set(s.canonicalUrl, s.snapshotId);

  const newClusterInput: SnapshotForClustering[] = newSnapshots.map((s) => ({
    snapshotId: s.snapshotId,
    sourceId: s.sourceId,
    canonicalUrl: s.canonicalUrl,
    canonicalPublisherItemId: s.meta.canonicalPublisherItemId ?? null,
    normalizedText: s.normalizedText,
    publishedAt: s.meta.publishedAt ?? null,
    wireService: s.meta.wireService ?? null,
    wireItemId: s.meta.wireItemId ?? null,
    syndicatedFromSnapshotId: s.meta.syndicatedFromUrl
      ? (combinedByCanonicalUrl.get(canonicalizeUrl(s.meta.syndicatedFromUrl)) ?? null)
      : null
  }));

  const combinedInput: SnapshotForClustering[] = [...persistedRepresentatives, ...newClusterInput];
  const { families, memberships } = clusterSourceFamilies(combinedInput);

  const existingFamilyBySnapshot = new Map(persistedRepresentatives.map((p) => [p.snapshotId, p.existingFamilyId]));
  const persistedFamilyIdsByClusterIndex = new Map<number, Set<string>>();
  for (const m of memberships) {
    const existingId = existingFamilyBySnapshot.get(m.sourceSnapshotId);
    if (!existingId) continue;
    if (!persistedFamilyIdsByClusterIndex.has(m.familyIndex)) {
      persistedFamilyIdsByClusterIndex.set(m.familyIndex, new Set());
    }
    persistedFamilyIdsByClusterIndex.get(m.familyIndex)!.add(existingId);
  }

  const familyDbIdByIndex = new Map<number, string>();
  // Evidence-consistency fix (third review round): every snapshot belonging
  // to any family that gets merged away this run — confidence for whatever
  // claims cite those snapshots must be recomputed once convergence is
  // final, even if none of those claims' own snapshots were touched by
  // this run's discovery.
  const mergeAffectedSnapshotIds = new Set<string>();
  for (const family of families) {
    const existingIds = [...(persistedFamilyIdsByClusterIndex.get(family.familyIndex) ?? [])].sort();
    if (existingIds.length === 0) {
      const familyId = newId();
      familyDbIdByIndex.set(family.familyIndex, familyId);
      await db.insert(sourceFamilies).values({
        id: familyId,
        familyType: family.familyType,
        canonicalOriginSourceId: family.canonicalOriginSourceId,
        fingerprint: family.fingerprint,
        createdAt: new Date()
      });
      summary.familiesCreated += 1;
      continue;
    }
    const canonical = existingIds[0]!;
    familyDbIdByIndex.set(family.familyIndex, canonical);
    if (existingIds.length > 1) {
      const toMerge = existingIds.slice(1);
      const mergedMembers = await db
        .select({ sourceSnapshotId: sourceFamilyMembers.sourceSnapshotId })
        .from(sourceFamilyMembers)
        .where(inArray(sourceFamilyMembers.sourceFamilyId, existingIds));
      for (const m of mergedMembers) mergeAffectedSnapshotIds.add(m.sourceSnapshotId);
      await db
        .update(sourceFamilyMembers)
        .set({ sourceFamilyId: canonical })
        .where(inArray(sourceFamilyMembers.sourceFamilyId, toMerge));
      await db.delete(sourceFamilies).where(inArray(sourceFamilies.id, toMerge));
    }
  }

  for (const membership of memberships) {
    if (!newSnapshotIds.has(membership.sourceSnapshotId)) continue; // persisted rows already exist (or were just repointed above)
    await db
      .insert(sourceFamilyMembers)
      .values({
        sourceSnapshotId: membership.sourceSnapshotId,
        sourceFamilyId: familyDbIdByIndex.get(membership.familyIndex)!,
        membershipRule: membership.membershipRule,
        similarityScore: membership.similarityScore
      })
      .onConflictDoNothing({ target: sourceFamilyMembers.sourceSnapshotId });
  }

  // Membership convergence is now complete — recompute every persisted
  // claim whose evidence cites a snapshot from a merged family, even one
  // (like Source C establishing the merge) that carries no claim of its
  // own. A claim previously scored as two-independent-family corroboration
  // must not keep that inflated confidence once those families are one.
  if (mergeAffectedSnapshotIds.size > 0) {
    const affectedEvidence = await db
      .select({ claimId: claimEvidence.claimId })
      .from(claimEvidence)
      .where(inArray(claimEvidence.sourceSnapshotId, [...mergeAffectedSnapshotIds]));
    const affectedClaimIds = [...new Set(affectedEvidence.map((r) => r.claimId))];
    for (const claimId of affectedClaimIds) {
      const before = (
        await db.select({ confidence: claims.confidence }).from(claims).where(eq(claims.id, claimId))
      )[0];
      if (!before) continue;
      const { confidence: recomputedConfidence } = await recomputeClaimConfidence(db, claimId);
      await db.update(claims).set({ confidence: recomputedConfidence }).where(eq(claims.id, claimId));
      await writeAuditEvent(db, {
        actorType: "deterministic_service",
        actorId: "source-family-reconciliation",
        eventType: "claim_confidence_recomputed_after_family_merge",
        objectType: "claim",
        objectId: claimId,
        payload: {
          previousConfidence: before.confidence,
          newConfidence: recomputedConfidence,
          reason: "source-family independence changed: previously separate families merged"
        }
      });
    }
  }
}

async function processDiscoveredUrl(args: {
  db: RunEvidencePipelineInput["db"];
  adapters: PipelineAdapters;
  url: string;
  resolveMeta: RunEvidencePipelineInput["resolveMeta"];
  summary: PipelineRunSummary;
}): Promise<WorkingSnapshot | null> {
  const { db, adapters, url, resolveMeta, summary } = args;

  const meta = resolveMeta(url);
  if (!meta) return null; // discovered but no usable classification — skip, don't fabricate one

  // Defect #1: no separate policy check here — `adapters.fetch` is already
  // the access-policy-gated wrapper constructed once in runEvidencePipeline,
  // so this call is the *only* place policy is (or needs to be) evaluated
  // for discovery, and the exact same instance is reused for verification.
  const fetchResult = await adapters.fetch.fetch({ url });

  if (fetchResult.status === "denied") {
    summary.sourcesSkippedByPolicy += 1;
    const policyResult = fetchResult.accessPolicyResult ?? "manual_policy_required";
    await upsertSource(db, url, meta, {
      fetchStatus: policyResult === "deny" ? "denied_by_policy" : "manual_policy_required",
      contentHash: null
    });
    return null;
  }

  if (fetchResult.status !== "ok" || fetchResult.normalizedText === null || fetchResult.contentHash === null) {
    await upsertSource(db, url, meta, { fetchStatus: "fetch_failed", contentHash: null });
    return null;
  }
  summary.sourcesFetched += 1;

  const canonical = canonicalizeUrl(url);
  const existing = await db.select().from(sources).where(eq(sources.canonicalUrl, canonical));
  const priorContentHash = existing[0]?.contentHash ?? null;
  const sourceId = existing[0]?.id ?? newId();

  await upsertSource(db, url, meta, {
    fetchStatus: priorContentHash === fetchResult.contentHash ? "unchanged" : "fetched",
    contentHash: fetchResult.contentHash,
    idOverride: sourceId
  });

  if (priorContentHash === fetchResult.contentHash) {
    // Unchanged: reuse the most recent existing snapshot instead of
    // re-persisting/re-extracting identical content.
    const priorSnapshots = await db
      .select()
      .from(sourceSnapshots)
      .where(eq(sourceSnapshots.sourceId, sourceId));
    const latest = priorSnapshots.at(-1);
    if (!latest) return null;
    const normalizedText = (await adapters.storage.get(latest.normalizedTextLocation)).toString("utf-8");
    return {
      snapshotId: latest.id,
      sourceId,
      canonicalUrl: canonical,
      normalizedText,
      fetchedAt: latest.fetchedAt,
      meta
    };
  }

  const snapshotId = newId();
  const rawLocation = await adapters.storage.put(`raw/${snapshotId}.txt`, fetchResult.rawContent ?? "");
  const normalizedLocation = await adapters.storage.put(
    `normalized/${snapshotId}.txt`,
    fetchResult.normalizedText
  );
  const fetchedAt = new Date(fetchResult.fetchedAt);
  // Defect #5: (source_id, content_hash) is unique — if a concurrent/rerun
  // race already inserted this exact snapshot, fall back to it rather than
  // erroring or creating a duplicate.
  const insertedRows = await db
    .insert(sourceSnapshots)
    .values({
      id: snapshotId,
      sourceId,
      fetchedAt,
      contentHash: fetchResult.contentHash,
      rawContentLocation: rawLocation,
      normalizedTextLocation: normalizedLocation,
      screenshotLocation: null,
      fetchMethod: "http_static",
      accessPolicyResult: "allow"
    })
    .onConflictDoNothing({ target: [sourceSnapshots.sourceId, sourceSnapshots.contentHash] })
    .returning({ id: sourceSnapshots.id });

  if (insertedRows.length > 0) {
    summary.snapshotsCreated += 1;
    return { snapshotId, sourceId, canonicalUrl: canonical, normalizedText: fetchResult.normalizedText, fetchedAt, meta };
  }

  const raceWinner = (
    await db
      .select()
      .from(sourceSnapshots)
      .where(and(eq(sourceSnapshots.sourceId, sourceId), eq(sourceSnapshots.contentHash, fetchResult.contentHash)))
  )[0]!;
  return {
    snapshotId: raceWinner.id,
    sourceId,
    canonicalUrl: canonical,
    normalizedText: fetchResult.normalizedText,
    fetchedAt: raceWinner.fetchedAt,
    meta
  };
}

async function processSnapshotClaims(args: {
  db: RunEvidencePipelineInput["db"];
  adapters: PipelineAdapters;
  snapshot: WorkingSnapshot;
  materialityRules: MaterialitySensitivityRule[];
  runSeed: string;
  researchRunId: string;
  summary: PipelineRunSummary;
}): Promise<void> {
  const { db, adapters, snapshot, materialityRules, runSeed, researchRunId, summary } = args;

  const { response: extraction, agentRunId: extractionAgentRunId } = await callModelWithProvenance(
    db,
    researchRunId,
    { task: "atomize_claims", promptVersion: getPromptVersion("atomize_claims"), input: { text: snapshot.normalizedText } },
    adapters.model
  );
  const { response: classification, agentRunId: evidenceClassAgentRunId } = await callModelWithProvenance(
    db,
    researchRunId,
    {
      task: "classify_evidence_class",
      promptVersion: getPromptVersion("classify_evidence_class"),
      input: { sourceType: snapshot.meta.sourceType }
    },
    adapters.model
  );
  const evidenceClass = classification.output["evidenceClass"] as EvidenceClass;

  const candidates =
    (extraction.output["claims"] as Array<{
      predicate: string;
      objectValue: string;
      excerptText: string;
      excerptLocation: string;
    }>) ?? [];

  for (const candidate of candidates) {
    summary.claimsExtracted += 1;
    const grounding = groundExcerpt(candidate.excerptText, snapshot.normalizedText);
    const normalizedValue = candidate.objectValue.trim().toLowerCase();
    const candidateStatus: ClaimStatus = grounding.status === "grounding_failed" ? "grounding_failed" : "grounded";

    // Defect #2: semantic claim identity — the same subject+predicate+
    // normalized value is one claim, ever. A second (or Nth) supporting
    // source attaches as another claim_evidence row on the *same* claim
    // rather than creating an unrelated duplicate.
    const { claimId } = await findOrCreateClaim(db, {
      subjectType: snapshot.meta.subjectType,
      subjectId: snapshot.meta.subjectId,
      predicate: candidate.predicate,
      objectValue: candidate.objectValue,
      normalizedValue,
      initialClaimStatus: candidateStatus
    });
    await mergeClaimStatusForward(db, claimId, candidateStatus);

    const extractionCert = extractionCertainty({
      method: "structured",
      groundedExact: grounding.status === "grounded_exact"
    });

    const evidenceId = await findOrCreateClaimEvidence(db, {
      claimId,
      sourceSnapshotId: snapshot.snapshotId,
      evidenceClass,
      excerptLocation: candidate.excerptLocation,
      excerptText: candidate.excerptText,
      groundingStatus: grounding.status,
      extractorConfidence: extractionCert,
      interestFlags: snapshot.meta.interestFlags ?? [],
      extractionAgentRunId,
      evidenceClassAgentRunId
    });

    await writeAuditEvent(db, {
      actorType: "deterministic_service",
      actorId: "evidence-and-research-pipeline",
      eventType: "claim_extracted",
      objectType: "claim",
      objectId: claimId,
      payload: {
        researchRunId,
        groundingStatus: grounding.status,
        predicate: candidate.predicate,
        extractionAgentRunId,
        evidenceClassAgentRunId
      }
    });

    if (grounding.status === "grounding_failed") {
      summary.claimsGroundingFailed += 1;
      continue;
    }

    const materiality = determineMateriality(
      { id: claimId, predicate: candidate.predicate },
      materialityRules,
      { runSeed }
    );
    await db.update(claims).set({ material: materiality.material }).where(eq(claims.id, claimId));
    await writeAuditEvent(db, {
      actorType: "deterministic_service",
      actorId: "materiality-service",
      eventType: "materiality_determined",
      objectType: "claim",
      objectId: claimId,
      payload: { researchRunId, ...materiality }
    });
    if (materiality.material) summary.claimsMaterial += 1;
    if (materiality.auditSampled) summary.claimsAudited += 1;

    if (!requiresVerification(materiality)) {
      continue; // terminal state for non-material, non-audited claims — already "grounded"
    }

    // --- 10. Independent verification (blind re-fetch) ---
    // `adapters.fetch` is the same access-policy-gated instance discovery
    // used above — the verifier cannot reach a domain discovery couldn't.
    const blindPayload = buildBlindVerifierPayload({
      id: claimId,
      predicate: candidate.predicate,
      objectValue: candidate.objectValue,
      sourceCanonicalUrl: snapshot.canonicalUrl
    });
    const refetch = await adapters.fetch.fetch({ url: blindPayload.sourceCanonicalUrl });
    const reVerify = reVerifyClaim({
      refetchStatus: refetch.status,
      refetchedNormalizedText: refetch.normalizedText,
      objectValue: blindPayload.objectValue
    });

    const verifierStatus = reVerify.status;
    const newClaimStatus: ClaimStatus =
      verifierStatus === "verified"
        ? "verified"
        : verifierStatus === "failed"
          ? "verification_failed"
          : "verification_unresolved";

    // Defect #3: age is computed from the source's actual publication/
    // observation time, never hardcoded. Falls back to when this snapshot
    // was fetched if no publication date is known.
    const observedAt = snapshot.meta.publishedAt ?? snapshot.fetchedAt;
    const ageDays = daysBetween(new Date(), observedAt);
    const ttlDays = inferTtl(candidate.predicate);
    // Defect #3: Phase 1's blind re-fetch always re-fetches the *same*
    // source URL — it is a same-source re-fetch, never an independently
    // discovered second source, so it must not receive the full
    // independent-verification factor.
    const itemConfidence = evidenceItemConfidence({
      evidenceClass,
      ageDays,
      ttlDays,
      extraction: { method: "structured", groundedExact: grounding.status === "grounded_exact" },
      verifierStatus,
      sameSourceReFetchOnly: true,
      interestFlags: snapshot.meta.interestFlags ?? []
    });

    // Update only *this* candidate's own claim_evidence row — a claim can
    // now carry multiple evidence rows (defect #2), so this must never
    // touch any sibling row belonging to other sources on the same claim.
    await db
      .update(claimEvidence)
      .set({ verifierStatus, evidenceItemConfidence: itemConfidence, sameSourceRefetch: true })
      .where(eq(claimEvidence.id, evidenceId));

    // Defect #2: recompute the claim's overall confidence from *all* of its
    // persisted evidence, collapsed by source_family (max per family), not
    // from this one item in isolation.
    const { confidence, familyCount } = await recomputeClaimConfidence(db, claimId);

    await mergeClaimStatusForward(db, claimId, newClaimStatus);
    await db.update(claims).set({ lastVerifiedAt: new Date(), confidence }).where(eq(claims.id, claimId));

    await writeAuditEvent(db, {
      actorType: "deterministic_service",
      actorId: "verifier-worker",
      eventType: "claim_verification_completed",
      objectType: "claim",
      objectId: claimId,
      payload: { researchRunId, familyCount, confidence, verifierStatus, sameSourceRefetch: true, reason: reVerify.reason }
    });

    if (verifierStatus === "verified") summary.claimsVerified += 1;
    else if (verifierStatus === "failed") summary.claimsVerificationFailed += 1;
    else summary.claimsVerificationUnresolved += 1;
  }
}

/**
 * Defect #2 — semantic claim identity. Finds an existing claim by
 * (subject_type, subject_id, predicate, normalized_value); if none exists,
 * creates one. Race-safe via the DB unique constraint + onConflictDoNothing
 * + re-select, so concurrent/rerun callers converge on the same row rather
 * than erroring or duplicating (defect #5).
 */
async function findOrCreateClaim(
  db: RunEvidencePipelineInput["db"],
  params: {
    subjectType: DiscoverySourceMeta["subjectType"];
    subjectId: string;
    predicate: string;
    objectValue: string;
    normalizedValue: string;
    initialClaimStatus: ClaimStatus;
  }
): Promise<{ claimId: string; isNew: boolean }> {
  const existing = await db
    .select({ id: claims.id })
    .from(claims)
    .where(
      and(
        eq(claims.subjectType, params.subjectType),
        eq(claims.subjectId, params.subjectId),
        eq(claims.predicate, params.predicate),
        eq(claims.normalizedValue, params.normalizedValue)
      )
    );
  if (existing[0]) return { claimId: existing[0].id, isNew: false };

  const claimId = newId();
  const inserted = await db
    .insert(claims)
    .values({
      id: claimId,
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      predicate: params.predicate,
      objectValue: params.objectValue,
      normalizedValue: params.normalizedValue,
      claimStatus: params.initialClaimStatus,
      material: null,
      firstObservedAt: new Date(),
      lastVerifiedAt: null,
      confidence: null
    })
    .onConflictDoNothing({
      target: [claims.subjectType, claims.subjectId, claims.predicate, claims.normalizedValue]
    })
    .returning({ id: claims.id });

  if (inserted.length > 0) return { claimId, isNew: true };

  // Lost a race to a concurrent insert with the same semantic identity —
  // converge on the winner's row rather than creating a duplicate.
  const winner = (
    await db
      .select({ id: claims.id })
      .from(claims)
      .where(
        and(
          eq(claims.subjectType, params.subjectType),
          eq(claims.subjectId, params.subjectId),
          eq(claims.predicate, params.predicate),
          eq(claims.normalizedValue, params.normalizedValue)
        )
      )
  )[0]!;
  return { claimId: winner.id, isNew: false };
}

/** claims.claim_status only ever moves forward — one new/weaker piece of evidence never regresses an already-stronger claim. */
async function mergeClaimStatusForward(
  db: RunEvidencePipelineInput["db"],
  claimId: string,
  candidateStatus: ClaimStatus
): Promise<void> {
  const current = (await db.select({ claimStatus: claims.claimStatus }).from(claims).where(eq(claims.id, claimId)))[0];
  if (!current) return;
  if (CLAIM_STATUS_RANK[candidateStatus] > CLAIM_STATUS_RANK[current.claimStatus]) {
    await db.update(claims).set({ claimStatus: candidateStatus }).where(eq(claims.id, claimId));
  }
}

/** Defect #5 — idempotent claim_evidence insert: the same excerpt from the same snapshot on the same claim is one row, ever. */
async function findOrCreateClaimEvidence(
  db: RunEvidencePipelineInput["db"],
  params: {
    claimId: string;
    sourceSnapshotId: string;
    evidenceClass: EvidenceClass;
    excerptLocation: string;
    excerptText: string;
    groundingStatus: GroundingStatus;
    extractorConfidence: number;
    interestFlags: string[];
    extractionAgentRunId: string;
    evidenceClassAgentRunId: string;
  }
): Promise<string> {
  const id = newId();
  const inserted = await db
    .insert(claimEvidence)
    .values({
      id,
      claimId: params.claimId,
      sourceSnapshotId: params.sourceSnapshotId,
      evidenceClass: params.evidenceClass,
      supportType: "support",
      excerptLocation: params.excerptLocation,
      excerptText: params.excerptText,
      groundingStatus: params.groundingStatus,
      extractorConfidence: params.extractorConfidence,
      verifierStatus: "not_selected",
      interestFlagsJson: params.interestFlags,
      evidenceItemConfidence: null,
      sameSourceRefetch: false,
      extractionAgentRunId: params.extractionAgentRunId,
      evidenceClassAgentRunId: params.evidenceClassAgentRunId
    })
    .onConflictDoNothing({
      target: [claimEvidence.claimId, claimEvidence.sourceSnapshotId, claimEvidence.excerptLocation]
    })
    .returning({ id: claimEvidence.id });

  if (inserted.length > 0) return id;

  const winner = (
    await db
      .select({ id: claimEvidence.id })
      .from(claimEvidence)
      .where(
        and(
          eq(claimEvidence.claimId, params.claimId),
          eq(claimEvidence.sourceSnapshotId, params.sourceSnapshotId),
          eq(claimEvidence.excerptLocation, params.excerptLocation)
        )
      )
  )[0]!;
  return winner.id;
}

/**
 * Defect #2 — collapses this claim's evidence by source_family (max
 * evidence_item_confidence per independent family — syndicated copies in
 * the same family therefore count once, not additively), then computes
 * claimConfidence() over the per-family maxima. Considers *all* persisted
 * evidence for the claim, not just the item that just triggered the
 * recompute, so corroboration correctly accumulates across separate
 * pipeline runs.
 */
async function recomputeClaimConfidence(
  db: RunEvidencePipelineInput["db"],
  claimId: string
): Promise<{ confidence: number; familyCount: number }> {
  const evidenceRows = await db.select().from(claimEvidence).where(eq(claimEvidence.claimId, claimId));
  const snapshotIds = [...new Set(evidenceRows.map((r) => r.sourceSnapshotId))];
  const memberships =
    snapshotIds.length > 0
      ? await db
          .select()
          .from(sourceFamilyMembers)
          .where(inArray(sourceFamilyMembers.sourceSnapshotId, snapshotIds))
      : [];
  const familyBySnapshot = new Map(memberships.map((m) => [m.sourceSnapshotId, m.sourceFamilyId]));

  const maxByFamily = new Map<string, number>();
  let hasTopTier = false;
  for (const row of evidenceRows) {
    if (row.evidenceItemConfidence === null) continue; // not yet scored (e.g. never verified) — excluded from the rollup
    const familyKey = familyBySnapshot.get(row.sourceSnapshotId) ?? `unclustered:${row.sourceSnapshotId}`;
    const prevMax = maxByFamily.get(familyKey) ?? 0;
    if (row.evidenceItemConfidence > prevMax) maxByFamily.set(familyKey, row.evidenceItemConfidence);
    if (row.evidenceClass === "audited_regulatory_primary_dataset") hasTopTier = true;
  }

  const familyConfidences = [...maxByFamily.values()];
  return { confidence: claimConfidence(familyConfidences, hasTopTier), familyCount: familyConfidences.length };
}

/**
 * Defect #6 — every model call in the evidence pipeline writes/links an
 * `agent_runs` provenance row (research run, agent role, provider, model,
 * prompt version + content hash, status, timing) before returning the
 * model's proposal to the caller.
 */
async function callModelWithProvenance(
  db: RunEvidencePipelineInput["db"],
  researchRunId: string,
  request: ModelRequest,
  adapter: ModelAdapter
): Promise<{ response: ModelResponse; agentRunId: string }> {
  const agentRunId = newId();
  const startedAt = new Date();
  const expectedPromptContentHash = getPromptContentHash(request.task);
  await db.insert(agentRuns).values({
    id: agentRunId,
    researchRunId,
    agentRole: "evidence_and_research",
    modelProvider: adapter.providerName,
    modelName: adapter.modelName,
    promptVersion: request.promptVersion,
    promptContentHash: expectedPromptContentHash,
    status: "running",
    startedAt,
    completedAt: null,
    costEstimate: null
  });

  try {
    const response = await adapter.propose(request);
    // Second review round, defect #2: don't silently trust — verify the
    // model actually used the prompt version this run recorded as expected.
    // A mismatch means the recorded provenance would misdescribe what
    // really produced the claim, which is worse than no provenance at all.
    if (response.promptContentHash !== expectedPromptContentHash) {
      await writeAuditEvent(db, {
        actorType: "deterministic_service",
        actorId: "model-provenance-guard",
        eventType: "prompt_content_hash_mismatch",
        objectType: "agent_run",
        objectId: agentRunId,
        payload: {
          researchRunId,
          task: request.task,
          expectedPromptContentHash,
          actualPromptContentHash: response.promptContentHash
        }
      });
      throw new Error(
        `prompt_content_hash mismatch for task "${request.task}": expected ${expectedPromptContentHash}, got ${response.promptContentHash}`
      );
    }
    await db
      .update(agentRuns)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(agentRuns.id, agentRunId));
    return { response, agentRunId };
  } catch (err) {
    await db
      .update(agentRuns)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(agentRuns.id, agentRunId));
    throw err;
  }
}

function inferTtl(predicate: string): number | null {
  if (predicate.includes("pricing")) return TTL_DAYS.pricing;
  if (predicate.includes("maturity") || predicate.includes("availability")) return TTL_DAYS.maturity_availability;
  if (predicate.includes("hiring")) return TTL_DAYS.leadership_hiring;
  if (predicate.includes("partnership") || predicate.includes("acquisition")) return TTL_DAYS.partnership_acquisition;
  if (predicate.includes("positioning")) return TTL_DAYS.positioning;
  return TTL_DAYS.positioning;
}

async function upsertSource(
  db: RunEvidencePipelineInput["db"],
  rawUrl: string,
  meta: DiscoverySourceMeta,
  opts: { fetchStatus: (typeof sources.$inferInsert)["fetchStatus"]; contentHash: string | null; idOverride?: string }
): Promise<void> {
  const canonical = canonicalizeUrl(rawUrl);
  const existing = await db.select().from(sources).where(eq(sources.canonicalUrl, canonical));
  const now = new Date();
  if (existing[0]) {
    await db
      .update(sources)
      .set({
        lastFetchedAt: now,
        fetchStatus: opts.fetchStatus,
        contentHash: opts.contentHash ?? existing[0].contentHash,
        // Reconciliation needs this metadata to survive past the run that
        // first saw it — keep it current on every re-observation.
        wireService: meta.wireService ?? existing[0].wireService,
        wireItemId: meta.wireItemId ?? existing[0].wireItemId,
        canonicalPublisherItemId: meta.canonicalPublisherItemId ?? existing[0].canonicalPublisherItemId,
        syndicatedFromUrl: meta.syndicatedFromUrl ?? existing[0].syndicatedFromUrl
      })
      .where(eq(sources.id, existing[0].id));
    return;
  }
  await db
    .insert(sources)
    .values({
      id: opts.idOverride ?? newId(),
      canonicalUrl: canonical,
      domain: new URL(canonical).hostname,
      sourceType: meta.sourceType,
      publisher: meta.publisher ?? null,
      title: meta.title ?? null,
      publishedAt: meta.publishedAt ?? null,
      firstFetchedAt: now,
      lastFetchedAt: now,
      fetchStatus: opts.fetchStatus,
      contentHash: opts.contentHash,
      wireService: meta.wireService ?? null,
      wireItemId: meta.wireItemId ?? null,
      canonicalPublisherItemId: meta.canonicalPublisherItemId ?? null,
      syndicatedFromUrl: meta.syndicatedFromUrl ?? null
    })
    .onConflictDoNothing({ target: sources.canonicalUrl });
}
