import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const { db } = await import("@/lib/db");
const { apiKeys, rateLimits, renders, usageEvents, users, workspaces } = await import("@/lib/db/schema");
const { planLimits, UNVERIFIED_FREE_LIMIT } = await import("@/lib/usage/plans");
const { assertWithinLimit, QuotaExceededError } = await import("@/lib/usage/limits");
const route = await import("@/app/api/admin/users/verify-email/route");

const TOKEN = "verify-token-that-is-long-enough-0123456789";
const EMAIL = "support-case@example.com";

const post = (body: unknown, headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` }) =>
  route.POST(new Request("http://localhost:3000/api/admin/users/verify-email", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));

const verifiedAt = () => db.select({ at: users.emailVerifiedAt }).from(users).all()[0]?.at ?? null;

/**
 * What the render API would actually do with this workspace's next render.
 *
 * Read the same way src/app/api/v1/charts/route.ts reads it — the owner's stored emailVerifiedAt, inside a
 * transaction — so this asserts what the product enforces rather than what the endpoint claims. The
 * refusal is part of the answer now: an unconfirmed free workspace has an allowance of
 * UNVERIFIED_FREE_LIMIT (zero), so the check does not return a limit at all, it refuses the first render.
 */
type Enforcement = { refused: boolean; limit: number | null; message: string };
const enforcement = (): Enforcement =>
  db.transaction((tx) => {
    const owner = tx.select({ at: users.emailVerifiedAt }).from(users).where(eq(users.id, "verify-u1")).get();
    try {
      return { refused: false, limit: assertWithinLimit("verify-ws1", "free", Boolean(owner?.at), tx).limit, message: "" };
    } catch (error) {
      if (!(error instanceof QuotaExceededError)) throw error;
      return { refused: true, limit: null, message: error.message };
    }
  });

beforeEach(() => {
  process.env.ADMIN_TOKEN = TOKEN;
  db.delete(usageEvents).run();
  db.delete(renders).run();
  db.delete(apiKeys).run();
  db.delete(workspaces).run();
  db.delete(users).run();
  db.delete(rateLimits).run();
  const now = new Date().toISOString();
  db.insert(users).values({ id: "verify-u1", email: EMAIL, name: "Support case", passwordHash: "x", createdAt: now }).run();
  db.insert(workspaces).values({ id: "verify-ws1", ownerId: "verify-u1", name: "Workspace", createdAt: now }).run();
});

afterEach(() => {
  delete process.env.ADMIN_TOKEN;
});

describe("POST /api/admin/users/verify-email", () => {
  it("raises the account to the advertised free limit", async () => {
    // The state the deployment leaves every free account in while email cannot be sent: an allowance of
    // UNVERIFIED_FREE_LIMIT, which the render API refuses on the very first request.
    expect(verifiedAt()).toBeNull();
    const before = enforcement();
    expect(before.refused).toBe(true);
    expect(before.message).toContain(`(${UNVERIFIED_FREE_LIMIT.toLocaleString()})`);
    expect(before.message).toContain(`raise it to ${planLimits.free.toLocaleString()}`);

    const response = await post({ email: EMAIL });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, alreadyVerified: false, limit: planLimits.free });

    // The point of the endpoint: the quota the API enforces actually moves.
    expect(verifiedAt()).not.toBeNull();
    expect(enforcement()).toMatchObject({ refused: false, limit: planLimits.free });
  });

  it("is idempotent and does not move the original verification time", async () => {
    const first = await post({ email: EMAIL });
    const firstAt = (await first.json()).verifiedAt;
    const second = await post({ email: EMAIL });
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ ok: true, alreadyVerified: true, verifiedAt: firstAt });
    expect(verifiedAt()).toBe(firstAt);
  });

  it("matches the address case-insensitively, the way sign-up stores it", async () => {
    expect((await post({ email: "  SUPPORT-CASE@Example.COM  " })).status).toBe(200);
    expect(verifiedAt()).not.toBeNull();
  });

  it("says plainly that an unknown address has no account, and changes nothing", async () => {
    const response = await post({ email: "nobody@example.com" });
    expect(response.status).toBe(404);
    expect((await response.json()).error).toMatch(/No account/);
    expect(verifiedAt()).toBeNull();
  });

  it("refuses a request with no token, a wrong token, or the wrong scheme", async () => {
    const attempts: Record<string, string>[] = [{}, { authorization: `Bearer ${TOKEN}x` }, { authorization: TOKEN }];
    for (const headers of attempts) {
      const response = await post({ email: EMAIL }, headers);
      expect(response.status).toBe(401);
      expect(verifiedAt()).toBeNull();
    }
  });

  it("behaves as if the route does not exist when no admin token is configured", async () => {
    delete process.env.ADMIN_TOKEN;
    const response = await post({ email: EMAIL }, {});
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Not found.");
    expect(verifiedAt()).toBeNull();
  });

  it("refuses a token that is configured but too short to be worth trusting", async () => {
    process.env.ADMIN_TOKEN = "short";
    const response = await post({ email: EMAIL }, { authorization: "Bearer short" });
    expect(response.status).toBe(404);
    expect(verifiedAt()).toBeNull();
  });

  it("rejects a body that is not one email address", async () => {
    for (const body of [{}, { email: "" }, { email: 42 }, "not json"]) {
      const response = await post(body);
      expect(response.status).toBe(400);
      expect(verifiedAt()).toBeNull();
    }
  });

  it("rate limits repeated attempts from one client", async () => {
    // Wrong token, so nothing is ever verified — this is the token-guessing budget.
    let sawLimit = false;
    for (let i = 0; i < 12; i++) {
      const response = await post({ email: EMAIL }, { authorization: "Bearer wrong-token-that-is-long-enough-000000" });
      if (response.status === 429) { sawLimit = true; expect(response.headers.get("retry-after")).toBeTruthy(); break; }
    }
    expect(sawLimit).toBe(true);
    expect(verifiedAt()).toBeNull();
  });

  it("never echoes the address back in the response", async () => {
    const response = await post({ email: EMAIL });
    expect(JSON.stringify(await response.json())).not.toContain(EMAIL);
  });
});
