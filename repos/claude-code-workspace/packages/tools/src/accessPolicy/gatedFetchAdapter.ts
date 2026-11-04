import type { Database } from "@mi/db";
import type { FetchRequest, FetchResult } from "@mi/schemas";
import type { FetchAdapter } from "../fetch/types.js";
import { evaluateAccessPolicyWithAudit } from "./gate.js";
import { defaultRobotsPolicyResolver, type RobotsPolicyResolver } from "./robotsPolicy.js";

/**
 * Defect #1 (Phase 1 independent review): access-policy enforcement must be
 * structural for *every* fetch, including the blind independent-verification
 * re-fetch, not something each call site has to remember to check first.
 *
 * This wraps any FetchAdapter so the policy gate cannot be bypassed by
 * construction: callers hold only this wrapper, never the raw inner
 * adapter, so there is no code path from pipeline code to an ungated
 * `.fetch()` call. Discovery and the Verifier Worker's blind re-fetch both
 * call the exact same `fetch()` method on the exact same instance.
 */
export class AccessPolicyGatedFetchAdapter implements FetchAdapter {
  readonly providerName: string;

  constructor(
    private readonly db: Database,
    private readonly inner: FetchAdapter,
    private readonly robotsResolver: RobotsPolicyResolver = defaultRobotsPolicyResolver
  ) {
    this.providerName = `access-policy-gated(${inner.providerName})`;
  }

  async fetch(request: FetchRequest): Promise<FetchResult> {
    const decision = await evaluateAccessPolicyWithAudit(
      this.db,
      request.url,
      "fetch",
      undefined,
      this.robotsResolver
    );
    if (decision.result !== "allow") {
      return {
        url: request.url,
        status: "denied",
        httpStatus: null,
        rawContent: null,
        normalizedText: null,
        contentHash: null,
        fetchedAt: new Date().toISOString(),
        accessPolicyResult: decision.result
      };
    }
    const result = await this.inner.fetch(request);
    return { ...result, accessPolicyResult: "allow" };
  }
}
