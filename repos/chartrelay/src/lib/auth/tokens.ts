import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { authTokens } from "@/lib/db/schema";

export type TokenPurpose = "verify-email" | "reset-password";

const LIFETIME_MS: Record<TokenPurpose, number> = { "verify-email": 48 * 3_600_000, "reset-password": 3_600_000 };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Issues a single-use token. Only its hash is stored; earlier unused tokens of the same purpose are revoked. */
export function issueToken(userId: string, purpose: TokenPurpose, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  db.transaction((tx) => {
    tx.update(authTokens).set({ usedAt: now.toISOString() }).where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt))).run();
    tx.insert(authTokens).values({ id: nanoid(), userId, purpose, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + LIFETIME_MS[purpose]).toISOString(), createdAt: now.toISOString() }).run();
  });
  return token;
}

/** Returns the token's owner if it is valid, without consuming it. */
export function peekToken(token: string, purpose: TokenPurpose, now = new Date()) {
  const row = db.select().from(authTokens).where(and(eq(authTokens.tokenHash, hashToken(token)), eq(authTokens.purpose, purpose))).get();
  if (!row || row.usedAt || new Date(row.expiresAt) <= now) return null;
  return row;
}

/** Atomically marks a valid token used and returns its user ID, or null if invalid, expired, or already used. */
export function consumeToken(token: string, purpose: TokenPurpose, now = new Date()) {
  return db.transaction((tx) => {
    const row = tx.select().from(authTokens).where(and(eq(authTokens.tokenHash, hashToken(token)), eq(authTokens.purpose, purpose))).get();
    if (!row || row.usedAt || new Date(row.expiresAt) <= now) return null;
    tx.update(authTokens).set({ usedAt: now.toISOString() }).where(eq(authTokens.id, row.id)).run();
    return row.userId;
  });
}
