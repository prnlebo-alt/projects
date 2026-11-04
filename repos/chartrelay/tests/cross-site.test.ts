import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ currentAccount: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentAccount: session.currentAccount }));

const { db } = await import("@/lib/db");
const { apiKeys, users, workspaces } = await import("@/lib/db/schema");
const keys = await import("@/app/api/keys/route");

const WORKSPACE = "ws-cross-site";

beforeEach(() => {
  db.delete(apiKeys).run();
  db.delete(users).run();
  db.delete(workspaces).run();
  const now = new Date().toISOString();
  db.insert(users).values({ id: "user_cross_site", email: "a@example.com", passwordHash: "x", name: "Test User", createdAt: now }).run();
  db.insert(workspaces).values({ id: WORKSPACE, ownerId: "user_cross_site", name: "W", createdAt: now }).run();
  session.currentAccount.mockResolvedValue({
    workspace: db.select().from(workspaces).all()[0],
    user: db.select().from(users).all()[0],
  });
});

/** A forged request from another site, carrying the victim's cookie the way a browser would. */
const forged = (method: "POST" | "DELETE", extra: Record<string, string> = {}) =>
  new Request(`http://localhost:3000/api/keys${method === "DELETE" ? "?id=k1" : ""}`, {
    method,
    headers: { "content-type": "application/json", origin: "https://evil.example", "sec-fetch-site": "cross-site", ...extra },
    ...(method === "POST" ? { body: JSON.stringify({ name: "stolen" }) } : {}),
  });

const sameSite = (method: "POST" | "DELETE") =>
  new Request(`http://localhost:3000/api/keys${method === "DELETE" ? "?id=k1" : ""}`, {
    method,
    headers: { "content-type": "application/json", origin: "http://localhost:3000", "sec-fetch-site": "same-origin" },
    ...(method === "POST" ? { body: JSON.stringify({ name: "mine" }) } : {}),
  });

describe("minting a key from another site", () => {
  it("is refused, and no key is created", async () => {
    // This route returns a live plaintext key. SameSite=Lax was the only other layer, and SameSite is
    // site-scoped — an XSS on any subdomain is same-site and reaches here with the session cookie.
    const response = await keys.POST(forged("POST"));
    expect(response.status).toBe(403);
    expect(db.select().from(apiKeys).all()).toHaveLength(0);
  });

  it("does not leak a key in the refusal body", async () => {
    const body = await (await keys.POST(forged("POST"))).text();
    expect(body).not.toContain("cr_live_");
  });

  it("still works from the application's own origin", async () => {
    const response = await keys.POST(sameSite("POST"));
    expect(response.status).toBe(201);
    expect(db.select().from(apiKeys).all()).toHaveLength(1);
  });

  it("refuses a forged revocation too", async () => {
    // A forged revoke is a denial of service on a live integration, not a harmless no-op.
    expect((await keys.DELETE(forged("DELETE"))).status).toBe(403);
  });

  it("refuses on a hostile Origin even when the fetch metadata is absent", async () => {
    const response = await keys.POST(new Request("http://localhost:3000/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ name: "stolen" }),
    }));
    expect(response.status).toBe(403);
  });
});

describe("the API a customer calls from their own origin", () => {
  it("lets a Bearer key through cross-site, because it is not an ambient credential", async () => {
    // A browser cannot attach someone else's Bearer token to a forged request, and refusing this would
    // break the cross-origin API calls the product exists to serve.
    const { rejectAmbientCrossSite } = await import("@/lib/security/request");
    const request = new Request("http://localhost:3000/api/v1/charts", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://customer.example", "sec-fetch-site": "cross-site", authorization: "Bearer cr_live_whatever" },
    });
    expect(rejectAmbientCrossSite(request)).toBeNull();
  });

  it("still refuses a cookie-authenticated cross-site call", async () => {
    const { rejectAmbientCrossSite } = await import("@/lib/security/request");
    const request = new Request("http://localhost:3000/api/v1/charts", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    });
    expect(rejectAmbientCrossSite(request)).not.toBeNull();
  });
});
