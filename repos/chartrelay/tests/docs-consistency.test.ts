import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Guards the three ways the documentation and the product drifted apart, each of which cost a
 * first-time developer a retry on the live service:
 *
 *  - /docs told you to export `CHARTRELAY_KEY` while the dashboard and the MCP server read
 *    `CHARTRELAY_API_KEY`.
 *  - /docs handed out a quickstart aimed at `http://localhost:3000` rather than the deployed origin.
 *  - /docs never documented the registration body, so `{email, password}` returned 400 because `name`
 *    was also mandatory.
 *
 * Every assertion here compares two real things — the docs page against the dashboard card, the
 * documented payload against the Zod schema the route enforces — so it fails when they disagree
 * rather than when someone rewords a sentence.
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (relative: string) => readFileSync(path.join(ROOT, relative), "utf8");

const DOCS_PAGE = "src/app/docs/page.tsx";
const QUICKSTART_CARD = "src/components/quickstart-card.tsx";

/** Request headers the server components read. Reassigned per test, so the mock reads it lazily. */
const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));
vi.mock("next/headers", () => ({
  headers: async () => requestHeaders.current,
  // Present so the real session module still links; nothing under test calls it.
  cookies: async () => { throw new Error("cookies() is not available in these tests."); },
}));

const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }));
const sessionMock = vi.hoisted(() => ({ createSession: vi.fn() }));
vi.mock("@/lib/email/send", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/email/send")>()), sendEmail: mail.sendEmail }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/auth/session")>()), createSession: sessionMock.createSession }));

const { registrationSchema } = await import("@/lib/auth/credentials");
const {
  API_KEY_ONE_TIME_NOTICE,
  KEY_ENV_VAR,
  QUICKSTART_KEY_PLACEHOLDER,
  REGISTRATION_EXAMPLE,
  registrationCurl,
  resolveQuickstartOrigin,
} = await import("@/components/quickstart-card");
const registerRoute = await import("@/app/api/auth/register/route");
const { db } = await import("@/lib/db");
const { apiKeys, rateLimits, users, workspaces } = await import("@/lib/db/schema");

const PRODUCTION_ORIGIN = "https://chartrelay.dev";

async function renderDocs(): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: DocsPage } = await import("@/app/docs/page");
  return renderToStaticMarkup(await DocsPage());
}

/** The two marketing pages that carry a copy-paste snippet, rendered the way a visitor sees them. */
async function renderLanding(): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: Home } = await import("@/app/page");
  return renderToStaticMarkup(Home());
}

async function renderCompare(): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: ComparePage } = await import("@/app/compare/page");
  return renderToStaticMarkup(ComparePage());
}

async function renderMcp(): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: McpPage } = await import("@/app/mcp/page");
  return renderToStaticMarkup(McpPage());
}

/** Markup without tags or entities, so an assertion sees the sentence a reader sees. */
const plainText = (html: string) =>
  html.replace(/<[^>]*>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x2F;/g, "/").replace(/\s+/g, " ");

