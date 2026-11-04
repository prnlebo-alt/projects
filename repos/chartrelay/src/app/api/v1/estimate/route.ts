import { NextResponse } from "next/server";
import { chartRequestOptionsSchema, chartSpecSchema } from "@/lib/charts/schema";
import { validationDetails } from "@/lib/charts/validation";
import { guardV1, v1Error } from "@/lib/auth/v1-auth";
import { keyPolicy } from "@/lib/auth/api-keys";
import { ApiError, responseHeaders } from "@/lib/http/errors";
import { balanceOf } from "@/lib/ledger/ledger";
import { readJsonBody } from "@/lib/security/request";

/** What one render of this spec would cost, and whether the balance covers it. Renders nothing, spends nothing. */
export async function POST(request: Request) {
  const guarded = await guardV1(request, "render");
  if ("response" in guarded) return guarded.response;
  const { auth, requestId } = guarded;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const spec = chartSpecSchema.safeParse(body.value);
  if (!spec.success) return v1Error(new ApiError("invalid_chart_spec", "Invalid chart specification.", { details: { issues: validationDetails(spec.error) } }), requestId);
  const options = chartRequestOptionsSchema.safeParse(body.value);
  if (!options.success) return v1Error(new ApiError("invalid_chart_spec", "Invalid request options.", { details: { issues: validationDetails(options.error) } }), requestId);
  // A test key renders without spending, so its estimate is zero units whatever the balance is.
  const billable = auth.key ? keyPolicy(auth.key).billable : true;
  const units = billable ? 1 : 0;
  const balance = balanceOf(auth.workspace.id);
  return NextResponse.json({ units, billable, credits_remaining: balance, can_afford: balance >= units, request_id: requestId }, { headers: responseHeaders(requestId, { creditsRemaining: balance }) });
}
