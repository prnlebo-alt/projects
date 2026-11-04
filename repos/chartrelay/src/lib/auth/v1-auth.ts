import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { findApiKey, keyAllowsAddress, keyHasScope, type KeyScope } from "@/lib/auth/api-keys";
import { ApiError, errorBody, responseHeaders } from "@/lib/http/errors";
import { requestIdFrom } from "@/lib/http/request-id";
import { ensureAllowance } from "@/lib/ledger/allowance";
import { clientIp, consumeRateLimit, MINUTE } from "@/lib/security/rate-limit";
import { currentAccount } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

/**
 * Who is calling the v1 API: a Bearer key, or a signed-in person in the dashboard. Shared so every v1 route
 * resolves a caller the same way and none grows its own idea of what a valid key is.
 */
export async function authorize(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const key = await findApiKey(authorization.slice(7));
    if (!key) return null;
    const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.id, key.workspaceId) });
    return workspace ? { workspace, apiKeyId: key.id, key } : null;
  }
  const account = await currentAccount();
  // A signed-in human in the dashboard carries no key, so no key policy applies to them.
  return account ? { workspace: account.workspace, apiKeyId: null, key: null } : null;
}

type V1Auth = NonNullable<Awaited<ReturnType<typeof authorize>>>;

/** One error response for the read-only v1 routes, in the same shape and with the same headers as the render route. */
export function v1Error(error: ApiError, requestId: string) {
  return NextResponse.json(errorBody(error, requestId), { status: error.status, headers: responseHeaders(requestId, error.options) });
}

/**
 * The checks every read-only v1 route shares, in the order the render route applies them: who is calling, what
 * the key may do, where it may call from, how fast. None of them moves credit.
 */
export async function guardV1(request: Request, scope: KeyScope): Promise<{ auth: V1Auth; requestId: string } | { response: Response }> {
  const requestId = requestIdFrom(request);
  const auth = await authorize(request);
  if (!auth) return { response: v1Error(new ApiError("invalid_api_key", "Provide a valid Bearer API key."), requestId) };
  if (auth.key) {
    if (!keyHasScope(auth.key, scope)) return { response: v1Error(new ApiError("scope_denied", `This key does not carry the ${scope} scope.`), requestId) };
    if (!keyAllowsAddress(auth.key, clientIp(request))) return { response: v1Error(new ApiError("ip_not_allowed", "This key is restricted to other addresses."), requestId) };
  }
  const limit = consumeRateLimit(`v1-read:${auth.apiKeyId ?? auth.workspace.id}`, 60, MINUTE);
  if (!limit.allowed) return { response: v1Error(new ApiError("rate_limited", "Too many requests. Slow down and retry.", { retryAfterSeconds: limit.retryAfterSeconds }), requestId) };
  ensureAllowance(auth.workspace.id);
  return { auth, requestId };
}
