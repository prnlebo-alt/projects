import { beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  createApiKeyValue, effectiveKeyMode, findApiKey, keyAllowsAddress, keyBudgetRemaining,
  keyHasScope, keyInactiveReason, keyLabel, keyPolicy, keyScopes, keySpendThisMonth, parseScopes,
  revokeApiKey, rotateApiKey, ROTATION_GRACE_MS, storeApiKey, withinKeyBudget,
} from "@/lib/auth/api-keys";
import { hashApiKey, ipInAllowlist, isCidr, parseIp } from "@/lib/auth/key-utils";
import { db } from "@/lib/db";
import { apiKeys, usageEvents, users, workspaces } from "@/lib/db/schema";

const WS = "ws-keys";
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  for (const table of [usageEvents, apiKeys, workspaces, users]) db.delete(table).run();
  const now = new Date().toISOString();
  db.insert(users).values({ id: "u-keys", email: "keys@example.com", passwordHash: "x", name: "T", createdAt: now }).run();
  db.insert(workspaces).values({ id: WS, ownerId: "u-keys", name: "W", createdAt: now }).run();
});

describe("API keys", () => {
  it("generates scoped-looking random values", () => {
    const first = createApiKeyValue();
    const second = createApiKeyValue();
    expect(first).toMatch(/^cr_live_/);
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(40);
  });

  it("hashes distinct keys to distinct digests", () => {
    // hashApiKey(x) === hashApiKey(x) says nothing: a function returning a constant passes it. What a
    // lookup by key hash actually depends on is that two different keys cannot share a digest.
    const digests = new Set(Array.from({ length: 50 }, () => hashApiKey(createApiKeyValue())));
    expect(digests.size).toBe(50);
    expect(hashApiKey("cr_live_one")).not.toBe(hashApiKey("cr_live_two"));
    for (const digest of digests) expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is SHA-256, pinned to published vectors rather than to itself", () => {
    // NIST FIPS 180-2 / RFC 6234 test vectors. Stored digests must stay readable by any future
    // implementation, so the algorithm cannot be swapped without this failing.
    expect(hashApiKey("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hashApiKey("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(hashApiKey("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });
});

describe("storing a key", () => {
  it("keeps the secret out of the row and the last four characters in it", () => {
    const key = storeApiKey(WS, "CI");
    const row = db.select().from(apiKeys).all()[0];
    expect(row.keyHash).toBe(hashApiKey(key.value));
    expect(JSON.stringify(row)).not.toContain(key.value.slice(20));
    expect(row.last4).toBe(key.value.slice(-4));
    expect(keyLabel(row)).toBe(`${row.prefix}…${key.value.slice(-4)}`);
  });

  it("gives two keys of the same workspace distinguishable labels", () => {
    const first = storeApiKey(WS, "one");
    const second = storeApiKey(WS, "two");
    // Both share the eight-character prefix; only last4 tells them apart in a list.
    expect(first.prefix.slice(0, 8)).toBe(second.prefix.slice(0, 8));
    expect(keyLabel(first)).not.toBe(keyLabel(second));
  });

  it("records the agent tag, budget, allowlist and expiry it was given", () => {
    const expiresAt = new Date(Date.now() + 30 * DAY).toISOString();
    const key = storeApiKey(WS, "agent", {
      agentTag: "nightly-reporter", monthlyBudget: 500, ipAllowlist: ["203.0.113.0/24"], expiresAt,
    });
    const row = db.select().from(apiKeys).all()[0];
    expect(row.agentTag).toBe("nightly-reporter");
    expect(row.monthlyBudget).toBe(500);
    expect(row.ipAllowlist).toBe("203.0.113.0/24");
    expect(row.expiresAt).toBe(expiresAt);
    expect(keyPolicy(row).agentTag).toBe("nightly-reporter");
    expect(key.agentTag).toBe("nightly-reporter");
  });
});

describe("scopes", () => {
  it("defaults to render only when nothing is recorded", () => {
    for (const recorded of [null, undefined, "", "   ", ",,"]) {
      expect(parseScopes(recorded)).toEqual(["render"]);
    }
    const key = storeApiKey(WS, "default");
    expect(keyScopes(key)).toEqual(["render"]);
    expect(keyHasScope(key, "render")).toBe(true);
    expect(keyHasScope(key, "usage:read")).toBe(false);
    expect(keyHasScope(key, "keys:admin")).toBe(false);
  });

  it("does not hand out render just because another scope was asked for", () => {
    // The default is render-only; an explicit list is exactly the list. A reader key that could also
    // render would be a quota the customer did not intend to delegate.
    const key = storeApiKey(WS, "reader", { scopes: ["usage:read"] });
    expect(keyScopes(key)).toEqual(["usage:read"]);
    expect(keyHasScope(key, "usage:read")).toBe(true);
    expect(keyHasScope(key, "render")).toBe(false);
  });

  it("grants only the three known scopes, and drops anything else", () => {
    expect(parseScopes("render,usage:read,keys:admin")).toEqual(["render", "usage:read", "keys:admin"]);
    expect(parseScopes("render,render")).toEqual(["render"]);
    expect(parseScopes("admin,*,billing:write")).toEqual(["render"]);
    expect(parseScopes("usage:read,nonsense")).toEqual(["usage:read"]);
  });
});

describe("expiry", () => {
  it("stops authenticating the moment it passes", async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const key = storeApiKey(WS, "short-lived", { expiresAt });
    expect(await findApiKey(key.value)).toBeTruthy();
    expect(await findApiKey(key.value, new Date(Date.now() + 2 * 60 * 60 * 1000))).toBeUndefined();
    expect(keyInactiveReason(key, new Date(Date.now() + 2 * 60 * 60 * 1000))).toBe("expired");
  });

  it("treats an unreadable expiry as expired rather than absent", () => {
    // A date column we cannot parse is a database we do not understand; honouring the credential
    // anyway is the one failure direction that cannot be recovered from.
    expect(keyInactiveReason({ revokedAt: null, expiresAt: "whenever", rotatedAt: null })).toBe("expired");
    expect(keyInactiveReason({ revokedAt: null, expiresAt: null, rotatedAt: "whenever" })).toBe("rotation_grace_ended");
  });

  it("leaves a key with no expiry alone", async () => {
    const key = storeApiKey(WS, "permanent");
    expect(await findApiKey(key.value, new Date(Date.now() + 3650 * DAY))).toBeTruthy();
  });
});

describe("rotation", () => {
  it("keeps the old key working for seven days and then stops it", async () => {
    const original = storeApiKey(WS, "embedded");
    const result = await rotateApiKey({ keyId: original.id, workspaceId: WS });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sixDays = new Date(Date.now() + 6 * DAY);
    const eightDays = new Date(Date.now() + 8 * DAY);
    expect(await findApiKey(original.value, sixDays)).toBeTruthy();
    // Nobody has to come back and finish the rotation: the grace runs out on its own.
    expect(await findApiKey(original.value, eightDays)).toBeUndefined();
    expect(await findApiKey(result.replacement.value, eightDays)).toBeTruthy();
    expect(Date.parse(result.graceEndsAt) - Date.now()).toBeGreaterThan(6.9 * DAY);
    expect(ROTATION_GRACE_MS).toBe(7 * DAY);
  });

  it("points the old row at its replacement", async () => {
    const original = storeApiKey(WS, "embedded");
    const result = await rotateApiKey({ keyId: original.id, workspaceId: WS });
    const row = db.select().from(apiKeys).where(eq(apiKeys.id, original.id)).all()[0];
    expect(result.ok && row.supersededByKeyId).toBe(result.ok && result.replacement.id);
    expect(row.rotatedAt).toBeTruthy();
  });

  it("carries the original's settings across instead of widening them", async () => {
    const original = storeApiKey(WS, "narrow", {
      mode: "test", scopes: ["usage:read"], monthlyBudget: 10, ipAllowlist: ["198.51.100.7/32"], agentTag: "bot",
    });
    const result = await rotateApiKey({ keyId: original.id, workspaceId: WS });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.replacement.mode).toBe("test");
    expect(result.replacement.value.startsWith("cr_test_")).toBe(true);
    expect(keyScopes(result.replacement)).toEqual(["usage:read"]);
    expect(result.replacement.monthlyBudget).toBe(10);
    expect(result.replacement.ipAllowlist).toBe("198.51.100.7/32");
    expect(result.replacement.agentTag).toBe("bot");
  });

  it("refuses to rotate another workspace's key, a revoked key, or a key twice", async () => {
    const key = storeApiKey(WS, "k");
    expect(await rotateApiKey({ keyId: key.id, workspaceId: "someone-else" })).toEqual({ ok: false, reason: "not_found" });
    expect((await rotateApiKey({ keyId: key.id, workspaceId: WS })).ok).toBe(true);
    // A second rotation would restart the grace period and leave two live secrets for a key the
    // customer believes they have already replaced.
    expect(await rotateApiKey({ keyId: key.id, workspaceId: WS })).toEqual({ ok: false, reason: "already_rotated" });

    const revoked = storeApiKey(WS, "gone");
    await revokeApiKey(revoked.id, WS);
    expect(await rotateApiKey({ keyId: revoked.id, workspaceId: WS })).toEqual({ ok: false, reason: "revoked" });
  });

  it("revokes instantly, with no grace of any kind", async () => {
    const key = storeApiKey(WS, "leaked");
    expect(await findApiKey(key.value)).toBeTruthy();
    expect(await revokeApiKey(key.id, WS)).toBe(true);
    expect(await findApiKey(key.value)).toBeUndefined();
    expect(await findApiKey(key.value, new Date(Date.now() - 60_000))).toBeUndefined();
    expect(await revokeApiKey(key.id, "someone-else")).toBe(false);
  });

  it("revokes a key that was already rotated, inside its grace", async () => {
    // The grace is a convenience, not a promise: a key that has leaked must die now even if it was
    // rotated yesterday and is still inside its seven days.
    const key = storeApiKey(WS, "leaked-mid-rotation");
    await rotateApiKey({ keyId: key.id, workspaceId: WS });
    expect(await findApiKey(key.value)).toBeTruthy();
    await revokeApiKey(key.id, WS);
    expect(await findApiKey(key.value)).toBeUndefined();
    // Asserted on the row as well as through the lookup: the lookup also filters revoked keys in SQL,
    // so it would keep passing even if the in-code reason ranked the grace above the revocation.
    const row = db.select().from(apiKeys).where(eq(apiKeys.id, key.id)).all()[0];
    expect(row.rotatedAt).toBeTruthy();
    expect(keyInactiveReason(row)).toBe("revoked");
  });
});

describe("test keys", () => {
  it("are a property of the key, so the render path can read it without a second query", () => {
    const live = storeApiKey(WS, "live key");
    const test = storeApiKey(WS, "test key", { mode: "test" });
    expect(test.value.startsWith("cr_test_")).toBe(true);
    expect(keyPolicy(live)).toMatchObject({ mode: "live", billable: true, watermarked: false });
    expect(keyPolicy(test)).toMatchObject({ mode: "test", billable: false, watermarked: true });
  });

  it("authenticate like any other key", async () => {
    const test = storeApiKey(WS, "playground", { mode: "test" });
    const found = await findApiKey(test.value);
    expect(found).toBeTruthy();
    expect(found && keyPolicy(found).billable).toBe(false);
  });

  it("stay unbilled when the column and the prefix disagree", () => {
    // Hand-edited rows and half-finished migrations happen. Being wrong towards "test" costs an
    // unbilled watermarked render; being wrong the other way charges for a key we called free.
    const test = storeApiKey(WS, "test key", { mode: "test" });
    db.update(apiKeys).set({ mode: "live" }).where(eq(apiKeys.id, test.id)).run();
    const row = db.select().from(apiKeys).where(eq(apiKeys.id, test.id)).all()[0];
    expect(effectiveKeyMode(row)).toBe("test");
    expect(keyPolicy(row).billable).toBe(false);
  });
});

describe("the per-key monthly budget", () => {
  const spend = (keyId: string, units: number, status: "charged" | "reserved" | "refunded", at = new Date()) =>
    db.insert(usageEvents).values({
      id: `ev-${keyId}-${status}-${at.getTime()}-${units}`, workspaceId: WS, kind: "render",
      keyId, units, status, createdAt: at.toISOString(),
    }).run();

  it("counts charged and reserved units, and ignores refunded ones", () => {
    const key = storeApiKey(WS, "capped", { monthlyBudget: 3 });
    spend(key.id, 2, "charged");
    spend(key.id, 5, "refunded");
    expect(keySpendThisMonth(key.id)).toBe(2);
    expect(keyBudgetRemaining(key)).toBe(1);
    expect(withinKeyBudget(key, 1)).toBe(true);
    expect(withinKeyBudget(key, 2)).toBe(false);
    // A reservation is credit already committed; ignoring it lets concurrent requests each see room.
    spend(key.id, 1, "reserved");
    expect(keySpendThisMonth(key.id)).toBe(3);
    expect(keyBudgetRemaining(key)).toBe(0);
    expect(withinKeyBudget(key, 1)).toBe(false);
  });

  it("does not count last month's spend against this month's budget", () => {
    const key = storeApiKey(WS, "capped", { monthlyBudget: 3 });
    const lastMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1) - DAY);
    spend(key.id, 3, "charged", lastMonth);
    expect(keySpendThisMonth(key.id)).toBe(0);
    expect(withinKeyBudget(key, 1)).toBe(true);
  });

  it("does not count another key's spend", () => {
    const first = storeApiKey(WS, "a", { monthlyBudget: 1 });
    const second = storeApiKey(WS, "b", { monthlyBudget: 1 });
    spend(second.id, 1, "charged");
    expect(keySpendThisMonth(first.id)).toBe(0);
    expect(withinKeyBudget(first, 1)).toBe(true);
    expect(withinKeyBudget(second, 1)).toBe(false);
  });

  it("means no cap when no budget is set", () => {
    const key = storeApiKey(WS, "uncapped");
    spend(key.id, 10_000, "charged");
    expect(keyBudgetRemaining(key)).toBeNull();
    expect(withinKeyBudget(key, 10_000)).toBe(true);
  });
});

describe("the per-key IP allowlist", () => {
  it("matches IPv4 CIDRs at the bit, not the byte", () => {
    const key = storeApiKey(WS, "office", { ipAllowlist: ["203.0.113.0/25"] });
    expect(keyAllowsAddress(key, "203.0.113.1")).toBe(true);
    expect(keyAllowsAddress(key, "203.0.113.127")).toBe(true);
    // A /25 that compared whole bytes would wave this through.
    expect(keyAllowsAddress(key, "203.0.113.128")).toBe(false);
    expect(keyAllowsAddress(key, "203.0.114.1")).toBe(false);
  });

  it("matches IPv6 CIDRs, including an IPv4-mapped address", () => {
    expect(ipInAllowlist("2001:db8:abcd::/48", "2001:db8:abcd:1234::1")).toBe(true);
    expect(ipInAllowlist("2001:db8:abcd::/48", "2001:db8:abce::1")).toBe(false);
    expect(ipInAllowlist("2001:db8::1", "2001:db8::1")).toBe(true);
    expect(ipInAllowlist("2001:db8::1", "2001:db8::2")).toBe(false);
    // Which spelling arrives is the proxy chain's choice, not the customer's.
    expect(ipInAllowlist("203.0.113.0/24", "::ffff:203.0.113.9")).toBe(true);
    expect(ipInAllowlist("203.0.113.0/24", "::ffff:198.51.100.9")).toBe(false);
    // Families do not cross: an IPv4 rule never admits a real IPv6 host.
    expect(ipInAllowlist("0.0.0.0/0", "2001:db8::1")).toBe(false);
    expect(ipInAllowlist("::/0", "2001:db8::1")).toBe(true);
  });

  it("fails closed when the address is missing, unparseable or ambiguous", () => {
    const key = storeApiKey(WS, "office", { ipAllowlist: ["203.0.113.0/24"] });
    expect(keyAllowsAddress(key, null)).toBe(false);
    expect(keyAllowsAddress(key, "")).toBe(false);
    expect(keyAllowsAddress(key, "not-an-address")).toBe(false);
    expect(keyAllowsAddress(key, "203.0.113.9, 70.1.2.3")).toBe(false);
    // 010 is 8 to some resolvers and 10 to others; an allowlist that guesses is a bypass.
    expect(parseIp("203.0.113.010")).toBeNull();
    expect(keyAllowsAddress(key, "203.0.113.010")).toBe(false);
    // A malformed rule matches nothing rather than everything.
    expect(ipInAllowlist("203.0.113.0/99", "203.0.113.9")).toBe(false);
    expect(ipInAllowlist("garbage", "203.0.113.9")).toBe(false);
    expect(isCidr("203.0.113.0/99")).toBe(false);
    expect(isCidr("203.0.113.0/24")).toBe(true);
    expect(isCidr("2001:db8::/32")).toBe(true);
  });

  it("allows any address when no allowlist is set", () => {
    const key = storeApiKey(WS, "open");
    expect(key.ipAllowlist).toBeNull();
    expect(keyAllowsAddress(key, "198.51.100.1")).toBe(true);
    expect(keyAllowsAddress(key, null)).toBe(true);
  });
});

describe("keys issued before this format existed", () => {
  /** A row exactly as the old `cr_live_` + 24-byte base64url minting left it: no checksum, no last4. */
  const insertLegacy = () => {
    const value = `cr_live_${randomBytes(24).toString("base64url")}`;
    db.insert(apiKeys).values({
      id: "legacy-1", workspaceId: WS, name: "Legacy", keyHash: hashApiKey(value),
      prefix: value.slice(0, 12), last4: null, createdAt: new Date().toISOString(),
    }).run();
    return value;
  };

  it("keep authenticating", async () => {
    const value = insertLegacy();
    expect(value).toHaveLength(40);
    const found = await findApiKey(value);
    expect(found).toBeTruthy();
    expect(found?.id).toBe("legacy-1");
  });

  it("get render scope and live billing from the column defaults", async () => {
    const found = await findApiKey(insertLegacy());
    expect(found && keyScopes(found)).toEqual(["render"]);
    expect(found && keyPolicy(found).billable).toBe(true);
    expect(found && keyPolicy(found).monthlyBudget).toBeNull();
  });

  it("are still revocable, and still listable without a last4", async () => {
    const value = insertLegacy();
    const row = db.select().from(apiKeys).all()[0];
    expect(row.last4).toBeNull();
    expect(keyLabel(row)).toBe(`${row.prefix}••••`);
    await revokeApiKey("legacy-1", WS);
    expect(await findApiKey(value)).toBeUndefined();
  });
});
