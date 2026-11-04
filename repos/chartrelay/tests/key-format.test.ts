import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Counts every property access on the database handle.
 *
 * This is the only way to assert the thing the checksum exists for. "Returns undefined for a bad key"
 * passes whether or not a query ran; what has to be true is that **no** query ran, and that is a claim
 * about the database being untouched, not about the return value.
 */
const probes = vi.hoisted(() => ({ dbTouches: 0 }));
vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    db: new Proxy({}, { get(_target, property) { probes.dbTouches++; return Reflect.get(actual.db, property); } }),
  };
});

const {
  BASE62_ALPHABET, KEY_LENGTH, base62Encode, checksumFor, crc32, createApiKeyValue,
  inspectApiKey, apiKeyLast4, apiKeyMode, apiKeyShapeAcceptable,
} = await import("@/lib/auth/key-utils");
const { findApiKey } = await import("@/lib/auth/api-keys");

beforeEach(() => { probes.dbTouches = 0; });

describe("the key format", () => {
  it("is cr_live_ / cr_test_ plus 43 Base62 digits plus a 6-character checksum", () => {
    for (const mode of ["live", "test"] as const) {
      const value = createApiKeyValue(mode);
      expect(value).toMatch(new RegExp(`^cr_${mode}_[0-9A-Za-z]{49}$`));
      expect(value).toHaveLength(KEY_LENGTH);
      expect(KEY_LENGTH).toBe(57);
      expect(apiKeyMode(value)).toBe(mode);
    }
  });

  it("carries 32 bytes of entropy, not 24", () => {
    // 62**43 is the smallest Base62 width that holds 2**256, so the width is the entropy claim.
    expect(62 ** 43 > 2 ** 256).toBe(true);
    expect(62 ** 42 > 2 ** 256).toBe(false);
    const values = new Set(Array.from({ length: 200 }, () => createApiKeyValue()));
    expect(values.size).toBe(200);
  });

  it("uses an alphabet with no - or _, so a key survives a double-click", () => {
    expect(BASE62_ALPHABET).toHaveLength(62);
    expect(new Set(BASE62_ALPHABET).size).toBe(62);
    expect(createApiKeyValue().slice("cr_live_".length)).not.toMatch(/[-_]/);
  });

  it("pads Base62 to a fixed width, so the checksum is always the last six characters", () => {
    // A value with leading zero bytes is where an unpadded encoder produces a short key, two possible
    // parses of the same string, and a length the verifier cannot rely on.
    expect(base62Encode(new Uint8Array(32), 43)).toBe("0".repeat(43));
    const almostZero = new Uint8Array(32);
    almostZero[31] = 1;
    expect(base62Encode(almostZero, 43)).toBe(`${"0".repeat(42)}1`);
    expect(base62Encode(Uint8Array.from([0, 0, 62]), 6)).toBe("000010");
  });

  it("refuses to encode a value wider than the field", () => {
    expect(() => base62Encode(Uint8Array.from([255, 255]), 2)).toThrow(/digits/);
  });
});

describe("the checksum", () => {
  it("is CRC-32, pinned to published vectors rather than to itself", () => {
    // Standard IEEE 802.3 CRC-32 vectors. Pinned so the algorithm cannot be swapped while every key
    // already issued keeps its checksum — the same guard the SHA-256 test gives the stored hashes.
    expect(crc32("")).toBe(0x00000000);
    expect(crc32("a")).toBe(0xe8b7be43);
    expect(crc32("abc")).toBe(0x352441c2);
    expect(crc32("message digest")).toBe(0x20159d7f);
    expect(crc32("123456789")).toBe(0xcbf43926);
    expect(crc32("The quick brown fox jumps over the lazy dog")).toBe(0x414fa339);
  });

  it("is six Base62 characters and deterministic", () => {
    expect(checksumFor("cr_live_abc")).toHaveLength(6);
    expect(checksumFor("cr_live_abc")).toBe(checksumFor("cr_live_abc"));
    expect(checksumFor("cr_live_abc")).not.toBe(checksumFor("cr_live_abd"));
  });

  it("covers the prefix, so cr_test_ cannot be edited into cr_live_", () => {
    const test = createApiKeyValue("test");
    const pretendLive = `cr_live_${test.slice("cr_test_".length)}`;
    expect(inspectApiKey(test)).toEqual({ format: "current", mode: "test" });
    expect(inspectApiKey(pretendLive)).toEqual({ format: "invalid", reason: "bad_checksum" });
  });

  it("rejects a mistyped, truncated or padded key", () => {
    const value = createApiKeyValue();
    const swap = (text: string, index: number) => {
      const replacement = text[index] === "A" ? "B" : "A";
      return text.slice(0, index) + replacement + text.slice(index + 1);
    };
    expect(inspectApiKey(swap(value, 10)).format).toBe("invalid");
    expect(inspectApiKey(swap(value, value.length - 1)).format).toBe("invalid");
    expect(inspectApiKey(value.slice(0, -1)).format).toBe("invalid");
    expect(inspectApiKey(`${value}x`).format).toBe("invalid");
    expect(inspectApiKey("cr_live_not-base62-at-all").format).toBe("invalid");
    expect(inspectApiKey("sk_live_somethingelse").format).toBe("invalid");
    expect(inspectApiKey("").format).toBe("invalid");
    expect(inspectApiKey(value).format).toBe("current");
  });

  it("still recognises keys issued before the checksum existed", () => {
    // cr_live_ + 24 bytes of base64url, the format in the database today.
    const legacy = "cr_live_abcdefghijklmnopqrstuvwxyz012345";
    expect(legacy).toHaveLength(40);
    expect(inspectApiKey(legacy)).toEqual({ format: "legacy", mode: "live" });
    expect(apiKeyShapeAcceptable(legacy)).toBe(true);
    // A legacy-length string with the wrong alphabet is still refused.
    expect(inspectApiKey(`cr_live_${"!".repeat(32)}`).format).toBe("invalid");
    // And there is no legacy test key: the prefix is new, so the checksum is mandatory.
    expect(inspectApiKey("cr_test_abcdefghijklmnopqrstuvwxyz012345").format).toBe("invalid");
  });

  it("names the last four characters, so two keys are distinguishable in a list", () => {
    const value = createApiKeyValue();
    expect(apiKeyLast4(value)).toBe(value.slice(-4));
    expect(apiKeyLast4(value)).toHaveLength(4);
  });
});

describe("rejecting a bad key before the database", () => {
  it("does not touch the database for a key that fails its own checksum", async () => {
    const mistyped = `${createApiKeyValue().slice(0, -1)}X`;
    expect(await findApiKey(mistyped)).toBeUndefined();
    expect(probes.dbTouches).toBe(0);
  });

  it("does not touch the database for a fabricated or empty key", async () => {
    for (const fake of ["", "cr_live_", "hunter2", "Bearer cr_live_x", "cr_live_".padEnd(57, "A")]) {
      expect(await findApiKey(fake)).toBeUndefined();
    }
    expect(probes.dbTouches).toBe(0);
  });

  it("does touch the database for a well-formed key, so the test above can fail", async () => {
    // Without this control, a findApiKey that never queried at all would pass every assertion above.
    expect(await findApiKey(createApiKeyValue())).toBeUndefined();
    expect(probes.dbTouches).toBeGreaterThan(0);
  });
});
