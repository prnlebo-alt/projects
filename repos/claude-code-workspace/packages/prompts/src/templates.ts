import type { ModelProposalTask } from "@mi/schemas";

export interface PromptTemplate {
  version: string;
  /**
   * Template text. Model-facing wording only — never secrets, never raw
   * API keys (CLAUDE.md constitutional rule: "Secrets never enter prompts").
   */
  template: string;
}

/**
 * Versioned prompt templates for every Qwen-class proposal task
 * (ARCHITECTURE.md §12). `agent_runs.prompt_version` and
 * `prompt_content_hash` are derived from this table so every model call is
 * reproducible and auditable back to exact wording.
 */
export const PROMPT_TEMPLATES: Record<ModelProposalTask, PromptTemplate> = {
  atomize_claims: {
    version: "v1",
    template:
      "Given the normalized text of a single source snapshot, extract atomic factual " +
      "claims about the named subject. Each claim must cite the exact excerpt it came " +
      "from. Do not infer facts not present in the text. Output is a proposal only; it " +
      "cannot be treated as verified until it passes the grounding gate."
  },
  classify_evidence_class: {
    version: "v1",
    template:
      "Given a source's publisher/type metadata, propose one evidence class from the " +
      "fixed enum in EVIDENCE_DOCTRINE.md §Evidence classes. This is a proposal; " +
      "deterministic evidentiary floors (ARCHITECTURE.md §9) may override it, " +
      "particularly for GA/Packaged maturity determinations."
  },
  propose_source_family_features: {
    version: "v1",
    template:
      "Given two normalized source texts and their publication timestamps, propose " +
      "candidate shared-origin fingerprints (distinctive quote attribution, uncommon " +
      "numeric/factual fingerprint, wire marker, release identifier). Only deterministic " +
      "rules in packages/evidence finalize family membership."
  },
  propose_entity_normalization: {
    version: "v1",
    template:
      "Given a raw company/product name string, propose a normalized canonical form and " +
      "candidate aliases. Ambiguous merges are never finalized by this proposal alone."
  },
  summarize: {
    version: "v1",
    template: "Summarize the given text in at most 3 sentences, preserving named entities and figures."
  },
  propose_contradiction: {
    version: "v1",
    template:
      "Given two claims about the same subject/predicate, propose whether they " +
      "contradict. Contradictions are always retained (never silently deleted) "
      + "regardless of this proposal's confidence."
  },
  extract_from_screenshot: {
    version: "v1",
    template:
      "Given OCR/visible text captured from a screenshot, extract atomic claims as in " +
      "atomize_claims. Screenshot-only extraction has a lower confidence ceiling " +
      "(EVIDENCE_DOCTRINE.md extraction_certainty) unless independently corroborated."
  }
};
