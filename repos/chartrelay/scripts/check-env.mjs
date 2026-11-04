// Validates billing/runtime environment variables without printing secret values.
import fs from "node:fs";

// Usage: node scripts/check-env.mjs [env-file] [--production]
const args = process.argv.slice(2);
const production = args.includes("--production") || process.env.NODE_ENV === "production";
const file = args.find((arg) => !arg.startsWith("--")) ?? ".env.local";
const env = { ...process.env };
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && !(match[1] in process.env)) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const checks = [
  ["APP_URL", (v) => /^https?:\/\//.test(v), "must be an http(s) URL"],
  ["SESSION_SECRET", (v) => v.length >= 32, "must be at least 32 characters"],
  ["STRIPE_SECRET_KEY", (v) => /^(sk|rk)_test_/.test(v) || (/^(sk|rk)_live_/.test(v) && env.STRIPE_LIVE_MODE === "enabled"), "must start with sk_test_ or rk_test_ (live keys require STRIPE_LIVE_MODE=enabled)"],
  ["STRIPE_WEBHOOK_SECRET", (v) => v.startsWith("whsec_"), "must start with whsec_"],
  ["STRIPE_PRICE_DEVELOPER", (v) => v.startsWith("price_"), "must start with price_"],
  ["STRIPE_PRICE_PRO", (v) => v.startsWith("price_"), "must start with price_"],
  ["STRIPE_PRICE_BUSINESS", (v) => v.startsWith("price_"), "must start with price_"],
  // The render pack is required, not optional: a deployment that can sell subscriptions but not packs is
  // half-configured, and the half that is missing is the one a pay-as-you-go customer needs.
  ["STRIPE_PRICE_PACK", (v) => v.startsWith("price_"), "must start with price_ (the one-time $10 render pack)"],
  // Email is optional locally (emails print to the console) but required in production.
  ["EMAIL_PROVIDER", (v) => v === "resend", "must be \"resend\" in production, or verification and reset emails are never sent", { productionOnly: true }],
  ["RESEND_API_KEY", (v) => v.length > 0, "required when EMAIL_PROVIDER=resend", { productionOnly: true }],
  ["EMAIL_FROM", (v) => v.includes("@"), "must be a sender address such as ChartRelay <hello@example.com>", { productionOnly: true }],
  // Advisory: the app runs without these, but each one silently disables something a deployer expects to work.
  ["SUPPORT_EMAIL", (v) => /^[a-z0-9._+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(v) && v.length <= 254, "the published support address; /support and /privacy print no address and say the channel is being set up without it", { advisory: true }],
  ["SUPPORT_RESPONSE_HOURS", (v) => v.length <= 80, "reply-time shown on /support: bare hours (\"24\") or a phrase; defaults to \"2 business days\"", { advisory: true }],
  ["ADMIN_TOKEN", (v) => v.length >= 24, "at least 24 chars; enables /api/admin/backup, which `npm run backup` needs — until it is set that route answers 404 and there is no backup path", { advisory: true }],
  // Deliberately advisory rather than required. Until a virtual mailbox exists this must stay unset —
  // the owner runs this company from home, and a home address on a terms page is scraped and archived
  // within days. Unset is the safe state; it only blocks lifecycle email, never a receipt or a reset.
  ["BUSINESS_POSTAL_ADDRESS", (v) => v.trim().length >= 10, "the published business address; while unset, /terms and /privacy print no address line and every non-transactional email is refused and logged", { advisory: true }],
  ["LEGAL_GOVERNING_STATE", (v) => v.trim().length > 1, "the state whose law governs the terms; without it /terms omits the governing-law clause entirely rather than naming no state", { advisory: true }],
  ["LEGAL_EFFECTIVE_DATE", (v) => /^\d{4}-\d{2}-\d{2}$/.test(v.trim()), "YYYY-MM-DD; the date the published terms took effect, omitted rather than shown as a placeholder while unset", { advisory: true }],
  ["LEGAL_DBA", (v) => v.trim().length > 1, "the registered fictitious name, once Florida has one on file (§865.09). Until then the legal pages name the LLC alone, which is the honest default", { advisory: true }],
  ["TRUSTED_PROXY_HOPS", (v) => /^\d+$/.test(v.trim()), "how many proxies sit in front of this app; defaults to 1, which is correct behind Railway. Set it to 0 only when nothing proxies the app, or per-IP rate limits can be evaded by rotating X-Forwarded-For", { advisory: true }],
];

let failed = 0;
for (const [name, valid, rule, options = {}] of checks) {
  const value = env[name] ?? "";
  const secret = /SECRET|KEY|TOKEN/.test(name);
  // Only ever reveal a recognized, non-secret type prefix (e.g. "sk_test_"), never any part of the value itself.
  const knownPrefix = /^(sk_test_|rk_test_|sk_live_|rk_live_|whsec_)/.exec(value)?.[1];
  const shown = !value ? "missing" : secret ? `set (${knownPrefix ? `${knownPrefix}…, ` : ""}${value.length} chars)` : value;
  const ok = Boolean(value) && valid(value);
  const soft = options.advisory || (options.productionOnly && !production);
  if (!ok && !soft) failed++;
  const label = ok ? "ok  " : options.advisory ? "note" : soft ? "warn" : "FAIL";
  const suffix = options.productionOnly && !production ? " (required with --production)" : "";
  console.log(`${label} ${name}: ${shown}${ok ? "" : ` — ${rule}${suffix}`}`);
}
process.exit(failed ? 1 : 0);
