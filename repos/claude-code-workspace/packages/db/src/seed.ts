import { newId, logger } from "@mi/schemas";
import { closeDb, getDb } from "./client.js";
import { accessPolicyRegistry, materialitySensitivityRules } from "./schema.js";

/**
 * Seeds the versioned, human-administered configuration tables Phase 1
 * requires:
 *  - materiality_sensitivity_rules: static predicate -> materiality mapping
 *    (ADR-002 / EVIDENCE_DOCTRINE.md — no live counterfactual scoring).
 *  - access_policy_registry: domain allow/deny/manual-review defaults for
 *    the pre-fetch gate (ARCHITECTURE.md §11 access-policy gate).
 *
 * Safe to re-run: clears and re-inserts version 1 of each table.
 */
export async function seedMateriality(): Promise<void> {
  const db = getDb();
  await db.delete(materialitySensitivityRules);
  const rows: (typeof materialitySensitivityRules.$inferInsert)[] = [
    {
      id: newId(),
      predicatePattern: "pricing",
      fieldType: "pricing",
      affectedDimensions: ["threat.competitor_velocity", "opportunity.revenue_potential"],
      affectedActionGate: true,
      material: true,
      ruleVersion: 1,
      active: true
    },
    {
      id: newId(),
      predicatePattern: "maturity",
      fieldType: "maturity",
      affectedDimensions: ["threat.maturity"],
      affectedActionGate: true,
      material: true,
      ruleVersion: 1,
      active: true
    },
    {
      id: newId(),
      predicatePattern: "availability",
      fieldType: "availability",
      affectedDimensions: ["threat.maturity"],
      affectedActionGate: true,
      material: true,
      ruleVersion: 1,
      active: true
    },
    {
      id: newId(),
      predicatePattern: "buyer_fit",
      fieldType: "buyer_fit",
      affectedDimensions: ["threat.buyer_fit"],
      affectedActionGate: true,
      material: true,
      ruleVersion: 1,
      active: true
    },
    {
      id: newId(),
      predicatePattern: "capability",
      fieldType: "capability_presence",
      affectedDimensions: ["threat.capability_overlap"],
      affectedActionGate: true,
      material: true,
      ruleVersion: 1,
      active: true
    },
    {
      id: newId(),
      predicatePattern: "partnership",
      fieldType: "partnership_acquisition",
      affectedDimensions: ["threat.distribution_reach"],
      affectedActionGate: true,
      material: true,
      ruleVersion: 1,
      active: true
    },
    {
      id: newId(),
      predicatePattern: "acquisition",
      fieldType: "partnership_acquisition",
      affectedDimensions: ["threat.distribution_reach"],
      affectedActionGate: true,
      material: true,
      ruleVersion: 1,
      active: true
    },
    {
      id: newId(),
      predicatePattern: "positioning",
      fieldType: "positioning",
      affectedDimensions: [],
      affectedActionGate: false,
      material: false,
      ruleVersion: 1,
      active: true
    },
    {
      id: newId(),
      predicatePattern: "hiring",
      fieldType: "hiring",
      affectedDimensions: [],
      affectedActionGate: false,
      material: false,
      ruleVersion: 1,
      active: true
    }
  ];
  await db.insert(materialitySensitivityRules).values(rows);
  logger.info("seeded materiality_sensitivity_rules", { count: rows.length });
}

