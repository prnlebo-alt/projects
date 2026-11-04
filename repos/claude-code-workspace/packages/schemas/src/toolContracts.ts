import { z } from "zod";

/**
 * Provider-neutral tool contracts (ARCHITECTURE.md §11). Every adapter
 * (fixture, Playwright, a future paid provider) implements these same
 * input/output shapes so nothing above the adapter boundary needs to know
 * which provider is behind it.
 */

// --- Search adapter -------------------------------------------------------

export const searchQuerySchema = z.object({
  query: z.string().min(1),
  domainRestrict: z.array(z.string()).optional(),
  freshnessDays: z.number().int().positive().optional(),
  maxResults: z.number().int().positive().default(10)
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const searchResultSchema = z.object({
  url: z.string().url(),
  title: z.string().nullable(),
  snippet: z.string().nullable(),
  publishedAt: z.string().datetime({ offset: true }).nullable()
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  deduplicated: z.boolean()
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

// --- Fetch adapter ---------------------------------------------------------

export const fetchRequestSchema = z.object({
  url: z.string().url()
});
export type FetchRequest = z.infer<typeof fetchRequestSchema>;

export const fetchResultSchema = z.object({
  url: z.string().url(),
  status: z.enum(["ok", "not_found", "error", "denied"]),
  httpStatus: z.number().int().nullable(),
  rawContent: z.string().nullable(),
  normalizedText: z.string().nullable(),
  contentHash: z.string().nullable(),
  fetchedAt: z.string().datetime({ offset: true }),
  /**
   * Set by AccessPolicyGatedFetchAdapter (packages/tools) to the exact
   * access-policy outcome that produced this result — "deny" vs
   * "manual_policy_required" both surface as status="denied" above, so
   * callers that need to distinguish them (e.g. to set sources.fetch_status)
   * read it from here. Absent/null for an adapter that isn't gated.
   */
  accessPolicyResult: z.enum(["allow", "deny", "manual_policy_required"]).nullable().optional()
});
export type FetchResult = z.infer<typeof fetchResultSchema>;

// --- Browser adapter --------------------------------------------------------

export const browserNavigateRequestSchema = z.object({
  url: z.string().url(),
  waitForSelector: z.string().optional()
});
export type BrowserNavigateRequest = z.infer<typeof browserNavigateRequestSchema>;

export const browserResultSchema = z.object({
  url: z.string().url(),
  status: z.enum(["ok", "error", "denied"]),
  visibleText: z.string().nullable(),
  screenshotLocation: z.string().nullable(),
  fetchedAt: z.string().datetime({ offset: true }),
  /** See fetchResultSchema.accessPolicyResult — same purpose, browser path. */
  accessPolicyResult: z.enum(["allow", "deny", "manual_policy_required"]).nullable().optional()
});
export type BrowserResult = z.infer<typeof browserResultSchema>;

// --- Model adapter -----------------------------------------------------------

/** Fixed set of proposal tasks Qwen-class models are allowed to perform. */
export const modelProposalTaskSchema = z.enum([
  "atomize_claims",
  "classify_evidence_class",
  "propose_source_family_features",
  "propose_entity_normalization",
  "summarize",
  "propose_contradiction",
  "extract_from_screenshot"
]);
export type ModelProposalTask = z.infer<typeof modelProposalTaskSchema>;

export const modelRequestSchema = z.object({
  task: modelProposalTaskSchema,
  promptVersion: z.string().min(1),
  input: z.record(z.unknown()),
  /** Deterministic seed so fake/test adapters are reproducible. */
  seed: z.string().optional()
});
export type ModelRequest = z.infer<typeof modelRequestSchema>;

export const modelResponseSchema = z.object({
  task: modelProposalTaskSchema,
  provider: z.string().min(1),
  modelName: z.string().min(1),
  promptContentHash: z.string().min(1),
  output: z.record(z.unknown()),
  /** Model output is always a proposal in Phase 1 — never final authority. */
  isFinal: z.literal(false)
});
export type ModelResponse = z.infer<typeof modelResponseSchema>;
