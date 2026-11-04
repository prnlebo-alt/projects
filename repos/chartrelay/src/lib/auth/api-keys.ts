import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { apiKeys, usageEvents } from "@/lib/db/schema";
import {
  apiKeyLast4, apiKeyShapeAcceptable, createApiKeyValue, hashApiKey, inspectApiKey,
  ipInAllowlist, KEY_PREFIX, type KeyMode,
} from "./key-utils";

export {
  apiKeyLast4, apiKeyMode, apiKeyShapeAcceptable, cidrContains, createApiKeyValue, hashApiKey,
  inspectApiKey, ipInAllowlist, isCidr, parseIp, type KeyMode,
} from "./key-utils";

export type ApiKeyRow = typeof apiKeys.$inferSelect;

/** The three things a key can be allowed to do (docs/BILLING_SPEC.md, "Keys and signed URLs"). */
export const KEY_SCOPES = ["render", "usage:read", "keys:admin"] as const;
export type KeyScope = (typeof KEY_SCOPES)[number];

/**
 * How long a rotated key keeps working.
 *
 * The grace exists because the alternative is that pressing "rotate" breaks production, so nobody
 * presses it, so keys live forever. It expires by itself rather than needing a second visit — a
 * rotation that depends on someone remembering to come back and finish is not a rotation.
 */
export const ROTATION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export function isKeyScope(value: string): value is KeyScope {
  return (KEY_SCOPES as readonly string[]).includes(value);
}

/**
 * The scopes a stored key actually has.
 *
 * No scope recorded means `render` and nothing else. That is the spec's default and also the safe
 * reading: a row written before scopes existed, or with the column blanked, must not be read as
 * "unrestricted" — the key that gets to mint other keys has to say so.
 */
export function parseScopes(raw: string | null | undefined): KeyScope[] {
  const listed = (raw ?? "").split(",").map((scope) => scope.trim()).filter(isKeyScope);
  const unique = [...new Set(listed)];
  return unique.length > 0 ? unique : ["render"];
}

export function keyScopes(key: Pick<ApiKeyRow, "scopes">): KeyScope[] {
  return parseScopes(key.scopes);
}

export function keyHasScope(key: Pick<ApiKeyRow, "scopes">, scope: KeyScope): boolean {
  return keyScopes(key).includes(scope);
}

/**
 * A key's mode, trusting whichever of the two records says "test".
 *
 * The column and the prefix should always agree, and `storeApiKey` is the only writer that can make
 * them agree. If they ever disagree — a hand-edited row, a half-finished migration — the answer is
 * `test`, because the cost of being wrong in that direction is an unbilled watermarked render, and in
 * the other direction it is charging a customer for a key we told them was free.
 */
export function effectiveKeyMode(key: Pick<ApiKeyRow, "mode" | "prefix">): KeyMode {
  return key.mode === "test" || key.prefix.startsWith(KEY_PREFIX.test) ? "test" : "live";
}

export type KeyInactiveReason = "revoked" | "expired" | "rotation_grace_ended";

/**
 * Why this key is no longer usable, or `null` if it is.
 *
 * An unparseable timestamp counts as expired. A date column that cannot be read is a database we do
 * not understand, and the only safe thing to do with a credential whose expiry is unreadable is to
 * stop honouring it.
 */
export function keyInactiveReason(
  key: Pick<ApiKeyRow, "revokedAt" | "expiresAt" | "rotatedAt">,
  now: Date = new Date(),
): KeyInactiveReason | null {
  if (key.revokedAt) return "revoked";
  if (key.expiresAt !== null && key.expiresAt !== undefined) {
    const expires = Date.parse(key.expiresAt);
    if (Number.isNaN(expires) || expires <= now.getTime()) return "expired";
  }
  if (key.rotatedAt !== null && key.rotatedAt !== undefined) {
    const rotated = Date.parse(key.rotatedAt);
    if (Number.isNaN(rotated) || rotated + ROTATION_GRACE_MS <= now.getTime()) return "rotation_grace_ended";
  }
  return null;
}

