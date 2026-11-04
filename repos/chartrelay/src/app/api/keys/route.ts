import { NextResponse } from "next/server";
import { rejectAmbientCrossSite } from "@/lib/security/request";
import { currentAccount } from "@/lib/auth/session";
import {
  isCidr, isKeyScope, type KeyMode, type KeyScope, keyLabel, revokeApiKey, rotateApiKey, storeApiKey,
} from "@/lib/auth/api-keys";

/** A rejected field, named, because "Bad request" is unactionable for the script that sent it. */
function invalid(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

interface KeyRequestBody {
  name?: unknown;
  mode?: unknown;
  scopes?: unknown;
  monthlyBudget?: unknown;
  ipAllowlist?: unknown;
  agentTag?: unknown;
  expiresAt?: unknown;
}

type ParsedOptions = {
  mode: KeyMode;
  scopes: KeyScope[];
  monthlyBudget: number | null;
  ipAllowlist: string[] | null;
  agentTag: string | null;
  expiresAt: string | null;
};

/**
 * Every per-key control, validated here rather than coerced.
 *
 * A budget that silently became `null`, or an allowlist entry that silently stopped matching because
 * it was not a CIDR, is a control the customer believes is on and is not. So a malformed value is a
 * 400 that names the field, never a default.
 */
function parseOptions(body: KeyRequestBody, now: Date): ParsedOptions | NextResponse {
  const mode = body.mode === undefined ? "live" : body.mode;
  if (mode !== "live" && mode !== "test") return invalid("mode must be \"live\" or \"test\".");

  let scopes: KeyScope[] = ["render"];
  if (body.scopes !== undefined) {
    if (!Array.isArray(body.scopes) || body.scopes.some((scope) => typeof scope !== "string")) return invalid("scopes must be an array of strings.");
    const requested = (body.scopes as string[]).map((scope) => scope.trim()).filter((scope) => scope.length > 0);
    const unknown = requested.filter((scope) => !isKeyScope(scope));
    if (unknown.length > 0) return invalid(`Unknown scope(s): ${unknown.join(", ")}.`);
    scopes = requested.length > 0 ? (requested as KeyScope[]) : ["render"];
  }

  let monthlyBudget: number | null = null;
  if (body.monthlyBudget !== undefined && body.monthlyBudget !== null) {
    if (typeof body.monthlyBudget !== "number" || !Number.isInteger(body.monthlyBudget) || body.monthlyBudget < 1) {
      return invalid("monthlyBudget must be a positive whole number of renders, or null.");
    }
    monthlyBudget = body.monthlyBudget;
  }

  let ipAllowlist: string[] | null = null;
  if (body.ipAllowlist !== undefined && body.ipAllowlist !== null) {
    if (!Array.isArray(body.ipAllowlist) || body.ipAllowlist.some((entry) => typeof entry !== "string")) return invalid("ipAllowlist must be an array of CIDRs.");
    const entries = (body.ipAllowlist as string[]).map((entry) => entry.trim()).filter((entry) => entry.length > 0);
    const broken = entries.filter((entry) => !isCidr(entry));
    if (broken.length > 0) return invalid(`Not a valid address or CIDR: ${broken.join(", ")}.`);
    ipAllowlist = entries.length > 0 ? entries : null;
  }

  let expiresAt: string | null = null;
  if (body.expiresAt !== undefined && body.expiresAt !== null) {
    if (typeof body.expiresAt !== "string") return invalid("expiresAt must be an ISO 8601 timestamp.");
    const parsed = Date.parse(body.expiresAt);
    if (Number.isNaN(parsed)) return invalid("expiresAt must be an ISO 8601 timestamp.");
    // An expiry already in the past would mint a key that is dead on arrival — almost certainly a
    // units mistake (seconds for milliseconds) rather than an intention.
    if (parsed <= now.getTime()) return invalid("expiresAt must be in the future.");
    expiresAt = new Date(parsed).toISOString();
  }

  const agentTag = typeof body.agentTag === "string" && body.agentTag.trim().length > 0 ? body.agentTag.trim().slice(0, 60) : null;
  return { mode, scopes, monthlyBudget, ipAllowlist, agentTag, expiresAt };
}

export async function POST(request: Request) {
  // A session cookie alone reaches this route and it returns a live plaintext key. SameSite=Lax is the
  // only other layer, and SameSite is site-scoped, so any subdomain XSS is same-site and gets here.
  const refused = rejectAmbientCrossSite(request);
  if (refused) return refused;
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body: KeyRequestBody = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "New key";
  const options = parseOptions(body, new Date());
  if (options instanceof NextResponse) return options;
  const key = storeApiKey(account.workspace.id, name || "New key", options);
  // `key` is the only time the plaintext exists outside the customer's clipboard; `last4` is what the
  // dashboard shows afterwards, so the response carries both and the client never has to keep the secret.
  return NextResponse.json({
    id: key.id,
    key: key.value,
    prefix: key.prefix,
    last4: key.last4,
    label: keyLabel(key),
    mode: key.mode,
    scopes: key.scopes.split(","),
    monthlyBudget: key.monthlyBudget,
    ipAllowlist: key.ipAllowlist ? key.ipAllowlist.split(",") : null,
    agentTag: key.agentTag,
    expiresAt: key.expiresAt,
  }, { status: 201 });
}

/**
 * Rotate: issue a replacement and leave the old key working for seven days.
 *
 * Same cross-site guard as minting. A forged rotation is both a key disclosure and, seven days later,
 * an outage.
 */
export async function PATCH(request: Request) {
  const refused = rejectAmbientCrossSite(request);
  if (refused) return refused;
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing key id." }, { status: 400 });
  const result = await rotateApiKey({ keyId: id, workspaceId: account.workspace.id });
  if (!result.ok) {
    if (result.reason === "not_found") return NextResponse.json({ error: "Key not found." }, { status: 404 });
    if (result.reason === "revoked") return NextResponse.json({ error: "That key is revoked. Create a new one instead." }, { status: 409 });
    return NextResponse.json({ error: "That key has already been rotated." }, { status: 409 });
  }
  return NextResponse.json({
    id: result.replacement.id,
    key: result.replacement.value,
    prefix: result.replacement.prefix,
    last4: result.replacement.last4,
    label: keyLabel(result.replacement),
    replaces: id,
    // The old key keeps working until here, then stops on its own.
    previousKeyValidUntil: result.graceEndsAt,
  }, { status: 201 });
}

export async function DELETE(request: Request) {
  // Revocation is as worth forging as minting: a forged revoke is a denial of service on a live integration.
  const refused = rejectAmbientCrossSite(request);
  if (refused) return refused;
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing key id." }, { status: 400 });
  const revoked = await revokeApiKey(id, account.workspace.id);
  if (!revoked) return NextResponse.json({ error: "Key not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
