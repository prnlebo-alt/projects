import type { SearchFixtureEntry, FetchFixtureEntry } from "@mi/tools";
import type { DiscoverySourceMeta } from "@mi/agents";

/**
 * Frozen Phase 1 labeled corpus (BENCHMARK.md Test A). Every fixture below
 * is deliberately labeled with its expected evidence class, materiality,
 * and family relationship so the benchmark can measure recall/accuracy
 * against ground truth instead of asserting on prose.
 *
 * Fixture source content is semi-structured ("Key: value" per line) so a
 * deterministic (non-LLM) extractor can atomize it — see
 * packages/models/src/fakeModelAdapter.ts.
 */

const NOW = new Date("2026-08-20T00:00:00Z");

export const ACME_VENDOR_URL = "https://acme.example.com/finance-agent/pricing";
export const ACME_ANALYST_URL = "https://forrester.example.com/reports/acme-finance-agent";
export const ACME_WIRE_A_URL = "https://prnewswire.example.com/acme-launch";
export const ACME_WIRE_B_URL = "https://businesswire.example.com/acme-launch-copy";
export const ACME_MARKETING_URL = "https://acme.example.com/blog/why-choose-us";
export const UNFIXTURED_URL = "https://acme.example.com/does-not-exist-in-fixtures";

export const searchFixtures: SearchFixtureEntry[] = [
  {
    query: "acme finance agent pricing",
    results: [
      { url: ACME_VENDOR_URL, title: "Acme Finance Agent — Pricing", snippet: null, publishedAt: null },
      {
        url: ACME_ANALYST_URL,
        title: "Forrester: Acme Finance Agent Review",
        snippet: null,
        publishedAt: null
      },
      { url: ACME_MARKETING_URL, title: "Why choose Acme", snippet: null, publishedAt: null },
      // A URL search "found" but never fixtured in fetch — must never become
      // an accepted source (fabricated/unreachable URL rejection).
      { url: UNFIXTURED_URL, title: "Suspicious result", snippet: null, publishedAt: null }
    ]
  },
  {
    query: "acme robotics launch announcement",
    results: [
      { url: ACME_WIRE_A_URL, title: "Acme Robotics Launch", snippet: null, publishedAt: null },
      { url: ACME_WIRE_B_URL, title: "Acme Robotics Launch (syndicated)", snippet: null, publishedAt: null }
    ]
  }
];

export const fetchFixtures: FetchFixtureEntry[] = [
  {
    url: ACME_VENDOR_URL,
    rawContent: [
      "PRICING_MODEL: $1200 per month for the standard tier",
      "MATURITY_STATE: GA",
      "AVAILABILITY_STATUS: Available now via Salesforce AppExchange",
      "CAPABILITY_SUPPORT_COLLECTIONS: Full automated collections workflow"
    ].join("\n")
  },
  {
    url: ACME_ANALYST_URL,
    rawContent: [
      "MATURITY_STATE: GA",
      "POSITIONING_STATEMENT: Acme is positioned as a challenger in the agentic collections space",
      "BUYER_FIT_ROLE: CFO and Controller are the primary buyers"
    ].join("\n")
  },
  {
    url: ACME_MARKETING_URL,
    rawContent: [
      "POSITIONING_STATEMENT: We are the best finance agent on the market",
      "HIRING_SIGNAL: We are hiring 10 new engineers this quarter"
    ].join("\n")
  },
  {
    url: ACME_WIRE_A_URL,
    rawContent:
      'PARTNERSHIP_ANNOUNCED: Acme Robotics announced a partnership with Salesforce today. ' +
      '"This changes everything for revenue teams" said CEO Jane Doe.',
    httpStatus: 200
  },
  {
    url: ACME_WIRE_B_URL,
    rawContent:
      '(BUSINESS WIRE) -- PARTNERSHIP_ANNOUNCED: Acme Robotics announced a partnership with Salesforce today. ' +
      '"This changes everything for revenue teams" said CEO Jane Doe. Distributed via wire service.',
    httpStatus: 200
  }
  // UNFIXTURED_URL intentionally has no fetch fixture entry.
];

export const metaByUrl: Record<string, DiscoverySourceMeta> = {
  [ACME_VENDOR_URL]: {
    subjectType: "product",
    subjectId: "acme-finance-agent",
    sourceType: "vendor_documentation",
    publisher: "Acme Robotics",
    publishedAt: NOW,
    interestFlags: ["subject_owned"]
  },
  [ACME_ANALYST_URL]: {
    subjectType: "product",
    subjectId: "acme-finance-agent",
    sourceType: "analyst_report",
    publisher: "Forrester",
    publishedAt: NOW
  },
  [ACME_MARKETING_URL]: {
    subjectType: "product",
    subjectId: "acme-finance-agent",
    sourceType: "marketing_page",
    publisher: "Acme Robotics",
    publishedAt: NOW,
    interestFlags: ["subject_owned"]
  },
  [ACME_WIRE_A_URL]: {
    subjectType: "product",
    subjectId: "acme-finance-agent",
    sourceType: "launch_announcement",
    publisher: "PR Newswire",
    publishedAt: NOW,
    wireService: "PR Newswire",
    wireItemId: "pnw-2026-08-acme-robotics-launch"
  },
  [ACME_WIRE_B_URL]: {
    subjectType: "product",
    subjectId: "acme-finance-agent",
    sourceType: "launch_announcement",
    publisher: "Business Wire",
    publishedAt: NOW,
    wireService: "PR Newswire",
    wireItemId: "pnw-2026-08-acme-robotics-launch"
  }
};

export function resolveMeta(url: string): DiscoverySourceMeta | null {
  return metaByUrl[url] ?? null;
}

/** Ground truth: predicate -> expected materiality, for the recall benchmark. */
export const materialityLabels: Array<{ predicate: string; expectedMaterial: boolean }> = [
  { predicate: "pricing_model", expectedMaterial: true },
  { predicate: "pricing_tier_standard", expectedMaterial: true },
  { predicate: "maturity_state", expectedMaterial: true },
  { predicate: "availability_status", expectedMaterial: true },
  { predicate: "buyer_fit_role", expectedMaterial: true },
  { predicate: "capability_support_collections", expectedMaterial: true },
  { predicate: "partnership_announced", expectedMaterial: true },
  { predicate: "acquisition_completed", expectedMaterial: true },
  { predicate: "positioning_statement", expectedMaterial: false },
  { predicate: "hiring_signal", expectedMaterial: false }
];

/** Ground truth: sourceType -> whether the correct evidence class is vendor/self-interested. */
export const vendorLabelingCorpus: Array<{ sourceType: string; expectedSelfInterested: boolean }> = [
  { sourceType: "audited_report", expectedSelfInterested: false },
  { sourceType: "customer_testimonial", expectedSelfInterested: false },
  { sourceType: "analyst_report", expectedSelfInterested: false },
  { sourceType: "implementation_partner_case_study", expectedSelfInterested: false },
  { sourceType: "vendor_documentation", expectedSelfInterested: true },
  { sourceType: "vendor_case_study", expectedSelfInterested: true },
  { sourceType: "marketing_page", expectedSelfInterested: true }
];

const SELF_INTERESTED_EVIDENCE_CLASSES = new Set([
  "vendor_primary_documentation",
  "vendor_case_study_outcome",
  "demo_roadmap_announcement",
  "marketing_only_assertion"
]);

export function isSelfInterestedEvidenceClass(evidenceClass: string): boolean {
  return SELF_INTERESTED_EVIDENCE_CLASSES.has(evidenceClass);
}
