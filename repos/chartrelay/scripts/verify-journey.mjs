#!/usr/bin/env node
/**
 * The end-to-end billing journey, over real HTTP against a running server: sign up, get a key, hit 402, pay,
 * render, hit 402 again. `npm run verify:journey` with the server already started on BASE_URL and DATABASE_PATH
 * pointing at the same throwaway database it uses.
 *
 * Three steps cannot happen over HTTP in a test environment and are done directly, each marked below: confirming
 * the email (the link goes by email), setting a balance to a known number, and the payment itself, which is a
 * Stripe event signed with the same webhook secret the server holds. Everything else is the product's own API.
 * Never point this at production: it creates an account and writes to the database.
 */
import Database from "better-sqlite3";
import Stripe from "stripe";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const DB_PATH = process.env.DATABASE_PATH;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
if (!DB_PATH || !WEBHOOK_SECRET) throw new Error("Set DATABASE_PATH and STRIPE_WEBHOOK_SECRET to the server's own values.");
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error("Refusing to run against anything but a local server.");

const db = new Database(DB_PATH);
const spec = { type: "bar", title: "Signups doubled in a quarter", series: [{ name: "Signups", data: [{ label: "Q1", value: 10 }, { label: "Q2", value: 20 }] }] };
const email = `journey-${Date.now()}@example.com`;
const password = `Journey-${Math.random().toString(36).slice(2)}-pw`;
let passed = 0;
const step = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) { console.log("\nJourney failed."); process.exit(1); } passed += 1; };
const json = async (response) => response.json().catch(() => ({}));
const origin = { origin: BASE };

// 1. Sign up through the real endpoint.
const signup = await fetch(`${BASE}/api/auth/register`, { method: "POST", headers: { "content-type": "application/json", ...origin }, body: JSON.stringify({ name: "Journey Tester", email, password }) });
step("sign up", signup.status === 200 || signup.status === 201, `HTTP ${signup.status}`);
const cookie = (signup.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
step("signed in by the sign-up response", cookie.length > 0);

// 2. Mint a key through the real endpoint.
const made = await fetch(`${BASE}/api/keys`, { method: "POST", headers: { "content-type": "application/json", cookie, ...origin }, body: JSON.stringify({ name: "Journey", scopes: ["render", "usage:read"] }) });
const { key } = await json(made);
step("create an API key", made.ok && typeof key === "string", `HTTP ${made.status}`);
const auth = { authorization: `Bearer ${key}`, "content-type": "application/json" };
const render = () => fetch(`${BASE}/api/v1/charts`, { method: "POST", headers: auth, body: JSON.stringify(spec) });
const usage = async () => json(await fetch(`${BASE}/api/v1/usage`, { headers: auth }));

// 3. Unconfirmed email: the free tier is closed, and the refusal says where to go.
const refused = await render();
const refusedBody = await json(refused);
step("unconfirmed account is refused with 402", refused.status === 402 && refusedBody.error?.code === "credits_exhausted", `HTTP ${refused.status}`);
step("the 402 carries a top_up_url", /\/dashboard\/billing$/.test(refusedBody.error?.top_up_url ?? ""));

// 4. Confirm the email (direct: the link is delivered by email) and render the free allowance.
db.prepare("UPDATE users SET email_verified_at = ? WHERE email = ?").run(new Date().toISOString(), email.toLowerCase());
const first = await render();
const firstBody = await json(first);
step("confirmed account renders", first.status === 201, `HTTP ${first.status}`);
step("free-tier chart carries the mark", firstBody.svg?.includes("chartrelay.dev</text>"));
step("free allowance is 250, one spent", (await usage()).credits_remaining === 249);
const png = await fetch(`${BASE}/c/${firstBody.id}.png`);
step("short PNG URL serves the chart", png.status === 200 && png.headers.get("content-type") === "image/png");

// 5. Run the balance down to one render (direct), spend it, then hit the wall.
const workspaceId = db.prepare("SELECT w.id AS id FROM workspaces w JOIN users u ON u.id = w.owner_id WHERE u.email = ?").get(email.toLowerCase()).id;
db.prepare("UPDATE balances SET remaining = 1 WHERE workspace_id = ?").run(workspaceId);
step("last render succeeds", (await render()).status === 201);
const wall = await render();
step("next render is 402, nothing charged", wall.status === 402 && (await usage()).credits_remaining === 0, `HTTP ${wall.status}`);

// 6. Pay: a pack checkout completes. The event is signed with the server's own webhook secret.
const event = { id: `evt_journey_${Date.now()}`, object: "event", type: "checkout.session.completed", data: { object: { id: "cs_journey", object: "checkout.session", mode: "payment", payment_status: "paid", payment_intent: `pi_journey_${Date.now()}`, customer: "cus_journey", client_reference_id: workspaceId, metadata: { workspaceId, kind: "pack" } } } };
const deliver = () => {
  const payload = JSON.stringify(event);
  return fetch(`${BASE}/api/billing/webhook`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }) }, body: payload });
};
step("webhook accepted", (await deliver()).status === 200);
step("pack credit is on the account", (await usage()).credits_remaining === 2000);
step("same webhook delivered again grants nothing more", (await deliver()).status === 200 && (await usage()).credits_remaining === 2000);

// 7. Render with pack credit: works, and the mark is gone.
const paid = await render();
const paidBody = await json(paid);
step("renders again after paying", paid.status === 201);
step("pack credit removes the mark", !paidBody.svg?.includes("chartrelay.dev</text>"));
step("balance is 1,999 after one render", (await usage()).credits_remaining === 1999);

// 8. A refund of that payment takes the unspent credit back.
const refund = { id: `evt_refund_${Date.now()}`, object: "event", type: "charge.refunded", data: { object: { id: "ch_journey", object: "charge", refunded: true, payment_intent: event.data.object.payment_intent } } };
const refundPayload = JSON.stringify(refund);
const refunded = await fetch(`${BASE}/api/billing/webhook`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload: refundPayload, secret: WEBHOOK_SECRET }) }, body: refundPayload });
step("refund webhook accepted", refunded.status === 200);
step("unspent pack credit is taken back, to zero not below", (await usage()).credits_remaining === 0);
step("and the next render is 402 again", (await render()).status === 402);

console.log(`\nJourney complete: ${passed} checks passed.`);
