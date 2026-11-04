// Dependency-free uptime probe for a deployed ChartRelay instance.
// Usage: node scripts/uptime-check.mjs [base-url] [--json] [--timeout=<ms>]
// Base URL: argv, else APP_URL, else the canonical production host. Sends no credentials and reads no secrets.
// Exit code: 0 when every check passed (warnings allowed), 1 when any check failed.
import { pathToFileURL } from "node:url";

export const DEFAULT_BASE_URL = "https://chartrelay.dev";
export const DEFAULT_TIMEOUT_MS = 10_000;
/** Response bodies are only inspected for a short status marker; never read an unbounded body from the network. */
const MAX_BODY_CHARS = 2048;
/** Smallest spec the render API accepts. Sent to the unauthenticated demo route, which stores nothing. */
export const RENDER_PROBE_SPEC = {
  type: "bar",
  title: "Uptime check",
  series: [{ name: "probe", data: [{ label: "a", value: 1 }, { label: "b", value: 2 }] }],
};

/** Parses argv. Returns { baseUrl, json, timeoutMs, help } or { error } for bad input. */
export function parseArgs(argv, env = {}) {
  let json = false;
  let help = false;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let positional;
  for (const arg of argv) {
    if (arg === "--json") json = true;
    else if (arg === "--help" || arg === "-h") help = true;
    else if (arg.startsWith("--timeout")) {
      const raw = arg.startsWith("--timeout=") ? arg.slice("--timeout=".length) : "";
      if (!/^\d+$/.test(raw) || Number(raw) === 0) return { error: "--timeout=<milliseconds> expects a positive integer, e.g. --timeout=5000" };
      timeoutMs = Number(raw);
    } else if (arg.startsWith("-")) return { error: `Unknown option ${arg}. Try --help.` };
    else if (positional === undefined) positional = arg;
    else return { error: "Expected at most one base URL." };
  }
  const candidate = positional ?? env.APP_URL ?? DEFAULT_BASE_URL;
  let baseUrl;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { error: `Base URL must be http(s): ${candidate}` };
    baseUrl = parsed.origin;
  } catch {
    return { error: `Not a valid base URL: ${candidate}` };
  }
  return { baseUrl, json, timeoutMs, help };
}

export const USAGE = `ChartRelay uptime check

  node scripts/uptime-check.mjs [base-url] [--json] [--timeout=<ms>]

  base-url      Origin to probe. Defaults to $APP_URL, then ${DEFAULT_BASE_URL}.
  --json        Machine-readable output on stdout.
  --timeout=ms  Per-request timeout (default ${DEFAULT_TIMEOUT_MS}).

Exits 0 when every check passes (warnings allowed), 1 otherwise.`;

async function request(url, { method = "GET", timeoutMs, headers, body }) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method, headers, body, redirect: "follow", signal: controller.signal });
    const text = (await response.text()).slice(0, MAX_BODY_CHARS);
    return { status: response.status, text, durationMs: Date.now() - started };
  } catch (error) {
    const reason = controller.signal.aborted ? `no response within ${timeoutMs}ms` : (error?.cause?.code ?? error?.message ?? "request failed");
    return { status: null, text: "", durationMs: Date.now() - started, error: String(reason) };
  } finally {
    clearTimeout(timer);
  }
}

function result(name, method, path, response, outcome, detail) {
  return { name, method, path, outcome, httpStatus: response.status, durationMs: response.durationMs, detail };
}

