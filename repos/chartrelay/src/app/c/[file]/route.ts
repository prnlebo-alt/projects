import { NextResponse } from "next/server";
import { GET as serveChart } from "@/app/api/v1/charts/[id]/route";

/**
 * Short, shareable chart URLs: `/c/{id}.png` and `/c/{id}.svg`, the form the spec asks for. They serve exactly what
 * `/api/v1/charts/{id}?format=…` serves, through the same handler, so the two can never disagree about a chart.
 * An id with no extension is treated as SVG, matching the API's default.
 */
export async function GET(request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const match = /^([A-Za-z0-9_-]{1,64})(?:\.(png|svg))?$/.exec(file);
  if (!match) return NextResponse.json({ error: "Chart not found." }, { status: 404 });
  const [, id, extension] = match;
  const target = new URL(request.url);
  target.pathname = `/api/v1/charts/${id}`;
  target.search = `?format=${extension ?? "svg"}`;
  return serveChart(new Request(target, { headers: request.headers }), { params: Promise.resolve({ id }) });
}
