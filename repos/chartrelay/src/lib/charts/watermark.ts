/**
 * The free tier's mark.
 *
 * This is how the category monetises: renders are unlimited and unmetered, and what a paid plan buys
 * is the removal of this mark. That is a better trade than a monthly render cap, which forces a buyer
 * to estimate their usage before they have used anything, and punishes the customers who succeed.
 *
 * The mark is deliberately quiet — muted, small, top-right, outside the plot — because a watermark
 * that ruins the chart does not sell the upgrade, it sends the reader to a competitor. It must still
 * be legible after the SVG is rasterised and scaled down in an email client, hence 11px rather than
 * smaller, and a real opacity rather than a near-surface colour that JPEG-style resampling would eat.
 */
import { MONO } from "./fonts";

/** Reads the drawing's own coordinate space, which is what the mark must be positioned in. */
function viewBoxSize(svg: string): { width: number; height: number } | null {
  const match = /viewBox="0 0 ([0-9.]+) ([0-9.]+)"/.exec(svg);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? { width, height } : null;
}

export const WATERMARK_TEXT = "chartrelay.dev";

/**
 * Stamps the free-tier mark onto a rendered SVG.
 *
 * Appends rather than rewrites: the mark goes last so it paints above the chart, and nothing already
 * drawn is touched. An SVG whose size cannot be read is returned unchanged — a chart with no mark is a
 * smaller problem than a chart with a mark sitting at NaN, which most renderers drop on the floor
 * along with everything after it.
 */
export function watermark(svg: string, text = WATERMARK_TEXT): string {
  const size = viewBoxSize(svg);
  const close = svg.lastIndexOf("</svg>");
  if (size === null || close === -1) return svg;

  const x = (size.width - 14).toFixed(1);
  const y = (18).toFixed(1);
  const mark = `<text x="${x}" y="${y}" font-family="${MONO}" font-size="11" fill="#898781" text-anchor="end" opacity="0.75">${text}</text>`;
  return `${svg.slice(0, close)}  ${mark}\n${svg.slice(close)}`;
}
