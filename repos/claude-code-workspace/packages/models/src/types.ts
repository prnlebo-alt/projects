import type { ModelRequest, ModelResponse } from "@mi/schemas";

/**
 * ARCHITECTURE.md §12 — provider-neutral model adapter. No provider-specific
 * API may exist outside this package. Every response is `isFinal: false`:
 * models propose, deterministic code in packages/evidence decides.
 */
export interface ModelAdapter {
  readonly providerName: string;
  readonly modelName: string;
  propose(request: ModelRequest): Promise<ModelResponse>;
}
