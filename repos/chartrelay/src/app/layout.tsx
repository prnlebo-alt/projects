import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";

// Absolute base for canonicals, Open Graph URLs and the sitemap. APP_URL is the public origin in
// every deployed environment (docs/DEPLOY.md); the fallback is the current Railway domain so a
// build without the variable still emits absolute URLs instead of localhost.
const siteUrl = (process.env.APP_URL ?? "https://chartrelay-production.up.railway.app").replace(/\/+$/, "");

const description =
  "Render bar, line, area, pie and scatter charts from JSON. Every ChartRelay render returns deterministic SVG, durable PNG and SVG URLs, alt text, and a structural QA review.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "ChartRelay — Charts your agents can ship", template: "%s · ChartRelay" },
  description,
  applicationName: "ChartRelay",
  // No alternates.canonical here on purpose: a relative canonical set on the root layout is
  // inherited by every route, which would point the whole site at the home page. Each public
  // page declares its own canonical instead.
  openGraph: {
    type: "website",
    siteName: "ChartRelay",
    locale: "en_US",
    // title and description are left out so each page's own <title> and `description` become
    // og:title and og:description. Setting them here would pin every social card to this generic
    // blurb, because a page-level `description` does not override an inherited openGraph one.
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Header />{children}</body></html>;
}
