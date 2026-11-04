import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { storedPng } from "@/lib/charts/raster";
import { db } from "@/lib/db";
import { renders } from "@/lib/db/schema";

const IMMUTABLE = "public, max-age=31536000, immutable";
// SVGs are user-influenced documents; serve them inert even when opened directly (next.config.ts sets the same).
const SVG_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const params = new URL(request.url).searchParams;
  // Unknown parameters are refused so cache-busting query strings cannot force fresh work past a CDN.
  if ([...params.keys()].some((key) => key !== "format")) return NextResponse.json({ error: "Only the format parameter is supported." }, { status: 400 });
  const format = params.get("format") ?? "svg";
  if (format !== "svg" && format !== "png") return NextResponse.json({ error: "Format must be svg or png." }, { status: 400 });
  const render = db.select({ svg: renders.svg, ...(format === "png" ? { png: renders.png } : {}) }).from(renders).where(eq(renders.id, id)).get() as { svg: string; png?: Buffer | null } | undefined;
  if (!render) return NextResponse.json({ error: "Chart not found." }, { status: 404 });
  if (format === "png") {
    try {
      const png = await storedPng(id, render.svg, render.png ?? null);
      return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": IMMUTABLE } });
    } catch (error) {
      console.error(`PNG rasterization failed for render ${id}:`, error instanceof Error ? error.message : error);
      return NextResponse.json({ error: "This chart could not be converted to PNG. Use the SVG URL instead." }, { status: 500 });
    }
  }
  return new Response(render.svg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": IMMUTABLE, "content-security-policy": SVG_CSP, "x-content-type-options": "nosniff" } });
}