export async function seedAccessPolicy(): Promise<void> {
  const db = getDb();
  await db.delete(accessPolicyRegistry);
  const rows: (typeof accessPolicyRegistry.$inferInsert)[] = [
    {
      id: newId(),
      domainPattern: "*.example.com",
      fetchPolicy: "allow",
      browserPolicy: "allow",
      authRequired: false,
      // Generic fixture domain used pervasively across unrelated pipeline
      // tests — robots semantics are exercised only by the dedicated
      // robots-*.example.com / reviewed-auth.example.com fixtures below, so
      // this stays "not_applicable" rather than dragging every unrelated
      // caller into supplying a robots resolver.
      robotsMode: "not_applicable",
      tosNote: "Fixture domain used for Phase 1 tests.",
      reviewedBy: "phase1-seed",
      reviewedAt: new Date(),
      expiresAt: null
    },
    {
      id: newId(),
      domainPattern: "blocked.example.com",
      fetchPolicy: "deny",
      browserPolicy: "deny",
      authRequired: false,
      robotsMode: "respect",
      tosNote: "Explicitly denied fixture domain for policy-gate tests.",
      reviewedBy: "phase1-seed",
      reviewedAt: new Date(),
      expiresAt: null
    },
    {
      id: newId(),
      domainPattern: "authwall.example.com",
      fetchPolicy: "manual_review",
      browserPolicy: "manual_review",
      authRequired: true,
      robotsMode: "not_applicable",
      tosNote: "Authenticated source; requires human-administered policy review before fetch.",
      reviewedBy: null,
      reviewedAt: null,
      expiresAt: null
    },
    {
      id: newId(),
      domainPattern: "misconfigured-auth.example.com",
      // Defect #7 regression fixture: fetch_policy is (incorrectly) "allow"
      // even though this domain requires auth and has never been reviewed.
      // The gate must cap this to manual_policy_required regardless — see
      // gate.test.ts "caps a misconfigured auth-required allow rule...".
      fetchPolicy: "allow",
      browserPolicy: "allow",
      authRequired: true,
      robotsMode: "not_applicable",
      tosNote: "Regression fixture: auth_required=true must cap allow, even if fetch_policy says allow.",
      reviewedBy: null,
      reviewedAt: null,
      expiresAt: null
    },
    {
      id: newId(),
      domainPattern: "unreviewed-robots-override.example.com",
      // Defect #7 regression fixture: robots_mode claims an authorized
      // override, but nobody has actually reviewed/recorded that
      // authorization — the gate must not trust the bare enum value.
      fetchPolicy: "allow",
      browserPolicy: "allow",
      authRequired: false,
      robotsMode: "override_authorized",
      tosNote: "Regression fixture: an unreviewed robots override must not resolve to allow.",
      reviewedBy: null,
      reviewedAt: null,
      expiresAt: null
    },
    {
      id: newId(),
      domainPattern: "reviewed-auth.example.com",
      // Positive counterpart: auth_required=true, but a human reviewer is
      // on record — the gate must genuinely allow this, proving the field
      // participates both ways rather than always failing closed.
      fetchPolicy: "allow",
      browserPolicy: "allow",
      authRequired: true,
      robotsMode: "respect",
      tosNote: "Regression fixture: reviewed auth-required domain — allow should stand.",
      reviewedBy: "phase1-seed",
      reviewedAt: new Date(),
      expiresAt: null
    },
    {
      id: newId(),
      domainPattern: "robots-disallow.example.com",
      // Defect #3 (second review round) regression fixture: robots_mode is
      // "respect" and the FixtureRobotsPolicyResolver used in
      // gate.test.ts/gatedFetchAdapter.test.ts returns "disallow" for this
      // domain — the gate must deny regardless of fetch_policy/review.
      fetchPolicy: "allow",
      browserPolicy: "allow",
      authRequired: false,
      robotsMode: "respect",
      tosNote: "Regression fixture: robots disallow must block fetch even when otherwise allowed/reviewed.",
      reviewedBy: "phase1-seed",
      reviewedAt: new Date(),
      expiresAt: null
    },
    {
      id: newId(),
      domainPattern: "robots-ambiguous.example.com",
      // Regression fixture: robots_mode="respect" but the resolver has no
      // entry for this domain ("unavailable") — must fail closed to
      // manual_policy_required even though reviewed, since a domain review
      // says nothing about this path's live robots state.
      fetchPolicy: "allow",
      browserPolicy: "allow",
      authRequired: false,
      robotsMode: "respect",
      tosNote: "Regression fixture: ambiguous/unavailable robots directive must fail closed.",
      reviewedBy: "phase1-seed",
      reviewedAt: new Date(),
      expiresAt: null
    }
  ];
  await db.insert(accessPolicyRegistry).values(rows);
  logger.info("seeded access_policy_registry", { count: rows.length });
}

async function main(): Promise<void> {
  await seedMateriality();
  await seedAccessPolicy();
  await closeDb();
}

const isMain = Boolean(process.argv[1]) && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    logger.error("seed failed", { error: String(err) });
    process.exitCode = 1;
  });
}