/** When a rotated key stops working, for the dashboard to show and the email to quote. */
export function rotationGraceEndsAt(key: Pick<ApiKeyRow, "rotatedAt">): string | null {
  if (!key.rotatedAt) return null;
  const rotated = Date.parse(key.rotatedAt);
  return Number.isNaN(rotated) ? null : new Date(rotated + ROTATION_GRACE_MS).toISOString();
}

/** What the render path needs to know about the key in front of it, with no further queries. */
export interface KeyPolicy {
  id: string;
  workspaceId: string;
  mode: KeyMode;
  /** A test key is never billed. */
  billable: boolean;
  /** A test key always renders watermarked output, whatever the workspace has paid for. */
  watermarked: boolean;
  scopes: KeyScope[];
  monthlyBudget: number | null;
  agentTag: string | null;
  expiresAt: string | null;
  graceEndsAt: string | null;
}

export function keyPolicy(key: ApiKeyRow): KeyPolicy {
  const mode = effectiveKeyMode(key);
  return {
    id: key.id,
    workspaceId: key.workspaceId,
    mode,
    billable: mode === "live",
    watermarked: mode === "test",
    scopes: keyScopes(key),
    monthlyBudget: key.monthlyBudget ?? null,
    agentTag: key.agentTag ?? null,
    expiresAt: key.expiresAt ?? null,
    graceEndsAt: rotationGraceEndsAt(key),
  };
}

/** Is this request's address allowed to use this key? */
export function keyAllowsAddress(key: Pick<ApiKeyRow, "ipAllowlist">, address: string | null | undefined): boolean {
  return ipInAllowlist(key.ipAllowlist, address);
}

/** How a key is named in a list: enough to identify it, not enough to use it. */
export function keyLabel(key: Pick<ApiKeyRow, "prefix" | "last4">): string {
  return key.last4 ? `${key.prefix}…${key.last4}` : `${key.prefix}••••`;
}

export interface NewKeyOptions {
  mode?: KeyMode;
  scopes?: KeyScope[];
  monthlyBudget?: number | null;
  ipAllowlist?: string[] | null;
  agentTag?: string | null;
  expiresAt?: string | null;
}

export function storeApiKey(workspaceId: string, name = "Default", options: NewKeyOptions = {}) {
  const mode = options.mode ?? "live";
  const value = createApiKeyValue(mode);
  const now = new Date().toISOString();
  const allowlist = (options.ipAllowlist ?? []).map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  const record = {
    id: nanoid(),
    workspaceId,
    name,
    keyHash: hashApiKey(value),
    prefix: value.slice(0, 12),
    last4: apiKeyLast4(value),
    // Written from the value that was just minted, never from the caller's wish, so the column and the
    // prefix cannot disagree about whether this is a test key.
    mode,
    scopes: parseScopes(options.scopes?.join(",")).join(","),
    monthlyBudget: options.monthlyBudget ?? null,
    ipAllowlist: allowlist.length > 0 ? allowlist.join(",") : null,
    agentTag: options.agentTag ?? null,
    expiresAt: options.expiresAt ?? null,
    // Spelled out rather than left to the column defaults so the returned object is the whole row, and
    // callers (and tests) can pass it straight to `keyPolicy` or `keyInactiveReason` without re-reading it.
    rotatedAt: null,
    supersededByKeyId: null,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: now,
  };
  db.insert(apiKeys).values(record).run();
  return { ...record, value };
}

/** The row that was just written, plus the plaintext that will never be available again. */
export type StoredKey = ApiKeyRow & { value: string };

/**
 * The authentication lookup.
 *
 * The shape check comes first and costs nothing, so a fabricated or mistyped key never reaches the
 * database: no SHA-256, no index probe, no row. Revoked, expired and past-grace keys are filtered
 * here rather than at each call site, because there are three call sites and there will be more.
 */
export async function findApiKey(value: string, now: Date = new Date()) {
  if (!apiKeyShapeAcceptable(value)) return undefined;
  const row = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.keyHash, hashApiKey(value)), isNull(apiKeys.revokedAt)),
  });
  if (!row) return undefined;
  return keyInactiveReason(row, now) ? undefined : row;
}

