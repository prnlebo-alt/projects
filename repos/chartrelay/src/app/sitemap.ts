import type { MetadataRoute } from "next";

// Rendered per request: a variable-only redeploy (for example moving APP_URL to a new domain) does not
// rebuild the app, so a statically generated copy would keep serving the previous origin.
export const dynamic = "force-dynamic";

// Same resolution as the metadata base in app/layout.tsx; sitemap URLs must be absolute.
const siteUrl = (process.env.APP_URL ?? "https://chartrelay-production.up.railway.app").replace(/\/+$/, "");

type Entry = MetadataRoute.Sitemap[number];

// Only real, public, indexable routes. The dashboard and the account flows are excluded here and
// disallowed in robots.ts; /api is machine-facing and never listed.
const routes: { path: string; priority: number; changeFrequency: Entry["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
  { path: "/docs", priority: 0.9, changeFrequency: "weekly" },
  { path: "/playground", priority: 0.8, changeFrequency: "monthly" },
  { path: "/mcp", priority: 0.8, changeFrequency: "monthly" },
  { path: "/studio", priority: 0.9, changeFrequency: "monthly" },
  { path: "/integrations", priority: 0.8, changeFrequency: "monthly" },
  { path: "/compare", priority: 0.7, changeFrequency: "monthly" },
  { path: "/chart-check", priority: 0.7, changeFrequency: "monthly" },
  { path: "/support", priority: 0.6, changeFrequency: "monthly" },
  { path: "/register", priority: 0.5, changeFrequency: "yearly" },
  { path: "/login", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  // lastModified is deliberately omitted: a build-time "now" would claim every page changed on
  // every deploy, which is worse for crawlers than no date at all.
  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${siteUrl}${path}`,
    changeFrequency,
    priority,
  }));
}
