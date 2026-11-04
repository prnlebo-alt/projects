import { NextResponse } from "next/server";

/** The largest valid chart spec is about 150 KB; nothing legitimate needs more. */
export const MAX_CHART_BODY_BYTES = 256 * 1024;

export type JsonBody = { ok: true; value: unknown } | { ok: false; response: Response };

const tooLarge = (maxBytes: number) => ({ ok: false as const, response: NextResponse.json({ error: `Request body is larger than ${Math.round(maxBytes / 1024)} KB.` }, { status: 413 }) });

/**
 * A body that never parsed is a different failure from a body that parsed and then failed validation, and the
 * caller — often an agent trying to repair its own request — can only act on the difference if we state it.
 * Reporting the parser's own position ("Unexpected end of JSON input") is safe: it describes the bytes the
 * caller just sent us, nothing of ours.
 */
const unparseable = (reason: string) => ({ ok: false as const, response: NextResponse.json({ error: "Request body could not be parsed as JSON.", details: { reason } }, { status: 400 }) });

/**
 * Reads a JSON body with a hard byte cap, so an anonymous client cannot make the server buffer and parse
 * arbitrarily large payloads. Rejects on Content-Length first, then stops reading once the cap is crossed.
 * A body that is missing, empty or not JSON is rejected here with 400 rather than handed to the caller's
 * schema as `null`, which used to report the confusing "expected object, received null".
 */
export async function readJsonBody(request: Request, maxBytes = MAX_CHART_BODY_BYTES): Promise<JsonBody> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return tooLarge(maxBytes);
  if (!request.body) return unparseable("The request has no body. Send a JSON object.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return tooLarge(maxBytes);
    }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return unparseable("The request body is empty. Send a JSON object.");
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return unparseable(error instanceof Error ? error.message : "The body is not valid JSON.");
  }
}

function allowedOrigins(request: Request) {
  const origins = new Set<string>([new URL(request.url).origin]);
  if (process.env.APP_URL) {
    try {
      origins.add(new URL(process.env.APP_URL).origin);
    } catch {
      // A malformed APP_URL is reported by check:env; fall back to the request origin.
    }
  }
  return origins;
}

/** Blocks cross-site browser requests (forced logout, login CSRF). Non-browser clients send neither header. */
export function rejectCrossSite(request: Request): Response | null {
  if (request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins(request).has(origin)) return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 });
  return null;
}

/**
 * Cross-site guard for a route that a cookie alone can authenticate.
 *
 * SameSite=Lax is the only thing standing in front of these otherwise, and SameSite is site-scoped: an XSS on
 * any subdomain is same-site, so it carries the session cookie and reaches the route. A route that mints or
 * spends something on the user's behalf needs a second layer.
 *
 * Skipped when the caller presents a Bearer key, because that is a deliberate credential rather than an
 * ambient one — a browser cannot attach it to a forged request, and refusing it would break the cross-origin
 * API calls this product exists to serve.
 */
export function rejectAmbientCrossSite(request: Request): Response | null {
  if (request.headers.get("authorization")?.startsWith("Bearer ")) return null;
  return rejectCrossSite(request);
}

/**
 * For cookie-issuing JSON routes: requires application/json (which a cross-site HTML form cannot send without a
 * CORS preflight) and refuses cross-site origins.
 */
export function rejectCrossSiteJson(request: Request): Response | null {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return NextResponse.json({ error: "Send the request as application/json." }, { status: 415 });
  return rejectCrossSite(request);
}