async function renderCard(): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { QuickstartCard } = await import("@/components/quickstart-card");
  return renderToStaticMarkup(await QuickstartCard({ renderCount: 0, activeKeyCount: 1, keyPrefix: "cr_live_abcd" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  requestHeaders.current = new Headers();
  db.delete(apiKeys).run();
  db.delete(rateLimits).run();
  db.delete(workspaces).run();
  db.delete(users).run();
});

describe("the key environment variable has one name", () => {
  it("is CHARTRELAY_API_KEY, the name the MCP server reads", () => {
    expect(KEY_ENV_VAR).toBe("CHARTRELAY_API_KEY");
    expect(QUICKSTART_KEY_PLACEHOLDER).toBe(`$${KEY_ENV_VAR}`);
    // mcp/index.js is the third surface that tells a developer where to put the key.
    expect(read("mcp/index.js")).toContain(`process.env.${KEY_ENV_VAR}`);
  });

  it("is the only spelling the docs page and the dashboard card use", async () => {
    for (const file of [DOCS_PAGE, QUICKSTART_CARD]) {
      // "CHARTRELAY_API_KEY" does not contain "CHARTRELAY_KEY", so a bare match is the old name.
      expect(read(file), `${file} still uses the old CHARTRELAY_KEY name`).not.toMatch(/\bCHARTRELAY_KEY\b/);
    }
    vi.stubEnv("APP_URL", PRODUCTION_ORIGIN);
    const [docs, card] = [await renderDocs(), await renderCard()];
    for (const html of [docs, card]) {
      expect(html).toContain(KEY_ENV_VAR);
      expect(html).not.toMatch(/CHARTRELAY_KEY\b/);
    }
  });

  it("is the name in the snippet on the two most-visited marketing pages", async () => {
    vi.stubEnv("APP_URL", PRODUCTION_ORIGIN);
    // The landing page and /compare are where a developer meets the product; the snippet they copy
    // has to export the variable the API actually reads, not a near-miss they debug later.
    for (const html of [await renderLanding(), await renderCompare()]) {
      expect(html).toContain(`Bearer $${KEY_ENV_VAR}`);
      expect(html).not.toMatch(/CHARTRELAY_KEY\b/);
    }
  });

  it("appears nowhere under src/ or in the README", () => {
    // This assertion used to carry an allow-list of known offenders (the landing page and /compare),
    // so it reported green while the two most-visited snippets on the site still exported the wrong
    // variable. A test that encodes known offenders as acceptable is worse than no test, because it
    // reports green while the defect ships. There is no allow-list here, and there must never be one
    // again: every file is held to the same rule, and a new offender fails this test on the spot.
    const offenders = [...sourceFiles("src"), "README.md"].filter((file) => /\bCHARTRELAY_KEY\b/.test(read(file)));
    expect(offenders).toEqual([]);
  });
});

describe("no public page hardcodes a localhost endpoint in a copy-paste snippet", () => {
  it("has no localhost API endpoint anywhere in the pages or components", () => {
    // Exactly Codex's finding: a snippet a developer copies that calls their own machine instead of
    // the service. A localhost value documented for a *setting* (CHARTRELAY_API_URL, the deployment
    // the MCP server is aimed at) is legitimate and does not match, because no API path follows it.
    const offenders = sourceFiles("src").filter((file) => /localhost(:\d+)?\/api\//.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it("points the docs quickstart at the deployed origin, not at localhost", async () => {
    vi.stubEnv("APP_URL", PRODUCTION_ORIGIN);
    // A poisoned host must not be able to redirect the copyable command either.
    requestHeaders.current = new Headers({ host: "evil.example", "x-forwarded-host": "evil.example" });
    const html = await renderDocs();
    expect(html).toContain(`${PRODUCTION_ORIGIN}/api/v1/charts`);
    expect(html).toContain(`${PRODUCTION_ORIGIN}/api/auth/register`);
    expect(html).not.toContain("localhost");
    expect(html).not.toContain("evil.example");
  });

  it("resolves the same origin on the docs page and on the dashboard card", async () => {
    vi.stubEnv("APP_URL", PRODUCTION_ORIGIN);
    const [docs, card] = [await renderDocs(), await renderCard()];
    for (const html of [docs, card]) expect(html).toContain(`${PRODUCTION_ORIGIN}/api/v1/charts`);
  });

  it("still gives a working command in local development", async () => {
    vi.stubEnv("APP_URL", "");
    requestHeaders.current = new Headers({ host: "localhost:3000" });
    expect(await renderDocs()).toContain("http://localhost:3000/api/v1/charts");
  });
});

describe("the documented registration payload matches the schema the route enforces", () => {
  /** Fields registrationSchema rejects the body for omitting, derived from the schema itself. */
  const requiredFields = Object.keys(registrationSchema.shape).filter((field) => {
    const withoutField = { ...REGISTRATION_EXAMPLE } as Record<string, unknown>;
    delete withoutField[field];
    return !registrationSchema.safeParse(withoutField).success;
  });

  it("documents a body the schema accepts", () => {
    expect(registrationSchema.safeParse(REGISTRATION_EXAMPLE).success).toBe(true);
  });

  it("documents every field the schema requires, and requires every field it documents", () => {
    expect(requiredFields.sort()).toEqual(["email", "name", "password"]);
    expect(Object.keys(REGISTRATION_EXAMPLE).sort()).toEqual(requiredFields.sort());
  });

  it("names each required field on the docs page", async () => {
    vi.stubEnv("APP_URL", PRODUCTION_ORIGIN);
    const html = await renderDocs();
    for (const field of requiredFields) expect(html, `/docs never names the required field ${field}`).toContain(`<code>${field}</code>`);
    // The finding was that `name` was mandatory but undocumented, so the page must say so outright.
    expect(html).toContain("All three are required");
  });

  it("ships a curl example whose body the schema accepts", () => {
    const curl = registrationCurl(PRODUCTION_ORIGIN);
    expect(curl).toContain(`${PRODUCTION_ORIGIN}/api/auth/register`);
    const body = curl.slice(curl.indexOf("--data '") + "--data '".length, curl.lastIndexOf("'"));
    expect(registrationSchema.safeParse(JSON.parse(body)).success).toBe(true);
  });
});

describe("POST /api/auth/register names the field that is wrong", () => {
  const post = (body: unknown, ip = "203.0.113.10") =>
    registerRoute.POST(new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
    }));

  it("names the missing field rather than restating the whole payload", async () => {
    const response = await post({ email: "ada@example.com", password: "a long enough password" });
    expect(response.status).toBe(400);
    const { error } = await response.json();
    expect(error).toContain("Missing required field: name");
    // The old message described all three fields and left the caller to work out which was wrong.
    expect(error).not.toBe("Enter a valid name, email, and password of at least 10 characters.");
  });

  it("lists every missing field when several are absent", async () => {
    const { error } = await (await post({})).json();
    expect(error).toContain("Missing required fields: name, email, password");
  });

  it("separates a field that is present but invalid from one that is absent", async () => {
    const { error } = await (await post({ name: "Ada Lovelace", email: "ada@example.com", password: "short" })).json();
    expect(error).toContain("Invalid field: password");
    expect(error).not.toContain("Missing required field");
  });

  it("treats an empty string as a missing field, because that is how it reads to the caller", async () => {
    const { error } = await (await post({ name: "", email: "ada@example.com", password: "a long enough password" })).json();
    expect(error).toContain("Missing required field: name");
  });

  it("still explains the rules after naming the field", async () => {
    const { error } = await (await post({ email: "ada@example.com", password: "a long enough password" })).json();
    expect(error).toContain("at least 10 characters");
  });

  it("rejects a body that is not an object without pretending to know which field is wrong", async () => {
    const { error } = await (await post("not an object")).json();
    expect(error).toContain("must be a JSON object");
  });
});

