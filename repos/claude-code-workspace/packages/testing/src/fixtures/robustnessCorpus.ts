import type { SearchFixtureEntry, FetchFixtureEntry } from "@mi/tools";
import type { DiscoverySourceMeta } from "@mi/agents";

/**
 * Dedicated, isolated fixture corpus for the Phase 1 review-fix regression
 * suite (packages/testing/src/benchmark/robustness.integration.test.ts):
 * rerun idempotency, overlapping-query URL dedup, independent-source
 * corroboration, syndicated non-corroboration, and stale-evidence
 * freshness decay.
 *
 * Kept entirely separate from fixtures/corpus.ts (and its "acme-finance-
 * agent" subject) so these tests never depend on — or risk destabilizing —
 * the confidence math the main Phase 1 gate suite asserts on.
 */

const NOW = new Date("2026-08-20T00:00:00Z");
// Comfortably past 2x the 14-day pricing TTL relative to "now" at test time.
const STALE_PUBLISHED_AT = new Date("2025-11-01T00:00:00Z");

export const WIDGETCO_VENDOR_URL = "https://widgetco.example.com/agent/maturity";
export const WIDGETCO_ANALYST_URL = "https://analysthouse.example.com/reports/widgetco-agent";
export const WIDGETCO_SYNDICATED_A_URL = "https://mirror-a.example.com/widgetco-pricing";
export const WIDGETCO_SYNDICATED_B_URL = "https://mirror-b.example.com/widgetco-pricing-copy";
export const WIDGETCO_STALE_PRICING_URL = "https://widgetco.example.com/agent/pricing-archive";
export const WIDGETCO_OVERLAP_URL = "https://widgetco.example.com/agent/overview";

// Incremental cross-run source-family reconciliation fixtures (second
// review round, defect #1). INCREMENTALCO_ORIGINAL is discovered in "Run 1";
// INCREMENTALCO_SYNDICATED (an explicit syndicated copy) and
// INCREMENTALCO_INDEPENDENT (a genuinely unrelated source, same fact,
// deliberately dissimilar prose so it never accidentally trips rule 3/4)
// are each discovered alone in their own later run.
export const INCREMENTALCO_ORIGINAL_URL = "https://incrementalco.example.com/agent/pricing-original";
export const INCREMENTALCO_SYNDICATED_URL = "https://mirror-incremental.example.com/agent/pricing-copy";
export const INCREMENTALCO_INDEPENDENT_URL = "https://independent-analyst.example.com/incrementalco-review";

export const INCREMENTAL_ORIGINAL_QUERY = "incrementalco agent pricing original";
export const INCREMENTAL_SYNDICATED_QUERY = "incrementalco agent pricing syndicated copy";
export const INCREMENTAL_INDEPENDENT_QUERY = "incrementalco agent independent analyst review";

// Family-merge confidence-recomputation fixtures (third review round,
// defect: stale confidence after a merge). Source A and Source B each
// support Claim X ("pricing_model" = "$650 per month") from genuinely
// independent families across Run 1 / Run 2. Source C, in Run 3, deliberately
// carries no PRICING_MODEL line at all — it exists only to deterministically
// bridge A and B: C shares wireService+wireItemId with A (rule 2) and
// explicitly declares itself syndicated from B (rule 5), so union-find
// merges A's and B's previously-separate persisted families into one.
export const FAMILY_MERGE_A_URL = "https://familymergeco.example.com/pricing-source-a";
export const FAMILY_MERGE_B_URL = "https://independent-b.example.com/familymergeco-pricing-review";
export const FAMILY_MERGE_C_URL = "https://wire-distributor.example.com/familymergeco-origin-notice";

export const FAMILY_MERGE_A_QUERY = "familymergeco pricing source a";
export const FAMILY_MERGE_B_QUERY = "familymergeco pricing independent source b";
export const FAMILY_MERGE_C_QUERY = "familymergeco wire distribution origin notice";

const FAMILY_MERGE_WIRE_SERVICE = "Global Wire Distribution";
const FAMILY_MERGE_WIRE_ITEM_ID = "gwd-2026-familymergeco-origin";

export const MATURITY_QUERY = "widgetco agent maturity";
export const SYNDICATED_PRICING_QUERY = "widgetco agent pricing syndicated";
export const STALE_PRICING_QUERY = "widgetco agent stale pricing archive";
export const OVERLAP_QUERY_A = "widgetco agent overview A";
export const OVERLAP_QUERY_B = "widgetco agent overview B";

