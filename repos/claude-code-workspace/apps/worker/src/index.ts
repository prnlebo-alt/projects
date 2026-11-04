import { closeDb, getDb, schema } from "@mi/db";
import { runEvidencePipeline, type DiscoverySourceMeta } from "@mi/agents";
import { FakeModelAdapter, QwenAdapter, type ModelAdapter } from "@mi/models";
import {
  FixtureFetchAdapter,
  FixtureSearchAdapter,
  LocalObjectStorage,
  PlaywrightBrowserAdapter,
  type FetchAdapter,
  type SearchAdapter
} from "@mi/tools";
import { loadEnv, logger, newId } from "@mi/schemas";

/**
 * Market Intelligence worker process (Engineering Defaults: "Separate Node
 * worker process"). Phase 1 boundary: this runs one bounded Evidence &
 * Research pipeline pass and exits — no persistent scheduler, no
 * per-role budgets, no adaptive TTL. Those are Phase 6 (ARCHITECTURE.md
 * §19, §21 "Phase 6 required controls"); implementing them early would
 * violate CLAUDE.md's "Implement Phase 1 only."
 *
 * A real deployment wires SEARCH_ADAPTER/FETCH_ADAPTER/MODEL_ADAPTER env
 * vars to paid providers behind these same interfaces; Phase 1's default
 * (and the only path exercised by the benchmark) is fixture/fake adapters
 * with zero external calls.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const db = getDb();

  const search: SearchAdapter = new FixtureSearchAdapter([]);
  const fetch: FetchAdapter = new FixtureFetchAdapter([]);
  const model: ModelAdapter = buildModelAdapter(env.MODEL_ADAPTER, env);
  const storage = new LocalObjectStorage(env.STORAGE_LOCAL_ROOT);

  // Wired but unused unless a future queries/meta config supplies
  // JS-rendered targets — demonstrates the real Playwright adapter is a
  // first-class citizen behind BrowserAdapter, per Engineering Defaults.
  const browser = new PlaywrightBrowserAdapter();
  await browser.close();

  const researchRunId = newId();
  await db.insert(schema.researchRuns).values({
    id: researchRunId,
    objective: "Phase 1 worker demo run (no queries configured)",
    runType: "worker",
    status: "running",
    startedAt: new Date(),
    completedAt: null,
    tokenBudget: env.RUN_TOKEN_BUDGET,
    monetaryBudget: env.RUN_MONETARY_BUDGET_USD,
    sourceBudget: env.RUN_SOURCE_BUDGET,
    partialReason: null
  });

  const resolveMeta = (_url: string): DiscoverySourceMeta | null => null;

  const summary = await runEvidencePipeline({
    db,
    adapters: { search, fetch, model, storage },
    researchRunId,
    runSeed: env.AUDIT_SAMPLE_SEED,
    queries: [],
    resolveMeta
  });

  logger.info("worker pipeline run complete", { researchRunId, ...summary });
  await closeDb();
}

function buildModelAdapter(kind: "fake" | "qwen", env: ReturnType<typeof loadEnv>): ModelAdapter {
  if (kind === "qwen") {
    return new QwenAdapter({ apiKey: env.QWEN_API_KEY, baseUrl: env.QWEN_BASE_URL });
  }
  return new FakeModelAdapter();
}

main().catch((err) => {
  logger.error("worker run failed", { error: String(err) });
  process.exitCode = 1;
});
