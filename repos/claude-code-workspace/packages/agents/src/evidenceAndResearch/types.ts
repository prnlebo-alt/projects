import type { Database } from "@mi/db";
import type { InterestFlag, SubjectType } from "@mi/schemas";
import type { FetchAdapter, ObjectStorage, SearchAdapter } from "@mi/tools";
import type { ModelAdapter } from "@mi/models";

export interface DiscoverySourceMeta {
  subjectType: SubjectType;
  subjectId: string;
  sourceType: string;
  publisher?: string | null;
  title?: string | null;
  publishedAt?: Date | null;
  canonicalPublisherItemId?: string | null;
  wireService?: string | null;
  wireItemId?: string | null;
  syndicatedFromUrl?: string | null;
  interestFlags?: InterestFlag[];
}

export interface PipelineAdapters {
  search: SearchAdapter;
  fetch: FetchAdapter;
  model: ModelAdapter;
  storage: ObjectStorage;
}

export interface RunEvidencePipelineInput {
  db: Database;
  adapters: PipelineAdapters;
  researchRunId: string;
  runSeed: string;
  queries: string[];
  /** Fixture-supplied classification for a discovered URL; return null to skip it. */
  resolveMeta: (url: string) => DiscoverySourceMeta | null;
}

export interface PipelineRunSummary {
  urlsDiscovered: number;
  sourcesSkippedByPolicy: number;
  sourcesFetched: number;
  snapshotsCreated: number;
  familiesCreated: number;
  claimsExtracted: number;
  claimsGroundingFailed: number;
  claimsMaterial: number;
  claimsAudited: number;
  claimsVerified: number;
  claimsVerificationFailed: number;
  claimsVerificationUnresolved: number;
  /**
   * Per-item failures that were caught and skipped rather than crashing the
   * whole run — one bad URL or one bad claim extraction must not lose
   * everything else this run already produced. A non-empty list means the
   * run is marked `research_runs.status = 'partial'` with a reason, never
   * silently reported as a clean completion (Engineering Defaults:
   * "graceful budget exhaustion... mark run `partial`").
   */
  partialFailures: Array<{ stage: "source" | "claim"; ref: string; error: string }>;
}
