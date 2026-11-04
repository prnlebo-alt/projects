import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

const session = vi.hoisted(() => ({ currentAccount: vi.fn(), clearSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentAccount: session.currentAccount, clearSession: session.clearSession }));

// The delete route asks Stripe whether anything is still billing. No network call is ever made: this
// stands in for stripe.subscriptions.list, and every test states what Stripe would have answered.
const stripe = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/billing/stripe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/stripe")>()),
  stripeClient: () => ({ subscriptions: { list: stripe.list } }),
}));

const { db } = await import("@/lib/db");
const { apiKeys, authTokens, deletedCustomers, rateLimits, renders, usageEvents, users, workspaces } = await import("@/lib/db/schema");
const { OMITTED_USER_COLUMNS } = await import("@/app/api/account/export/route");
const exportRoute = await import("@/app/api/account/export/route");
const deleteRoute = await import("@/app/api/account/delete/route");

const PASSWORD = "correct horse battery";
const EMAIL = "owner@example.com";
const SVG_MARKER = "<svg data-secret-pixels=\"1\"></svg>";
const KEY_HASH = "hash_of_the_real_api_key_value";

function seed() {
  const now = new Date().toISOString();
  db.insert(users).values({ id: "u1", email: EMAIL, name: "Owner Person", passwordHash: bcrypt.hashSync(PASSWORD, 4), createdAt: now }).run();
  db.insert(workspaces).values({ id: "ws_1", ownerId: "u1", name: "Owner workspace", stripeCustomerId: "cus_1", createdAt: now }).run();
  db.insert(apiKeys).values({ id: "key_1", workspaceId: "ws_1", name: "Production", keyHash: KEY_HASH, prefix: "crk_live_abc", createdAt: now }).run();
  db.insert(renders).values({ id: "rnd_1", workspaceId: "ws_1", apiKeyId: "key_1", spec: JSON.stringify({ title: "Revenue", type: "bar" }), svg: SVG_MARKER, altText: "Bar chart of revenue", warnings: JSON.stringify(["axis truncated"]), png: Buffer.from([1, 2, 3]), createdAt: now }).run();
  db.insert(usageEvents).values({ id: "use_1", workspaceId: "ws_1", kind: "render", quantity: 1, createdAt: now }).run();
  db.insert(authTokens).values({ id: "tok_1", userId: "u1", purpose: "verify-email", tokenHash: "token_hash_1", expiresAt: now, createdAt: now }).run();
  // A second account that must survive every deletion below.
  db.insert(users).values({ id: "u2", email: "other@example.com", name: "Other Person", passwordHash: "x", createdAt: now }).run();
  db.insert(workspaces).values({ id: "ws_2", ownerId: "u2", name: "Other workspace", createdAt: now }).run();
  db.insert(apiKeys).values({ id: "key_2", workspaceId: "ws_2", name: "Other key", keyHash: "other_hash", prefix: "crk_live_xyz", createdAt: now }).run();
  db.insert(renders).values({ id: "rnd_2", workspaceId: "ws_2", spec: "{}", svg: "<svg/>", altText: "Other", warnings: "[]", createdAt: now }).run();
  db.insert(usageEvents).values({ id: "use_2", workspaceId: "ws_2", kind: "render", quantity: 1, createdAt: now }).run();
  db.insert(authTokens).values({ id: "tok_2", userId: "u2", purpose: "verify-email", tokenHash: "token_hash_2", expiresAt: now, createdAt: now }).run();
}

function signIn(userId = "u1") {
  const user = db.select().from(users).where(eq(users.id, userId)).get()!;
  const workspace = db.select().from(workspaces).where(eq(workspaces.ownerId, userId)).get()!;
  session.currentAccount.mockResolvedValue({ user, workspace });
}

const exportRequest = (ip = "203.0.113.5") => new Request("http://localhost:3000/api/account/export", { headers: { "x-forwarded-for": ip } });

