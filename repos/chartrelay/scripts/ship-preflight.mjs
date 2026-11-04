// Checks a live-mode Stripe configuration BEFORE the switch is made, against Stripe's own API.
//
// Usage: STRIPE_SECRET_KEY=sk_live_… STRIPE_PRICE_DEVELOPER=price_… STRIPE_PRICE_PRO=price_… STRIPE_PRICE_BUSINESS=price_… STRIPE_PRICE_PACK=price_… node scripts/ship-preflight.mjs
// Values may instead live in .env.local, which is read but never echoed. No secret is ever printed:
// only a recognised prefix and a length, the same rule check-env follows.
//
// The trap this exists for: price IDs are mode-specific. A live key with test-mode price IDs fails at
// the moment a real customer clicks Subscribe, with "No such price" — which is the worst possible time
// to find out, because it looks like the customer's fault and it happens in front of them.
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const ENV_FILE = ".env.local";

function readEnvFile(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

const describe = (value) => {
  const prefix = /^(sk_test_|rk_test_|sk_live_|rk_live_|whsec_|price_)/.exec(value)?.[1];
  return prefix ? `${prefix}… (${value.length} chars)` : `set (${value.length} chars)`;
};

async function stripe(key, path) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { authorization: `Bearer ${key}` } });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const fileEnv = readEnvFile(ENV_FILE);
  // The real environment always wins, so a stale file cannot silently redirect this at the wrong target.
  const value = (name) => (env[name] ?? fileEnv[name] ?? "").trim();

  const key = value("STRIPE_SECRET_KEY");
  const problems = [];
  const notes = [];

  if (!key) {
    console.error("STRIPE_SECRET_KEY is not set. Put the live key in the environment or .env.local and run this again.");
    return 1;
  }

  const live = key.startsWith("sk_live_") || key.startsWith("rk_live_");
  console.log(`Stripe pre-flight\n`);
  console.log(`  key:          ${describe(key)} — ${live ? "LIVE mode" : "TEST mode"}`);

  const balance = await stripe(key, "balance");
  if (!balance.ok) {
    console.log(`  authenticates: NO — ${balance.body?.error?.message ?? `HTTP ${balance.status}`}`);
    return 1;
  }
  console.log(`  authenticates: yes`);

  // Third element: whether the price must be recurring. The render pack is deliberately one-time, so a
  // recurring pack price is as much a misconfiguration as a one-off plan price.
  const prices = [
    ["STRIPE_PRICE_DEVELOPER", "Developer", true],
    ["STRIPE_PRICE_PRO", "Pro", true],
    ["STRIPE_PRICE_BUSINESS", "Business", true],
    ["STRIPE_PRICE_PACK", "render pack", false],
  ];
  for (const [name, plan, shouldRecur] of prices) {
    const priceId = value(name);
    if (!priceId) { problems.push(`${name} is not set.`); continue; }
    const price = await stripe(key, `prices/${priceId}`);
    if (!price.ok) {
      // This is the failure the whole script exists to catch, so it says what it means rather than
      // repeating Stripe's terse message.
      problems.push(`${name} (${priceId}) does not exist for this key. Price IDs are mode-specific: a test-mode price cannot be used with a live key. In the Stripe dashboard, switch to live mode and use "Copy to live mode" on the product, then set the new price ID.`);
      continue;
    }
    const { active, livemode, unit_amount: amount, currency, recurring } = price.body;
    console.log(`  ${name}: ${priceId} — ${(amount / 100).toFixed(2)} ${String(currency).toUpperCase()}/${recurring?.interval ?? "one-off"}, ${active ? "active" : "INACTIVE"}, ${livemode ? "live" : "test"} mode`);
    if (!active) problems.push(`${name} is archived in Stripe. An archived price cannot be sold.`);
    if (livemode !== live) problems.push(`${name} is a ${livemode ? "live" : "test"}-mode price but the key is ${live ? "live" : "test"} mode. They must match.`);
    if (shouldRecur && !recurring) problems.push(`${name} is a one-off price; ${plan} is a subscription.`);
    if (!shouldRecur && recurring) problems.push(`${name} is a recurring price; the ${plan} is a one-time purchase and must not renew.`);
  }

  const webhookSecret = value("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) problems.push("STRIPE_WEBHOOK_SECRET is not set. Without it the app cannot verify Stripe's callbacks and a paid subscription never reaches the database.");
  else console.log(`  webhook:      ${describe(webhookSecret)}`);

  // A live-mode webhook endpoint is a different object from the test-mode one and has its own secret.
  const endpoints = await stripe(key, "webhook_endpoints?limit=10");
  if (endpoints.ok) {
    const urls = (endpoints.body.data ?? []).map((e) => `${e.url} (${e.status})`);
    if (!urls.length) problems.push(`No webhook endpoint exists for this key. Create one in the Stripe dashboard in ${live ? "live" : "test"} mode pointing at https://chartrelay.dev/api/billing/webhook, and set its signing secret as STRIPE_WEBHOOK_SECRET.`);
    else { console.log(`  endpoints:`); for (const url of urls) console.log(`    - ${url}`); }
  } else {
    notes.push("Could not list webhook endpoints with this key — a restricted key may lack that permission. Check the endpoint by hand in the dashboard.");
  }

  if (!live) notes.push("This key is TEST mode. Nothing here is wrong, but this is not yet the live configuration — re-run with the live key before shipping.");

  console.log("");
  for (const note of notes) console.log(`  note: ${note}`);
  if (!problems.length) {
    console.log(live ? "  Ready: live key, live prices, webhook configured." : "  Test-mode configuration is consistent.");
    return 0;
  }
  console.log(`\n  ${problems.length} problem${problems.length === 1 ? "" : "s"} to fix before shipping:\n`);
  for (const problem of problems) console.log(`  - ${problem}\n`);
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().then((code) => process.exit(code));
}
