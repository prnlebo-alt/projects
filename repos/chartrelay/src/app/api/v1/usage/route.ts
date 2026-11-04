import { NextResponse } from "next/server";
import { guardV1 } from "@/lib/auth/v1-auth";
import { keyBudgetRemaining } from "@/lib/auth/api-keys";
import { responseHeaders } from "@/lib/http/errors";
import { usageReport } from "@/lib/usage/report";

/** Balance and spend for the calling workspace. Needs the `usage:read` scope; moves no credit. */
export async function GET(request: Request) {
  const guarded = await guardV1(request, "usage:read");
  if ("response" in guarded) return guarded.response;
  const { auth, requestId } = guarded;
  const report = usageReport(auth.workspace.id);
  return NextResponse.json({
    credits_remaining: report.balance,
    period_days: report.byDay.length,
    total: report.total,
    by_day: report.byDay,
    // A key is told about itself, not about the workspace's other keys; a signed-in person sees them all.
    by_key: report.byKey.filter((row) => !auth.apiKeyId || row.keyId === auth.apiKeyId).map((row) => ({ key_id: row.keyId, name: row.name, renders: row.renders })),
    by_format: report.byFormat,
    credit: report.grants.map((grant) => ({ source: grant.source, renders: grant.renders, expires_at: grant.expiresAt })),
    // Only the calling key's own budget, never another key's: a key is told about itself.
    key_budget: auth.key ? { monthly: auth.key.monthlyBudget, remaining: keyBudgetRemaining(auth.key) } : null,
    request_id: requestId,
  }, { headers: responseHeaders(requestId, { creditsRemaining: report.balance }) });
}