/** Runs every check against baseUrl. Returns the check results in order. */
export async function runChecks(baseUrl, { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl } = {}) {
  const send = fetchImpl ?? request;
  const checks = [];

  const health = await send(`${baseUrl}/api/health`, { timeoutMs });
  if (health.error) checks.push(result("health", "GET", "/api/health", health, "fail", health.error));
  else if (health.status !== 200) checks.push(result("health", "GET", "/api/health", health, "fail", `expected 200, got ${health.status}`));
  else {
    let status;
    try {
      status = JSON.parse(health.text)?.status;
    } catch {
      status = undefined;
    }
    checks.push(status === "ok"
      ? result("health", "GET", "/api/health", health, "pass", 'database reachable, {"status":"ok"}')
      : result("health", "GET", "/api/health", health, "fail", `expected {"status":"ok"}, got ${health.text.trim() || "an empty body"}`));
  }

  for (const [name, path] of [["home", "/"], ["pricing", "/pricing"]]) {
    const page = await send(`${baseUrl}${path}`, { timeoutMs });
    if (page.error) checks.push(result(name, "GET", path, page, "fail", page.error));
    else if (page.status !== 200) checks.push(result(name, "GET", path, page, "fail", `expected 200, got ${page.status}`));
    else checks.push(result(name, "GET", path, page, "pass", "page served"));
  }

  // The product's core function. Health can be green while every render returns 5xx, so probe a real one:
  // /api/demo/render is unauthenticated, writes nothing and stores nothing, so this sends no credentials
  // and leaves no rows behind. A 429 means the demo rate limit fired, which proves the route is alive but
  // not that it renders — reported as a warning rather than a failure.
  const render = await send(`${baseUrl}/api/demo/render`, { method: "POST", timeoutMs, headers: { "content-type": "application/json" }, body: JSON.stringify(RENDER_PROBE_SPEC) });
  if (render.error) checks.push(result("render", "POST", "/api/demo/render", render, "fail", render.error));
  else if (render.status === 429) checks.push(result("render", "POST", "/api/demo/render", render, "warn", "demo rate limit reached, so the render path could not be exercised"));
  else if (render.status !== 200) checks.push(result("render", "POST", "/api/demo/render", render, "fail", `expected 200, got ${render.status}`));
  // The body is capped at MAX_BODY_CHARS and a rendered chart is far larger, so it cannot be parsed as
  // JSON here. The route answers `{"svg":"<svg …` with svg first, so the marker is inside the cap.
  else if (/"svg"\s*:\s*"<svg/.test(render.text)) checks.push(result("render", "POST", "/api/demo/render", render, "pass", "chart rendered, response carries SVG"));
  else checks.push(result("render", "POST", "/api/demo/render", render, "fail", "200 without an svg field in the response"));

  // Unsigned and therefore harmless: the route can only refuse it. 400 proves the Stripe signing secret is loaded, 503 proves it is not.
  const webhook = await send(`${baseUrl}/api/billing/webhook`, { method: "POST", timeoutMs, headers: { "content-type": "application/json" }, body: "{}" });
  if (webhook.error) checks.push(result("billing-webhook", "POST", "/api/billing/webhook", webhook, "fail", webhook.error));
  else if (webhook.status === 400) checks.push(result("billing-webhook", "POST", "/api/billing/webhook", webhook, "pass", "unsigned request refused; Stripe webhook secret is configured"));
  else if (webhook.status === 503) checks.push(result("billing-webhook", "POST", "/api/billing/webhook", webhook, "warn", "STRIPE_WEBHOOK_SECRET is not configured, so billing events are not processed"));
  else checks.push(result("billing-webhook", "POST", "/api/billing/webhook", webhook, "fail", `expected 400 (configured) or 503 (unconfigured), got ${webhook.status}`));

  return checks;
}

export function summarize(checks) {
  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const check of checks) counts[check.outcome]++;
  return counts;
}

const LABEL = { pass: "ok  ", warn: "warn", fail: "FAIL" };

export function formatText(baseUrl, checks, counts) {
  const lines = [`ChartRelay uptime check — ${baseUrl}`];
  for (const check of checks) {
    const status = check.httpStatus === null ? "---" : String(check.httpStatus);
    lines.push(`${LABEL[check.outcome]} ${check.name.padEnd(16)} ${check.method} ${check.path.padEnd(22)} ${status.padStart(3)} ${String(check.durationMs).padStart(5)}ms  ${check.detail}`);
  }
  lines.push(`${counts.fail ? "FAIL" : "ok  "} ${counts.pass} passed, ${counts.warn} warned, ${counts.fail} failed`);
  return lines.join("\n");
}

export async function main(argv, env = process.env) {
  const options = parseArgs(argv, env);
  if (options.error) {
    console.error(`${options.error}\n\n${USAGE}`);
    return 1;
  }
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  const checks = await runChecks(options.baseUrl, { timeoutMs: options.timeoutMs });
  const counts = summarize(checks);
  if (options.json) console.log(JSON.stringify({ baseUrl: options.baseUrl, checkedAt: new Date().toISOString(), ok: counts.fail === 0, counts, checks }, null, 2));
  else console.log(formatText(options.baseUrl, checks, counts));
  return counts.fail === 0 ? 0 : 1;
}

// Only run when executed directly, so tests and other scripts can import the pieces above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
