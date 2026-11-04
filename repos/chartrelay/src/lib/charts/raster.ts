import { asc, eq, isNotNull, sql } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/lib/db";
import { renders } from "@/lib/db/schema";

/** The largest allowed chart is 2400x1600; anything bigger is not one of ours. */
const MAX_INPUT_PIXELS = 2400 * 1600;
/** Rasterizing is CPU-heavy; cap it so a burst of PNG requests cannot starve the rest of the server. */
const MAX_CONCURRENT_RASTERS = 2;

let active = 0;
const waiting: Array<() => void> = [];
const inflight = new Map<string, Promise<Buffer>>();

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT_RASTERS) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
  try {
    return await task();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

export async function rasterize(svg: string) {
  return withSlot(() => sharp(Buffer.from(svg), { limitInputPixels: MAX_INPUT_PIXELS }).png().toBuffer());
}

/** PNGs larger than this are served but never stored. */
export const MAX_STORED_PNG_BYTES = 512 * 1024;
/** Total bytes of stored PNGs before the oldest are evicted (regenerated on demand). */
export function pngCacheBudget(env: Record<string, string | undefined> = process.env) {
  // Plain integers only: "200MB" would otherwise parse as 200 bytes.
  const raw = (env.PNG_CACHE_MAX_BYTES ?? "").trim();
  return /^\d+$/.test(raw) ? Number(raw) : 200 * 1024 * 1024;
}

/** Clears the oldest stored PNGs until the total is at most 80% of the budget. Returns the number evicted. */
export function enforcePngBudget(budget = pngCacheBudget()) {
  // Both queries are answered from idx_renders_png_bytes (partial index on created_at, length(png)); keep their shape in sync with it.
  const total = Number(db.select({ total: sql<number>`coalesce(sum(length(${renders.png})), 0)` }).from(renders).where(isNotNull(renders.png)).get()?.total ?? 0);
  if (total <= budget) return 0;
  const target = Math.floor(budget * 0.8);
  let remaining = total;
  let evicted = 0;
  const oldest = db.select({ rowid: sql<number>`${renders}.rowid`, size: sql<number>`length(${renders.png})` }).from(renders).where(isNotNull(renders.png)).orderBy(asc(renders.createdAt)).all();
  for (const row of oldest) {
    if (remaining <= target) break;
    db.update(renders).set({ png: null }).where(sql`rowid = ${row.rowid}`).run();
    remaining -= Number(row.size);
    evicted++;
  }
  return evicted;
}

/**
 * Returns the PNG for a render, rasterizing on first request and storing it when it fits the cache policy.
 * Concurrent first requests for the same id share one rasterization. Storage is bounded by pngCacheBudget().
 */
export async function storedPng(id: string, svg: string, cached: Buffer | null): Promise<Buffer> {
  if (cached) return cached;
  const pending = inflight.get(id);
  if (pending) return pending;
  const job = (async () => {
    const png = await rasterize(svg);
    const budget = pngCacheBudget();
    if (png.length <= MAX_STORED_PNG_BYTES && png.length <= budget) {
      db.update(renders).set({ png }).where(eq(renders.id, id)).run();
      enforcePngBudget(budget);
    }
    return png;
  })().finally(() => inflight.delete(id));
  inflight.set(id, job);
  return job;
}
