import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { authorize } from "@/lib/auth/v1-auth";
import { keyAllowsAddress, keyHasScope, keyPolicy, withinKeyBudget } from "@/lib/auth/api-keys";
import { blockingIssues, type QaIssue } from "@/lib/charts/qa";
import { chartRequestOptionsSchema, chartSpecSchema } from "@/lib/charts/schema";
import { renderStyled } from "@/lib/charts/style";
import { validationDetails } from "@/lib/charts/validation";
import { db } from "@/lib/db";
import { apiKeys, renders } from "@/lib/db/schema";
import { rejectAmbientCrossSite, readJsonBody } from "@/lib/security/request";
import { ApiError, errorBody, rateLimitHeaders, responseHeaders } from "@/lib/http/errors";
import { requestIdFrom } from "@/lib/http/request-id";
import { ensureAllowance } from "@/lib/ledger/allowance";
import { hasLivePackCredit, refund, reserve, settleCharged, type Reservation } from "@/lib/ledger/ledger";
import { watermark } from "@/lib/charts/watermark";
import { UNMARKED_PLANS } from "@/lib/usage/plans";
import { clientIp, consumeRateLimit, MINUTE } from "@/lib/security/rate-limit";
import { recordRender } from "@/lib/metrics/activation";


/**
 * Ceilings, not quotas. Credit decides how much a customer may render; these decide how fast.
 * Generous enough that no legitimate integration meets them, low enough that one key cannot saturate
 * the single instance this runs on. This route previously had no rate limit at all.
 */
const RATE_LIMITS = { perKey: 120, perAccount: 300 } as const;

/** One error shape for everything this route refuses, so a client branches on `code` and nothing else. */
function errorResponse(error: ApiError, requestId: string, extra: Record<string, string> = {}) {
  return NextResponse.json(errorBody(error, requestId), {
    status: error.status,
    headers: { ...responseHeaders(requestId, error.options), ...extra },
  });
}

/**
 * Thrown inside the render transaction when QA found a blocking problem, so the transaction rolls back and the
 * chart is neither stored nor metered. It carries the findings the response has to name.
 */
class QualityRejectedError extends Error {
  constructor(readonly blocking: QaIssue[], readonly findings: QaIssue[]) {
    super("Chart rejected by QA review.");
  }
}

