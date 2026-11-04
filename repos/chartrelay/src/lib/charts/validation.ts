/**
 * Input limits, checked before any work is done.
 *
 * `docs/BILLING_SPEC.md` ("Request path", step 3) puts this ahead of everything that costs
 * something: "Validate input against tier limits (payload size, data points, output size, format)
 * → 400/413 **before any credit moves**". And the stress-test row "50 MB payload or 10M points →
 * 413 before any credit moves" is only true if the refusal also lands before the JSON parse, before
 * schema validation and before the renderer — a 50 MB body that is parsed and *then* refused has
 * already cost the server the parse.
 *
 * So the order below is deliberate and is the thing worth protecting:
 *
 *   1. declared/actual byte length      → 413, no parse
 *   2. textual nesting depth            → 400, no parse (JSON.parse itself overflows the stack on
 *                                         deeply nested input, so this cannot run after it)
 *   3. JSON.parse                       → 400 on failure
 *   4. data-point count                 → 413, counted from array lengths, short-circuiting, so a
 *                                         10,000,000-element array is refused without being walked
 *   5. output pixels                    → 413
 *   6. only now, the caller's work
 *
 * `guardChartPayload` is that sequence, and it takes the work as a callback precisely so the
 * ordering is testable rather than a comment.
 */
import type { z } from "zod";

/** Validation issues with the full path to each bad field (e.g. "series.1.data.3.label"), so clients can fix it. */
export function validationDetails(error: z.ZodError) {
  return { issues: error.issues.map((issue) => ({ path: issue.path.map(String).join(".") || "(root)", message: issue.message })) };
}

/**
 * The plan ladder from the billing spec.
 *
 * `payg` is the pay-as-you-go account the spec describes: no subscription, bought a pack, and
 * explicitly given "Developer-tier rate limits", so it shares Developer's caps.
 */
export type PlanTier = "free" | "payg" | "developer" | "pro" | "business";

export const PLAN_TIERS = ["free", "payg", "developer", "pro", "business"] as const;

export interface RenderLimits {
  /** Largest accepted request body, in bytes. */
  maxPayloadBytes: number;
  /** Largest accepted total number of data points across every series. */
  maxDataPoints: number;
  /** Largest accepted width × height. */
  maxOutputPixels: number;
  /** Largest SVG the renderer may hand back. The stand-in for a memory cap inside one render. */
  maxSvgBytes: number;
  /** Deepest JSON nesting accepted. A chart spec is 4 levels deep; the rest is an attack or a bug. */
  maxNestingDepth: number;
  /** Wall-clock budget for one render. */
  renderTimeoutMs: number;
}

/**
 * Per-tier caps.
 *
 * A function of the tier rather than a constant because the plan ladder (Free / Developer / Pro /
 * Business) is being built separately: whoever wires plans up changes the table here and nothing
 * else. Every call site takes the tier, so there is no single hard-coded number to forget.
 *
 * The render timeout is 10 s on every tier because the spec states it once, for everyone — it is a
 * safety limit, not a feature to sell. Only the input and output caps differ.
 */
const LIMITS: Record<PlanTier, RenderLimits> = {
  // 250 renders a month, watermarked, no card. Small caps are the point.
  free: { maxPayloadBytes: 64 * 1024, maxDataPoints: 400, maxOutputPixels: 1_440_000, maxSvgBytes: 512 * 1024, maxNestingDepth: 12, renderTimeoutMs: 10_000 },
  payg: { maxPayloadBytes: 256 * 1024, maxDataPoints: 1_200, maxOutputPixels: 2_400_000, maxSvgBytes: 1024 * 1024, maxNestingDepth: 16, renderTimeoutMs: 10_000 },
  developer: { maxPayloadBytes: 256 * 1024, maxDataPoints: 1_200, maxOutputPixels: 2_400_000, maxSvgBytes: 1024 * 1024, maxNestingDepth: 16, renderTimeoutMs: 10_000 },
  pro: { maxPayloadBytes: 512 * 1024, maxDataPoints: 5_000, maxOutputPixels: 3_840_000, maxSvgBytes: 2 * 1024 * 1024, maxNestingDepth: 24, renderTimeoutMs: 10_000 },
  business: { maxPayloadBytes: 1024 * 1024, maxDataPoints: 20_000, maxOutputPixels: 3_840_000, maxSvgBytes: 4 * 1024 * 1024, maxNestingDepth: 32, renderTimeoutMs: 10_000 },
};

