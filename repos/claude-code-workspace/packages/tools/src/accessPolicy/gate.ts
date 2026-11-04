import type { Database } from "@mi/db";
import { accessPolicyRegistry } from "@mi/db";
import { writeAuditEvent } from "@mi/db";
import type { AccessPolicyResult } from "@mi/schemas";
import { defaultRobotsPolicyResolver, type RobotsPolicyResolver } from "./robotsPolicy.js";

export interface AccessPolicyDecision {
  result: AccessPolicyResult;
  matchedDomainPattern: string | null;
  reason: string;
}

/**
 * ARCHITECTURE.md §11 — deterministic pre-fetch access-policy gate.
 *
 * This function's signature deliberately accepts no model input of any
 * kind. There is nothing for a model to override: the decision is a pure
 * function of the domain and the human-administered
 * `access_policy_registry` table. A domain with no matching rule fails
 * closed to `manual_policy_required` rather than silently allowing fetch —
 * "legal ambiguity is not automatically interpreted by an LLM"
 * (ARCHITECTURE.md §11).
 *
 * Defect #7 (Phase 1 independent review): `robots_mode`, `auth_required`,
 * and the ToS/access-control note must *participate* in the decision, not
 * merely exist as schema fields a human is trusted to have already folded
 * into `fetch_policy`/`browser_policy` correctly. So this function never
 * trusts a stored "allow" at face value when either of those two fields
 * signals a restriction: it independently caps the decision down to
 * `manual_policy_required` unless a human reviewer is on record
 * (`reviewed_by`/`reviewed_at` both set) for that exact rule. A registry row
 * that requires auth, or whose robots_mode is "respect"/"override_authorized",
 * can therefore never resolve to "allow" on the strength of a merely
 * *stored* fetch_policy value alone — it needs an actual recorded review.
 */
export async function evaluateAccessPolicy(
  db: Database,
  url: string,
  mode: "fetch" | "browser",
  robotsResolver: RobotsPolicyResolver = defaultRobotsPolicyResolver
): Promise<AccessPolicyDecision> {
  const domain = extractDomain(url);
  const rules = await db.select().from(accessPolicyRegistry);

  const now = new Date();
  const candidates = rules.filter(
    (rule) => matchesDomainPattern(domain, rule.domainPattern) && !isExpired(rule.expiresAt, now)
  );

  // Most specific pattern wins (exact match over wildcard) when multiple rules match.
  candidates.sort((a, b) => specificity(b.domainPattern) - specificity(a.domainPattern));
  const matched = candidates[0];

  if (!matched) {
    return {
      result: "manual_policy_required",
      matchedDomainPattern: null,
      reason: `No access_policy_registry rule matches domain "${domain}"; failing closed.`
    };
  }

  const storedDecision = mode === "fetch" ? matched.fetchPolicy : matched.browserPolicy;
  const rawResult: AccessPolicyResult =
    storedDecision === "allow" ? "allow" : storedDecision === "deny" ? "deny" : "manual_policy_required";

  // Defect #3 (second review round): robots_mode="respect" now actually
  // consults a robots directive instead of only capping an unreviewed
  // "allow". Only matters when the stored decision would otherwise be
  // "allow" — an already-deny/manual_review row can't get more restrictive,
  // and robots ambiguity must never *loosen* an existing hard deny.
  // Disallow overrides an allow to a hard stop; ambiguous fails closed
  // regardless of review — a human reviewing the domain in general does not
  // know this path's live robots state.
  if (rawResult === "allow" && matched.robotsMode === "respect") {
    const directive = await robotsResolver.resolve(url);
    if (directive === "disallow") {
      return {
        result: "deny",
        matchedDomainPattern: matched.domainPattern,
        reason: `Rule "${matched.domainPattern}" is robots_mode=respect and the robots resolver returned disallow for this URL.`
      };
    }
    if (directive === "unavailable") {
      return {
        result: "manual_policy_required",
        matchedDomainPattern: matched.domainPattern,
        reason: `Rule "${matched.domainPattern}" is robots_mode=respect but the robots directive is unavailable/ambiguous; failing closed.`
      };
    }
    // directive === "allow" falls through to the existing review-gated logic below.
  }

  const reviewed = Boolean(matched.reviewedBy) && matched.reviewedAt !== null;
  const requiresReviewToAllow =
    matched.authRequired || matched.robotsMode === "respect" || matched.robotsMode === "override_authorized";

  if (rawResult === "allow" && requiresReviewToAllow && !reviewed) {
    const reasonParts = [
      matched.authRequired ? "auth_required=true" : null,
      matched.robotsMode !== "not_applicable" ? `robots_mode=${matched.robotsMode}` : null
    ].filter((p): p is string => p !== null);
    return {
      result: "manual_policy_required",
      matchedDomainPattern: matched.domainPattern,
      reason:
        `Rule "${matched.domainPattern}" is stored as ${mode}_policy=allow but ` +
        `${reasonParts.join(", ")} with no recorded review (reviewed_by/reviewed_at); ` +
        "capping to manual_policy_required rather than trusting the stored value."
    };
  }

  return {
    result: rawResult,
    matchedDomainPattern: matched.domainPattern,
    reason: `Matched rule "${matched.domainPattern}" (${mode}_policy=${storedDecision}, robots_mode=${matched.robotsMode}, auth_required=${matched.authRequired}, reviewed=${reviewed}).`
  };
}

/**
 * Evaluates policy and writes an audit_events row recording the decision.
 * `modelSuggestion` is accepted only so callers can log what a model
 * proposed for comparison; it is never read to influence `result`.
 */
export async function evaluateAccessPolicyWithAudit(
  db: Database,
  url: string,
  mode: "fetch" | "browser",
  modelSuggestion?: AccessPolicyResult,
  robotsResolver: RobotsPolicyResolver = defaultRobotsPolicyResolver
): Promise<AccessPolicyDecision> {
  const decision = await evaluateAccessPolicy(db, url, mode, robotsResolver);
  await writeAuditEvent(db, {
    actorType: "deterministic_service",
    actorId: "access-policy-gate",
    eventType: "access_policy_evaluated",
    objectType: "url",
    objectId: url,
    payload: {
      mode,
      result: decision.result,
      matchedDomainPattern: decision.matchedDomainPattern,
      reason: decision.reason,
      // Recorded for audit only. The model's opinion never changes `result`
      // above — it is already final by the time this payload is built.
      modelSuggestionIgnored: modelSuggestion ?? null
    }
  });
  return decision;
}

function extractDomain(url: string): string {
  return new URL(url).hostname.toLowerCase();
}

function matchesDomainPattern(domain: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(2).toLowerCase();
    return domain === suffix || domain.endsWith(`.${suffix}`);
  }
  return domain === pattern.toLowerCase();
}

function specificity(pattern: string): number {
  return pattern.startsWith("*.") ? 0 : 1;
}

function isExpired(expiresAt: Date | null, now: Date): boolean {
  return expiresAt !== null && expiresAt.getTime() < now.getTime();
}
