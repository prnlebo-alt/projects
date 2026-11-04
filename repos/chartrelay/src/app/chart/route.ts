/**
 * GET /chart — the whole chart in a URL.
 *
 * This is the surface that makes the product usable where JavaScript cannot run: an `<img src>` in an
 * email, a Markdown image in a README, a Slack unfurl, an automation step in a no-code tool. Those
 * callers cannot POST a body and then fetch a second URL, which is why /api/v1/charts alone was never
 * enough to compete in this category.
 *
 * It is unauthenticated, and a render served here is not counted against any workspace's monthly
 * allowance: the key, when one is passed, is read only to decide whether to draw the watermark. That is
 * a description of this route as it stands, not a promise. docs/BILLING_SPEC.md sells renders by the
 * month and leaves whether anonymous URL charts stay unmetered as an open decision for the owner, so
 * the public copy now says "not metered today" rather than "unlimited", and nothing here has changed.
 * If that decision lands, the meter belongs in this handler and every page cited in
 * reports/BILLING_AUDIT.md section 9 has to move with it.
 */
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { findApiKey } from "@/lib/auth/api-keys";
import { MONO, SANS } from "@/lib/charts/fonts";
import { rasterize } from "@/lib/charts/raster";
import { parseChartQuery } from "@/lib/charts/url";
import { renderStyled } from "@/lib/charts/style";
import { watermark } from "@/lib/charts/watermark";
import { db } from "@/lib/db";
import { safeHeaders } from "@/lib/http/header-text";
import { workspaces } from "@/lib/db/schema";
import { clientIp, consumeRateLimit, MINUTE } from "@/lib/security/rate-limit";
import { UNMARKED_PLANS } from "@/lib/usage/plans";

// Reads the query on every request and may look up a key, so it can never be prerendered.
export const dynamic = "force-dynamic";

/**
 * Not a quota — an abuse ceiling.
 *
 * This is not the plan's monthly allowance and must not be confused with it: nothing here is metered,
 * but a single client hammering an uncached URL still costs real CPU, so one origin gets a generous
 * burst before it is asked to slow down. Anything drawn twice should be arriving from the CDN cache
 * below, not from here.
 */
const RATE_LIMIT = { requests: 240, windowMs: MINUTE };


/**
 * How long a rendered chart may be reused.
 *
 * The URL *is* the chart, so the same URL can only ever produce the same image — it is safe to cache
 * hard and for a long time. `immutable` matters more than the age here: mail clients and Slack fetch
 * through image proxies that will otherwise re-render the same chart for every recipient.
 */
const CACHE = "public, max-age=31536000, s-maxage=31536000, immutable";

/**
 * Draws the refusal instead of returning JSON nobody will see.
 *
 * An `<img>` tag cannot show an error body, so a caller who mistypes a parameter gets a broken image
 * icon and no idea why. Rendering the reason as the image itself is the only way the person who wrote
 * the URL — often in an email template, hours earlier — ever learns what was wrong. The status stays
 * 4xx so a programmatic caller still sees a failure; browsers render an image body regardless.
 */