export const searchFixtures: SearchFixtureEntry[] = [
  {
    query: MATURITY_QUERY,
    results: [
      { url: WIDGETCO_VENDOR_URL, title: "WidgetCo Agent", snippet: null, publishedAt: null },
      { url: WIDGETCO_ANALYST_URL, title: "Analyst review of WidgetCo Agent", snippet: null, publishedAt: null }
    ]
  },
  {
    query: SYNDICATED_PRICING_QUERY,
    results: [
      { url: WIDGETCO_SYNDICATED_A_URL, title: "WidgetCo pricing wire item", snippet: null, publishedAt: null },
      { url: WIDGETCO_SYNDICATED_B_URL, title: "WidgetCo pricing wire item (mirror)", snippet: null, publishedAt: null }
    ]
  },
  {
    query: STALE_PRICING_QUERY,
    results: [{ url: WIDGETCO_STALE_PRICING_URL, title: "Archived WidgetCo pricing", snippet: null, publishedAt: null }]
  },
  // Two DIFFERENT queries, same URL — the overlapping-query dedup case.
  {
    query: OVERLAP_QUERY_A,
    results: [{ url: WIDGETCO_OVERLAP_URL, title: "WidgetCo overview", snippet: null, publishedAt: null }]
  },
  {
    query: OVERLAP_QUERY_B,
    results: [{ url: WIDGETCO_OVERLAP_URL, title: "WidgetCo overview (found again)", snippet: null, publishedAt: null }]
  },
  {
    query: INCREMENTAL_ORIGINAL_QUERY,
    results: [{ url: INCREMENTALCO_ORIGINAL_URL, title: "IncrementalCo pricing", snippet: null, publishedAt: null }]
  },
  {
    query: INCREMENTAL_SYNDICATED_QUERY,
    results: [
      { url: INCREMENTALCO_SYNDICATED_URL, title: "IncrementalCo pricing (mirror)", snippet: null, publishedAt: null }
    ]
  },
  {
    query: INCREMENTAL_INDEPENDENT_QUERY,
    results: [
      { url: INCREMENTALCO_INDEPENDENT_URL, title: "Independent review of IncrementalCo", snippet: null, publishedAt: null }
    ]
  },
  {
    query: FAMILY_MERGE_A_QUERY,
    results: [{ url: FAMILY_MERGE_A_URL, title: "FamilyMergeCo pricing (Source A)", snippet: null, publishedAt: null }]
  },
  {
    query: FAMILY_MERGE_B_QUERY,
    results: [
      { url: FAMILY_MERGE_B_URL, title: "Independent review of FamilyMergeCo (Source B)", snippet: null, publishedAt: null }
    ]
  },
  {
    query: FAMILY_MERGE_C_QUERY,
    results: [
      { url: FAMILY_MERGE_C_URL, title: "Wire distribution origin notice", snippet: null, publishedAt: null }
    ]
  }
];

export const fetchFixtures: FetchFixtureEntry[] = [
  { url: WIDGETCO_VENDOR_URL, rawContent: "MATURITY_STATE: GA" },
  { url: WIDGETCO_ANALYST_URL, rawContent: "MATURITY_STATE: GA" },
  { url: WIDGETCO_SYNDICATED_A_URL, rawContent: "PRICING_MODEL: $500 per month" },
  { url: WIDGETCO_SYNDICATED_B_URL, rawContent: "PRICING_MODEL: $500 per month" },
  { url: WIDGETCO_STALE_PRICING_URL, rawContent: "PRICING_MODEL: $999 per month legacy tier" },
  { url: WIDGETCO_OVERLAP_URL, rawContent: "POSITIONING_STATEMENT: WidgetCo leads the market" },
  { url: INCREMENTALCO_ORIGINAL_URL, rawContent: "PRICING_MODEL: $750 per month" },
  { url: INCREMENTALCO_SYNDICATED_URL, rawContent: "PRICING_MODEL: $750 per month" },
  {
    url: INCREMENTALCO_INDEPENDENT_URL,
    rawContent:
      "An independent analyst spent several weeks separately evaluating IncrementalCo's roadmap, " +
      "support quality and competitive position before publishing this unrelated write-up.\n" +
      "PRICING_MODEL: $750 per month"
  },
  { url: FAMILY_MERGE_A_URL, rawContent: "PRICING_MODEL: $650 per month" },
  {
    url: FAMILY_MERGE_B_URL,
    rawContent:
      "An independent analyst spent several weeks separately evaluating FamilyMergeCo's roadmap, " +
      "support quality and competitive position before publishing this unrelated write-up.\n" +
      "PRICING_MODEL: $650 per month"
  },
  {
    url: FAMILY_MERGE_C_URL,
    // Deliberately no "Key: value" line at all — Claim X never appears here.
    rawContent: "Distribution confirmation notice establishing shared release origin for prior FamilyMergeCo pricing reports."
  }
];

