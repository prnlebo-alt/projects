import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db";

// Always evaluated per request; never prerendered at build time (which would also open the database).
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

/** Liveness and readiness probe for the host's healthcheck. Reports only ok/error, never configuration details. */
export async function GET() {
  try {
    sqlite().prepare("select 1").get();
    return NextResponse.json({ status: "ok" }, { status: 200, headers: noStore });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503, headers: noStore });
  }
}
