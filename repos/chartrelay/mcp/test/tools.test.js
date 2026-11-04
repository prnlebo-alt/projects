import { test } from "node:test";
import assert from "node:assert/strict";

process.env.CHARTRELAY_API_KEY = "cr_live_test";
process.env.CHARTRELAY_API_URL = "https://api.test/";
const { renderChart, estimateCost, getCreditBalance, getUsage, getTopUpLink, outOfCredit, createServer } = await import("../index.js");

const reply = (status, body) => async () => ({ ok: status < 400, status, json: async () => body });
const spec = { type: "bar", title: "Revenue", series: [{ name: "MRR", data: [{ label: "Aug", value: 1 }] }] };
const contract402 = { error: { type: "billing_error", code: "credits_exhausted", message: "No credit left.", top_up_url: "https://chartrelay.dev/dashboard/billing" }, request_id: "r1" };

test("a 402 tells the agent to stop, not retry, and hands over the top-up URL", async () => {
  const result = await renderChart(spec, reply(402, contract402));
  assert.equal(result.isError, true);
  const message = result.content[0].text;
  assert.match(message, /No credit left/);
  assert.match(message, /Do not retry/);
  assert.match(message, /https:\/\/chartrelay\.dev\/dashboard\/billing/);
  assert.doesNotMatch(message, /\[object Object\]/);
});

test("a key-budget 402 names the budget, not the account", () => {
  const message = outOfCredit({ error: { code: "key_budget_exhausted", message: "This key has spent its monthly budget." } });
  assert.match(message, /monthly budget/);
});

test("a 429 in the new error shape reads as text, not [object Object]", async () => {
  const result = await renderChart(spec, reply(429, { error: { code: "rate_limited", message: "Too many requests for this key." } }));
  assert.match(result.content[0].text, /Too many requests for this key/);
  assert.doesNotMatch(result.content[0].text, /\[object Object\]/);
});

test("render_chart returns the short /c/ URLs", async () => {
  const fetchImpl = async (url) => url.includes("/c/") ? { ok: false } : { ok: true, status: 201, json: async () => ({ id: "abc123", altText: "Alt.", urls: { png: "x", svg: "y" }, warnings: [], credits_remaining: 41 }) };
  const result = await renderChart(spec, fetchImpl);
  assert.match(result.content[0].text, /PNG: https:\/\/api\.test\/c\/abc123\.png/);
  assert.match(result.content[0].text, /SVG: https:\/\/api\.test\/c\/abc123\.svg/);
  assert.match(result.content[0].text, /Credits remaining: 41/);
});

test("estimate_cost posts the spec to /estimate with the key and says whether the balance covers it", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ units: 1, billable: true, credits_remaining: 0, can_afford: false }) }; };
  const result = await estimateCost(spec, fetchImpl);
  assert.equal(calls[0].url, "https://api.test/api/v1/estimate");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.authorization, "Bearer cr_live_test");
  assert.deepEqual(JSON.parse(calls[0].init.body), spec);
  assert.match(result.content[0].text, /does NOT cover it/);
  assert.match(result.content[0].text, /get_top_up_link/);
});

test("get_credit_balance lists live credit and any key budget", async () => {
  const result = await getCreditBalance(reply(200, { credits_remaining: 1990, credit: [{ source: "pack", renders: 2000, expires_at: "2027-10-09T00:00:00.000Z" }], key_budget: { monthly: 500, remaining: 120 } }));
  const message = result.content[0].text;
  assert.match(message, /Credits remaining: 1,990/);
  assert.match(message, /pack: 2,000 granted, expires 2027-10-09/);
  assert.match(message, /monthly budget: 500 \(remaining 120\)/);
});

test("get_usage summarises the week, keys and formats", async () => {
  const by_day = Array.from({ length: 30 }, (_, i) => ({ day: `2026-09-${String(i + 1).padStart(2, "0")}`, renders: i }));
  const result = await getUsage(reply(200, { period_days: 30, total: 435, credits_remaining: 10, by_day, by_key: [{ name: "Production", renders: 400 }], by_format: [{ format: "editorial", renders: 435 }] }));
  const message = result.content[0].text;
  assert.match(message, /last 30 days: 435/);
  assert.match(message, /2026-09-30: 29/);
  assert.doesNotMatch(message, /2026-09-01/);
  assert.match(message, /Production: 400/);
  assert.match(message, /editorial: 435/);
});

test("get_top_up_link hands the URL to the human and says the agent must not pay", async () => {
  const result = await getTopUpLink(reply(200, { url: "https://checkout.stripe.com/c/pay/cs_1", kind: "checkout" }));
  assert.match(result.content[0].text, /https:\/\/checkout\.stripe\.com\/c\/pay\/cs_1/);
  assert.match(result.content[0].text, /cannot pay/);
});

test("a key without the scope gets an actionable 403, not a crash", async () => {
  const result = await getUsage(reply(403, { error: { code: "scope_denied", message: "This key does not carry the usage:read scope." } }));
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /usage:read/);
});

test("a network failure is reported, not thrown", async () => {
  const result = await getTopUpLink(async () => { throw new Error("down"); });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /Could not reach ChartRelay/);
});

test("the server registers all five tools", () => {
  const names = Object.keys(createServer()._registeredTools ?? {}).sort();
  assert.deepEqual(names, ["estimate_cost", "get_credit_balance", "get_top_up_link", "get_usage", "render_chart"]);
});
