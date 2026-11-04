import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";

// Next.js injects inline bootstrap scripts, so script-src needs 'unsafe-inline' without a nonce setup;
// dev mode additionally needs 'unsafe-eval' for fast refresh.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

// Chart assets are user-influenced documents, often opened directly; serve them inert.
const assetContentSecurityPolicy = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Reset and verification tokens travel in query strings; never leak full URLs to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  async headers() {
    // When two rules set the same header, the later rule wins, so chart assets get their own stricter CSP.
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/api/v1/charts/:id", headers: [{ key: "Content-Security-Policy", value: assetContentSecurityPolicy }] },
      // /chart serves the same user-influenced SVG and was inheriting the permissive site policy, which
      // is the one that allows inline script. The document is drawn from query parameters a stranger can
      // put in a link, so it gets the inert policy its sibling already had.
      { source: "/chart", headers: [{ key: "Content-Security-Policy", value: assetContentSecurityPolicy }] },
    ];
  },
};

export default nextConfig;
