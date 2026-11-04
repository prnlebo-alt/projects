#!/usr/bin/env node
// ChartRelay MCP server over stdio: render_chart, estimate_cost, get_credit_balance, get_usage, get_top_up_link.
// It never buys anything: get_top_up_link hands a URL to the human, who pays in their own browser.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = (process.env.CHARTRELAY_API_URL ?? "https://chartrelay.example").replace(/\/+$/, "");
const API_KEY = process.env.CHARTRELAY_API_KEY ?? "";
const INCLUDE_IMAGE = process.env.CHARTRELAY_INCLUDE_IMAGE !== "false";

// Mirrors the API's chart schema (src/lib/charts/schema.ts). Keep the two in sync.
export const chartInput = {
  type: z.enum(["bar", "line", "area", "pie", "scatter"]).describe("Chart type. Use bar to compare categories, line/area for trends over time, pie only for one series with at most 7 parts. Scatter draws each value as a dot at its category label, in input order; there is no numeric x-axis, so it cannot show an x/y relationship."),
  title: z.string().max(120).describe("The takeaway, not just the metric, e.g. 'MRR grew 84% in six months'."),
  subtitle: z.string().max(180).optional().describe("Optional context such as units, source, or time range."),
  series: z.array(z.object({
    name: z.string().min(1).max(80),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe("Optional hex color like #6C5CE7."),
    data: z.array(z.object({ label: z.string().min(1).max(80), value: z.number() })).min(1).max(100),
  })).min(1).max(12).describe("One or more data series. Points are matched to categories by label, so series may list labels in different orders."),
  width: z.number().int().min(320).max(2400).optional(),
  height: z.number().int().min(240).max(1600).optional(),
  theme: z.enum(["light", "dark"]).optional(),
  showLegend: z.boolean().optional(),
  showValues: z.boolean().optional().describe("Print values on the chart; good for small bar charts."),
  // Not part of the chart: it travels in the same object and the API parses it separately (src/lib/charts/schema.ts).
  // Without it in this schema the tool would strip the field, and the override named in a 422 reply would be
  // impossible to use from here — advice the model could read but never act on.
  allowQualityErrors: z.boolean().optional().describe("Store the chart even when the quality review found blocking problems. Leave unset by default; set it only after a render was refused and you deliberately want that exact chart anyway. The findings are returned either way, and the render still counts against the quota."),
};

const text = (value) => ({ type: "text", text: value });

/** The API's error contract is { error: { code, message, top_up_url? } }; older replies carried a bare string. */
export function apiError(body) {
  const error = body?.error;
  if (error && typeof error === "object") return { code: error.code, message: error.message, topUpUrl: error.top_up_url };
  return { code: undefined, message: typeof error === "string" ? error : undefined, topUpUrl: undefined };
}

/** Short, shareable chart URLs (`/c/{id}.png`). The API's own `urls` stay the fallback for older servers. */
const shortUrl = (id, extension, fallback) => (id ? `${API_URL}/c/${id}.${extension}` : fallback);