describe("the one-time key reveal says the same thing everywhere", () => {
  it("returns the notice alongside the key, in the words the docs and the dashboard use", async () => {
    const response = await registerRoute.POST(new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      body: JSON.stringify(REGISTRATION_EXAMPLE),
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.40" },
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.apiKey).toMatch(/^cr_live_/);
    expect(body.apiKeyNotice).toBe(API_KEY_ONE_TIME_NOTICE);
  });

  it("states plainly that this is the only time the key is shown, and what to do if it is lost", () => {
    expect(API_KEY_ONE_TIME_NOTICE).toContain("only time");
    expect(API_KEY_ONE_TIME_NOTICE).toContain("create another key");
    // A lost key is replaced, not recovered — and replacing it must not sound like it breaks the old one.
    expect(API_KEY_ONE_TIME_NOTICE).toContain("keep working until you revoke them");
  });

  it("appears on the docs page and on the dashboard card", async () => {
    vi.stubEnv("APP_URL", PRODUCTION_ORIGIN);
    // The notice contains no character React escapes, so it survives into the markup verbatim.
    for (const html of [await renderDocs(), await renderCard()]) expect(html).toContain(API_KEY_ONE_TIME_NOTICE);
  });
});

describe("resolveQuickstartOrigin is what both surfaces agree on", () => {
  it("prefers APP_URL over any request header", () => {
    expect(resolveQuickstartOrigin({ appUrl: PRODUCTION_ORIGIN, host: "evil.example" })).toBe(PRODUCTION_ORIGIN);
  });
});

