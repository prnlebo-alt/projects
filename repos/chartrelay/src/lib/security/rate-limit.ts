import { eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
/** Longest window any caller uses. Rows older than this are expired for every key and can be deleted. */
export const MAX_WINDOW_MS = HOUR;
const PRUNE_INTERVAL_MS = MINUTE;
let lastPrune = 0;

/** Deletes rows whose window has ended for every possible limit, so the table cannot grow without bound. */
export function pruneRateLimits(now = Date.now()) {
  lastPrune = now;
  return db.delete(rateLimits).where(lt(rateLimits.windowStart, now - MAX_WINDOW_MS)).run().changes;
}

function maybePrune(now: number) {
  if (now - lastPrune >= PRUNE_INTERVAL_MS || now < lastPrune) pruneRateLimits(now);
}

/**
 * Fixed-window counter stored in SQLite, so limits survive restarts on the single-server pilot.
 * Replace with shared storage (e.g. Redis) before running more than one instance.
 */
export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  maybePrune(now);
  return db.transaction((tx) => {
    const row = tx.select().from(rateLimits).where(eq(rateLimits.key, key)).get();
    if (!row || now - row.windowStart >= windowMs) {
      tx.insert(rateLimits).values({ key, windowStart: now, count: 1 }).onConflictDoUpdate({ target: rateLimits.key, set: { windowStart: now, count: 1 } }).run();
      return { allowed: true, retryAfterSeconds: 0 };
    }
    const retryAfterSeconds = Math.ceil((row.windowStart + windowMs - now) / 1000);
    if (row.count >= limit) return { allowed: false, retryAfterSeconds };
    tx.update(rateLimits).set({ count: row.count + 1 }).where(eq(rateLimits.key, key)).run();
    return { allowed: true, retryAfterSeconds: 0 };
  });
}

/** Reads a counter without incrementing it. `count` is 0 when the window has ended. */
export function peekRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult & { count: number } {
  const row = db.select().from(rateLimits).where(eq(rateLimits.key, key)).get();
  if (!row || now - row.windowStart >= windowMs) return { allowed: true, retryAfterSeconds: 0, count: 0 };
  const retryAfterSeconds = Math.ceil((row.windowStart + windowMs - now) / 1000);
  return { allowed: row.count < limit, retryAfterSeconds: row.count < limit ? 0 : retryAfterSeconds, count: row.count };
}

export function clearRateLimit(key: string) {
  db.delete(rateLimits).where(eq(rateLimits.key, key)).run();
}

function trustedProxyHops(env: Record<string, string | undefined>) {
  const raw = env.TRUSTED_PROXY_HOPS;
  if (raw === undefined || raw === "") return 1;
  const hops = Number.parseInt(raw, 10);
  return Number.isFinite(hops) && hops >= 0 ? hops : 1;
}

/**
 * Client IP as seen by the trusted reverse proxy.
 * Proxies (Railway, Fly, nginx `proxy_add_x_forwarded_for`) append the address they saw to the right of any
 * client-supplied X-Forwarded-For, so only the entry TRUSTED_PROXY_HOPS positions from the right is trustworthy.
 * The leftmost entry is attacker-controlled. TRUSTED_PROXY_HOPS=0 means no proxy: the header is ignored and all
 * clients share one bucket (set it correctly for your deployment; the default of 1 fits a single proxy).
 */
export function clientIp(request: Request, env: Record<string, string | undefined> = process.env) {
  const hops = trustedProxyHops(env);
  if (hops === 0) return "local";
  const entries = (request.headers.get("x-forwarded-for") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  if (entries.length === 0) return "local";
  return entries[Math.max(0, entries.length - hops)];
}
