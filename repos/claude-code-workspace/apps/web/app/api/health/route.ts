import { getDb, schema } from "@mi/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    await db.select({ ok: sql<number>`1` }).from(schema.researchRuns).limit(1);
    return NextResponse.json({ status: "ok", database: "reachable" });
  } catch (error) {
    return NextResponse.json(
      { status: "error", database: "unreachable", error: String(error) },
      { status: 503 }
    );
  }
}
