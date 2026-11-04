import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }));
const sessionMock = vi.hoisted(() => ({ createSession: vi.fn() }));
// Only sendEmail is replaced: the config helpers in that module drive real behaviour under test.
vi.mock("@/lib/email/send", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/email/send")>()), sendEmail: mail.sendEmail }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/auth/session")>()), createSession: sessionMock.createSession }));

const { db } = await import("@/lib/db");
const { authTokens, rateLimits, users } = await import("@/lib/db/schema");
const { consumeRateLimit, clearRateLimit, clientIp, pruneRateLimits, HOUR } = await import("@/lib/security/rate-limit");
const { issueToken, consumeToken, peekToken } = await import("@/lib/auth/tokens");
const { verifyEmail, requestPasswordReset, resetPassword } = await import("@/lib/auth/account");
const { sessionRevoked, secret } = await import("@/lib/auth/session");
const { productionConfigReport } = await import("@/lib/config/startup");
const { workspaces } = await import("@/lib/db/schema");
const { limitFor } = await import("@/lib/usage/limits");
const login = await import("@/app/api/auth/login/route");
const forgot = await import("@/app/api/auth/password/forgot/route");
const registerRoute = await import("@/app/api/auth/register/route");

const PASSWORD = "correct horse battery";

function seedUser(id = "u1", email = "owner@example.com") {
  db.insert(users).values({ id, email, name: "Owner Person", passwordHash: bcrypt.hashSync(PASSWORD, 4), createdAt: new Date().toISOString() }).run();
}
const user = (id = "u1") => db.select().from(users).where(eq(users.id, id)).get()!;
const tokenFromEmail = () => /token=([A-Za-z0-9_-]+)/.exec(mail.sendEmail.mock.calls.at(-1)![0].text)![1];
const loginRequest = (email: string, password: string, ip = "203.0.113.5") => new Request("http://localhost:3000/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }), headers: { "content-type": "application/json", "x-forwarded-for": ip } });

beforeEach(() => {
  vi.clearAllMocks();
  db.delete(authTokens).run();
  db.delete(rateLimits).run();
  db.delete(users).run();
  seedUser();
});

describe("rate limiter", () => {
  it("allows up to the limit, blocks, then resets after the window", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(consumeRateLimit("k", 3, 60_000, t).allowed).toBe(true);
    expect(consumeRateLimit("k", 3, 60_000, t + 1_000)).toEqual({ allowed: false, retryAfterSeconds: 59 });
    expect(consumeRateLimit("k", 3, 60_000, t + 60_000).allowed).toBe(true);
    clearRateLimit("k");
    expect(db.select().from(rateLimits).all()).toHaveLength(0);
  });
});

describe("client IP", () => {
  const withXff = (value: string) => new Request("http://localhost:3000/", { headers: { "x-forwarded-for": value } });

  it("uses the entry the trusted proxy appended, not the client-controlled leftmost one", () => {
    expect(clientIp(withXff("1.2.3.4, 203.0.113.9"), { TRUSTED_PROXY_HOPS: "1" })).toBe("203.0.113.9");
    expect(clientIp(withXff("1.2.3.4, 203.0.113.9"), {})).toBe("203.0.113.9");
    expect(clientIp(withXff("1.2.3.4, 203.0.113.9, 10.0.0.2"), { TRUSTED_PROXY_HOPS: "2" })).toBe("203.0.113.9");
    expect(clientIp(withXff("203.0.113.9"), { TRUSTED_PROXY_HOPS: "2" })).toBe("203.0.113.9");
  });

  it("ignores the header entirely when no proxy is trusted", () => {
    expect(clientIp(withXff("1.2.3.4"), { TRUSTED_PROXY_HOPS: "0" })).toBe("local");
    expect(clientIp(new Request("http://localhost:3000/"), {})).toBe("local");
  });
});

describe("rate limit storage", () => {
  it("prunes rows whose window has ended", () => {
    const now = Date.now();
    consumeRateLimit("old", 5, HOUR, now - 2 * HOUR);
    consumeRateLimit("fresh", 5, HOUR, now);
    pruneRateLimits(now);
    expect(db.select().from(rateLimits).all().map((row) => row.key)).toEqual(["fresh"]);
  });
});

