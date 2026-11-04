import { clusterSourceFamilies, determineMateriality, type SnapshotForClustering } from "@mi/evidence";
import type { MaterialitySensitivityRule } from "@mi/schemas";
import { isSelfInterestedEvidenceClass, materialityLabels, vendorLabelingCorpus } from "../fixtures/corpus.js";

export interface MetricResult {
  name: string;
  value: number;
  thresholdDescription: string;
  pass: boolean;
  detail: string;
}

/** BENCHMARK.md gate 1 — materiality recall >= 95% on the labeled corpus. */
export function materialityRecall(rules: MaterialitySensitivityRule[]): MetricResult {
  const trulyMaterial = materialityLabels.filter((l) => l.expectedMaterial);
  const truePositives = trulyMaterial.filter(
    (l) => determineMateriality({ id: l.predicate, predicate: l.predicate }, rules, { runSeed: "benchmark" }).material
  );
  const recall = trulyMaterial.length === 0 ? 1 : truePositives.length / trulyMaterial.length;
  return {
    name: "materiality_recall",
    value: recall,
    thresholdDescription: ">= 0.95",
    pass: recall >= 0.95,
    detail: `${truePositives.length}/${trulyMaterial.length} labeled-material predicates correctly flagged material`
  };
}

/** BENCHMARK.md gate 3 — vendor/self-interested labeling accuracy >= 95%. */
export async function vendorSelfInterestLabelingAccuracy(
  classify: (sourceType: string) => Promise<string>
): Promise<MetricResult> {
  let correct = 0;
  for (const label of vendorLabelingCorpus) {
    const evidenceClass = await classify(label.sourceType);
    if (isSelfInterestedEvidenceClass(evidenceClass) === label.expectedSelfInterested) correct += 1;
  }
  const accuracy = vendorLabelingCorpus.length === 0 ? 1 : correct / vendorLabelingCorpus.length;
  return {
    name: "vendor_self_interest_labeling_accuracy",
    value: accuracy,
    thresholdDescription: ">= 0.95",
    pass: accuracy >= 0.95,
    detail: `${correct}/${vendorLabelingCorpus.length} source types correctly labeled vendor/self-interested vs not`
  };
}

export interface FamilyLabelPair {
  name: string;
  a: SnapshotForClustering;
  b: SnapshotForClustering;
  expectedSameFamily: boolean;
}

/** BENCHMARK.md gate 5 — syndicated-vs-independent source-family accuracy >= 90%. */
export function sourceFamilyAccuracy(pairs: FamilyLabelPair[]): MetricResult {
  let correct = 0;
  const mismatches: string[] = [];
  for (const pair of pairs) {
    const { families } = clusterSourceFamilies([pair.a, pair.b]);
    const actualSameFamily = families.length === 1;
    if (actualSameFamily === pair.expectedSameFamily) {
      correct += 1;
    } else {
      mismatches.push(pair.name);
    }
  }
  const accuracy = pairs.length === 0 ? 1 : correct / pairs.length;
  return {
    name: "source_family_independence_accuracy",
    value: accuracy,
    thresholdDescription: ">= 0.90",
    pass: accuracy >= 0.9,
    detail:
      `${correct}/${pairs.length} labeled pairs correctly classified as syndicated vs independent` +
      (mismatches.length > 0 ? `; mismatches: ${mismatches.join(", ")}` : "")
  };
}
