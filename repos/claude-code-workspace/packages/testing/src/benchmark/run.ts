import { getDb, schema } from "@mi/db";
import { FakeModelAdapter } from "@mi/models";
import { getPromptVersion } from "@mi/prompts";
import { logger } from "@mi/schemas";
import { familyLabelPairs } from "../fixtures/familyLabelPairs.js";
import { materialityRecall, sourceFamilyAccuracy, vendorSelfInterestLabelingAccuracy, type MetricResult } from "./metrics.js";

/**
 * BENCHMARK.md Test A metrics, computed against the frozen labeled corpus.
 * Run standalone (`npm run benchmark`) or imported by writeGateReport.ts.
 * These are the same deterministic functions packages/evidence/testing
 * unit-test individually — this just aggregates them into gate-shaped
 * pass/fail results with a percentage.
 */
export async function runBenchmark(): Promise<MetricResult[]> {
  const db = getDb();
  const rules = await db.select().from(schema.materialitySensitivityRules);
  const adapter = new FakeModelAdapter();

  const results: MetricResult[] = [];
  results.push(materialityRecall(rules));
  results.push(
    await vendorSelfInterestLabelingAccuracy(async (sourceType) => {
      const response = await adapter.propose({
        task: "classify_evidence_class",
        promptVersion: getPromptVersion("classify_evidence_class"),
        input: { sourceType }
      });
      return response.output["evidenceClass"] as string;
    })
  );
  results.push(sourceFamilyAccuracy(familyLabelPairs));
  return results;
}

const isMain = Boolean(process.argv[1]) && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  runBenchmark()
    .then((results) => {
      for (const r of results) {
        logger.info(r.name, { value: r.value, pass: r.pass, threshold: r.thresholdDescription, detail: r.detail });
      }
      const allPass = results.every((r) => r.pass);
      process.exitCode = allPass ? 0 : 1;
    })
    .catch((err) => {
      logger.error("benchmark run failed", { error: String(err) });
      process.exitCode = 1;
    });
}
