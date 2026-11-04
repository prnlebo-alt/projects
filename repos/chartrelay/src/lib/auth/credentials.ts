import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/lib/db";
import { recordActivation } from "@/lib/metrics/activation";
import { users, workspaces } from "@/lib/db/schema";
import { storeApiKey } from "./api-keys";

// A marketing channel slug (`?ref=launch-hn`), not a referrer URL: short, opaque, and never user-identifying.
const SOURCE_PATTERN = /^[a-z0-9_-]{1,40}$/;

/** Normalizes a `?ref=` value to a storable channel slug, or null when it is absent, oversized, or contains anything else. */
export function normalizeSource(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  return SOURCE_PATTERN.test(slug) ? slug : null;
}

export const registrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(128),
  // Attribution is best-effort: a junk value is dropped rather than failing an otherwise valid sign-up.
  source: z.unknown().optional().transform(normalizeSource),
});

export const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export class DuplicateEmailError extends Error {
  constructor() {
    super("An account already exists for that email.");
  }
}

export async function register(input: z.infer<typeof registrationSchema>) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (existing) throw new DuplicateEmailError();
  const now = new Date().toISOString();
  const userId = nanoid();
  const workspaceId = nanoid();
  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    db.transaction((tx) => {
      tx.insert(users).values({ id: userId, email: input.email, passwordHash, name: input.name, source: input.source ?? null, createdAt: now }).run();
      tx.insert(workspaces).values({ id: workspaceId, ownerId: userId, name: `${input.name}'s workspace`, createdAt: now }).run();
    });
  } catch (error) {
    // A concurrent sign-up for the same email loses the UNIQUE race.
    if ((error as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") throw new DuplicateEmailError();
    throw error;
  }
  // Outside the transaction: a funnel row is not worth failing a sign-up for, and recordActivation
  // swallows its own errors for the same reason.
  recordActivation(workspaceId, "signup");
  const key = storeApiKey(workspaceId);
  return { userId, workspaceId, apiKey: key.value };
}

// A real bcrypt hash (cost 12) of a random string, so unknown emails cost the same time as wrong passwords.
const DUMMY_HASH = "$2b$12$j3AACEgIH/blwBhs8ZTzaOtPaARdXbG.K5xn36OzxwVvt2t0t8mRy";

export async function authenticate(input: z.infer<typeof loginSchema>) {
  const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  const matches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  return user && matches ? user : null;
}

/** Removes a just-created account (workspace and keys cascade) when sign-up cannot be completed. */
export function deleteAccount(userId: string) {
  db.delete(users).where(eq(users.id, userId)).run();
}
