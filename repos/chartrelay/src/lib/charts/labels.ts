/**
 * Deciding which category labels a chart can actually show.
 *
 * The schema allows 100 points, and at 100 points both renderers drew all 100 labels at full size into
 * a solid grey smear across the foot of the figure — nothing legible, and the run spilled past the
 * right edge of the plot. A chart that admits it cannot label every point is more useful than one that
 * pretends it has, so labels are thinned to whatever the width allows and the rest are dropped.
 *
 * Thinning rather than rotating or shrinking on purpose. Rotated labels force a reader to tilt their
 * head, and a mail client showing a chart at half size will not render 6px type at all; a chart with
 * every fifth label is readable in both places, and the marks themselves still show all 100 points.
 */

/**
 * Approximate advance width, used to keep labels from colliding — never for layout precision.
 *
 * Monospace needs its own ratio: every glyph is ~0.6em, so measuring a monospace string with the
 * proportional ratio under-estimates it by a fifth and the text runs into whatever sits to its right.
 */
export const width = (text: string | number, size: number, weight = 400, mono = false): number => {
  const per = mono ? 0.605 : weight >= 600 ? 0.58 : 0.53;
  return String(text).length * size * per;
};

/** Clear space between two neighbouring labels before they read as one word. */
const MIN_GAP = 8;

/**
 * How many slots apart drawn labels have to be for the widest of them to fit.
 *
 * Driven by the widest label rather than the average, because one long category name in a row of short
 * ones is exactly the case that collides.
 */
export function labelStride(labels: string[], size: number, band: number, weight = 400): number {
  if (!labels.length || band <= 0) return 1;
  const widest = labels.reduce((most, label) => Math.max(most, width(label, size, weight)), 0);
  return Math.max(1, Math.ceil((widest + MIN_GAP) / band));
}

/**
 * Which label slots to draw, counting back from the last.
 *
 * Anchored to the end because the most recent point is the one a reader looks for first, and a chart
 * whose final column is unlabelled looks truncated. Slots in `always` are kept whatever the stride
 * says — the focus bar carries the chart's argument, so its label is not optional — and any neighbour
 * too close to one is dropped rather than left to collide with it.
 */
export function labelSlots(count: number, stride: number, always: number[] = []): Set<number> {
  const keep = new Set<number>();
  for (let slot = count - 1; slot >= 0; slot -= stride) keep.add(slot);
  for (const slot of always) {
    if (slot < 0 || slot >= count) continue;
    // Collected before deleting: mutating the set inside its own iteration is legal but silently skips
    // entries, which would leave a collision in place on some inputs and not others. The protected slot
    // needs no exemption from the sweep — it is re-added immediately after.
    const tooClose: number[] = [];
    for (const existing of keep) {
      if (Math.abs(existing - slot) < stride) tooClose.push(existing);
    }
    for (const existing of tooClose) keep.delete(existing);
    keep.add(slot);
  }
  return keep;
}
