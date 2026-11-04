import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminTokenConfigured, authorizeAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { clientIp, consumeRateLimit, MINUTE } from "@/lib/security/rate-limit";
import { readJsonBody } from "@/lib/security/request";
import { planLimits, UNVERIFIED_FREE_LIMIT } from "@/lib/usage/plans";

// Always evaluated per request; never prerendered at build time (which would also open the database).
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" } as const;

/**
 * Marking an account verified is a support action, not a bulk one: a handful per window is plenty, and
 * the same budget caps token guessing per client.
 */
const RATE_LIMIT = { attempts: 10, windowMs: 10 * MINUTE };
/** The body carries only an email address. */
const MAX_BODY_BYTES = 1024;

/** Identical body for "not configured" and "no such route", so the endpoint cannot be probed for existence. */
const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });

const bodySchema = z.object({ email: z.string().trim().min(1).max(320) });

/**
 * Marks one account's email verified, which raises a free workspace from UNVERIFIED_FREE_LIMIT to the
 * advertised free quota.
 *
 * Why this exists: the only other writer of `email_verified_at` is the confirmation link, and that link
 * can only reach a user by email. On a deployment with no email provider every free account is therefore
 * pinned at the lower limit for good, and /register's promise that "support can raise the limit by hand"
 * has nothing behind it. This is that hand.
 *
 * It is deliberately one account at a time and takes the address the operator already knows, so it reads
 * like a support action in the log rather than a migration.
 */
export async function POST(request: Request) {
  // Unset ADMIN_TOKEN means this install never opted into the admin surface: behave as if the route does
  // not exist, and return before touching the database at all.
  if (!adminTokenConfigured()) return notFound();

  // Rate limit before authorizing, so a wrong token cannot be retried quickly.
  const limit = consumeRateLimit(`admin-verify-email:${clientIp(request)}`, RATE_LIMIT.attempts, RATE_LIMIT.windowMs);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { ...noStore, "retry-after": String(limit.retryAfterSeconds) } });
  }

  // Constant body and headers regardless of how the token was wrong (absent, malformed, or incorrect).
  if (!authorizeAdmin(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: noStore });

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Send a JSON body of {\"email\": \"...\"}." }, { status: 400, headers: noStore });

  // Stored emails are lower-cased at sign-up; surrounding whitespace comes from copy-and-paste, not intent.
  const email = parsed.data.email.toLowerCase();
  const user = db.select({ id: users.id, verifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.email, email)).get();
  // The caller already holds the admin token, so there is no account to enumerate: saying plainly that
  // the address is unknown is what stops an operator from believing a typo worked.
  if (!user) return NextResponse.json({ error: "No account has that email address." }, { status: 404, headers: noStore });

  if (user.verifiedAt) {
    return NextResponse.json({ ok: true, alreadyVerified: true, verifiedAt: user.verifiedAt, limit: planLimits.free }, { headers: noStore });
  }

  const verifiedAt = new Date().toISOString();
  db.update(users).set({ emailVerifiedAt: verifiedAt }).where(eq(users.id, user.id)).run();
  // Identifiers only: the log never carries the email address that was sent in.
  console.info(`[admin-verify-email] user=${user.id} raised=${UNVERIFIED_FREE_LIMIT}->${planLimits.free}`);

  return NextResponse.json({ ok: true, alreadyVerified: false, verifiedAt, limit: planLimits.free }, { headers: noStore });
}