function deleteRequest(body: unknown, ip = "203.0.113.5") {
  return new Request("http://localhost:3000/api/account/delete", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": ip, origin: "http://localhost:3000" } });
}

const rows = {
  users: () => db.select().from(users).all(),
  workspaces: () => db.select().from(workspaces).all(),
  apiKeys: () => db.select().from(apiKeys).all(),
  renders: () => db.select().from(renders).all(),
  usageEvents: () => db.select().from(usageEvents).all(),
  authTokens: () => db.select().from(authTokens).all(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: Stripe knows of no subscription for this customer.
  stripe.list.mockResolvedValue({ data: [] });
  db.delete(deletedCustomers).run();
  db.delete(rateLimits).run();
  db.delete(authTokens).run();
  db.delete(usageEvents).run();
  db.delete(renders).run();
  db.delete(apiKeys).run();
  db.delete(workspaces).run();
  db.delete(users).run();
  seed();
});

describe("GET /api/account/export", () => {
  it("refuses unauthenticated requests", async () => {
    session.currentAccount.mockResolvedValue(null);
    expect((await exportRoute.GET(exportRequest())).status).toBe(401);
  });

  it("returns the owner's data as a JSON download", async () => {
    signIn();
    const response = await exportRoute.GET(exportRequest());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="chartrelay-export-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.user).toEqual(expect.objectContaining({ id: "u1", email: EMAIL, name: "Owner Person" }));
    expect(body.workspace).toEqual(expect.objectContaining({ id: "ws_1", plan: "free", stripeCustomerId: "cus_1" }));
    expect(body.apiKeys).toEqual([expect.objectContaining({ id: "key_1", name: "Production", prefix: "crk_live_abc" })]);
    expect(body.renders).toEqual([expect.objectContaining({ id: "rnd_1", altText: "Bar chart of revenue", spec: { title: "Revenue", type: "bar" }, warnings: ["axis truncated"] })]);
    expect(body.renders[0].urls).toEqual({ svg: "http://localhost:3000/api/v1/charts/rnd_1?format=svg", png: "http://localhost:3000/api/v1/charts/rnd_1?format=png" });
    expect(body.usageEvents).toEqual([expect.objectContaining({ id: "use_1", kind: "render", quantity: 1 })]);
  });

  it("excludes password hashes, API key material and render blobs", async () => {
    signIn();
    const raw = await (await exportRoute.GET(exportRequest())).text();
    expect(raw).not.toContain(KEY_HASH);
    expect(raw).not.toContain(SVG_MARKER);
    expect(raw).not.toContain("$2b$");
    expect(raw).not.toContain("passwordHash");
    expect(raw).not.toContain("keyHash");
    const body = JSON.parse(raw);
    expect(Object.keys(body.user)).toEqual(["id", "email", "name", "emailVerifiedAt", "passwordChangedAt", "source", "createdAt"]);
    expect(Object.keys(body.apiKeys[0])).toEqual(["id", "name", "prefix", "lastUsedAt", "revokedAt", "createdAt"]);
    expect(Object.keys(body.renders[0])).toEqual(["id", "apiKeyId", "spec", "altText", "warnings", "createdAt", "urls"]);
  });

  it("never includes another workspace's rows", async () => {
    signIn();
    const raw = await (await exportRoute.GET(exportRequest())).text();
    for (const id of ["ws_2", "key_2", "rnd_2", "use_2", "other@example.com"]) expect(raw).not.toContain(id);
  });

  it("documents the row cap and reports that nothing was truncated", async () => {
    signIn();
    const body = await (await exportRoute.GET(exportRequest())).json();
    expect(body.rowLimitPerCollection).toBe(5_000);
    expect(body.truncated).toEqual({ apiKeys: false, renders: false, usageEvents: false });
    expect(body.truncationNote).toContain("5,000");
    expect(body.omitted.join(" ")).toMatch(/password hash/i);
  });

  it("rate limits repeated exports", async () => {
    signIn();
    for (let i = 0; i < 6; i++) expect((await exportRoute.GET(exportRequest())).status).toBe(200);
    const blocked = await exportRoute.GET(exportRequest());
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toMatch(/^\d+$/);
  });

  it("exports every stored user column that is not on the declared deny-list", async () => {
    // "Download everything we hold" has to stay true when a column is added: users.source was added and
    // silently dropped, appearing neither in the payload nor in the omitted list.
    db.update(users).set({ source: "launch_hn" }).where(eq(users.id, "u1")).run();
    signIn();
    const body = await (await exportRoute.GET(exportRequest())).json();
    const stored = Object.keys(db.select().from(users).where(eq(users.id, "u1")).get()!);
    const expected = stored.filter((column) => !(OMITTED_USER_COLUMNS as readonly string[]).includes(column));
    expect(Object.keys(body.user).sort()).toEqual(expected.sort());
    expect(body.user.source).toBe("launch_hn");
  });

  it("names every withheld user column in the omitted list", async () => {
    signIn();
    const body = await (await exportRoute.GET(exportRequest())).json();
    const omitted = body.omitted.join(" ").toLowerCase();
    for (const column of OMITTED_USER_COLUMNS) expect(omitted).toContain(column.replace(/([A-Z])/g, " $1").toLowerCase().trim());
  });

  it("carries the key each render was made with, rather than dropping it unmentioned", async () => {
    signIn();
    const body = await (await exportRoute.GET(exportRequest())).json();
    expect(body.renders[0].apiKeyId).toBe("key_1");
  });

  it("refuses a cookie-authenticated cross-site GET", async () => {
    signIn();
    const crossSite = new Request("http://localhost:3000/api/account/export", { headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" } });
    const response = await exportRoute.GET(crossSite);
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain(EMAIL);
    const foreignOrigin = new Request("http://localhost:3000/api/account/export", { headers: { origin: "https://evil.example" } });
    expect((await exportRoute.GET(foreignOrigin)).status).toBe(403);
    // Same-origin and non-browser clients are unaffected.
    expect((await exportRoute.GET(exportRequest())).status).toBe(200);
  });
});

describe("POST /api/account/delete", () => {
  it("refuses unauthenticated, cross-site and non-JSON requests", async () => {
    session.currentAccount.mockResolvedValue(null);
    expect((await deleteRoute.POST(deleteRequest({ email: EMAIL, password: PASSWORD }))).status).toBe(401);
    signIn();
    const plain = new Request("http://localhost:3000/api/account/delete", { method: "POST", body: JSON.stringify({ email: EMAIL, password: PASSWORD }), headers: { "content-type": "text/plain" } });
    expect((await deleteRoute.POST(plain)).status).toBe(415);
    const crossSite = new Request("http://localhost:3000/api/account/delete", { method: "POST", body: JSON.stringify({ email: EMAIL, password: PASSWORD }), headers: { "content-type": "application/json", origin: "https://evil.example" } });
    expect((await deleteRoute.POST(crossSite)).status).toBe(403);
    expect(rows.users()).toHaveLength(2);
  });

  it("refuses a mismatched email and a wrong password", async () => {
    signIn();
    const wrongEmail = await deleteRoute.POST(deleteRequest({ email: "someone@example.com", password: PASSWORD }));
    expect(wrongEmail.status).toBe(400);
    expect((await wrongEmail.json()).error).toMatch(/does not match/i);
    const wrongPassword = await deleteRoute.POST(deleteRequest({ email: EMAIL, password: "not the password" }));
    expect(wrongPassword.status).toBe(401);
    expect((await wrongPassword.json()).error).toMatch(/password/i);
    const missing = await deleteRoute.POST(deleteRequest({ email: EMAIL }));
    expect(missing.status).toBe(400);
    expect(rows.users()).toHaveLength(2);
    expect(session.clearSession).not.toHaveBeenCalled();
  });

  it("refuses while an active subscription exists and points at billing", async () => {
    db.update(workspaces).set({ plan: "pro", stripeSubscriptionId: "sub_1", subscriptionStatus: "active" }).where(eq(workspaces.id, "ws_1")).run();
    signIn();
    const response = await deleteRoute.POST(deleteRequest({ email: EMAIL, password: PASSWORD }));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatch(/cancel your subscription/i);
    expect(body.manageBillingUrl).toBe("/dashboard");
    expect(rows.users().map((row) => row.id)).toContain("u1");
    expect(rows.workspaces().map((row) => row.id)).toContain("ws_1");
  });

  it("deletes a workspace whose subscription has already ended", async () => {
    db.update(workspaces).set({ plan: "free", stripeSubscriptionId: "sub_1", subscriptionStatus: "canceled" }).where(eq(workspaces.id, "ws_1")).run();
    signIn();
    expect((await deleteRoute.POST(deleteRequest({ email: EMAIL, password: PASSWORD }))).status).toBe(200);
    expect(rows.users().map((row) => row.id)).toEqual(["u2"]);
  });

  it("removes every related row, clears the session and leaves other accounts alone", async () => {
    const logged = vi.spyOn(console, "info").mockImplementation(() => {});
    signIn();
    const response = await deleteRoute.POST(deleteRequest({ email: ` ${EMAIL.toUpperCase()} `, password: PASSWORD }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, deleted: true });
    expect(rows.users().map((row) => row.id)).toEqual(["u2"]);
    expect(rows.workspaces().map((row) => row.id)).toEqual(["ws_2"]);
    expect(rows.apiKeys().map((row) => row.id)).toEqual(["key_2"]);
    expect(rows.renders().map((row) => row.id)).toEqual(["rnd_2"]);
    expect(rows.usageEvents().map((row) => row.id)).toEqual(["use_2"]);
    expect(rows.authTokens().map((row) => row.id)).toEqual(["tok_2"]);
    expect(session.clearSession).toHaveBeenCalledTimes(1);
    const line = logged.mock.calls.at(-1)![0] as string;
    expect(line).toBe("[account-deleted] user=u1 workspace=ws_1");
    expect(line).not.toContain(EMAIL);
  });

  it("still reports success when the session cookie cannot be cleared", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    session.clearSession.mockRejectedValueOnce(new Error("cookies() outside a request"));
    signIn();
    expect((await deleteRoute.POST(deleteRequest({ email: EMAIL, password: PASSWORD }))).status).toBe(200);
    expect(rows.users().map((row) => row.id)).toEqual(["u2"]);
  });

  it("refuses while Stripe reports a subscription the local record has not heard about yet", async () => {
    // The webhook-pending window the dashboard models with BillingPending: checkout wrote the customer
    // id, customer.subscription.created has not landed, so stripeSubscriptionId is still null.
    db.update(workspaces).set({ stripeCustomerId: "cus_A", stripeSubscriptionId: null, subscriptionStatus: null }).where(eq(workspaces.id, "ws_1")).run();
    stripe.list.mockResolvedValue({ data: [{ id: "sub_new", status: "active" }] });
    signIn();
    const response = await deleteRoute.POST(deleteRequest({ email: EMAIL, password: PASSWORD }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/stripe still shows a subscription/i);
    expect(stripe.list).toHaveBeenCalledWith({ customer: "cus_A", status: "all", limit: 20 });
    expect(rows.users().map((row) => row.id)).toContain("u1");
  });

  it("treats an incomplete subscription as blocking, because 3-D Secure can still complete it", async () => {
    db.update(workspaces).set({ stripeCustomerId: "cus_A", subscriptionStatus: "incomplete" }).where(eq(workspaces.id, "ws_1")).run();
    stripe.list.mockResolvedValue({ data: [{ id: "sub_sca", status: "incomplete" }] });
    signIn();
    expect((await deleteRoute.POST(deleteRequest({ email: EMAIL, password: PASSWORD }))).status).toBe(409);
    expect(rows.users()).toHaveLength(2);
  });

  it("fails closed when Stripe cannot be reached, rather than orphaning a live subscription", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stripe.list.mockRejectedValue(new Error("network down"));
    signIn();
    const response = await deleteRoute.POST(deleteRequest({ email: EMAIL, password: PASSWORD }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/could not confirm with stripe/i);
    expect(rows.users()).toHaveLength(2);
  });

  it("deletes when Stripe confirms every subscription is terminal", async () => {
    stripe.list.mockResolvedValue({ data: [{ id: "sub_old", status: "canceled" }, { id: "sub_dead", status: "incomplete_expired" }] });
    signIn();
    expect((await deleteRoute.POST(deleteRequest({ email: EMAIL, password: PASSWORD }))).status).toBe(200);
    expect(rows.users().map((row) => row.id)).toEqual(["u2"]);
  });

  it("never asks Stripe about a workspace that has no customer id", async () => {
    db.update(workspaces).set({ stripeCustomerId: null }).where(eq(workspaces.id, "ws_1")).run();
    signIn();
    expect((await deleteRoute.POST(deleteRequest({ email: EMAIL, password: PASSWORD }))).status).toBe(200);
    expect(stripe.list).not.toHaveBeenCalled();
  });

  it("leaves a billing tombstone carrying the Stripe handle and no personal data", async () => {
    signIn();
    expect((await deleteRoute.POST(deleteRequest({ email: EMAIL, password: PASSWORD }))).status).toBe(200);
    const tombstones = db.select().from(deletedCustomers).all();
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0].stripeCustomerId).toBe("cus_1");
    expect(tombstones[0].workspaceId).toBe("ws_1");
    expect(JSON.stringify(tombstones)).not.toContain(EMAIL);
    expect(JSON.stringify(tombstones)).not.toContain("Owner Person");
  });

  it("leaves no rate-limit row tying the deleted user id to an IP", async () => {
    signIn();
    // An export first, so both personal key shapes exist before the deletion.
    expect((await exportRoute.GET(exportRequest("198.51.100.44"))).status).toBe(200);
    expect((await deleteRoute.POST(deleteRequest({ email: EMAIL, password: PASSWORD }, "198.51.100.44"))).status).toBe(200);
    const keys = db.select().from(rateLimits).all().map((row) => row.key);
    expect(keys.some((key) => key.includes("u1"))).toBe(false);
    // The pure-IP bucket must survive: dropping it would hand an attacker a rate-limit reset.
    expect(keys).toContain("account-delete-ip:198.51.100.44");
  });

  it("does not treat an underscore in the user id as a LIKE wildcard", async () => {
    const now = new Date().toISOString();
    db.insert(users).values({ id: "u_1", email: "under@example.com", name: "Under Score", passwordHash: bcrypt.hashSync(PASSWORD, 4), createdAt: now }).run();
    db.insert(workspaces).values({ id: "ws_u", ownerId: "u_1", name: "Underscore workspace", createdAt: now }).run();
    // Another account's export bucket that a naive `account-export:u_1:%` pattern would also match.
    db.insert(rateLimits).values({ key: "account-export:uX1:198.51.100.7", windowStart: Date.now(), count: 1 }).run();
    db.insert(rateLimits).values({ key: "account-export:u_1:198.51.100.7", windowStart: Date.now(), count: 1 }).run();
    signIn("u_1");
    const response = await deleteRoute.POST(deleteRequest({ email: "under@example.com", password: PASSWORD }, "198.51.100.7"));
    expect(response.status).toBe(200);
    const keys = db.select().from(rateLimits).all().map((row) => row.key);
    expect(keys).toContain("account-export:uX1:198.51.100.7");
    expect(keys).not.toContain("account-export:u_1:198.51.100.7");
  });

  it("rate limits repeated attempts on one account", async () => {
    signIn();
    for (let i = 0; i < 5; i++) expect((await deleteRoute.POST(deleteRequest({ email: EMAIL, password: "wrong" }, `198.51.100.${i}`))).status).toBe(401);
    const blocked = await deleteRoute.POST(deleteRequest({ email: EMAIL, password: PASSWORD }, "198.51.100.9"));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(rows.users()).toHaveLength(2);
  });
});
