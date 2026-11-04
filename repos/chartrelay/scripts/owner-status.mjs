// What is still waiting on the owner, checked against the live site rather than asserted.
//
// Usage: node scripts/owner-status.mjs [https://target]
// Read-only, unauthenticated, sends no credentials and reads no secrets. Anything this cannot verify
// from outside is reported as "cannot check from here" with the one-line manual check instead — a
// status board that guesses is worse than one that admits what it does not know.
import { pathToFileURL } from "node:url";

const DEFAULT_BASE_URL = "https://chartrelay.dev";

/** Street lines, PO boxes, and "CITY, ST 00000" tails — the same shapes the address ratchet test uses. */
const ADDRESS_SHAPES = [
  /\b\d{1,6}\s+(?:[NSEW]\.?\s+)?[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir|Terrace|Ter|Place|Pl|Way|Highway|Hwy|Parkway|Pkwy|Suite|Ste)\b/,
  /\bP\.?\s?O\.?\s?Box\s+\d+/i,
  /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)[,.]?\s+\d{5}\b/,
];

const get = async (url) => {
  try {
    const response = await fetch(url, { redirect: "follow" });
    return { ok: response.ok, status: response.status, text: response.ok ? await response.text() : "", headers: response.headers };
  } catch (error) {
    return { ok: false, status: error instanceof Error ? error.message : "failed", text: "", headers: new Headers() };
  }
};

export async function checkPostalAddress(baseUrl) {
  const terms = await get(`${baseUrl}/terms`);
  if (!terms.ok) return { state: "unknown", detail: `/terms returned ${terms.status}` };
  const found = ADDRESS_SHAPES.some((shape) => shape.test(terms.text));
  return found
    ? { state: "done", detail: "an address is published on /terms" }
    : { state: "todo", detail: "no address on /terms, so lifecycle email is still blocked" };
}

export async function checkSiteHealth(baseUrl) {
  const [health, chart] = await Promise.all([get(`${baseUrl}/api/health`), get(`${baseUrl}/chart?type=bar&data=1,2,3&labels=A,B,C&format=svg`)]);
  if (!health.ok) return { state: "todo", detail: `/api/health returned ${health.status}` };
  if (!chart.ok) return { state: "todo", detail: `/chart returned ${chart.status}` };
  // A chart that renders is not the same as a chart that renders correctly, and only looking proves
  // the second. This check is deliberately the weaker claim.
  return { state: "done", detail: "health ok and /chart returns a drawing" };
}

const LABELS = { done: "DONE", todo: "TODO", unknown: "????" };

export async function main(argv = process.argv.slice(2), env = process.env) {
  const baseUrl = (argv.find((a) => a.startsWith("http")) ?? env.APP_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  console.log(`ChartRelay — owner status against ${baseUrl}\n`);

  const site = await checkSiteHealth(baseUrl);
  const address = await checkPostalAddress(baseUrl);

  const rows = [
    ["Site is up and drawing", site],
    ["1. Postal address (Gate S)", address],
    ["2. Baseline set reviewed (Gate E)", { state: "unknown", detail: "only you can say — run `npm run golden`, open reports/baseline/index.html" }],
    ["3. Stripe live (Gate F)", { state: "unknown", detail: "cannot be checked from outside; look for the Test mode toggle being OFF in the Stripe dashboard" }],
  ];

  const width = Math.max(...rows.map(([label]) => label.length));
  for (const [label, result] of rows) {
    console.log(`  [${LABELS[result.state]}]  ${label.padEnd(width)}  ${result.detail}`);
  }

  console.log("\nAnything marked ???? is something this script deliberately will not guess at.");
  return rows.some(([, result]) => result.state === "todo") ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().then((code) => process.exit(code));
}
