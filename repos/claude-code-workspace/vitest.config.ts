import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 20000,
    hookTimeout: 20000,
    globals: false,
    // Multiple test files exercise a single real PostgreSQL instance
    // (DATABASE_URL), including files whose beforeAll issues
    // `TRUNCATE ... CASCADE` (packages/testing/src/benchmark/
    // pipeline.integration.test.ts). Vitest's default file-level
    // parallelism would race that truncate against other files' in-flight
    // multi-step DB sequences (e.g. robustness.integration.test.ts), which
    // is exactly the kind of non-reproducible flake the Phase 1 review
    // fixes must not introduce (defect #8: strengthened regression tests
    // have to actually be reliable evidence). Test *files* run
    // sequentially; tests within a file still run in the normal order.
    fileParallelism: false
  }
});
