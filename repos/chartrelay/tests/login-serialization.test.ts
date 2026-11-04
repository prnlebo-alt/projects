import { describe, expect, it } from "vitest";
import { queuedKeys, serialize } from "@/lib/security/serialize";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("attempts against one account queue instead of racing", () => {
  it("runs work for the same key one at a time", async () => {
    // The login backoff is a per-request sleep. Thirty concurrent guesses all sleeping at once measured
    // about nine times faster than ten sequential ones — a delay that runs in parallel is not a delay.
    let running = 0;
    let peak = 0;
    const work = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await sleep(5);
      running -= 1;
    };
    await Promise.all(Array.from({ length: 8 }, () => serialize("account:a@example.com", work)));
    expect(peak).toBe(1);
  });

  it("takes at least as long as the sum of the work", async () => {
    const started = Date.now();
    await Promise.all(Array.from({ length: 4 }, () => serialize("account:b@example.com", () => sleep(10))));
    expect(Date.now() - started).toBeGreaterThanOrEqual(35);
  });

  it("does not serialize different accounts against each other", async () => {
    // One user being attacked must not slow down everyone else's logins.
    let running = 0;
    let peak = 0;
    const work = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await sleep(10);
      running -= 1;
    };
    await Promise.all(Array.from({ length: 4 }, (_, i) => serialize(`account:${i}@example.com`, work)));
    expect(peak).toBeGreaterThan(1);
  });

  it("keeps running after a failure, and still reports it", async () => {
    const key = "account:c@example.com";
    await expect(serialize(key, async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    await expect(serialize(key, async () => "next")).resolves.toBe("next");
  });

  it("does not grow a map entry per email address forever", async () => {
    // The key is derived from caller-supplied text, so an unbounded map is a leak whose size an
    // attacker chooses.
    for (let i = 0; i < 50; i++) await serialize(`account:leak${i}@example.com`, async () => i);
    await sleep(5);
    expect(queuedKeys()).toBe(0);
  });
});