/** Revocation is instant and unconditional: there is no grace period on "this key has leaked". */
export async function revokeApiKey(keyId: string, workspaceId: string): Promise<boolean> {
  const key = await db.query.apiKeys.findFirst({ where: eq(apiKeys.id, keyId) });
  if (!key || key.workspaceId !== workspaceId) return false;
  db.update(apiKeys).set({ revokedAt: new Date().toISOString() }).where(eq(apiKeys.id, keyId)).run();
  return true;
}

export type RotationResult =
  | { ok: true; replacement: StoredKey; graceEndsAt: string }
  | { ok: false; reason: "not_found" | "revoked" | "already_rotated" };

/**
 * Issue a replacement and start the old key's seven-day countdown.
 *
 * The replacement inherits the original's mode, scopes, budget, allowlist, agent tag and expiry.
 * Rotation is supposed to change the secret and nothing else; a rotated key that quietly came back
 * with wider scopes would be a privilege escalation performed by the safety feature.
 */
export async function rotateApiKey(options: { keyId: string; workspaceId: string; name?: string }): Promise<RotationResult> {
  const { keyId, workspaceId } = options;
  const existing = await db.query.apiKeys.findFirst({ where: eq(apiKeys.id, keyId) });
  if (!existing || existing.workspaceId !== workspaceId) return { ok: false, reason: "not_found" };
  if (existing.revokedAt) return { ok: false, reason: "revoked" };
  // Rotating twice would silently extend the first grace period, leaving two live secrets for a key
  // the customer believes they have already replaced.
  if (existing.rotatedAt) return { ok: false, reason: "already_rotated" };
  const replacement = storeApiKey(existing.workspaceId, options.name ?? existing.name, {
    mode: effectiveKeyMode(existing),
    scopes: keyScopes(existing),
    monthlyBudget: existing.monthlyBudget ?? null,
    ipAllowlist: existing.ipAllowlist ? existing.ipAllowlist.split(",") : null,
    agentTag: existing.agentTag ?? null,
    expiresAt: existing.expiresAt ?? null,
  });
  const rotatedAt = new Date().toISOString();
  db.update(apiKeys).set({ rotatedAt, supersededByKeyId: replacement.id }).where(eq(apiKeys.id, keyId)).run();
  return { ok: true, replacement, graceEndsAt: new Date(Date.parse(rotatedAt) + ROTATION_GRACE_MS).toISOString() };
}

/** First instant of the calendar month in UTC. One timezone, so a budget cannot reset twice. */
export function monthStart(at: Date = new Date()): string {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1)).toISOString();
}

/**
 * Units this key has spent this calendar month.
 *
 * Counts `reserved` as well as `charged`: a reservation is credit already committed, and ignoring it
 * would let concurrent requests each see room under the budget and collectively blow through it.
 * Refunded rows are excluded, because a render that failed was never a spend.
 */
export function keySpendThisMonth(keyId: string, at: Date = new Date()): number {
  const row = db
    .select({ total: sql<number>`coalesce(sum(${usageEvents.units}), 0)` })
    .from(usageEvents)
    .where(and(
      eq(usageEvents.keyId, keyId),
      inArray(usageEvents.status, ["charged", "reserved"]),
      gte(usageEvents.createdAt, monthStart(at)),
    ))
    .get();
  return Number(row?.total ?? 0);
}

/** Renders left under this key's own cap, or `null` when it has no cap. */
export function keyBudgetRemaining(key: Pick<ApiKeyRow, "id" | "monthlyBudget">, at: Date = new Date()): number | null {
  if (key.monthlyBudget === null || key.monthlyBudget === undefined) return null;
  return Math.max(0, key.monthlyBudget - keySpendThisMonth(key.id, at));
}

/** Can this key afford `units` more renders this month? The render path answers 402 `key_budget_exhausted` if not. */
export function withinKeyBudget(key: Pick<ApiKeyRow, "id" | "monthlyBudget">, units = 1, at: Date = new Date()): boolean {
  const remaining = keyBudgetRemaining(key, at);
  return remaining === null || remaining >= units;
}

/** True for a key minted before the checksum and `last4` existed. Such keys still authenticate. */
export function isLegacyKeyValue(value: string): boolean {
  return inspectApiKey(value).format === "legacy";
}
