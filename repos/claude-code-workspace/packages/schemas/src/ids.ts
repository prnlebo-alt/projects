import { createHash, randomUUID } from "node:crypto";

/** Generates a fresh v4 UUID for a new row's primary key. */
export function newId(): string {
  return randomUUID();
}

/**
 * Deterministic SHA-256 hex digest of arbitrary content. Used for
 * content_hash (snapshots), prompt_content_hash (agent_runs), and any other
 * place the architecture requires a stable, reproducible fingerprint.
 */
export function sha256Hex(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Canonical JSON stringify: recursively sorts object keys so semantically
 * identical objects always hash to the same string, regardless of
 * construction order. Used before hashing structured payloads (prompts,
 * fixtures, audit payloads).
 */
export function canonicalJSONStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0
    );
    return Object.fromEntries(entries.map(([k, v]) => [k, sortKeysDeep(v)]));
  }
  return value;
}

/**
 * A deterministic, seedable pseudo-random generator (mulberry32). Given the
 * same seed string, produces the same sequence of floats in [0, 1) forever.
 * Used for the reproducible non-material audit sample
 * (ARCHITECTURE.md §7.10 / EVIDENCE_DOCTRINE.md).
 */
export function seededRandom(seed: string): () => number {
  let a = hashSeedToUint32(seed);
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeedToUint32(seed: string): number {
  const digest = createHash("sha256").update(seed).digest();
  return digest.readUInt32BE(0);
}

/**
 * Deterministically decides whether `itemId` falls within the given sample
 * rate for `runSeed`. Same (runSeed, itemId, rate) always returns the same
 * answer, and is independent of iteration order — reproducible from the
 * seed alone, per EVIDENCE_DOCTRINE.md's audit-sampling requirement.
 */
export function isInDeterministicSample(runSeed: string, itemId: string, rate: number): boolean {
  const rng = seededRandom(`${runSeed}:${itemId}`);
  return rng() < rate;
}
