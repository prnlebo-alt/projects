import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPassword } from "@/lib/auth/account";
import { clientIp, consumeRateLimit, HOUR } from "@/lib/security/rate-limit";

const schema = z.object({ token: z.string().min(20).max(200), password: z.string().min(10).max(128) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a password of at least 10 characters." }, { status: 400 });
  const limit = consumeRateLimit(`reset-submit-ip:${clientIp(request)}`, 20, HOUR);
  if (!limit.allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const ok = await resetPassword(parsed.data.token, parsed.data.password);
  if (!ok) return NextResponse.json({ error: "This reset link is invalid or has expired. Request a new one." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
