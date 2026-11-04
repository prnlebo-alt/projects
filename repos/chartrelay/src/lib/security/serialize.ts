/**
 * One at a time, per key.
 *
 * The login route slows a guessed password with a per-request sleep, which only works if the guesses
 * queue. They did not: a security review measured ten sequential guesses taking 33.1 seconds and thirty
 * concurrent ones taking 11.5, because every request slept at the same time. A delay that runs in
 * parallel is not a delay, it is a pause.
 *
 * Single-process by design, which matches the deployment: one instance, one SQLite file. On several
 * instances an attacker would get one concurrent attempt per instance — better than unbounded, and the
 * per-IP and per-account-and-IP limits are the layers that do not depend on this.
 */
const chains = new Map<string, Promise<unknown>>();

export function serialize<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = chains.get(key) ?? Promise.resolve();
  // A failure in one caller must not poison the queue for the next, so the chain swallows it; the
  // result itself is still handed back to whoever asked for it.
  const result = previous.then(work, work);
  const settled = result.then(() => {}, () => {});
  chains.set(key, settled);
  // Without this the map grows one entry per distinct key for the life of the process, which for a key
  // derived from a caller-supplied email address is a memory leak an attacker chooses the size of.
  settled.then(() => {
    if (chains.get(key) === settled) chains.delete(key);
  });
  return result;
}

/** Number of keys currently queued. Exported for the test that proves the map does not grow forever. */
export const queuedKeys = () => chains.size;
