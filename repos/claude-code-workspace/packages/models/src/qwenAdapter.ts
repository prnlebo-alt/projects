import type { ModelRequest, ModelResponse } from "@mi/schemas";
import type { ModelAdapter } from "./types.js";

/**
 * Qwen-class adapter stub. NOT required for and NOT used by core Phase 1
 * tests/implementation (CLAUDE.md: "Do not request Qwen or other
 * paid-provider credentials for core Phase 1 implementation/tests").
 *
 * The config path exists so a later phase can flip MODEL_ADAPTER=qwen
 * without touching any caller — but constructing this adapter without a
 * QWEN_API_KEY throws immediately and explains why, instead of silently
 * falling back to fake behavior.
 */
export class QwenAdapter implements ModelAdapter {
  readonly providerName = "qwen";
  readonly modelName: string;

  constructor(private readonly config: { apiKey?: string; baseUrl?: string; modelName?: string }) {
    if (!config.apiKey) {
      throw new Error(
        "QwenAdapter requires QWEN_API_KEY. Phase 1 does not require this adapter — " +
          "use MODEL_ADAPTER=fake (the default) unless you are intentionally testing a " +
          "later-phase paid-provider integration with an authorized key."
      );
    }
    this.modelName = config.modelName ?? "qwen-plus";
  }

  async propose(request: ModelRequest): Promise<ModelResponse> {
    throw new Error(
      `QwenAdapter.propose("${request.task}") is not implemented in Phase 1. ` +
        "Real Qwen HTTP integration is out of scope until a later phase explicitly " +
        "authorizes paid-provider credentials."
    );
  }
}
