import { test } from "node:test";
import assert from "node:assert/strict";

process.env.CHARTRELAY_API_KEY = "cr_live_test";
process.env.CHARTRELAY_API_URL = "https://api.test/";
const { renderChart, formatResult, chartInput } = await import("../index.js");

const ok = (body) => ({ ok: true, status: 201, json: async () => body });
const spec = { type: "bar", title: "Revenue", series: [{ name: "MRR", data: [{ label: "Aug", value: 1 }] }] };
const body = { id: "abc", altText: "Bar chart of MRR.", urls: { png: "https://api.test/api/v1/charts/abc?format=png", svg: "https://api.test/api/v1/charts/abc?format=svg" }, usage: { used: 3, limit: 100 }, warnings: [{ severity: "warning", code: "pie-too-many-slices", message: "Too many slices.", suggestion: "Group the rest as Other." }] };

test("posts the spec with the bearer key and returns text plus an inline PNG", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return url.includes("format=png") ? { ok: true, arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer } : ok(body);
  };
  const result = await renderChart(spec, fetchImpl);
  assert.equal(calls[0].url, "https://api.test/api/v1/charts");
  assert.equal(calls[0].init.headers.authorization, "Bearer cr_live_test");
  assert.deepEqual(JSON.parse(calls[0].init.body), spec);
  assert.match(result.content[0].text, /PNG: https:\/\/api\.test/);
  assert.match(result.content[0].text, /Group the rest as Other/);
  assert.equal(result.content[1].type, "image");
  assert.equal(result.content[1].mimeType, "image/png");
});

test("returns validation details so the model can fix its spec", async () => {
  // The API's real 400 shape: every issue with the full path to the bad field.
  const details = { issues: [{ path: "type", message: 'Invalid option: expected one of "bar"|"line"|"area"|"pie"|"scatter"' }, { path: "series.1.data.3.label", message: "Too small: expected string to have >=1 characters" }] };
  const result = await renderChart(spec, async () => ({ ok: false, status: 400, json: async () => ({ error: "Invalid chart specification.", details }) }));
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /Invalid option/);
  assert.match(result.content[0].text, /series\.1\.data\.3\.label/);
});

test("explains quota and auth failures", async () => {
  const quota = await renderChart(spec, async () => ({ ok: false, status: 429, json: async () => ({ error: "Monthly render limit reached (100)." }) }));
  assert.match(quota.content[0].text, /api\.test\/pricing/);
  const auth = await renderChart(spec, async () => ({ ok: false, status: 401, json: async () => ({}) }));
  assert.match(auth.content[0].text, /API key was rejected/);
});

test("hands back the whole 422 self-correction payload instead of a bare status", async () => {
  // The API's real 422 shape (src/app/api/v1/charts/route.ts): blocking findings, every finding, and the override.
  const rejection = {
    error: "The chart was not stored: QA review found 1 blocking problem. Nothing was saved and no render was counted.",
    code: "quality-rejected",
    blocking: [{ severity: "error", code: "pie-negative-value", message: "A pie chart cannot represent negative values.", suggestion: "Use a bar chart for signed values." }],
    warnings: [
      { severity: "error", code: "pie-negative-value", message: "A pie chart cannot represent negative values.", suggestion: "Use a bar chart for signed values." },
      { severity: "warning", code: "missing-title", message: "The chart lacks a meaningful title.", suggestion: "State the decision or metric the reader should understand." },
    ],
    override: { field: "allowQualityErrors", value: true, effect: "Resend the same request with this field set to store the chart despite these findings. It then counts as one render." },
  };
  const result = await renderChart(spec, async () => ({ ok: false, status: 422, json: async () => rejection }));
  assert.equal(result.isError, true);
  const body = result.content[0].text;
  assert.match(body, /Nothing was saved and no render was counted/);
  assert.match(body, /pie-negative-value/);
  assert.match(body, /cannot represent negative values/);
  assert.match(body, /Use a bar chart for signed values/);
  // The non-blocking finding is reported too, but never as a reason the chart was refused.
  assert.match(body, /Also reported, not blocking:[\s\S]*missing-title/);
  // The escape hatch has to be actionable in one turn: the field name, the value, and what it does.
  assert.match(body, /allowQualityErrors: true/);
  assert.match(body, /counts as one render/);
  assert.doesNotMatch(body, /HTTP 422/);
});

test("accepts allowQualityErrors so the override it advertises can actually be sent", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(init);
    return url.includes("format=png") ? { ok: false } : ok(body);
  };
  await renderChart({ ...spec, allowQualityErrors: true }, fetchImpl);
  assert.equal(JSON.parse(calls[0].body).allowQualityErrors, true);
  assert.equal(chartInput.allowQualityErrors.safeParse(true).success, true);
});

test("does not blame the quota for a server error", async () => {
  const result = await renderChart(spec, async () => ({ ok: false, status: 500, json: async () => ({ error: "The chart could not be rendered because of a server error. Please try again." }) }));
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /server error/);
  assert.doesNotMatch(result.content[0].text, /Upgrade/);
  assert.doesNotMatch(result.content[0].text, /pricing/);
});

test("reports a healthy chart without inventing issues", () => {
  assert.match(formatResult({ ...body, warnings: [{ code: "healthy" }] }), /no structural problems/);
});
