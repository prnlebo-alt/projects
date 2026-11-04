import { getPromptContentHash, getPromptVersion } from "@mi/prompts";
import type { ModelRequest, ModelResponse } from "@mi/schemas";
import type { ModelAdapter } from "./types.js";

/** classify_evidence_class deterministic proposal table, keyed by sourceType. */
const SOURCE_TYPE_TO_EVIDENCE_CLASS: Record<string, string> = {
  audited_report: "audited_regulatory_primary_dataset",
  customer_testimonial: "direct_customer_primary_statement",
  analyst_report: "independent_analyst_academic_research",
  implementation_partner_case_study: "implementation_partner_named_deployment",
  vendor_documentation: "vendor_primary_documentation",
  vendor_case_study: "vendor_case_study_outcome",
  launch_announcement: "demo_roadmap_announcement",
  marketing_page: "marketing_only_assertion"
};

/**
 * Deterministic, no-network ModelAdapter. Given identical input it always
 * returns identical output, so Phase 1 tests never require a paid
 * model/provider (PHASE1_BUILD_DIRECTIVE.md). Every response carries
 * `isFinal: false` — deterministic services in packages/evidence decide
 * what actually happens with the proposal.
 */
export class FakeModelAdapter implements ModelAdapter {
  readonly providerName = "fake";
  readonly modelName = "deterministic-fake-v1";

  async propose(request: ModelRequest): Promise<ModelResponse> {
    const output = this.runTask(request);
    return {
      task: request.task,
      provider: this.providerName,
      modelName: this.modelName,
      promptContentHash: getPromptContentHash(request.task),
      output,
      isFinal: false
    };
  }

  private runTask(request: ModelRequest): Record<string, unknown> {
    switch (request.task) {
      case "atomize_claims":
        return { claims: atomizeClaims(request.input) };
      case "extract_from_screenshot":
        return { claims: atomizeClaims(request.input), confidenceCeiling: 0.75 };
      case "classify_evidence_class":
        return classifyEvidenceClass(request.input);
      case "propose_source_family_features":
        return proposeSourceFamilyFeatures(request.input);
      case "propose_entity_normalization":
        return proposeEntityNormalization(request.input);
      case "summarize":
        return summarize(request.input);
      case "propose_contradiction":
        return proposeContradiction(request.input);
      default:
        return {};
    }
  }
}

interface ClaimCandidate {
  predicate: string;
  objectValue: string;
  excerptText: string;
  excerptLocation: string;
}

/**
 * Fixture source content in this codebase is deliberately semi-structured
 * (one `Key: value` fact per line) so a deterministic extractor can stand
 * in for a real LLM without loosening Phase 1's evidence guarantees — every
 * excerpt returned here is a verbatim substring of the input, which is what
 * makes it possible for the grounding gate (packages/evidence) to check it
 * at all.
 */
function atomizeClaims(input: Record<string, unknown>): ClaimCandidate[] {
  const text = typeof input["text"] === "string" ? input["text"] : "";
  const lines = text.split("\n");
  const claims: ClaimCandidate[] = [];
  lines.forEach((line, index) => {
    const match = /^\s*([A-Za-z][A-Za-z0-9_ ]*):\s*(.+?)\s*$/.exec(line);
    if (!match) return;
    const [, rawKey, value] = match;
    if (!rawKey || !value) return;
    const predicate = rawKey.trim().toLowerCase().replace(/\s+/g, "_");
    claims.push({
      predicate,
      objectValue: value.trim(),
      excerptText: line.trim(),
      excerptLocation: `line:${index}`
    });
  });
  return claims;
}

function classifyEvidenceClass(input: Record<string, unknown>): Record<string, unknown> {
  const sourceType = typeof input["sourceType"] === "string" ? input["sourceType"] : "";
  const evidenceClass = SOURCE_TYPE_TO_EVIDENCE_CLASS[sourceType] ?? "unverified_inaccessible";
  return { evidenceClass, proposalBasis: "source_type_mapping" };
}

function proposeSourceFamilyFeatures(input: Record<string, unknown>): Record<string, unknown> {
  const textA = typeof input["textA"] === "string" ? input["textA"] : "";
  const textB = typeof input["textB"] === "string" ? input["textB"] : "";
  const similarityScore = jaccardShingleSimilarity(textA, textB);
  const sharedFingerprints = sharedQuotedFingerprints(textA, textB);
  return { similarityScore, sharedFingerprints };
}

function proposeEntityNormalization(input: Record<string, unknown>): Record<string, unknown> {
  const rawName = typeof input["rawName"] === "string" ? input["rawName"] : "";
  return { normalized: rawName.trim().replace(/\s+/g, " "), aliases: [] };
}

function summarize(input: Record<string, unknown>): Record<string, unknown> {
  const text = typeof input["text"] === "string" ? input["text"] : "";
  return { summary: text.length > 200 ? `${text.slice(0, 197)}...` : text };
}

function proposeContradiction(input: Record<string, unknown>): Record<string, unknown> {
  const a = typeof input["claimAValue"] === "string" ? input["claimAValue"] : "";
  const b = typeof input["claimBValue"] === "string" ? input["claimBValue"] : "";
  return { contradicts: a.trim().toLowerCase() !== b.trim().toLowerCase() };
}

function jaccardShingleSimilarity(a: string, b: string, shingleSize = 5): number {
  const shinglesA = wordShingles(a, shingleSize);
  const shinglesB = wordShingles(b, shingleSize);
  if (shinglesA.size === 0 || shinglesB.size === 0) return 0;
  let intersection = 0;
  for (const s of shinglesA) {
    if (shinglesB.has(s)) intersection += 1;
  }
  const union = shinglesA.size + shinglesB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function wordShingles(text: string, size: number): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  const shingles = new Set<string>();
  for (let i = 0; i + size <= words.length; i += 1) {
    shingles.add(words.slice(i, i + size).join(" "));
  }
  return shingles;
}

function sharedQuotedFingerprints(a: string, b: string): string[] {
  const quotesA = new Set(extractQuoted(a));
  const quotesB = extractQuoted(b);
  return quotesB.filter((q) => quotesA.has(q));
}

function extractQuoted(text: string): string[] {
  const matches = text.match(/"([^"]{8,})"/g) ?? [];
  return matches.map((m) => m.slice(1, -1));
}

// Ensure the fixture prompt-version constant stays referenced for callers
// that want to record it alongside the hash.
export { getPromptVersion };
