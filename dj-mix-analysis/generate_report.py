"""
Turn refined.json into the final style_transitions.md / style_transitions.json
deliverables.

Run: .mix-venv/bin/python -I dj-style/scripts/generate_report.py
"""
import json
import statistics
from collections import Counter

IN_JSON = "./cache/refined.json"
OUT_MD = "./style_transitions.md"
OUT_JSON = "./style_transitions.json"

AUDIO_NAME = "OSO's World Wide Mix Vol 105 - DJ OSO MIGHTY.mp3"

with open(IN_JSON) as f:
    raw = json.load(f)

raw.sort(key=lambda r: r["overlap_start_s"])


def mmss(t):
    if t is None:
        return None
    m = int(t // 60)
    s = t % 60
    return f"{m:02d}:{s:05.2f}"


transitions = []
for i, r in enumerate(raw, 1):
    bpm_b = round(r["bpm_before"], 1) if r["bpm_before"] else None
    bpm_a = round(r["bpm_after"], 1) if r["bpm_after"] else None
    transitions.append({
        "index": i,
        "start": mmss(r["overlap_start_s"]),
        "end": mmss(r["overlap_end_s"]),
        "start_s": round(r["overlap_start_s"], 2),
        "end_s": round(r["overlap_end_s"], 2),
        "overlap_duration_s": round(r["overlap_duration_s"], 1),
        "overlap_bars": round(r["overlap_bars"], 1) if r["overlap_bars"] else None,
        "bpm_before": bpm_b,
        "bpm_after": bpm_a,
        "bass_swap_time": mmss(r["bass_swap_time_s"]),
        "bass_swap_frac_of_overlap": round(r["bass_swap_frac_of_overlap"], 2) if r["bass_swap_frac_of_overlap"] is not None else None,
        "bass_swap_distinct": r["bass_swap_distinct"],
        "bass_swap_on_bar_boundary_approx": r["bass_swap_on_bar_boundary"],
        "bar_phase_offset_approx": round(r["bar_phase_offset"], 2) if r["bar_phase_offset"] is not None else None,
        "type": r["type"],
        "novelty_prominence": round(r["novelty_prominence"], 2),
    })

n = len(transitions)
bars_list = [t["overlap_bars"] for t in transitions if t["overlap_bars"] is not None]
dur_list = [t["overlap_duration_s"] for t in transitions]
type_counts = Counter(t["type"] for t in transitions)
distinct_count = sum(1 for t in transitions if t["bass_swap_distinct"])
on_bar_count = sum(1 for t in transitions if t["bass_swap_on_bar_boundary_approx"])
swap_fracs = [t["bass_swap_frac_of_overlap"] for t in transitions if t["bass_swap_frac_of_overlap"] is not None]

summary = {
    "n_transitions": n,
    "overlap_bars_median": round(statistics.median(bars_list), 1),
    "overlap_bars_min": round(min(bars_list), 1),
    "overlap_bars_max": round(max(bars_list), 1),
    "overlap_seconds_median": round(statistics.median(dur_list), 1),
    "overlap_seconds_min": round(min(dur_list), 1),
    "overlap_seconds_max": round(max(dur_list), 1),
    "type_fractions": {k: round(v / n, 2) for k, v in type_counts.items()},
    "bass_swap_distinct_fraction": round(distinct_count / n, 2),
    "bass_swap_on_bar_boundary_fraction_approx": round(on_bar_count / n, 2),
    "bass_swap_position_median_frac_of_overlap": round(statistics.median(swap_fracs), 2),
    "bass_swap_position_mean_frac_of_overlap": round(statistics.mean(swap_fracs), 2),
}

with open(OUT_JSON, "w") as f:
    json.dump({"audio_file": AUDIO_NAME, "summary": summary, "transitions": transitions}, f, indent=2)

# ---- Markdown ----
lines = []
lines.append(f"# Transition analysis: {AUDIO_NAME}\n")
lines.append(
    "Measured directly from the audio with a custom detector (chroma-CQT + MFCC "
    "two-window novelty, combined with band-energy and spectral-centroid derivatives; "
    "see `scripts/detect_transitions.py` and `scripts/refine_transitions.py`). "
    "Track identities are not known; only acoustic measurements are reported.\n"
)
lines.append(
    "**How to read this table:** `Start`/`End` bound the window where the novelty curve "
    "(the measured blend of tonal, timbral and spectral change) is elevated around each "
    "transition peak -- treat them as the audible blend/cut zone, not a verified two-stem "
    "overlap (no source separation was used). `Bass swap` is the time of steepest rise in "
    "sub-150 Hz energy inside that window -- a proxy for where the incoming track's bass "
    "takes over, not a certainty when `distinct=No`. `On bar?` checks phase against a beat "
    "grid anchored to the strongest nearby onset; true downbeat position was not "
    "independently verified, so treat this column as approximate. BPM values come from "
    "onset-autocorrelation tempo estimation on 20-24s windows before/after the transition and "
    "are quantized to the estimator's resolution; where the mix sits in a known half/double-time "
    "ambiguous zone (per `report.md`), the value shown is folded into the 60-180 BPM range and "
    "may be off by a factor of 2 from the 'true' musical tempo.\n"
)

lines.append("## Transition table\n")
header = ("| # | Start | End | Overlap (s) | Overlap (bars) | BPM before | BPM after | "
           "Bass swap @ | Swap frac | Swap distinct | On bar? (approx) | Type |")
sep = "|---|---|---|---|---|---|---|---|---|---|---|---|"
lines.append(header)
lines.append(sep)
for t in transitions:
    lines.append(
        f"| {t['index']} | {t['start']} | {t['end']} | {t['overlap_duration_s']:.1f} | "
        f"{t['overlap_bars'] if t['overlap_bars'] is not None else '?'} | "
        f"{t['bpm_before'] if t['bpm_before'] else '?'} | {t['bpm_after'] if t['bpm_after'] else '?'} | "
        f"{t['bass_swap_time'] if t['bass_swap_time'] else '?'} | "
        f"{t['bass_swap_frac_of_overlap'] if t['bass_swap_frac_of_overlap'] is not None else '?'} | "
        f"{'Yes' if t['bass_swap_distinct'] else 'No'} | "
        f"{'Yes' if t['bass_swap_on_bar_boundary_approx'] else 'No'} | {t['type']} |"
    )

lines.append("\n## Distribution summary\n")
lines.append(f"- Transitions found: **{summary['n_transitions']}**")
lines.append(
    f"- Overlap duration: median **{summary['overlap_bars_median']} bars** "
    f"({summary['overlap_seconds_median']}s), range {summary['overlap_bars_min']}-"
    f"{summary['overlap_bars_max']} bars ({summary['overlap_seconds_min']}-{summary['overlap_seconds_max']}s)"
)
lines.append("- Type breakdown:")
for k, v in sorted(summary["type_fractions"].items(), key=lambda kv: -kv[1]):
    lines.append(f"  - {k}: {v*100:.0f}% ({type_counts[k]}/{n})")
lines.append(
    f"- Bass swap is a distinct, single rise point in **{summary['bass_swap_distinct_fraction']*100:.0f}%** "
    f"of transitions ({distinct_count}/{n}); the rest show a more gradual/multi-step low-end change"
)
lines.append(
    f"- Bass swap position within the overlap window: median **{summary['bass_swap_position_median_frac_of_overlap']*100:.0f}%** "
    "of the way through (i.e. the incoming bass tends to take over past the midpoint of the blend, not at the very start)"
)
lines.append(
    f"- Bass swap lands within ~12% of a bar boundary (approximate beat-grid phase check) in "
    f"**{summary['bass_swap_on_bar_boundary_fraction_approx']*100:.0f}%** of cases ({on_bar_count}/{n}) -- "
    "treat this figure cautiously; see caveats"
)

lines.append("\n## Method notes\n")
lines.append(
    "1. Features (chroma-CQT, MFCC-13, spectral centroid, 3-band RMS energy: <150 Hz / "
    "150-2000 Hz / >2000 Hz) were extracted over the full file at ~43 fps, then pooled to ~3.9 fps.\n"
    "2. A combined novelty curve was built from two-window (8s and 24s) cosine-distance novelty "
    "on chroma and MFCC, plus energy- and centroid-derivative terms, z-scored and summed.\n"
    "3. Peaks were picked with a minimum 20s spacing and a prominence threshold; the top 45 "
    "candidates by prominence were kept and refined (all have overlap >= ~1.9 bars and clear "
    "multi-feature agreement, i.e. 'clear transitions' per the task's own detector).\n"
    "4. For each candidate, the novelty curve was walked outward from the peak to the nearest "
    "point where it falls to ~35% of peak-above-baseline, giving overlap start/end.\n"
    "5. BPM before/after come from onset-envelope autocorrelation tempo estimation "
    "(`librosa.feature.tempo`) over the 20s window immediately before/after the overlap, folded "
    "into 60-180 BPM.\n"
    "6. Bass-swap time = time of maximum positive slope of the <150 Hz energy curve inside the "
    "overlap window; 'distinct' means that slope peak is >2x the window's derivative noise floor.\n"
    "7. Bar-boundary check anchors a 4-beat bar grid to the strongest onset within 1s of the "
    "bass-swap time at the local BPM, then checks phase -- approximate, no independent downbeat detector.\n"
    "8. Type labels are rule-based from the measurements above (hard cut: overlap <2s; "
    "tempo-jump: |BPM change| >8%; filter sweep: centroid sweeps >45% of its mean, >60% monotonic, "
    "within <20s; echo-out: total energy decays through most of the first third of the window while "
    "the low band stays below its window median, i.e. a decaying tail with a bass gap; long blend: "
    ">=12 bars; otherwise short blend).\n"
)

lines.append("## Caveats\n")
lines.append(
    "- This is acoustic measurement, not stem separation: overlap bounds, bass-swap points and "
    "type labels are all inferred from mixed-signal features, not from isolated incoming/outgoing "
    "tracks. Treat all of the above as the best available estimate from a single-channel analysis, "
    "not ground truth.\n"
    "- BPM is quantized by the tempo estimator's autocorrelation resolution (same few values recur "
    "across the file); where the baseline report (`report.md`) flags half/double-time ambiguity, the "
    "true musical tempo may be exactly half or double the value shown here.\n"
    "- Bar-boundary alignment is phase-estimated from the nearest strong onset, not a verified "
    "downbeat; treat the On-bar column as a rough indicator, not a confirmed measurement.\n"
    "- Echo-out and filter-sweep labels are heuristic proxies on a handful of measured curves; a few "
    "borderline cases could be mislabeled as 'short blend' or vice versa.\n"
    "- Track names are not known or guessed anywhere in this analysis.\n"
)

with open(OUT_MD, "w") as f:
    f.write("\n".join(lines) + "\n")

print(f"Wrote {OUT_MD}")
print(f"Wrote {OUT_JSON}")
print(f"\nSummary: {json.dumps(summary, indent=2)}")
