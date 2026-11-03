"""
Take top novelty candidates, refine each into a measured transition record:
overlap start/end, duration (s and bars), bass-swap point, bar-boundary check,
BPM before/after, and a type label.

Run: .mix-venv/bin/python -I dj-style/scripts/refine_transitions.py
"""
import numpy as np
import librosa
import json
import os

FEAT = "./cache/features.npz"
NOV = "./cache/novelty.npz"
OUT_JSON = "./cache/refined.json"

feat = np.load(FEAT)
nov = np.load(NOV)

sr = int(feat["sr"])
hop = int(feat["hop"])
frame_times = feat["frame_times"]
onset_env = feat["onset_env"]
duration = float(feat["duration"])

times_ds = nov["times_ds"]
fps_ds = float(nov["fps_ds"])
combined_smooth = nov["combined_smooth"]
low_ds = nov["low_ds"]
mid_ds = nov["mid_ds"]
high_ds = nov["high_ds"]
total_ds = nov["total_ds"]
centroid_ds = nov["centroid_ds"]
peaks = nov["peaks"]
proms = nov["proms"]

N_CANDIDATES = 45
order = np.argsort(-proms)
top_idx = order[:N_CANDIDATES]
cand_frames = peaks[top_idx]
cand_times = times_ds[cand_frames]
cand_proms = proms[top_idx]

# sort chronologically
chron = np.argsort(cand_times)
cand_times = cand_times[chron]
cand_frames = cand_frames[chron]
cand_proms = cand_proms[chron]


def fine_frame_idx(t):
    return int(round(t * sr / hop))


def local_tempo(t_center, span=24.0, side="full"):
    """Estimate BPM from onset envelope in a window around t_center.
    side='before' uses [t_center-span, t_center-2], 'after' uses [t_center+2, t_center+span]."""
    fps_fine = sr / hop
    if side == "before":
        t0, t1 = t_center - span, t_center - 2.0
    elif side == "after":
        t0, t1 = t_center + 2.0, t_center + span
    else:
        t0, t1 = t_center - span / 2, t_center + span / 2
    t0 = max(0.0, t0)
    t1 = min(duration, t1)
    if t1 - t0 < 4.0:
        return None
    i0 = fine_frame_idx(t0)
    i1 = fine_frame_idx(t1)
    sub_env = onset_env[i0:i1]
    if len(sub_env) < 10:
        return None
    try:
        tempo = librosa.feature.tempo(onset_envelope=sub_env, sr=sr, hop_length=hop,
                                       start_bpm=120.0, std_bpm=1.0, ac_size=8.0)[0]
    except Exception:
        return None
    return float(tempo)


def resolve_octave(bpm, lo=60, hi=180):
    """Fold bpm into a plausible DJ range by doubling/halving."""
    if bpm is None:
        return None
    b = bpm
    while b < lo:
        b *= 2
    while b > hi:
        b /= 2
    return b


def ds_idx(t):
    return int(np.clip(round(t * fps_ds), 0, len(times_ds) - 1))


def find_zone_bounds(peak_frame, max_half_width_s=40.0):
    """Walk outward from the peak in the smoothed novelty curve until it drops
    to a low baseline (local minimum / below half-prominence), bounded by max_half_width_s."""
    max_half_width = int(round(max_half_width_s * fps_ds))
    n = len(combined_smooth)
    peak_val = combined_smooth[peak_frame]
    # baseline = median of a wide window around the peak, excluding a core
    lo_ctx = max(0, peak_frame - max_half_width)
    hi_ctx = min(n, peak_frame + max_half_width)
    ctx = combined_smooth[lo_ctx:hi_ctx]
    baseline = np.median(ctx)
    thresh = baseline + 0.35 * (peak_val - baseline)

    left = peak_frame
    while left > lo_ctx and combined_smooth[left] > thresh:
        left -= 1
    right = peak_frame
    while right < hi_ctx - 1 and combined_smooth[right] > thresh:
        right += 1
    return left, right


def classify_bass_swap(left_f, right_f):
    """Within [left_f, right_f], find steepest rise in low-band energy and
    judge if it's a distinct single swap point vs. gradual/multi-step."""
    seg = low_ds[left_f:right_f + 1]
    if len(seg) < 3:
        return None, None, False
    deriv = np.gradient(seg)
    peak_local = int(np.argmax(deriv))
    peak_val = deriv[peak_local]
    noise = np.std(deriv) + 1e-9
    distinct = peak_val > 2.0 * noise and peak_val > 0
    frac = peak_local / max(1, (len(seg) - 1))
    abs_frame = left_f + peak_local
    return abs_frame, frac, bool(distinct)


def bar_alignment(swap_time, bpm_before, bpm_after, tol_frac=0.12):
    """Rough bar-boundary check: build a beat grid from onset peaks near swap_time
    using the local bpm, phase-anchored to the nearest strong onset peak before
    swap_time. This is an approximation (downbeat phase is not independently verified)."""
    bpm = bpm_before or bpm_after or 120.0
    beat_dur = 60.0 / bpm
    bar_dur = 4 * beat_dur
    fps_fine = sr / hop
    i_center = fine_frame_idx(swap_time)
    search_span = int(round(1.0 * fps_fine))
    lo = max(0, i_center - search_span)
    hi = min(len(onset_env), i_center + search_span)
    if hi <= lo:
        return None, None
    local = onset_env[lo:hi]
    anchor_rel = int(np.argmax(local))
    anchor_time = frame_times[lo + anchor_rel]
    delta = swap_time - anchor_time
    phase = (delta % bar_dur) / bar_dur
    phase = min(phase, 1 - phase)
    on_boundary = phase <= tol_frac
    return bool(on_boundary), float(phase)