export const metaByUrl: Record<string, DiscoverySourceMeta> = {
  [WIDGETCO_VENDOR_URL]: {
    subjectType: "product",
    subjectId: "widgetco-agent",
    sourceType: "vendor_documentation",
    publisher: "WidgetCo",
    publishedAt: NOW,
    interestFlags: ["subject_owned"]
  },
  [WIDGETCO_ANALYST_URL]: {
    subjectType: "product",
    subjectId: "widgetco-agent",
    sourceType: "analyst_report",
    publisher: "Analyst House",
    publishedAt: NOW
  },
  [WIDGETCO_SYNDICATED_A_URL]: {
    subjectType: "product",
    subjectId: "widgetco-agent",
    sourceType: "vendor_documentation",
    publisher: "Mirror A",
    publishedAt: NOW
  },
  [WIDGETCO_SYNDICATED_B_URL]: {
    subjectType: "product",
    subjectId: "widgetco-agent",
    sourceType: "vendor_documentation",
    publisher: "Mirror B",
    publishedAt: NOW,
    syndicatedFromUrl: WIDGETCO_SYNDICATED_A_URL
  },
  [WIDGETCO_STALE_PRICING_URL]: {
    subjectType: "product",
    subjectId: "widgetco-agent-stale",
    sourceType: "vendor_documentation",
    publisher: "WidgetCo",
    publishedAt: STALE_PUBLISHED_AT
  },
  [WIDGETCO_OVERLAP_URL]: {
    subjectType: "product",
    subjectId: "widgetco-agent",
    sourceType: "marketing_page",
    publisher: "WidgetCo",
    publishedAt: NOW
  },
  [INCREMENTALCO_ORIGINAL_URL]: {
    subjectType: "product",
    subjectId: "incrementalco-agent",
    sourceType: "vendor_documentation",
    publisher: "IncrementalCo",
    publishedAt: NOW
  },
  [INCREMENTALCO_SYNDICATED_URL]: {
    subjectType: "product",
    subjectId: "incrementalco-agent",
    sourceType: "vendor_documentation",
    publisher: "Mirror Incremental",
    publishedAt: NOW,
    syndicatedFromUrl: INCREMENTALCO_ORIGINAL_URL
  },
  [INCREMENTALCO_INDEPENDENT_URL]: {
    subjectType: "product",
    subjectId: "incrementalco-agent",
    sourceType: "analyst_report",
    publisher: "Independent Analyst",
    publishedAt: NOW
  },
  [FAMILY_MERGE_A_URL]: {
    subjectType: "product",
    subjectId: "familymergeco-agent",
    sourceType: "vendor_documentation",
    publisher: "FamilyMergeCo",
    publishedAt: NOW,
    wireService: FAMILY_MERGE_WIRE_SERVICE,
    wireItemId: FAMILY_MERGE_WIRE_ITEM_ID
  },
  [FAMILY_MERGE_B_URL]: {
    subjectType: "product",
    subjectId: "familymergeco-agent",
    sourceType: "analyst_report",
    publisher: "Independent B",
    publishedAt: NOW
  },
  [FAMILY_MERGE_C_URL]: {
    subjectType: "product",
    subjectId: "familymergeco-agent",
    sourceType: "vendor_documentation",
    publisher: "Global Wire Distribution",
    publishedAt: NOW,
    // Bridges to A via rule 2 (matching wireService + wireItemId)...
    wireService: FAMILY_MERGE_WIRE_SERVICE,
    wireItemId: FAMILY_MERGE_WIRE_ITEM_ID,
    // ...and to B via rule 5 (explicit syndication).
    syndicatedFromUrl: FAMILY_MERGE_B_URL
  }
};

export function resolveMeta(url: string): DiscoverySourceMeta | null {
  return metaByUrl[url] ?? null;
}