describe("POST /api/auth/register", () => {
  const registerRequest = (email: string, xff: string) => new Request("http://localhost:3000/api/auth/register", { method: "POST", body: JSON.stringify({ name: "New Person", email, password: "a long enough password" }), headers: { "content-type": "application/json", "x-forwarded-for": xff } });

  it("cannot be bypassed by rotating spoofed X-Forwarded-For values", async () => {
    const statuses: number[] = [];
    // The client varies the leftmost entry; the proxy appends the same real address each time.
    for (let i = 0; i < 11; i++) statuses.push((await registerRoute.POST(registerRequest("owner@example.com", `192.0.2.${i}, 203.0.113.50`))).status);
    expect(statuses.slice(0, 10).every((status) => status === 409)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("rolls the account back when the session cannot be created, so the email can be retried", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    sessionMock.createSession.mockRejectedValueOnce(new Error("SESSION_SECRET is required in production"));
    const failed = await registerRoute.POST(registerRequest("new@example.com", "203.0.113.60"));
    expect(failed.status).toBe(500);
    expect(JSON.stringify(await failed.json())).not.toContain("SESSION_SECRET");
    expect(db.select().from(users).where(eq(users.email, "new@example.com")).all()).toHaveLength(0);
    expect(db.select().from(workspaces).all().filter((row) => row.ownerId !== "u1")).toHaveLength(0);
    const retried = await registerRoute.POST(registerRequest("new@example.com", "203.0.113.60"));
    expect(retried.status).toBe(200);
    expect(await retried.json()).toMatchObject({ ok: true, apiKey: expect.any(String) });
  });

  it("returns 409 only for an existing email", async () => {
    const duplicate = await registerRoute.POST(registerRequest("OWNER@example.com", "203.0.113.61"));
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toEqual({ error: "An account already exists for that email." });
  });
});

describe("production configuration", () => {
  it("refuses a missing or short session secret in production", () => {
    expect(() => secret({ NODE_ENV: "production" })).toThrow(/required/);
    expect(() => secret({ NODE_ENV: "production", SESSION_SECRET: "changeme" })).toThrow(/at least 32/);
    expect(secret({ NODE_ENV: "production", SESSION_SECRET: "x".repeat(32) })).toBeInstanceOf(Uint8Array);
    expect(secret({ NODE_ENV: "development" })).toBeInstanceOf(Uint8Array);
  });

  it("reports fatal and email problems at startup without values", () => {
    const report = productionConfigReport({ SESSION_SECRET: "short-secret-value" });
    expect(report.fatal).toEqual(["SESSION_SECRET must be at least 32 characters."]);
    expect(report.warnings[0]).toMatch(/EMAIL_PROVIDER/);
    expect(JSON.stringify(report)).not.toContain("short-secret-value");
    expect(productionConfigReport({ SESSION_SECRET: "x".repeat(40), EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.co" })).toEqual({ fatal: [], warnings: [] });
  });
});

describe("single-use tokens", () => {
  it("can be used once, for one purpose, before expiry", () => {
    const token = issueToken("u1", "reset-password");
    expect(peekToken(token, "reset-password")?.userId).toBe("u1");
    expect(consumeToken(token, "verify-email")).toBeNull();
    expect(consumeToken(token, "reset-password")).toBe("u1");
    expect(consumeToken(token, "reset-password")).toBeNull();
  });

  it("expires and is revoked when a newer token is issued", () => {
    const old = issueToken("u1", "reset-password", new Date("2026-01-01T00:00:00Z"));
    expect(consumeToken(old, "reset-password", new Date("2026-01-01T01:00:01Z"))).toBeNull();
    const first = issueToken("u1", "verify-email");
    const second = issueToken("u1", "verify-email");
    expect(consumeToken(first, "verify-email")).toBeNull();
    expect(consumeToken(second, "verify-email")).toBe("u1");
  });

  it("stores only a hash of the token", () => {
    const token = issueToken("u1", "verify-email");
    expect(JSON.stringify(db.select().from(authTokens).all())).not.toContain(token);
  });
});

describe("email verification", () => {
  it("marks the user verified from a valid link only", () => {
    expect(verifyEmail("not-a-real-token-value-000000")).toBe(false);
    expect(verifyEmail(issueToken("u1", "verify-email"))).toBe(true);
    expect(user().emailVerifiedAt).not.toBeNull();
  });

  it("gives unverified free workspaces no quota at all and leaves paid plans alone", () => {
    // The spec makes a confirmed address a condition of the free tier, so unconfirmed is zero, not a
    // smaller allowance. Verification is never a condition of a plan somebody paid for.
    expect(limitFor("free", false)).toBe(0);
    expect(limitFor("free", true)).toBe(250);
    expect(limitFor("developer", false)).toBe(5_000);
    expect(limitFor("pro", false)).toBe(25_000);
    expect(limitFor("business", false)).toBe(100_000);
  });
});

describe("password reset", () => {
  it("emails a link for a real account and nothing for an unknown one", async () => {
    await requestPasswordReset("nobody@example.com");
    expect(mail.sendEmail).not.toHaveBeenCalled();
    await requestPasswordReset("OWNER@example.com");
    expect(mail.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "owner@example.com" }));
    expect(mail.sendEmail.mock.calls[0][0].text).toContain("/reset-password?token=");
  });

  it("changes the password once, revokes old sessions, and confirms the email", async () => {
    await requestPasswordReset("owner@example.com");
    const token = tokenFromEmail();
    const issuedBefore = Math.floor(Date.now() / 1000) - 5;
    expect(await resetPassword(token, "a brand new password")).toBe(true);
    const updated = user();
    expect(await bcrypt.compare("a brand new password", updated.passwordHash)).toBe(true);
    expect(updated.emailVerifiedAt).not.toBeNull();
    expect(sessionRevoked(issuedBefore, updated.passwordChangedAt)).toBe(true);
    expect(sessionRevoked(Math.floor(Date.now() / 1000) + 1, updated.passwordChangedAt)).toBe(false);
    expect(await resetPassword(token, "another new password")).toBe(false);
  });

  it("answers in the same time whether or not the account exists", async () => {
    mail.sendEmail.mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 300)));
    const request = (email: string) => new Request("http://localhost:3000/api/auth/password/forgot", { method: "POST", body: JSON.stringify({ email }), headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.70" } });
    const time = async (email: string) => { const start = performance.now(); await forgot.POST(request(email)); return performance.now() - start; };
    const known = await time("owner@example.com");
    const unknown = await time("nobody@example.com");
    expect(Math.abs(known - unknown)).toBeLessThan(50);
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("answers identically whether or not the account exists", async () => {
    const request = (email: string) => new Request("http://localhost:3000/api/auth/password/forgot", { method: "POST", body: JSON.stringify({ email }), headers: { "content-type": "application/json" } });
    const known = await forgot.POST(request("owner@example.com"));
    const unknown = await forgot.POST(request("nobody@example.com"));
    expect(known.status).toBe(unknown.status);
    expect(await known.json()).toEqual(await unknown.json());
  });
});

describe("POST /api/auth/login", () => {
  it("uses one error message for unknown emails and wrong passwords", async () => {
    const wrong = await login.POST(loginRequest("owner@example.com", "wrong password"));
    const unknown = await login.POST(loginRequest("nobody@example.com", "wrong password"));
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
  });

  it("does not let failures from other IPs lock the real user out", async () => {
    // An attacker who knows the email fails 10 times from 10 addresses; the owner then signs in from their own.
    for (let i = 0; i < 10; i++) expect((await login.POST(loginRequest("owner@example.com", "wrong", `198.51.100.${i}`))).status).toBe(401);
    const owner = await login.POST(loginRequest("owner@example.com", PASSWORD, "198.51.100.99"));
    expect(owner.status).toBe(200);
    expect(sessionMock.createSession).toHaveBeenCalledWith("u1");
  });

  it("blocks an IP after 10 failures on one account, even with the right password", async () => {
    for (let i = 0; i < 10; i++) expect((await login.POST(loginRequest("owner@example.com", "wrong", "198.51.100.7"))).status).toBe(401);
    const blocked = await login.POST(loginRequest("owner@example.com", PASSWORD, "198.51.100.7"));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(sessionMock.createSession).not.toHaveBeenCalled();
  });

  it("does not count successful sign-ins toward the limit", async () => {
    for (let i = 0; i < 12; i++) expect((await login.POST(loginRequest("owner@example.com", PASSWORD, "198.51.100.8"))).status).toBe(200);
  });

  it("refuses text/plain and cross-site sign-in posts (login CSRF)", async () => {
    const body = JSON.stringify({ email: "owner@example.com", password: PASSWORD });
    const plain = await login.POST(new Request("http://localhost:3000/api/auth/login", { method: "POST", body, headers: { "content-type": "text/plain", origin: "https://evil.example" } }));
    expect(plain.status).toBe(415);
    const crossSite = await login.POST(new Request("http://localhost:3000/api/auth/login", { method: "POST", body, headers: { "content-type": "application/json", origin: "https://evil.example" } }));
    expect(crossSite.status).toBe(403);
    const sameSite = await login.POST(new Request("http://localhost:3000/api/auth/login", { method: "POST", body, headers: { "content-type": "application/json", origin: "http://localhost:3000", "sec-fetch-site": "same-origin" } }));
    expect(sameSite.status).toBe(200);
    expect(sessionMock.createSession).toHaveBeenCalledTimes(1);
  });

  it("signs in with the right password and resets the account counter", async () => {
    await login.POST(loginRequest("owner@example.com", "wrong"));
    const ok = await login.POST(loginRequest("owner@example.com", PASSWORD));
    expect(ok.status).toBe(200);
    expect(sessionMock.createSession).toHaveBeenCalledWith("u1");
    expect(db.select().from(rateLimits).all().some((row) => row.key.startsWith("login-account:"))).toBe(false);
  });
});
