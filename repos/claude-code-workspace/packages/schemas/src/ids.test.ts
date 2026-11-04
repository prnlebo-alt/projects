import { describe, expect, it } from "vitest";
import { canonicalJSONStringify, isInDeterministicSample, sha256Hex } from "./ids.js";

describe("sha256Hex", () => {
  it("is deterministic for identical input", () => {
    expect(sha256Hex("hello")).toBe(sha256Hex("hello"));
  });

  it("differs for different input", () => {
    expect(sha256Hex("hello")).not.toBe(sha256Hex("hello world"));
  });
});

describe("canonicalJSONStringify", () => {
  it("produces identical output regardless of key order", () => {
    const a = { b: 1, a: 2, c: { z: 1, y: 2 } };
    const b = { a: 2, c: { y: 2, z: 1 }, b: 1 };
    expect(canonicalJSONStringify(a)).toBe(canonicalJSONStringify(b));
  });

  it("sorts keys inside arrays of objects too", () => {
    const value = [{ b: 1, a: 1 }];
    expect(canonicalJSONStringify(value)).toBe('[{"a":1,"b":1}]');
  });
});

describe("isInDeterministicSample", () => {
  it("is reproducible: same seed + item + rate always agrees with itself", () => {
    const results = Array.from({ length: 50 }, (_, i) =>
      isInDeterministicSample("seed-A", `claim-${i}`, 0.1)
    );
    const resultsAgain = Array.from({ length: 50 }, (_, i) =>
      isInDeterministicSample("seed-A", `claim-${i}`, 0.1)
    );
    expect(results).toEqual(resultsAgain);
  });

  it("is independent of the order items are evaluated in", () => {
    const ids = Array.from({ length: 200 }, (_, i) => `claim-${i}`);
    const forward = ids.map((id) => isInDeterministicSample("seed-B", id, 0.1));
    const shuffled = [...ids].reverse();
    const backward = shuffled.map((id) => isInDeterministicSample("seed-B", id, 0.1));
    // Map back to original order and compare.
    const backwardInOriginalOrder = ids.map((id) => backward[shuffled.indexOf(id)]);
    expect(forward).toEqual(backwardInOriginalOrder);
  });

  it("approximates the requested rate over many items", () => {
    const ids = Array.from({ length: 5000 }, (_, i) => `claim-${i}`);
    const sampled = ids.filter((id) => isInDeterministicSample("seed-C", id, 0.1));
    const rate = sampled.length / ids.length;
    expect(rate).toBeGreaterThan(0.07);
    expect(rate).toBeLessThan(0.13);
  });

  it("changes selection when the seed changes", () => {
    const ids = Array.from({ length: 200 }, (_, i) => `claim-${i}`);
    const seedA = ids.map((id) => isInDeterministicSample("seed-A", id, 0.1));
    const seedD = ids.map((id) => isInDeterministicSample("seed-D", id, 0.1));
    expect(seedA).not.toEqual(seedD);
  });
});
