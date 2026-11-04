import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", ".data/**"],
    // Deterministic test-only configuration: an in-memory database and fake Stripe identifiers. No network access.
    env: {
      DATABASE_PATH: ":memory:",
      APP_URL: "http://localhost:3000",
      SESSION_SECRET: "test-session-secret-at-least-32-characters",
      STRIPE_SECRET_KEY: "sk_test_fake_unit",
      STRIPE_WEBHOOK_SECRET: "whsec_unitTestSigningSecret",
      STRIPE_PRICE_DEVELOPER: "price_test_developer",
      STRIPE_PRICE_PRO: "price_test_pro",
      STRIPE_PRICE_BUSINESS: "price_test_business",
      STRIPE_PRICE_PACK: "price_test_pack",
    },
    testTimeout: 10_000,
    teardownTimeout: 5_000,
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
});