export function formatResult(body) {
  const issues = (body.warnings ?? []).filter((issue) => issue.code !== "healthy");
  const lines = [
    `Chart rendered (id ${body.id}).`,
    `PNG: ${shortUrl(body.id, "png", body.urls?.png)}`,
    `SVG: ${shortUrl(body.id, "svg", body.urls?.svg)}`,
    `Alt text: ${body.altText}`,
    issues.length
      ? `Quality review found ${issues.length} issue(s). Consider fixing and re-rendering:\n${issues.map((issue) => `- [${issue.severity}] ${issue.message} Fix: ${issue.suggestion}`).join("\n")}`
      : "Quality review: no structural problems found. Still verify the data and the takeaway in the title.",
    body.usage ? `Usage this month: ${body.usage.used}/${body.usage.limit}.` : "",
    typeof body.credits_remaining === "number" ? `Credits remaining: ${body.credits_remaining.toLocaleString("en-US")}.` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * HTTP 402: no credit, or this key's own budget is spent. The agent cannot fix either by itself, so the message says
 * to stop, and gives the one URL the person needs. It deliberately never suggests retrying.
 */
export function outOfCredit(body) {
  const { code, message, topUpUrl } = apiError(body);
  const reason = code === "key_budget_exhausted" ? "This API key has spent its monthly budget." : "This account is out of render credit.";
  return [
    `${message ?? reason} Nothing was rendered and nothing was charged.`,
    "Do not retry: more attempts will fail the same way. Tell the person you are working for.",
    topUpUrl ? `They can add credit here: ${topUpUrl}` : `They can add credit at ${API_URL}/pricing.`,
  ].join("\n");
}

const issueLine = (issue) => `- [${issue.code}] ${issue.message} Fix: ${issue.suggestion}`;

/**
 * HTTP 422 from POST /api/v1/charts: the quality review found blocking problems, so nothing was stored and
 * nothing was metered. It is the one refusal the model can resolve on its own, and the body carries everything
 * it needs — each blocking finding with its code, message and suggested fix, plus the per-request override that
 * stores the chart as it is. Collapsing that into "HTTP 422" would throw the self-correction away, so this
 * reproduces both routes in the exact terms the next render_chart call has to use.
 */
export function formatQualityRejection(body) {
  const warnings = body.warnings ?? [];
  const blocking = body.blocking?.length ? body.blocking : warnings.filter((issue) => issue.severity === "error");
  const other = warnings.filter((issue) => issue.severity !== "error" && issue.code !== "healthy");
  const field = body.override?.field ?? "allowQualityErrors";
  const value = JSON.stringify(body.override?.value ?? true);
  return [
    body.error ?? `The chart was not stored: the quality review found ${blocking.length} blocking problem${blocking.length === 1 ? "" : "s"}. Nothing was saved and no render was counted.`,
    blocking.length ? `Blocking findings:\n${blocking.map(issueLine).join("\n")}` : "",
    other.length ? `Also reported, not blocking:\n${other.map(issueLine).join("\n")}` : "",
    `Two ways forward, each one render_chart call:\n1. Apply the fixes above and call render_chart again with the corrected spec.\n2. Keep this chart exactly as it is: call render_chart again with the same spec plus ${field}: ${value}. ${body.override?.effect ?? "The chart is then stored despite these findings and counts as one render."}`,
  ].filter(Boolean).join("\n");
}

export async function renderChart(args, fetchImpl = fetch) {
  if (!API_KEY) return { isError: true, content: [text("CHARTRELAY_API_KEY is not set. Create a free key at " + API_URL + "/register and add it to this MCP server's environment.")] };
  let response;
  try {
    response = await fetchImpl(`${API_URL}/api/v1/charts`, {
      method: "POST",
      headers: { authorization: `Bearer ${API_KEY}`, "content-type": "application/json", "user-agent": "chartrelay-mcp/0.1.0" },
      body: JSON.stringify(args),
    });
  } catch {
    return { isError: true, content: [text(`Could not reach ChartRelay at ${API_URL}. Try again shortly.`)] };
  }
  const body = await response.json().catch(() => ({}));
  if (response.status === 400) return { isError: true, content: [text(`The chart spec was rejected. Fix these fields and try again:\n${JSON.stringify(body.details ?? body.error, null, 2)}`)] };
  if (response.status === 401) return { isError: true, content: [text("The ChartRelay API key was rejected. Check CHARTRELAY_API_KEY.")] };
  if (response.status === 413) return { isError: true, content: [text("The chart spec is too large. Send fewer or shorter data points.")] };
  if (response.status === 422) return { isError: true, content: [text(formatQualityRejection(body))] };
  if (response.status === 402) return { isError: true, content: [text(outOfCredit(body))] };
  if (response.status === 403) return { isError: true, content: [text(`${apiError(body).message ?? "This key is not allowed to do that."} Ask the key's owner to change its scopes or allowed addresses.`)] };
  if (response.status === 429) {
    const { message } = apiError(body);
    return { isError: true, content: [text(`${message ?? "Rate or monthly render limit reached."} Upgrade at ${API_URL}/pricing, or wait and retry.`)] };
  }
  if (response.status >= 500) return { isError: true, content: [text(`ChartRelay had a server error (HTTP ${response.status}). This is not a quota problem; try again shortly.`)] };
  if (!response.ok) return { isError: true, content: [text(`ChartRelay returned an error (HTTP ${response.status}).`)] };

  const content = [text(formatResult(body))];
  if (INCLUDE_IMAGE && body.urls?.png) {
    try {
      const png = await fetchImpl(body.urls.png);
      if (png.ok) content.push({ type: "image", data: Buffer.from(await png.arrayBuffer()).toString("base64"), mimeType: "image/png" });
    } catch {
      // The URLs in the text are enough; the inline preview is a convenience.
    }
  }
  return { content };
}

async function callApi(path, { method = "GET", body } = {}, fetchImpl = fetch) {
  if (!API_KEY) return { error: { isError: true, content: [text("CHARTRELAY_API_KEY is not set. Create a free key at " + API_URL + "/register and add it to this MCP server's environment.")] } };
  let response;
  try {
    response = await fetchImpl(`${API_URL}${path}`, {
      method,
      headers: { authorization: `Bearer ${API_KEY}`, ...(body ? { "content-type": "application/json" } : {}), "user-agent": "chartrelay-mcp/0.2.0" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    return { error: { isError: true, content: [text(`Could not reach ChartRelay at ${API_URL}. Try again shortly.`)] } };
  }
  const json = await response.json().catch(() => ({}));
  if (response.ok) return { json };
  const { message } = apiError(json);
  const hint = response.status === 401 ? "The ChartRelay API key was rejected. Check CHARTRELAY_API_KEY."
    : response.status === 403 ? `${message ?? "This key cannot do that."} This tool needs a key with the right scope; create one in the dashboard.`
    : response.status === 429 ? `${message ?? "Too many requests."} Wait a moment and retry.`
    : response.status >= 500 ? `ChartRelay had a server error (HTTP ${response.status}). Try again shortly.`
    : `${message ?? "ChartRelay refused the request"} (HTTP ${response.status}).`;
  return { error: { isError: true, content: [text(hint)] } };
}

const number = (value) => Number(value ?? 0).toLocaleString("en-US");

export async function estimateCost(args, fetchImpl = fetch) {
  const { json, error } = await callApi("/api/v1/estimate", { method: "POST", body: args }, fetchImpl);
  if (error) return error;
  return { content: [text([
    json.billable ? `One render of this chart costs ${json.units} credit.` : "This is a test key: the render is free and watermarked.",
    `Credits remaining: ${number(json.credits_remaining)}.`,
    json.can_afford ? "The balance covers it." : "The balance does NOT cover it. Do not call render_chart; call get_top_up_link and give the URL to the person.",
  ].join("\n"))] };
}

export async function getCreditBalance(fetchImpl = fetch) {
  const { json, error } = await callApi("/api/v1/usage", {}, fetchImpl);
  if (error) return error;
  const credit = (json.credit ?? []).map((grant) => `- ${grant.source}: ${number(grant.renders)} granted${grant.expires_at ? `, expires ${grant.expires_at.slice(0, 10)}` : ", no expiry"}`);
  const budget = json.key_budget && json.key_budget.monthly != null ? `This key's monthly budget: ${number(json.key_budget.monthly)} (remaining ${number(json.key_budget.remaining)}).` : "";
  return { content: [text([`Credits remaining: ${number(json.credits_remaining)}.`, credit.length ? `Live credit:\n${credit.join("\n")}` : "No live credit grants.", budget].filter(Boolean).join("\n"))] };
}

export async function getUsage(fetchImpl = fetch) {
  const { json, error } = await callApi("/api/v1/usage", {}, fetchImpl);
  if (error) return error;
  const recent = (json.by_day ?? []).slice(-7).map((row) => `${row.day}: ${number(row.renders)}`);
  const keys = (json.by_key ?? []).map((row) => `- ${row.name}: ${number(row.renders)}`);
  const formats = (json.by_format ?? []).map((row) => `- ${row.format}: ${number(row.renders)}`);
  return { content: [text([
    `Renders in the last ${json.period_days} days: ${number(json.total)}. Credits remaining: ${number(json.credits_remaining)}.`,
    `Last 7 days:\n${recent.join("\n")}`,
    keys.length ? `By key:\n${keys.join("\n")}` : "",
    formats.length ? `By format:\n${formats.join("\n")}` : "",
  ].filter(Boolean).join("\n\n"))] };
}

export async function getTopUpLink(fetchImpl = fetch) {
  const { json, error } = await callApi("/api/v1/top-up-link", {}, fetchImpl);
  if (error) return error;
  return { content: [text(`Give this link to the person you are working for: ${json.url}\nThey add credit in their own browser; you cannot pay for it and should not try. Once they have, call get_credit_balance to confirm.`)] };
}

export function createServer() {
  const server = new McpServer({ name: "chartrelay", version: "0.2.0" });
  server.registerTool("render_chart", {
    title: "Render chart",
    description: "Render a publish-ready chart from data. Returns durable PNG and SVG URLs, alt text for accessibility, and a quality review with suggested fixes. If the review reports issues, revise the spec and call again. A chart that breaks a documented rule (a pie of negative values, a pie of several series) is refused and stored nowhere; the reply then names every blocking finding with its fix, and you either correct the spec or re-send it with allowQualityErrors: true to store it as it is. Use the PNG URL for chat, email, and Slack, and the SVG URL for web pages.",
    inputSchema: chartInput,
    annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
  }, (args) => renderChart(args));
  server.registerTool("estimate_cost", {
    title: "Estimate cost",
    description: "Check what rendering this chart would cost, and whether the balance covers it, without rendering or spending anything. Takes the same arguments as render_chart. Call it before a large batch of renders.",
    inputSchema: chartInput,
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  }, (args) => estimateCost(args));
  server.registerTool("get_credit_balance", {
    title: "Get credit balance",
    description: "Credits remaining, the live credit grants and when they expire, and this key's monthly budget if it has one. Needs a key with the usage:read scope.",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  }, () => getCreditBalance());
  server.registerTool("get_usage", {
    title: "Get usage",
    description: "Renders over the last 30 days: the last week by day, plus spend by API key and by render format. Needs a key with the usage:read scope.",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  }, () => getUsage());
  server.registerTool("get_top_up_link", {
    title: "Get top-up link",
    description: "Returns a URL where the person you work for can add render credit. You cannot pay: give the link to them, and call get_credit_balance afterwards to confirm. Use it when render_chart or estimate_cost says the credit has run out.",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  }, () => getTopUpLink());
  return server;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("chartrelay-mcp")) {
  await createServer().connect(new StdioServerTransport());
}
