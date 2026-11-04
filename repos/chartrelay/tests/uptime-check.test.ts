import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = path.resolve(import.meta.dirname, "../scripts/uptime-check.mjs");

type Reply = { status: number; body?: string; delayMs?: number };
type Routes = Record<string, Reply>;

const servers: http.Server[] = [];

/** Starts a stub ChartRelay on an ephemeral port. Keys are "METHOD /path"; anything unlisted answers 404. */
async function stub(routes: Routes) {
  const server = http.createServer((request, response) => {
    const reply = routes[`${request.method} ${request.url}`] ?? { status: 404, body: "not found" };
    const send = () => {
      response.writeHead(reply.status, { "content-type": "application/json" });
      response.end(reply.body ?? "");
    };
    if (reply.delayMs) setTimeout(send, reply.delayMs).unref();
    else send();
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("expected a TCP address");
  return `http://127.0.0.1:${address.port}`;
}

/** A realistic render response: svg first, and longer than the script's 2 KB body cap. */
const renderBody = `{"svg":"<svg xmlns=\\"http://www.w3.org/2000/svg\\">${"<rect/>".repeat(400)}</svg>","altText":"Uptime check.","warnings":[]}`;

const healthy: Routes = {
  'GET /api/health': { status: 200, body: '{"status":"ok"}' },
  'GET /': { status: 200, body: "<!doctype html>" },
  'GET /pricing': { status: 200, body: "<!doctype html>" },
  'POST /api/demo/render': { status: 200, body: renderBody },
  'POST /api/billing/webhook': { status: 400, body: '{"error":"Missing signature."}' },
};

function run(args: string[], env: Record<string, string | undefined> = {}) {
  // A deliberately bare environment, so a stray APP_URL from the test setup cannot decide what gets probed.
  const childEnv: NodeJS.ProcessEnv = { PATH: process.env.PATH, NODE_ENV: process.env.NODE_ENV, ...env };
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { env: childEnv });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("uptime-check", () => {
  it("passes every check against a healthy deployment and exits 0", async () => {
    const baseUrl = await stub(healthy);
    const { code, stdout } = await run([baseUrl]);
    expect(code).toBe(0);
    expect(stdout).toContain("5 passed, 0 warned, 0 failed");
    expect(stdout).toContain("ok   health");
    expect(stdout).toContain("ok   pricing");
    expect(stdout).toContain("ok   render");
    expect(stdout).toContain("ok   billing-webhook");
  });

  it("warns without failing when the webhook route reports that Stripe is not configured", async () => {
    const baseUrl = await stub({ ...healthy, "POST /api/billing/webhook": { status: 503, body: '{"error":"Webhook is not configured."}' } });
    const { code, stdout } = await run([baseUrl]);
    expect(code).toBe(0);
    expect(stdout).toContain("warn billing-webhook");
    expect(stdout).toContain("4 passed, 1 warned, 0 failed");
  });

  it("fails when /api/health answers 200 with a status other than ok", async () => {
    const baseUrl = await stub({ ...healthy, "GET /api/health": { status: 200, body: '{"status":"degraded"}' } });
    const { code, stdout } = await run([baseUrl]);
    expect(code).toBe(1);
    expect(stdout).toContain("FAIL health");
    expect(stdout).toContain("4 passed, 0 warned, 1 failed");
  });

  it("fails when a page or the webhook route answers an unexpected status", async () => {
    const baseUrl = await stub({ ...healthy, "GET /pricing": { status: 500 }, "POST /api/billing/webhook": { status: 200, body: "{}" } });
    const { code, stdout } = await run([baseUrl]);
    expect(code).toBe(1);
    expect(stdout).toContain("3 passed, 0 warned, 2 failed");
    expect(stdout).toContain("expected 200, got 500");
    expect(stdout).toContain("expected 400 (configured) or 503 (unconfigured), got 200");
  });

  it("fails when the render route answers 200 without an SVG, so a broken renderer cannot look healthy", async () => {
    const baseUrl = await stub({ ...healthy, "POST /api/demo/render": { status: 200, body: '{"warnings":[]}' } });
    const { code, stdout } = await run([baseUrl]);
    expect(code).toBe(1);
    expect(stdout).toContain("FAIL render");
    expect(stdout).toContain("200 without an svg field");
  });

  it("fails when the render route errors", async () => {
    const baseUrl = await stub({ ...healthy, "POST /api/demo/render": { status: 500, body: '{"error":"Chart render failed."}' } });
    const { code, stdout } = await run([baseUrl]);
    expect(code).toBe(1);
    expect(stdout).toContain("FAIL render");
    expect(stdout).toContain("expected 200, got 500");
  });

  it("warns rather than fails when the demo rate limit is what answered", async () => {
    const baseUrl = await stub({ ...healthy, "POST /api/demo/render": { status: 429, body: '{"error":"Demo limit reached."}' } });
    const { code, stdout } = await run([baseUrl]);
    expect(code).toBe(0);
    expect(stdout).toContain("warn render");
    expect(stdout).toContain("4 passed, 1 warned, 0 failed");
  });

  it("times out a slow request instead of hanging", async () => {
    const baseUrl = await stub({ ...healthy, "GET /api/health": { status: 200, body: '{"status":"ok"}', delayMs: 5_000 } });
    const { code, stdout } = await run([baseUrl, "--timeout=300"]);
    expect(code).toBe(1);
    expect(stdout).toContain("no response within 300ms");
  });

  it("emits machine-readable JSON with --json", async () => {
    const baseUrl = await stub(healthy);
    const { code, stdout } = await run([baseUrl, "--json"]);
    expect(code).toBe(0);
    const report = JSON.parse(stdout) as {
      baseUrl: string;
      ok: boolean;
      counts: { pass: number; warn: number; fail: number };
      checks: { name: string; outcome: string; httpStatus: number | null; method: string; path: string }[];
    };
    expect(report.baseUrl).toBe(baseUrl);
    expect(report.ok).toBe(true);
    expect(report.counts).toEqual({ pass: 5, warn: 0, fail: 0 });
    expect(report.checks.map((check) => check.name)).toEqual(["health", "home", "pricing", "render", "billing-webhook"]);
    expect(report.checks.every((check) => check.outcome === "pass")).toBe(true);
  });

  it("falls back to APP_URL when no base URL argument is given", async () => {
    const baseUrl = await stub(healthy);
    const { code, stdout } = await run(["--json"], { APP_URL: baseUrl });
    expect(code).toBe(0);
    expect((JSON.parse(stdout) as { baseUrl: string }).baseUrl).toBe(baseUrl);
  });

  it("rejects a malformed base URL, an unknown flag and a bad timeout without probing anything", async () => {
    for (const args of [["not a url"], ["--nope"], ["--timeout=abc"]]) {
      const { code, stderr, stdout } = await run(args);
      expect(code).toBe(1);
      expect(stderr).toContain("node scripts/uptime-check.mjs");
      expect(stdout).toBe("");
    }
  });

  it("reports a failure rather than crashing when the host refuses the connection", async () => {
    const baseUrl = await stub(healthy);
    await new Promise<void>((resolve) => servers.splice(0)[0].close(() => resolve()));
    const { code, stdout } = await run([baseUrl, "--timeout=2000"]);
    expect(code).toBe(1);
    expect(stdout).toContain("FAIL health");
    expect(stdout).toContain("0 passed, 0 warned, 5 failed");
  });
});