/** The caps for one tier. An unknown tier gets the smallest caps, never the largest. */
export function limitsFor(tier: PlanTier | string | null | undefined): RenderLimits {
  return LIMITS[(tier ?? "free") as PlanTier] ?? LIMITS.free;
}

/** Codes from the published error contract (`src/lib/http/errors.ts`) that this module can raise. */
export type LimitCode = "payload_too_large" | "invalid_chart_spec";

/**
 * A cap was exceeded.
 *
 * Carries the code and status rather than letting each call site decide, so the 413/400 split
 * cannot drift between the route, the MCP server and a background job.
 */
export class LimitExceededError extends Error {
  readonly code: LimitCode;
  readonly status: number;
  /** Which cap, for logs and tests: "payload_bytes", "data_points", "output_pixels", "nesting_depth", "svg_bytes". */
  readonly limit: string;
  readonly observed: number;
  readonly allowed: number;
  readonly tier: PlanTier;

  constructor(code: LimitCode, limit: string, message: string, context: { observed: number; allowed: number; tier: PlanTier }) {
    super(message);
    this.name = "LimitExceededError";
    this.code = code;
    this.status = code === "payload_too_large" ? 413 : 400;
    this.limit = limit;
    this.observed = context.observed;
    this.allowed = context.allowed;
    this.tier = context.tier;
  }
}

const bytesOf = (body: string | Uint8Array | ArrayBuffer): number => {
  if (typeof body === "string") return Buffer.byteLength(body, "utf8");
  if (body instanceof ArrayBuffer) return body.byteLength;
  return body.byteLength;
};

/**
 * Byte cap. The first check, and the only one that may look at the body before anything parses it.
 *
 * A declared `Content-Length` is checked by `readJsonBody`; this is the same cap expressed per tier
 * and applied to the bytes actually in hand, so a chunked body with no declared length is covered
 * too.
 */
export function assertPayloadWithinLimits(body: string | Uint8Array | ArrayBuffer, tier: PlanTier): void {
  const limits = limitsFor(tier);
  const size = bytesOf(body);
  if (size > limits.maxPayloadBytes) {
    throw new LimitExceededError("payload_too_large", "payload_bytes", `The request body is ${size} bytes; the ${tier} tier accepts at most ${limits.maxPayloadBytes}.`, { observed: size, allowed: limits.maxPayloadBytes, tier });
  }
}

/**
 * Deepest `[`/`{` nesting in a JSON document, measured on the text.
 *
 * It has to be the text, not the parsed value: V8's JSON parser recurses, so a body of 200,000
 * open brackets throws `RangeError: Maximum call stack size exceeded` inside `JSON.parse` — a
 * depth check that runs on the result never gets to run at all, and the process eats a stack
 * overflow for every such request. String contents are skipped so a label of `"[[[["` is a label.
 *
 * Returns early once `ceiling` is passed, so measuring a hostile body costs O(ceiling) not O(body).
 */
export function jsonNestingDepth(text: string, ceiling = Number.POSITIVE_INFINITY): number {
  let depth = 0;
  let deepest = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "[" || char === "{") {
      depth += 1;
      if (depth > deepest) deepest = depth;
      if (deepest > ceiling) return deepest;
    } else if (char === "]" || char === "}") depth -= 1;
  }
  return deepest;
}

export function assertNestingWithinLimits(text: string, tier: PlanTier): void {
  const limits = limitsFor(tier);
  const depth = jsonNestingDepth(text, limits.maxNestingDepth);
  if (depth > limits.maxNestingDepth) {
    throw new LimitExceededError("invalid_chart_spec", "nesting_depth", `The request body nests ${depth} levels deep; the ${tier} tier accepts at most ${limits.maxNestingDepth}. A chart spec is five levels deep (object, series array, series object, data array, datum object).`, { observed: depth, allowed: limits.maxNestingDepth, tier });
  }
}

