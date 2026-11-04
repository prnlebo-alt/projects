import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, workspaces } from "@/lib/db/schema";
import { MIN_SESSION_SECRET_LENGTH } from "@/lib/config/startup";

const COOKIE_NAME = "chartrelay_session";

/** HS256 signing key. Production refuses a missing or short secret, which could be brute-forced from one cookie. */
export function secret(env: Record<string, string | undefined> = process.env) {
  const configured = env.SESSION_SECRET;
  if (env.NODE_ENV === "production") {
    if (!configured) throw new Error("SESSION_SECRET is required in production");
    if (configured.length < MIN_SESSION_SECRET_LENGTH) throw new Error(`SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters in production`);
  }
  if (configured) return new TextEncoder().encode(configured);
  return new TextEncoder().encode("chartrelay-local-development-secret-only");
}

export async function createSession(userId: string) {
  const epoch = db.select({ sessionEpoch: users.sessionEpoch }).from(users).where(eq(users.id, userId)).get()?.sessionEpoch ?? 0;
  const token = await new SignJWT({ userId, epoch })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Signs out: bumps the user's session epoch so every copy of their session token stops working, then drops the cookie. */
export async function clearSession() {
  const session = await verifiedSession();
  if (session) db.update(users).set({ sessionEpoch: sql`${users.sessionEpoch} + 1` }).where(eq(users.id, session.userId)).run();
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

async function verifiedSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.userId === "string" ? { userId: payload.userId, issuedAt: payload.iat ?? 0, epoch: typeof payload.epoch === "number" ? payload.epoch : 0 } : null;
  } catch {
    return null;
  }
}

/** True when the session predates the user's last password change (JWT iat has one-second resolution). */
export function sessionRevoked(issuedAtSeconds: number, passwordChangedAt: string | null) {
  return Boolean(passwordChangedAt && issuedAtSeconds < Math.floor(new Date(passwordChangedAt).getTime() / 1000));
}

export async function currentAccount() {
  const session = await verifiedSession();
  if (!session) return null;
  const userId = session.userId;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user || sessionRevoked(session.issuedAt, user.passwordChangedAt) || session.epoch !== user.sessionEpoch) return null;
  const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.ownerId, userId) });
  return workspace ? { user, workspace } : null;
}

export async function requireAccount() {
  const account = await currentAccount();
  if (!account) redirect("/login");
  return account;
}
