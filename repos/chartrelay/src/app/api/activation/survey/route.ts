/**
 * The one question the upgrade page asks.
 *
 * Optional, answered at most once per workspace, and deliberately free text: the point is to learn what
 * people think this is for while there are few enough of them to read every answer. A multiple choice
 * here would only return the options I already thought of, which is the opposite of the thing worth
 * knowing before launch.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentAccount } from "@/lib/auth/session";
import { hasEvent, recordActivation, SURVEY_MAX_LENGTH } from "@/lib/metrics/activation";
import { rejectAmbientCrossSite } from "@/lib/security/request";
import { clientIp, consumeRateLimit, HOUR } from "@/lib/security/rate-limit";

const schema = z.object({ answer: z.string().trim().min(1).max(SURVEY_MAX_LENGTH) });

export async function POST(request: Request) {
  const refused = rejectAmbientCrossSite(request);
  if (refused) return refused;
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  // A signed-in caller could still paste free text in a loop; the row is small but the answers are read
  // by a person, and a flooded list is an unreadable one.
  const limit = consumeRateLimit(`survey:${clientIp(request)}`, 20, HOUR);
  if (!limit.allowed) return NextResponse.json({ error: "Too many answers. Try again later." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a short answer." }, { status: 400 });
  // Answered once. A second answer would not be a correction, it would be a second data point from one
  // person weighted the same as everyone else's first.
  if (hasEvent(account.workspace.id, "survey_answer")) return NextResponse.json({ ok: true, already: true });
  recordActivation(account.workspace.id, "survey_answer", parsed.data.answer);
  return NextResponse.json({ ok: true });
}
