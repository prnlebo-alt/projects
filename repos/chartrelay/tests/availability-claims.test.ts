import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Codex reviewed the live site as a first-time developer and refused to adopt it: "The advertised MCP
 * product is unavailable. No npm package, no repository link, and the checkout's GitHub remote is
 * unavailable anonymously. 'Clone the repository' is not an installation instruction."
 *
 * Neither fact is fixable in this repo — publishing the package and opening the repository are the
 * owner's calls. What is fixable is the copy, so these tests pin the copy to the reality: nothing
 * anywhere may tell a reader to fetch something that is not there, and the page that advertises the
 * MCP server has to say how to actually ask for it.
 */

const ADDRESS = "help@chartrelay.example";
const ROOT = path.resolve(import.meta.dirname, "..");

const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), "utf8");

/** Markup without tags, so an assertion sees the sentence a reader sees. */
const text = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");

async function renderMcp() {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: McpPage } = await import("@/app/mcp/page");
  return renderToStaticMarkup(McpPage());
}

async function renderHome() {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: Home } = await import("@/app/page");
  return renderToStaticMarkup(Home());
}

afterEach(() => vi.unstubAllEnvs());

describe("/mcp tells the truth about what a reader can obtain", () => {
  it("states plainly that the package is unpublished and the repository is private", async () => {
    vi.stubEnv("SUPPORT_EMAIL", ADDRESS);
    const body = text(await renderMcp());
    expect(body).toContain("has not been published to npm");
    expect(body).toContain("the repository it lives in is private");
    expect(body).toContain("beta users");
  });

  it("never tells the reader to clone a repository or install from a checkout", async () => {
    for (const address of [ADDRESS, ""]) {
      vi.stubEnv("SUPPORT_EMAIL", address);
      const body = text(await renderMcp());
      // The exact instruction Codex called out, plus the paraphrases that would replace it.
      expect(body).not.toMatch(/clone the repository/i);
      expect(body).not.toMatch(/from a checkout/i);
      expect(body).not.toMatch(/repository checkout/i);
      expect(body).not.toMatch(/git clone/i);
      expect(body).not.toMatch(/cd mcp/i);
    }
  });

  it("labels every npx block as post-publication rather than as a setup step", async () => {
    vi.stubEnv("SUPPORT_EMAIL", ADDRESS);
    const body = text(await renderMcp());
    expect(body).toContain("npx -y @chartrelay/mcp");
    // Both code cards carry the qualifier, and the prose says why once.
    expect(body.match(/after publication/gi)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(body).toContain("Not runnable yet");
    expect(body).toContain("What the setup will look like");
  });

  it("keeps the technical content that makes the tool evaluable", async () => {
    vi.stubEnv("SUPPORT_EMAIL", ADDRESS);
    const body = text(await renderMcp());
    for (const variable of ["CHARTRELAY_API_KEY", "CHARTRELAY_API_URL", "CHARTRELAY_INCLUDE_IMAGE"]) {
      expect(body).toContain(variable);
    }
    expect(body).toContain("render_chart");
    expect(body).toContain("Alt text:");
    expect(body).toContain("Quality review");
  });

  it("points at the API as the route that works today", async () => {
    vi.stubEnv("SUPPORT_EMAIL", ADDRESS);
    const body = text(await renderMcp());
    expect(body).toContain("/api/v1/charts");
    expect(body).toContain("The API needs none of this");
  });
});

describe("/mcp access instructions come from the support helper", () => {
  it("offers the configured address as a mailto with a subject, and names it in prose", async () => {
    vi.stubEnv("SUPPORT_EMAIL", ADDRESS);
    const html = await renderMcp();
    expect(html).toContain(`mailto:${ADDRESS}?subject=ChartRelay%20MCP%20beta%20access`);
    expect(text(html)).toContain(ADDRESS);
  });

  it("degrades to a plain statement when no address is configured, with no dead link", async () => {
    vi.stubEnv("SUPPORT_EMAIL", "");
    const html = await renderMcp();
    expect(html).not.toContain("mailto:");
    expect(text(html)).toContain("no support address configured");
    // Still honest about availability even with nowhere to send people.
    expect(text(html)).toContain("has not been published to npm");
  });

  it("does not publish an address that the helper would reject", async () => {
    vi.stubEnv("SUPPORT_EMAIL", "not an address");
    const html = await renderMcp();
    expect(html).not.toContain("mailto:");
    expect(text(html)).not.toContain("not an address");
  });

  it("hardcodes no address of its own, so the page can never outlive one", () => {
    const source = read("src/app/mcp/page.tsx");
    const literal = source.match(/[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi) ?? [];
    expect(literal, `hardcoded address(es): ${literal.join(", ")}`).toHaveLength(0);
    expect(source).toContain('from "@/lib/support"');
  });

  it("reads the environment per request, like /support does", () => {
    expect(read("src/app/mcp/page.tsx")).toContain('export const dynamic = "force-dynamic"');
  });
});

describe("the home page headline matches what the service enforces", () => {
  it("drops the claim that charts need no checking", async () => {
    const body = text(await renderHome());
    expect(body).not.toContain("without you checking them");
    expect(body).not.toContain("send unsupervised");
  });

  it("says what is enforced and, in the same breath, what is not", async () => {
    const body = text(await renderHome());
    expect(body).toContain("rejected outright rather than returned as a success");
    expect(body).toContain("Structure is enforced; data correctness is not");
    expect(body).toContain("Correctness is not checked at all");
  });

  it("describes the refusal as losing the render, not just flagging it", async () => {
    const body = text(await renderHome());
    expect(body).toContain("the request is rejected and nothing is stored");
    expect(body).toContain("There is no id and no URL to paste by accident");
  });

  it("keeps its MCP mention inside what a reader can actually get", async () => {
    const body = text(await renderHome());
    expect(body).toContain("not on npm and the repository is private");
    expect(body).not.toMatch(/repository checkout/i);
    expect(body).not.toMatch(/ships an MCP server/i);
    // The self-hosting answer used to offer the MCP source as the exception.
    expect(body).not.toContain("its source ships in the repository");
  });
});

describe("the enforcement the home page promises is the enforcement that exists", () => {
  it("blocks exactly the two cases the copy names, and only those", async () => {
    const { analyzeChart, blockingIssues } = await import("@/lib/charts/qa");
    const pie = (series: { name: string; data: { label: string; value: number }[] }[]) =>
      ({ type: "pie", title: "Share of revenue", series, width: 900, height: 520, theme: "light", legend: true, showValues: false }) as never;

    const negative = blockingIssues(analyzeChart(pie([{ name: "Revenue", data: [{ label: "A", value: 4 }, { label: "B", value: -1 }] }])));
    expect(negative.map((issue) => issue.code)).toContain("pie-negative-value");

    const several = blockingIssues(analyzeChart(pie([
      { name: "2025", data: [{ label: "A", value: 4 }] },
      { name: "2026", data: [{ label: "A", value: 5 }] },
    ])));
    expect(several.map((issue) => issue.code)).toContain("pie-multiple-series");

    // The home page promises the softer problems still render, so the agent can judge the trade-off.
    const crowded = blockingIssues(analyzeChart(pie([{ name: "Revenue", data: Array.from({ length: 9 }, (_, i) => ({ label: `Category ${i}`, value: i + 1 })) }])));
    expect(crowded).toHaveLength(0);
  });

  it("still has an API that refuses those renders, which is what makes the headline defensible", () => {
    // The copy on / and /mcp says a blocking finding loses the render rather than flagging it. That claim
    // belongs to POST /api/v1/charts, so if the refusal ever leaves the route, this copy has to leave too.
    const route = read("src/app/api/v1/charts/route.ts");
    expect(route, "the pages claim blocking findings are refused with 422").toContain("422");
    expect(route).toMatch(/blocking/i);
  });
});

describe("the written copy outside the app agrees with the pages", () => {
  const readme = read("mcp/README.md");
  const launch = read("marketing/LAUNCH_COPY.md");

  it("mcp/README.md leads with availability instead of an install that fails", () => {
    expect(readme).toContain("not published to npm");
    expect(readme).toContain("the repository it lives in is private");
    expect(readme).not.toMatch(/git clone/i);
    expect(readme).not.toMatch(/clone the repository/i);
    // The reader of this file already holds the server; that is the only honest running instruction.
    expect(readme).toContain("Running the copy you have");
    expect(readme).toContain("What setup will look like after publication");
  });

  it("mcp/README.md routes access requests through /support rather than a pasted address", () => {
    expect(readme).toContain("chartrelay.dev/support");
    const literal = readme.match(/[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi) ?? [];
    expect(literal, `hardcoded address(es): ${literal.join(", ")}`).toHaveLength(0);
  });

  it("LAUNCH_COPY.md blocks the two drafts whose whole point is an install that does not exist", () => {
    expect(launch.match(/BLOCKED until the package is published/g)).toHaveLength(2);
    expect(launch).toContain("Do not post this until `@chartrelay/mcp` is on npm");
    expect(launch).toContain("Do not submit until publication");
  });

  it("LAUNCH_COPY.md carries the same headline and the same caveat as the home page", async () => {
    const headline = launch.match(/\*\*Headline:\*\* (.+)/)?.[1]?.trim();
    expect(headline).toBeTruthy();
    expect(text(await renderHome())).toContain(headline);
    expect(launch).toContain("Structure is enforced; data correctness is not");
    expect(launch).not.toContain("without you checking them");
  });

  it("LAUNCH_COPY.md no longer points at the placeholder domain", () => {
    expect(launch).not.toContain("chartrelay.example");
  });
});
