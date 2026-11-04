import { NextResponse, type NextRequest } from "next/server";

/**
 * Sends visitors on an old hostname to the canonical domain.
 *
 * Next 16 renamed the middleware file convention to proxy; the behaviour is unchanged.
 *
 * Railway terminates TLS in front of the app, so the original hostname arrives in x-forwarded-host;
 * next.config's `has: host` matcher never sees it. Only page requests redirect: /api/* and /chart
 * keep answering on every hostname so that chart URLs minted before a domain move, and any webhook
 * still pointed at the old origin, keep working.
 *
 * /chart is excluded for a sharper reason than /api/ is. Those URLs are pasted into emails, READMEs
 * and automation steps and then left alone for years, and they are fetched by mail proxies and link
 * unfurlers rather than browsers — clients that do not all follow a 308. A chart that silently stops
 * loading in someone's inbox is the worst failure this product has, so the request is answered where
 * it arrives instead of being redirected somewhere better.
 */
export function proxy(request: NextRequest) {
  const canonical = (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");
  if (!canonical) return NextResponse.next();
  let canonicalHost: string;
  try {
    canonicalHost = new URL(canonical).host;
  } catch {
    return NextResponse.next();
  }
  const requestHost = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim();
  if (!requestHost || requestHost === canonicalHost) return NextResponse.next();
  // Never redirect local development or preview hosts to production.
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(requestHost)) return NextResponse.next();
  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, canonical);
  return NextResponse.redirect(target, 308);
}

export const config = {
  // Pages only: skip the API, the URL chart endpoint, Next's own assets and the files served from the site root.
  matcher: ["/((?!api/|chart|_next/|favicon.ico|robots.txt|sitemap.xml|opengraph-image).*)"],
};