/**
 * Total data points in a parsed body, read from `series[].data.length`.
 *
 * Lengths, never elements: a `data` array of ten million entries is refused on its `length`, so the
 * refusal costs one property read instead of a ten-million-iteration walk. Counting stops as soon as
 * the ceiling is passed for the same reason.
 */
export function countDataPoints(value: unknown, ceiling = Number.POSITIVE_INFINITY): number {
  if (typeof value !== "object" || value === null) return 0;
  const series = (value as { series?: unknown }).series;
  if (!Array.isArray(series)) return 0;
  let total = 0;
  for (const entry of series) {
    if (typeof entry !== "object" || entry === null) continue;
    const data = (entry as { data?: unknown }).data;
    if (Array.isArray(data)) total += data.length;
    if (total > ceiling) return total;
  }
  return total;
}

export function assertDataPointsWithinLimits(value: unknown, tier: PlanTier): void {
  const limits = limitsFor(tier);
  const points = countDataPoints(value, limits.maxDataPoints);
  if (points > limits.maxDataPoints) {
    throw new LimitExceededError("payload_too_large", "data_points", `The spec carries ${points} data points; the ${tier} tier accepts at most ${limits.maxDataPoints}.`, { observed: points, allowed: limits.maxDataPoints, tier });
  }
}

/**
 * Output cap, read off the requested width and height before anything is drawn.
 *
 * The schema's own 2400×1600 bound is the ceiling for every tier; this is the per-tier cap inside
 * it, and it is checked on the raw value so the refusal does not wait for schema defaults to be
 * applied.
 */
export function assertOutputWithinLimits(value: unknown, tier: PlanTier): void {
  const limits = limitsFor(tier);
  if (typeof value !== "object" || value === null) return;
  const raw = value as { width?: unknown; height?: unknown };
  const width = typeof raw.width === "number" && Number.isFinite(raw.width) ? raw.width : 900;
  const height = typeof raw.height === "number" && Number.isFinite(raw.height) ? raw.height : 520;
  const pixels = Math.abs(width) * Math.abs(height);
  if (pixels > limits.maxOutputPixels) {
    throw new LimitExceededError("payload_too_large", "output_pixels", `A ${width}×${height} chart is ${Math.round(pixels)} pixels; the ${tier} tier accepts at most ${limits.maxOutputPixels}.`, { observed: Math.round(pixels), allowed: limits.maxOutputPixels, tier });
  }
}

export function assertSvgWithinLimits(svg: string, tier: PlanTier): void {
  const limits = limitsFor(tier);
  const size = Buffer.byteLength(svg, "utf8");
  if (size > limits.maxSvgBytes) {
    throw new LimitExceededError("payload_too_large", "svg_bytes", `The rendered SVG is ${size} bytes; the ${tier} tier serves at most ${limits.maxSvgBytes}.`, { observed: size, allowed: limits.maxSvgBytes, tier });
  }
}

/**
 * Every pre-render check, in order, and then `work` — and `work` runs only if all of them passed.
 *
 * Expressed as a callback so "refused before any work is done" is an assertion a test can make
 * (pass a spy; it must not have been called) rather than a claim about the order of statements in
 * a route handler that someone will later reorder.
 */
export function guardChartPayload<T>(body: string | Uint8Array | ArrayBuffer, tier: PlanTier, work: (value: unknown) => T): T {
  assertPayloadWithinLimits(body, tier);
  const text = typeof body === "string" ? body : Buffer.from(body instanceof ArrayBuffer ? new Uint8Array(body) : body).toString("utf8");
  assertNestingWithinLimits(text, tier);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new LimitExceededError("invalid_chart_spec", "json", `The request body could not be parsed as JSON: ${error instanceof Error ? error.message : "parse failed"}.`, { observed: 0, allowed: 0, tier });
  }
  assertDataPointsWithinLimits(value, tier);
  assertOutputWithinLimits(value, tier);
  return work(value);
}