describe("counted nouns in the alt text agree with their count", () => {
  /** A chart's description is read aloud, so "across 1 categories" is a sentence, not a template. */
  const spec = (type: "pie" | "line", labels: string[]) => ({
    type,
    title: "Share",
    width: 900,
    height: 520,
    theme: "light" as const,
    showLegend: false,
    showValues: false,
    series: [{ name: "Visits", data: labels.map((label, index) => ({ label, value: type === "pie" ? index + 1 : 7 })) }],
  });

  it("says 'across 1 category' for a one-slice pie and 'categories' beyond that", async () => {
    const { renderChart } = await import("@/lib/charts/render");
    expect(renderChart(spec("pie", ["Search"]) as never).altText).toContain("across 1 category.");
    expect(renderChart(spec("pie", ["Search", "Direct"]) as never).altText).toContain("across 2 categories.");
  });

  it("says 'across all 2 points' for a flat line, and never 'all 1 points'", async () => {
    const { renderChart } = await import("@/lib/charts/render");
    // A flat two-point series is the shortest chart that reaches the "stays flat" sentence.
    expect(renderChart(spec("line", ["Jan", "Feb"]) as never).altText).toContain("stays flat at 7 across all 2 points.");
    // One point takes the single-point sentence instead, which must not say "1 points" either.
    const single = renderChart(spec("line", ["Jan"]) as never).altText;
    expect(single).toContain("a single data point");
    expect(single).not.toMatch(/\b1 (points|categories)\b/);
  });

  it("says '1 more series shown' without inflecting a word that has no plural", async () => {
    const { renderChart } = await import("@/lib/charts/render");
    const two = { ...spec("line", ["Jan", "Feb"]), series: [
      { name: "Visits", data: [{ label: "Jan", value: 7 }, { label: "Feb", value: 9 }] },
      { name: "Signups", data: [{ label: "Jan", value: 3 }, { label: "Feb", value: 4 }] },
    ] };
    const three = { ...two, series: [...two.series, { name: "Trials", data: [{ label: "Jan", value: 1 }, { label: "Feb", value: 2 }] }] };
    expect(renderChart(two as never).altText).toContain("1 more series shown.");
    expect(renderChart(three as never).altText).toContain("2 more series shown.");
  });
});

describe("the site tells one story about self-hosting", () => {
  it("offers self-hosting on neither the landing page nor /mcp", async () => {
    vi.stubEnv("APP_URL", PRODUCTION_ORIGIN);
    // The two pages disagreed: /mcp offered "a copy you host" while the landing page said the hosted
    // API is the only way to run ChartRelay. Only one of those can be true, and it is the landing page.
    for (const html of [await renderLanding(), await renderMcp()]) {
      const body = plainText(html);
      expect(body).not.toContain("a copy you host");
      expect(body).not.toMatch(/instance,? including one of your own/);
    }
  });

  it("still explains on /mcp that the server takes a base URL, and says why that is not self-hosting", async () => {
    const body = plainText(await renderMcp());
    expect(body).toContain("CHARTRELAY_API_URL");
    expect(body).toContain("not offered for self-hosting today");
    expect(body).toMatch(/takes any base URL/);
  });

  it("keeps the landing page's answer to the same question unchanged in substance", async () => {
    const body = plainText(await renderLanding());
    expect(body).toContain("The hosted API is the only supported way to run ChartRelay");
  });
});

/** Every .ts/.tsx file under a directory, as repo-relative paths. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...sourceFiles(relative));
    else if (/\.tsx?$/.test(entry.name)) out.push(relative);
  }
  return out;
}
