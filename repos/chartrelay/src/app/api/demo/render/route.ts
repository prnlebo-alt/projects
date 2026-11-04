import { NextResponse } from "next/server";
import { isBlocking } from "@/lib/charts/qa";
import { chartSpecSchema } from "@/lib/charts/schema";
import { renderChart } from "@/lib/charts/render";
import { validationDetails } from "@/lib/charts/validation";
import { readJsonBody } from "@/lib/security/request";
import { clientIp, consumeRateLimit, MINUTE } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  // Stored in SQLite with the other limits, so expired buckets are pruned instead of accumulating in memory.
  const limit = consumeRateLimit(`demo-ip:${clientIp(request)}`, 30, MINUTE);
  if (!limit.allowed) return NextResponse.json({ error: "Demo limit reached. Create a free account for API access." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = chartSpecSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Invalid chart specification.", details: validationDetails(parsed.error) }, { status: 400 });
  const result = renderChart(parsed.data);
  // The checker deliberately renders a chart the authenticated API would refuse — showing you what is wrong is
  // the whole point of the page — so it never enforces. It does say which findings would be refused there, so
  // nobody can read a 200 here as permission to publish.
  const blocking = result.warnings.filter(isBlocking);
  return NextResponse.json({
    ...result,
    warnings: result.warnings.map((issue) => ({ ...issue, blocksPublish: isBlocking(issue) })),
    enforcement: {
      enforced: false,
      wouldReject: blocking.length > 0,
      blocking: blocking.map((issue) => issue.code),
      note: blocking.length > 0
        ? "POST /api/v1/charts would refuse this chart with HTTP 422 and store nothing. Fix the findings marked blocksPublish, or resend there with \"allowQualityErrors\": true."
        : "POST /api/v1/charts would accept this chart. Remaining findings are advisory.",
    },
  });
}
