import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";
import { rejectCrossSite } from "@/lib/security/request";

export async function POST(request: Request) {
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;
  await clearSession();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
