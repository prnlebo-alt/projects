import type { Database } from "@mi/db";
import type { BrowserNavigateRequest, BrowserResult } from "@mi/schemas";
import type { BrowserAdapter } from "../browser/types.js";
import { evaluateAccessPolicyWithAudit } from "./gate.js";

/**
 * Browser-navigation counterpart to AccessPolicyGatedFetchAdapter (defect
 * #1: "structural for all fetch/browser operations"). Phase 1's pipeline
 * does not yet drive browser navigation, but the same structural guarantee
 * — the policy gate cannot be skipped by a caller that only holds this
 * wrapper — must exist for the browser path too, ready for whenever it is
 * wired in.
 */
export class AccessPolicyGatedBrowserAdapter implements BrowserAdapter {
  readonly providerName: string;

  constructor(
    private readonly db: Database,
    private readonly inner: BrowserAdapter
  ) {
    this.providerName = `access-policy-gated(${inner.providerName})`;
  }

  async navigate(request: BrowserNavigateRequest): Promise<BrowserResult> {
    const decision = await evaluateAccessPolicyWithAudit(this.db, request.url, "browser");
    if (decision.result !== "allow") {
      return {
        url: request.url,
        status: "denied",
        visibleText: null,
        screenshotLocation: null,
        fetchedAt: new Date().toISOString(),
        accessPolicyResult: decision.result
      };
    }
    const result = await this.inner.navigate(request);
    return { ...result, accessPolicyResult: "allow" };
  }

  async close(): Promise<void> {
    await this.inner.close();
  }
}
