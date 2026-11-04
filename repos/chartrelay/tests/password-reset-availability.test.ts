import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email/send", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/email/send")>()), sendEmail: mail.sendEmail }));

const { db } = await import("@/lib/db");
const { authTokens, rateLimits, users } = await import("@/lib/db/schema");
const { emailConfigProblem, emailConfigured, emailDeliverable } = await import("@/lib/email/send");
const forgot = await import("@/app/api/auth/password/forgot/route");
const { productionConfigReport } = await import("@/lib/config/startup");

const PROMISE = "on its way";

const forgotRequest = (email: string, ip = "203.0.113.80") =>
  new Request("http://localhost:3000/api/auth/password/forgot", { method: "POST", body: JSON.stringify({ email }), headers: { "content-type": "application/json", "x-forwarded-for": ip } });

beforeEach(() => {
  vi.clearAllMocks();
  db.delete(authTokens).run();
  db.delete(rateLimits).run();
  db.delete(users).run();
  db.insert(users).values({ id: "u1", email: "owner@example.com", name: "Owner Person", passwordHash: bcrypt.hashSync("correct horse battery", 4), createdAt: new Date().toISOString() }).run();
});

afterEach(() => vi.unstubAllEnvs());

/** The live deployment's documented state: production build, no provider configured. */
function productionWithoutEmail() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("EMAIL_PROVIDER", "");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("EMAIL_FROM", "");
}

function productionWithEmail() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("EMAIL_PROVIDER", "resend");
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("EMAIL_FROM", "ChartRelay <no-reply@chartrelay.example>");
}

describe("emailConfigured", () => {
  it("is true only for a fully configured Resend setup", () => {
    expect(emailConfigured({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_1", EMAIL_FROM: "a@b.com" })).toBe(true);
    expect(emailConfigured({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_1" })).toBe(false);
    expect(emailConfigured({ EMAIL_PROVIDER: "resend", EMAIL_FROM: "a@b.com" })).toBe(false);
    expect(emailConfigured({})).toBe(false);
  });

  it("rejects any provider value other than resend, which is the only one sendEmail implements", () => {
    for (const provider of ["sendgrid", "Resend", "resend ", "true", "1", "mailgun"]) {
      expect(emailConfigured({ EMAIL_PROVIDER: provider, RESEND_API_KEY: "re_1", EMAIL_FROM: "a@b.com" })).toBe(false);
    }
  });

  it("reports the same problem the startup warning prints, so the logs and the UI cannot disagree", () => {
    const env = { EMAIL_PROVIDER: "sendgrid", SESSION_SECRET: "x".repeat(40) };
    expect(emailConfigProblem(env)).toMatch(/EMAIL_PROVIDER is not set to "resend"/);
    expect(productionConfigReport(env).warnings).toContain(emailConfigProblem(env));
    expect(emailConfigProblem({ EMAIL_PROVIDER: "resend" })).toMatch(/RESEND_API_KEY and EMAIL_FROM/);
    expect(emailConfigProblem({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_1", EMAIL_FROM: "a@b.com" })).toBeNull();
  });

  it("treats an unconfigured non-production deployment as deliverable, because sendEmail prints there", () => {
    expect(emailDeliverable({ NODE_ENV: "development" })).toBe(true);
    expect(emailDeliverable({ NODE_ENV: "production" })).toBe(false);
    expect(emailDeliverable({ NODE_ENV: "production", EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_1", EMAIL_FROM: "a@b.com" })).toBe(true);
  });
});

describe("POST /api/auth/password/forgot without an email provider", () => {
  it("never claims a reset link is coming", async () => {
    productionWithoutEmail();
    const response = await forgot.POST(forgotRequest("owner@example.com"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.message).not.toContain(PROMISE);
    expect(body.emailUnavailable).toBe(true);
    expect(body.message).toMatch(/not available on this deployment/i);
    expect(body.message).toMatch(/support/i);
  });

  it("mints no reset token and calls no provider, so nothing is left half-done", async () => {
    productionWithoutEmail();
    await forgot.POST(forgotRequest("owner@example.com"));
    expect(mail.sendEmail).not.toHaveBeenCalled();
    expect(db.select().from(authTokens).all()).toHaveLength(0);
  });

  it("answers identically for an address that does not exist, so it still cannot be used to enumerate", async () => {
    productionWithoutEmail();
    const known = await (await forgot.POST(forgotRequest("owner@example.com"))).json();
    const unknown = await (await forgot.POST(forgotRequest("nobody@example.com"))).json();
    expect(known).toEqual(unknown);
  });

  it("still rejects a malformed address before anything else", async () => {
    productionWithoutEmail();
    const response = await forgot.POST(forgotRequest("not-an-email"));
    expect(response.status).toBe(400);
  });
});

describe("POST /api/auth/password/forgot with a configured provider", () => {
  it("keeps the enumeration-safe promise and sends the link", async () => {
    productionWithEmail();
    const response = await forgot.POST(forgotRequest("owner@example.com"));
    const body = await response.json();
    expect(body.message).toContain(PROMISE);
    expect(body.emailUnavailable).toBeUndefined();
    // requestPasswordReset is not awaited by the route; let its microtasks drain.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
    expect(db.select().from(authTokens).all()).toHaveLength(1);
  });
});