export async function POST(request: Request) {
  // Skipped for a Bearer key, which is a deliberate credential a browser cannot attach to a forged
  // request — the cross-origin API calls this product exists to serve keep working.
  const refused = rejectAmbientCrossSite(request);
  if (refused) return refused;
  const auth = await authorize(request);
  if (!auth) return NextResponse.json({ error: "Provide a valid Bearer API key." }, { status: 401 });
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = chartSpecSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Invalid chart specification.", details: validationDetails(parsed.error) }, { status: 400 });
  // Parsed from the same object as the spec, but separately: chartSpecSchema strips unknown keys, so an option
  // sent alongside the chart would otherwise be silently dropped, and a caller who asked for the escape hatch
  // would get a 422 that says the opposite of what they requested.
  const options = chartRequestOptionsSchema.safeParse(body.value);
  if (!options.success) return NextResponse.json({ error: "Invalid request options.", details: validationDetails(options.error) }, { status: 400 });
  // Everything a key is allowed to do, checked before any credit moves. Each of these is a 4xx the
  // caller can act on, and none of them costs a render.
  const requestIdEarly = requestIdFrom(request);
  if (auth.key) {
    if (!keyHasScope(auth.key, "render")) {
      return errorResponse(new ApiError("scope_denied", "This key does not carry the render scope."), requestIdEarly);
    }
    if (!keyAllowsAddress(auth.key, clientIp(request))) {
      // Fails closed: an address the allowlist cannot parse, or a request with no address at all, is
      // refused rather than waved through on the assumption it is probably fine.
      return errorResponse(new ApiError("ip_not_allowed", "This key is restricted to other addresses."), requestIdEarly);
    }
    if (!withinKeyBudget(auth.key)) {
      // A separate 402 from credits_exhausted on purpose: the workspace may have plenty of credit,
      // and the caller's remedy is to raise this key's budget rather than to buy anything.
      return errorResponse(new ApiError("key_budget_exhausted", "This key has spent its monthly budget. Raise the budget or use another key."), requestIdEarly);
    }
  }

  // Per-key and per-account rate limits, which the spec asks for and this route had none of. The
  // per-IP limits elsewhere do not help here: a key is used from a server, and one key hammering the
  // API from one address was previously unbounded.
  const requestId = requestIdEarly;
  for (const [scope, value, ceiling] of [
    ["key", auth.apiKeyId ?? "session", RATE_LIMITS.perKey],
    ["account", auth.workspace.id, RATE_LIMITS.perAccount],
  ] as const) {
    const limit = consumeRateLimit(`render-${scope}:${value}`, ceiling, MINUTE);
    if (!limit.allowed) {
      return errorResponse(new ApiError("rate_limited", `Too many requests for this ${scope}. Slow down and retry.`, { retryAfterSeconds: limit.retryAfterSeconds }), requestId, rateLimitHeaders(ceiling, 0, limit.retryAfterSeconds));
    }
  }

  // Reserved BEFORE the render, not after. The old order rendered first and checked the quota second,
  // so an account with nothing left could still burn unbounded CPU on every request it made — the
  // cheapest denial-of-service available against this service was to run out of credit and keep going.
  // A test key renders but never spends: the spec makes test keys free and watermarked so the
  // playground and a customer's own smoke tests cost nobody anything.
  const policy = auth.key ? keyPolicy(auth.key) : null;
  let reservation: Reservation | null = null;
  if (policy && !policy.billable) {
    reservation = null;
  } else try {
    ensureAllowance(auth.workspace.id);
    reservation = reserve({
      workspaceId: auth.workspace.id,
      keyId: auth.apiKeyId,
      requestId,
      idempotencyKey: request.headers.get("idempotency-key"),
      format: options.data.style,
    });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error, requestId);
    // The ledger could not be read or written (database down, volume gone, disk full). Fail closed: nothing was
    // reserved, so nothing renders, and the caller is told to retry rather than handed a free chart or a bare 500.
    console.error("Ledger unavailable, refusing the render:", error instanceof Error ? error.message : error);
    return errorResponse(new ApiError("service_unavailable", "Billing is temporarily unavailable. Nothing was rendered or charged. Retry shortly.", { retryAfterSeconds: 5 }), requestId, { "retry-after": "5" });
  }

  // A retry of a request we already answered must not pay again. The stored render is returned as it
  // was, for zero units.
  if (reservation?.replayed) {
    // The chart this very charge produced, found by id. Never "the latest chart": that is another request's.
    const previous = reservation.renderId ? db.select().from(renders).where(and(eq(renders.id, reservation.renderId), eq(renders.workspaceId, auth.workspace.id))).get() : undefined;
    if (!previous) {
      // The first request is still being rendered, so there is nothing to return yet and nothing to charge for.
      return errorResponse(new ApiError("request_in_progress", "A request with this Idempotency-Key is still being processed. Retry in a moment."), requestId, { "retry-after": "2" });
    }
    const baseUrl = process.env.APP_URL ?? new URL(request.url).origin;
    return NextResponse.json(
      { id: previous.id, svg: previous.svg, altText: previous.altText, warnings: JSON.parse(previous.warnings), urls: { svg: `${baseUrl}/api/v1/charts/${previous.id}?format=svg`, png: `${baseUrl}/api/v1/charts/${previous.id}?format=png` }, replayed: true },
      { status: 200, headers: responseHeaders(requestId, { creditsRemaining: reservation.remaining }) },
    );
  }

  try {
    // Rendering is pure and CPU-bound, so it stays outside the transaction; only counting and writing must be atomic.
    const rendered = renderStyled(parsed.data, options.data.style);
    // The mark is what a paid plan or a pack buys off. A test key is always marked (it is free), and so is a
    // free workspace with no pack credit left to its name. Applied before the SVG is stored, so the PNG that is
    // later rasterised from it carries the mark too.
    const marked = policy?.watermarked || !(UNMARKED_PLANS.has(auth.workspace.plan) || hasLivePackCredit(auth.workspace.id));
    const result = marked ? { ...rendered, svg: watermark(rendered.svg) } : rendered;
    // QA findings with severity "error" are contract violations, not advice: the documentation says a pie
    // cannot carry negative values or several series, so the API must not hand back a permanent public URL for
    // a chart that breaks its own rules. The caller can still override this per request, deliberately.
    const blocking = options.data.allowQualityErrors ? [] : blockingIssues(result.warnings);
    const id = nanoid(14);
    const createdAt = new Date().toISOString();
    // The quota check, the render and the usage event are one synchronous better-sqlite3 transaction, so the
    // render commits together with the usage event that pays for it — no live chart without a metered render,
    // and no metered render without a chart. The callback contains no `await`: because better-sqlite3 is
    // synchronous, nothing else in this process can run between counting and writing, so concurrent requests
    // can no longer all observe the same pre-insert count and overshoot the quota. BEGIN IMMEDIATE takes the
    // write lock up front instead of upgrading a read transaction part-way through.
    //
    // This holds within one process only. Two servers sharing the database file would each begin from their
    // own snapshot, and the quota would need a conditional write (an INSERT ... SELECT whose WHERE clause
    // carries the count) or a single writer. ChartRelay deliberately runs one server against one SQLite file.
    // The ledger is now the only meter. The old counter-based quota used to run here as well, which
    // meant every successful render wrote two usage_events rows — one from the reservation and one
    // from the counter — and any report built on that table counted each render twice.
    db.transaction((tx) => {
      // A rejected chart leaves nothing behind: no render row and no key timestamp, because the throw
      // rolls the whole transaction back. The reservation is given back by the catch below.
      if (blocking.length > 0) throw new QualityRejectedError(blocking, result.warnings);
      tx.insert(renders).values({ id, workspaceId: auth.workspace.id, apiKeyId: auth.apiKeyId, spec: JSON.stringify(parsed.data), svg: result.svg, altText: result.altText, warnings: JSON.stringify(result.warnings), createdAt }).run();
      if (auth.apiKeyId) tx.update(apiKeys).set({ lastUsedAt: createdAt }).where(eq(apiKeys.id, auth.apiKeyId)).run();
    }, { behavior: "immediate" });
    // After the transaction commits: a chart that was rejected by QA or by quota never happened, and
    // counting it would overstate the one number in the funnel that means "this person got value".
    recordRender(auth.workspace.id);
    // The render happened and was stored, so the unit is spent for good.
    if (reservation) settleCharged(reservation.id, id);
    const baseUrl = process.env.APP_URL ?? new URL(request.url).origin;
    return NextResponse.json(
      { id, ...result, urls: { svg: `${baseUrl}/api/v1/charts/${id}?format=svg`, png: `${baseUrl}/api/v1/charts/${id}?format=png` }, credits_remaining: reservation?.remaining ?? null },
      { status: 201, headers: responseHeaders(requestId, reservation ? { creditsRemaining: reservation.remaining } : {}) },
    );
  } catch (error) {
    // Anything that reaches here means the render did not produce a stored chart, so the unit goes
    // back. Failed renders and rejected specs are never charged — that is a rule, not a courtesy.
    if (reservation) refund(reservation.id, error instanceof Error ? error.message : "render failed");
    if (error instanceof QualityRejectedError) {
      return NextResponse.json({
        error: `The chart was not stored: QA review found ${error.blocking.length} blocking problem${error.blocking.length === 1 ? "" : "s"}. Nothing was saved and no render was counted.`,
        code: "quality-rejected",
        blocking: error.blocking,
        warnings: error.findings,
        override: { field: "allowQualityErrors", value: true, effect: "Resend the same request with this field set to store the chart despite these findings. It then counts as one render." },
      }, { status: 422 });
    }
    console.error("Chart render failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "The chart could not be rendered because of a server error. Please try again." }, { status: 500 });
  }
}
