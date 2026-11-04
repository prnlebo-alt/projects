import type { MetadataRoute } from "next";

// Rendered per request: a variable-only redeploy (for example moving APP_URL to a new domain) does not
// rebuild the app, so a statically generated copy would keep serving the previous origin.
export const dynamic = "force-dynamic";

// Same resolution as the metadata base in app/layout.tsx; the sitemap reference must be absolute.
const siteUrl = (process.env.APP_URL ?? "https://chartrelay-production.up.railway.app").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Signed-in surfaces and one-time token links: nothing here is useful in an index, and the
        // token pages should never be fetched by a crawler. /api/ is machine-facing.
        disallow: ["/dashboard", "/verify-email", "/reset-password", "/forgot-password", "/account-deleted", "/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
