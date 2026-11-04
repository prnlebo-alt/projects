import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/market_intelligence_test";

const { getDb, schema } = await import("@mi/db");
const { FakeModelAdapter } = await import("@mi/models");
const { getPromptVersion } = await import("@mi/prompts");
const { materialityRecall, vendorSelfInterestLabelingAccuracy, sourceFamilyAccuracy } = await import(
  "./metrics.js"
);
const { familyLabelPairs } = await import("../fixtures/familyLabelPairs.js");

describe("Phase 1 benchmark metrics (BENCHMARK.md gates)", () => {
  it("materiality recall >= 95% on the labeled corpus", async () => {
    const db = getDb();
    const rules = await db.select().from(schema.materialitySensitivityRules);
    const result = materialityRecall(rules);
    expect(result.pass).toBe(true);
    expect(result.value).toBeGreaterThanOrEqual(0.95);
  });

  it("vendor/self-interest labeling accuracy >= 95%", async () => {
    const adapter = new FakeModelAdapter();
    const result = await vendorSelfInterestLabelingAccuracy(async (sourceType) => {
      const response = await adapter.propose({
        task: "classify_evidence_class",
        promptVersion: getPromptVersion("classify_evidence_class"),
        input: { sourceType }
      });
      return response.output["evidenceClass"] as string;
    });
    expect(result.pass).toBe(true);
    expect(result.value).toBeGreaterThanOrEqual(0.95);
  });

  it("syndicated-vs-independent source-family accuracy >= 90%", () => {
    const result = sourceFamilyAccuracy(familyLabelPairs);
    expect(result.pass).toBe(true);
    expect(result.value).toBeGreaterThanOrEqual(0.9);
  });
});
