import { sha256Hex } from "@mi/schemas";
import type { ModelProposalTask } from "@mi/schemas";
import { PROMPT_TEMPLATES } from "./templates.js";

/**
 * Deterministic content hash of a prompt template, keyed by task. Stored in
 * `agent_runs.prompt_content_hash` so every model-produced artifact is
 * auditable to the exact wording used (ARCHITECTURE.md §22).
 */
export function getPromptContentHash(task: ModelProposalTask): string {
  const entry = PROMPT_TEMPLATES[task];
  return sha256Hex(`${entry.version}\n${entry.template}`);
}

export function getPromptVersion(task: ModelProposalTask): string {
  return PROMPT_TEMPLATES[task].version;
}
