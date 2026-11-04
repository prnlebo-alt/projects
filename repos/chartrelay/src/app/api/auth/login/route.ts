import { NextResponse } from "next/server";
import { authenticate, loginSchema } from "@/lib/auth/credentials";
import { createSession } from "@/lib/auth/session";
import { rejectCrossSiteJson } from "@/lib/security/request";
import { serialize } from "@/lib/security/serialize";
import { clearRateLimit, clientIp, consumeRateLimit, MINUTE, peekRateLimit } from "@/lib/security/rate-limit";

const WINDOW = 15 * MINUTE;
const FAILURES_PER_ACCOUNT_AND_IP = 10;
/** After this many failures on one account from any IP, every attempt on it is slowed down instead of blocked. */
const ACCOUNT_BACKOFF_AFTER = 10;
const ACCOUNT_BACKOFF_STEP_MS = 250;
const ACCOUNT_BACKOFF_MAX_MS = 3_000;

const tooMany = (retryAfterSeconds: number) => NextResponse.json({ error: "Too many sign-in attempts. Try again in a few minutes." }, { status: 429, headers: { "retry-after": String(retryAfterSeconds) } });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  const rejected = rejectCrossSiteJson(request);
  if (rejected) return rejected;
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
  const ip = clientIp(request);
  // Per-IP limit slows credential stuffing across accounts.
  const ipLimit = consumeRateLimit(`login-ip:${ip}`, 30, WINDOW);
  if (!ipLimit.allowed) return tooMany(ipLimit.retryAfterSeconds);
  // Only failures count, and the hard block is per (account, IP): an attacker elsewhere cannot lock the real user out.
  const pairKey = `login-account-ip:${parsed.data.email}:${ip}`;
  const pairLimit = peekRateLimit(pairKey, FAILURES_PER_ACCOUNT_AND_IP, WINDOW);
  if (!pairLimit.allowed) return tooMany(pairLimit.retryAfterSeconds);
  // Guessing one password from many IPs is slowed by an account-wide backoff rather than a lockout.
  const accountKey = `login-account:${parsed.data.email}`;
  // Serialized per account: the backoff below is a per-request sleep, and a sleep that every request
  // performs at the same time is not a delay. Measured before this, thirty concurrent guesses completed
  // about nine times faster than ten sequential ones.
  const user = await serialize(accountKey, async () => {
    const accountFailures = peekRateLimit(accountKey, Number.MAX_SAFE_INTEGER, WINDOW).count;
    if (accountFailures >= ACCOUNT_BACKOFF_AFTER) await sleep(Math.min(ACCOUNT_BACKOFF_MAX_MS, (accountFailures - ACCOUNT_BACKOFF_AFTER + 1) * ACCOUNT_BACKOFF_STEP_MS));
    return authenticate(parsed.data);
  });
  if (!user) {
    consumeRateLimit(pairKey, Number.MAX_SAFE_INTEGER, WINDOW);
    consumeRateLimit(accountKey, Number.MAX_SAFE_INTEGER, WINDOW);
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  clearRateLimit(pairKey);
  clearRateLimit(accountKey);
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
