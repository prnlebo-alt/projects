import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

const APP_DIR = path.resolve(import.meta.dirname, "../src/app");
const footerSource = fs.readFileSync(path.resolve(import.meta.dirname, "../src/components/footer.tsx"), "utf8");

/** Every internal href the footer links to, which is the site's full public navigation. */
const footerLinks = [...footerSource.matchAll(/href:\s*"(\/[^"]*)"/g)].map((match) => match[1]);

const sitemapPaths = sitemap().map((entry) => new URL(entry.url).pathname);
const disallowed = [robots().rules].flat().flatMap((rule) => [rule?.disallow ?? []].flat());

/** True when robots.ts keeps crawlers away from this path. */
const isDisallowed = (route: string) => disallowed.some((rule) => route === rule || route.startsWith(`${rule}/`));

describe("footer navigation", () => {
  it("links somewhere real", () => {
    expect(footerLinks.length).toBeGreaterThan(8);
    for (const route of footerLinks) {
      const page = path.join(APP_DIR, route, "page.tsx");
      expect(fs.existsSync(page), `${route} has no page.tsx`).toBe(true);
    }
  });

  it("puts every linked page in the sitemap unless robots.ts deliberately hides it", () => {
    // /support was linked from all eleven public pages while missing from the sitemap. Any page reachable
    // from the footer is either indexable and listed, or disallowed on purpose — never silently neither.
    for (const route of footerLinks) {
      expect(sitemapPaths.includes(route) || isDisallowed(route), `${route} is in neither sitemap.ts nor robots.ts`).toBe(true);
    }
  });

  it("lists /support", () => {
    expect(sitemapPaths).toContain("/support");
  });
});

describe("sitemap", () => {
  it("lists no route that robots.ts disallows, and no duplicates", () => {
    for (const route of sitemapPaths) expect(isDisallowed(route), `${route} is both listed and disallowed`).toBe(false);
    expect(new Set(sitemapPaths).size).toBe(sitemapPaths.length);
  });

  it("uses absolute URLs on the configured origin with a priority on every entry", () => {
    for (const entry of sitemap()) {
      expect(entry.url.startsWith("http")).toBe(true);
      expect(typeof entry.priority).toBe("number");
    }
  });

  it("keeps the post-deletion confirmation page out of the index", () => {
    expect(sitemapPaths).not.toContain("/account-deleted");
    expect(isDisallowed("/account-deleted")).toBe(true);
    expect(fs.existsSync(path.join(APP_DIR, "account-deleted", "page.tsx"))).toBe(true);
  });
});
