import { NextResponse } from "next/server";
import { sendVerificationEmail } from "@/lib/auth/account";
import { deleteAccount, DuplicateEmailError, registrationSchema, register } from "@/lib/auth/credentials";
import { createSession } from "@/lib/auth/session";
import { rejectCrossSiteJson } from "@/lib/security/request";
import { checkRequestRegion, REGION_BLOCKED_MESSAGE } from "@/lib/compliance/regions";
import { clientIp, consumeRateLimit, HOUR } from "@/lib/security/rate-limit";

/** The fields registrationSchema requires, in the order a developer reads them. */
const REQUIRED_FIELDS = ["name", "email", "password"] as const;
type RequiredField = (typeof REQUIRED_FIELDS)[number];

const RULES = "Send name (2–80 characters), email (a valid address) and password (at least 10 characters).";

/**
 * Names the fields that were wrong, instead of restating the whole payload.
 *
 * A review of the live product sent {email, password}, got back "Enter a valid name, email, and
 * password of at least 10 characters." and had to guess that `name` was the mandatory field it had
 * left out. A caller — often an agent repairing its own request — can only act on the difference
 * between "you omitted name" and "your password is too short", so say which it is.
 *
 * The raw body decides missing versus invalid rather than the issue code: a field that is absent, null
 * or empty reads as missing to whoever sent it, whatever Zod calls it internally.
 */
function registrationProblem(body: unknown, issues: readonly { path: PropertyKey[] }[]): string {
  const record = body !== null && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!record) return `The request body must be a JSON object. ${RULES}`;
  const flagged = new Set(issues.map((issue) => String(issue.path[0] ?? "")));
  const named = REQUIRED_FIELDS.filter((field) => flagged.has(field));
  const isBlank = (field: RequiredField) => record[field] === undefined || record[field] === null || record[field] === "";
  const missing = named.filter(isBlank);
  const invalid = named.filter((field) => !isBlank(field));
  const parts: string[] = [];
  if (missing.length) parts.push(`Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`);
  if (invalid.length) parts.push(`Invalid field${invalid.length > 1 ? "s" : ""}: ${invalid.join(", ")}.`);
  // Only reachable if every issue sits on a field outside REQUIRED_FIELDS, which the schema cannot
  // currently produce; a generic sentence is still better than an empty one.
  if (!parts.length) parts.push("The registration body was rejected.");
  return `${parts.join(" ")} ${RULES}`;
}

/**
 * Repeated verbatim as API_KEY_ONE_TIME_NOTICE in src/components/quickstart-card.tsx, which is where
 * /docs and the dashboard read it from. A route handler should not import a module that reaches client
 * components, so the string is duplicated here and tests/docs-consistency.test.ts fails if they drift.
 */
const API_KEY_ONE_TIME_NOTICE =
  "This is the only time this API key is shown. ChartRelay stores only a hash of it. If you lose it, create another key from your dashboard — your existing keys keep working until you revoke them.";

export async function POST(request: Request) {
  const rejected = rejectCrossSiteJson(request);
  if (rejected) return rejected;
  // Checked at sign-up, which is the first moment there is anything to refuse. The card's country is
  // checked again at payment: this one is trivially evaded with a VPN, that one is not, and neither
  // is relied on alone. An unknown country is allowed through here by design — see regions.ts.
  const region = checkRequestRegion(request);
  if (region.blocked) {
    console.warn(`[regions] sign-up refused from ${region.subdivision ?? region.country}`);
    return NextResponse.json({ error: REGION_BLOCKED_MESSAGE }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: registrationProblem(body, parsed.error.issues) }, { status: 400 });
  const limit = consumeRateLimit(`register-ip:${clientIp(request)}`, 10, HOUR);
  if (!limit.allowed) return NextResponse.json({ error: "Too many accounts created from this network. Try again later." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
  let account: Awaited<ReturnType<typeof register>>;
  try {
    account = await register(parsed.data);
  } catch (error) {
    if (error instanceof DuplicateEmailError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Registration failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not create the account. Please try again." }, { status: 500 });
  }
  try {
    await createSession(account.userId);
  } catch (error) {
    // Roll the account back so the email is not burned by a sign-up the user never completed.
    deleteAccount(account.userId);
    console.error("Registration failed while creating the session:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not create the account. Please try again." }, { status: 500 });
  }
  // A failed email must not block sign-up; the dashboard offers a resend.
  await sendVerificationEmail({ id: account.userId, email: parsed.data.email, name: parsed.data.name }).catch((error) => console.error("Verification email failed:", error instanceof Error ? error.message : error));
  // The key travels in this response and nowhere else: only its hash is stored, and the dashboard can
  // show no more than the prefix. A review of the live product missed that and would have had to
  // replace the key, so the response says so in words rather than leaving it to the docs.
  return NextResponse.json({ ok: true, apiKey: account.apiKey, apiKeyNotice: API_KEY_ONE_TIME_NOTICE });
}
