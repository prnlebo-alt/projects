import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/market_intelligence_test";

const { getDb } = await import("./client.js");
const { writeAuditEvent } = await import("./audit.js");
const { researchRuns, materialitySensitivityRules, accessPolicyRegistry } = await import(
  "./schema.js"
);
const { newId } = await import("@mi/schemas");
const { eq } = await import("drizzle-orm");

/**
 * Integration tests against a real Postgres instance (see .env.example /
 * docker-compose.yml). This is the "true external dependency" for Phase 1 —
 * not a paid provider, just a database — and is provisioned in CI/dev via
 * docker-compose or a local Postgres install.
 */
describe("db (Postgres integration)", () => {
  beforeAll(async () => {
    // Fail fast with a clear message if Postgres isn't reachable, instead of
    // a confusing pg driver stack trace.
    const db = getDb();
    await db.select().from(researchRuns).limit(1);
  });

  it("round-trips a research_runs row", async () => {
    const db = getDb();
    const id = newId();
    await db.insert(researchRuns).values({
      id,
      objective: "test objective",
      runType: "test",
      status: "running",
      startedAt: new Date(),
      completedAt: null,
      tokenBudget: 1000,
      monetaryBudget: 1,
      sourceBudget: 10,
      partialReason: null
    });

    const rows = await db.select().from(researchRuns).where(eq(researchRuns.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.objective).toBe("test objective");
    expect(rows[0]?.status).toBe("running");
  });

  it("writes an audit event", async () => {
    const db = getDb();
    const auditId = await writeAuditEvent(db, {
      actorType: "deterministic_service",
      actorId: "test-suite",
      eventType: "test_event",
      objectType: "research_run",
      objectId: "00000000-0000-0000-0000-000000000000",
      payload: { note: "integration test" }
    });
    expect(auditId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("has seeded materiality_sensitivity_rules (from packages/db/src/seed.ts)", async () => {
    const db = getDb();
    const rows = await db.select().from(materialitySensitivityRules);
    expect(rows.length).toBeGreaterThan(0);
    const pricingRule = rows.find((r) => r.predicatePattern === "pricing");
    expect(pricingRule?.material).toBe(true);
  });

  it("has seeded access_policy_registry with an explicit deny entry", async () => {
    const db = getDb();
    const rows = await db.select().from(accessPolicyRegistry);
    const denied = rows.find((r) => r.domainPattern === "blocked.example.com");
    expect(denied?.fetchPolicy).toBe("deny");
  });
});
