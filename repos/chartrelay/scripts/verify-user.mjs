// Raises one account from the unverified free limit to the advertised free quota, by asking
// /api/admin/users/verify-email to mark its email confirmed. Support lever, not a migration.
//
// Usage: node scripts/verify-user.mjs <email> [https://target] — or set APP_URL.
// ADMIN_TOKEN must match the server. Both values may live in .env.local, which is read but never echoed.
import fs from "node:fs";

const ENV_FILE = ".env.local";

function fail(message) {
  console.error(`verify-user: ${message}`);
  process.exit(1);
}

/** Reads KEY=value pairs from .env.local. Values are never printed — not on success, not in an error. */
function readEnvFile(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

/** `a…y@example.com`: enough to confirm the operator typed the address they meant, without a full copy in the log. */
function mask(email) {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  return `${local.slice(0, 1)}…${local.slice(-1)}${email.slice(at)}`;
}

const fileEnv = readEnvFile(ENV_FILE);
const token = process.env.ADMIN_TOKEN ?? fileEnv.ADMIN_TOKEN;
const positional = process.argv.slice(2).filter((value) => !value.startsWith("-"));
const email = positional[0];
const appUrl = positional[1] ?? process.env.APP_URL ?? fileEnv.APP_URL;

if (!email || !email.includes("@")) fail("pass the account email as the first argument.");
if (!token) fail(`ADMIN_TOKEN is not set (checked the environment and ${ENV_FILE}).`);
if (!appUrl) fail("pass the target URL as the second argument, or set APP_URL.");

let origin;
try {
  origin = new URL(appUrl).origin;
} catch {
  fail("the target must be a full URL, e.g. https://chartrelay.dev");
}

const response = await fetch(`${origin}/api/admin/users/verify-email`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({ email }),
});

const body = await response.json().catch(() => ({}));

if (response.status === 404 && body.error === "Not found.") {
  fail(`${origin} has no admin surface — ADMIN_TOKEN is unset or too short on the server.`);
}
if (!response.ok) fail(`${origin} answered ${response.status}: ${body.error ?? "unknown error"}`);

console.log(
  body.alreadyVerified
    ? `${mask(email)} was already verified (${body.verifiedAt}); limit ${body.limit.toLocaleString("en-US")}/month.`
    : `${mask(email)} verified; limit raised to ${body.limit.toLocaleString("en-US")}/month.`,
);
