import { z } from "zod";

/**
 * Shared environment schema. No secrets are ever hardcoded here — this only
 * describes shape/validation. Values come from process.env at runtime.
 *
 * Phase 1 default posture (CLAUDE.md, ARCHITECTURE.md §29): fixture/fake
 * adapters and no paid-provider credentials are required to run core tests.
 */
export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_ROOT: z.string().default(".storage"),
  STORAGE_S3_BUCKET: z.string().optional(),
  STORAGE_S3_REGION: z.string().optional(),
  STORAGE_S3_ENDPOINT: z.string().optional(),
  STORAGE_S3_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().optional(),

  SEARCH_ADAPTER: z.enum(["fixture"]).default("fixture"),
  FETCH_ADAPTER: z.enum(["fixture"]).default("fixture"),
  BROWSER_ADAPTER: z.enum(["playwright", "fixture"]).default("fixture"),

  MODEL_ADAPTER: z.enum(["fake", "qwen"]).default("fake"),
  QWEN_API_KEY: z.string().optional(),
  QWEN_BASE_URL: z.string().optional(),
  FRONTIER_MODEL_API_KEY: z.string().optional(),

  AUDIT_SAMPLE_SEED: z.string().default("phase1-default-seed"),
  MATERIALITY_RULESET_VERSION: z.coerce.number().int().positive().default(1),

  RUN_TOKEN_BUDGET: z.coerce.number().int().positive().default(200_000),
  RUN_MONETARY_BUDGET_USD: z.coerce.number().positive().default(5),
  RUN_SOURCE_BUDGET: z.coerce.number().int().positive().default(50)
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Parses process.env once and caches the result. Throws a descriptive error
 * (never leaking secret values) if required configuration is missing.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = result.data;
  return cached;
}

/** Test-only helper to reset the cached env between test cases. */
export function __resetEnvCacheForTests(): void {
  cached = undefined;
}