function errorImage(message: string): string {
  const lines: string[] = [];
  const words = message.split(/\s+/);
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > 52 && current) { lines.push(current); current = word; } else { current = `${current} ${word}`.trim(); }
  }
  if (current) lines.push(current);
  const height = 92 + lines.length * 20;
  const escaped = lines.map((line) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 ${height}" width="560" height="${height}" role="img">
  <title>Chart could not be drawn</title>
  <rect width="560" height="${height}" fill="#fcfcfb"/>
  <rect x="0" y="0" width="4" height="${height}" fill="#d03b3b"/>
  <text x="28" y="40" font-family="${MONO}" font-size="11" fill="#898781" letter-spacing="1.1">CHARTRELAY &#183; CHART NOT DRAWN</text>
  ${escaped.map((line, i) => `<text x="28" y="${72 + i * 20}" font-family="${SANS}" font-size="13.5" fill="#0b0b0b">${line}</text>`).join("\n  ")}
  <text x="28" y="${height - 18}" font-family="${MONO}" font-size="10.5" fill="#898781">chartrelay.dev/docs#url</text>
</svg>`;
}

/** Does this key belong to a workspace that has paid for an unmarked chart? */
async function entitledToUnmarked(key: string | null): Promise<boolean> {
  if (!key) return false;
  const found = await findApiKey(key);
  if (!found) return false;
  const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.id, found.workspaceId) });
  return workspace ? UNMARKED_PLANS.has(workspace.plan) : false;
}

async function send(svg: string, format: "svg" | "png", status: number, extraHeaders: Record<string, string> = {}) {
  // Every header goes through safeHeaders, including the ones that look like they can only hold ASCII.
  // A header value is a ByteString, and a caller-supplied character above U+00FF throws on the way out
  // — which is a 500 with an empty body, and an empty body in an <img> is a broken-image icon.
  const headers = { "cache-control": status === 200 ? CACHE : "no-store", ...safeHeaders(extraHeaders) };
  if (format === "svg") {
    return new Response(svg, { status, headers: { ...headers, "content-type": "image/svg+xml; charset=utf-8" } });
  }
  const png = await rasterize(svg);
  return new Response(new Uint8Array(png), { status, headers: { ...headers, "content-type": "image/png" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Read the format before parsing, so even a refusal comes back in the shape the caller asked for.
  const wanted = (url.searchParams.get("format") ?? "png").toLowerCase();
  const format: "svg" | "png" = wanted === "svg" ? "svg" : "png";

  const limit = consumeRateLimit(`chart-url:${clientIp(request)}`, RATE_LIMIT.requests, RATE_LIMIT.windowMs);
  if (!limit.allowed) {
    // ASCII only: this sentence also goes out in x-chartrelay-error, and a header value is a ByteString.
    const message = "Too many requests from this address. This is a rate limit, not your monthly render allowance. Please cache the charts you have already drawn, then retry.";
    // Every other refusal names itself in this header; a 429 that did not was the one case a caller
    // reading headers rather than pixels had to special-case.
    return send(errorImage(message), format, 429, { "retry-after": String(limit.retryAfterSeconds), "x-chartrelay-error": message });
  }

  const parsed = parseChartQuery(url.searchParams);
  if (!parsed.ok) {
    return send(errorImage(parsed.error), format, 400, { "x-chartrelay-error": parsed.error });
  }

  const { spec, style, chrome, key } = parsed.value;
  let rendered;
  try {
    rendered = renderStyled(spec, style, chrome);
  } catch (error) {
    // A renderer that throws is a bug, not a bad request — say so honestly rather than blaming the URL.
    const message = error instanceof Error ? error.message : "The chart could not be drawn.";
    return send(errorImage(message), format, 400, { "x-chartrelay-error": message });
  }

  const unmarked = await entitledToUnmarked(key);
  const svg = unmarked ? rendered.svg : watermark(rendered.svg);

  return send(svg, format, 200, {
    // The alt text travels with the image, so a caller can read it back without a second request and
    // put it in the `alt` attribute where it belongs.
    "x-chartrelay-alt": rendered.altText,
    "x-chartrelay-style": rendered.style,
    // The QA review runs either way, and throwing the result away would make this the one surface that
    // draws a chart without saying what it found. Nothing is enforced here — a URL in a newsletter is
    // not the place to refuse — but the findings travel, so a caller can act on them.
    ...(rendered.warnings.length ? { "x-chartrelay-findings": rendered.warnings.map((issue) => `${issue.severity}:${issue.code}`).join(",") } : {}),
    ...(rendered.styleNote ? { "x-chartrelay-note": rendered.styleNote } : {}),
  });
}

/** A HEAD is what link unfurlers and mail proxies send first; answer it without drawing anything. */
export function HEAD() {
  return new NextResponse(null, { status: 200, headers: { "content-type": "image/png", "cache-control": CACHE } });
}