def classify_type(overlap_s, bars, bpm_before, bpm_after, bass_distinct,
                   centroid_seg, total_seg, low_seg):
    tempo_ratio = None
    if bpm_before and bpm_after:
        tempo_ratio = abs(bpm_after - bpm_before) / bpm_before

    cent_range = centroid_seg.max() - centroid_seg.min() if len(centroid_seg) else 0
    cent_mean = centroid_seg.mean() if len(centroid_seg) else 1
    cent_sweep_ratio = cent_range / (cent_mean + 1e-9)
    if len(centroid_seg) > 3:
        diffs = np.diff(centroid_seg)
        mono_frac = max(np.mean(diffs > 0), np.mean(diffs < 0))
    else:
        mono_frac = 0

    # Echo-out heuristic: in the first third of the window, total energy decays
    # for most frames while the low band stays below the window median (new
    # track's bass hasn't entered yet) -- a decaying tail with a bass gap.
    echo_tail = False
    n = len(total_seg)
    if n >= 6:
        third = max(2, n // 3)
        head_total = total_seg[:third]
        head_low = low_seg[:third]
        decay_frac = np.mean(np.diff(head_total) < 0)
        low_med = np.median(low_seg) if len(low_seg) else 0
        bass_gap_frac = np.mean(head_low < low_med)
        echo_tail = decay_frac > 0.6 and bass_gap_frac > 0.6

    if overlap_s < 2.0:
        label = "hard cut"
    elif tempo_ratio is not None and tempo_ratio > 0.08:
        label = "tempo-jump"
    elif cent_sweep_ratio > 0.45 and mono_frac > 0.6 and overlap_s < 20:
        label = "filter sweep"
    elif echo_tail and overlap_s < 20:
        label = "echo-out"
    elif bars is not None and bars >= 12:
        label = "long blend"
    elif bars is not None and bars >= 2:
        label = "short blend"
    else:
        label = "hard cut"
    return label, tempo_ratio, cent_sweep_ratio, mono_frac, echo_tail


results = []
for t0, frame, prom in zip(cand_times, cand_frames, cand_proms):
    left_f, right_f = find_zone_bounds(frame)
    t_left = times_ds[left_f]
    t_right = times_ds[right_f]
    overlap_s = max(0.0, t_right - t_left)

    bpm_before = resolve_octave(local_tempo(t_left, side="before"))
    bpm_after = resolve_octave(local_tempo(t_right, side="after"))

    swap_abs_frame, swap_frac, distinct = classify_bass_swap(left_f, right_f)
    swap_time = times_ds[swap_abs_frame] if swap_abs_frame is not None else None

    on_boundary, phase = (None, None)
    if swap_time is not None:
        on_boundary, phase = bar_alignment(swap_time, bpm_before, bpm_after)

    avg_bpm = None
    if bpm_before and bpm_after:
        avg_bpm = (bpm_before + bpm_after) / 2
    elif bpm_before or bpm_after:
        avg_bpm = bpm_before or bpm_after
    bars = (overlap_s / (240.0 / avg_bpm)) if avg_bpm else None

    centroid_seg = centroid_ds[left_f:right_f + 1]
    total_seg = total_ds[left_f:right_f + 1]
    low_seg = low_ds[left_f:right_f + 1]

    label, tempo_ratio, cent_sweep_ratio, mono_frac, echo_tail = classify_type(
        overlap_s, bars, bpm_before, bpm_after, distinct,
        centroid_seg, total_seg, low_seg)

    results.append({
        "peak_time_s": float(t0),
        "overlap_start_s": float(t_left),
        "overlap_end_s": float(t_right),
        "overlap_duration_s": float(overlap_s),
        "overlap_bars": float(bars) if bars else None,
        "bpm_before": bpm_before,
        "bpm_after": bpm_after,
        "tempo_ratio": float(tempo_ratio) if tempo_ratio is not None else None,
        "bass_swap_time_s": float(swap_time) if swap_time is not None else None,
        "bass_swap_frac_of_overlap": float(swap_frac) if swap_frac is not None else None,
        "bass_swap_distinct": distinct,
        "bass_swap_on_bar_boundary": on_boundary,
        "bar_phase_offset": phase,
        "novelty_prominence": float(prom),
        "type": label,
        "centroid_sweep_ratio": float(cent_sweep_ratio),
        "centroid_monotonic_frac": float(mono_frac),
        "echo_tail_heuristic": bool(echo_tail),
    })

with open(OUT_JSON, "w") as f:
    json.dump(results, f, indent=2)

print(f"Refined {len(results)} candidates -> {OUT_JSON}\n")
for r in results:
    t = r["peak_time_s"]
    mm = int(t // 60)
    ss = t % 60
    bars_str = f"{r['overlap_bars']:.1f} bars" if r['overlap_bars'] else "? bars"
    print(f"{mm:02d}:{ss:05.2f}  overlap={r['overlap_duration_s']:.1f}s ({bars_str})"
          f"  bpm {r['bpm_before']}->{r['bpm_after']}  type={r['type']}  prom={r['novelty_prominence']:.2f}")
