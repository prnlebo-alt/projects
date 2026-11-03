#!/usr/bin/env python
"""
Task C: detect and timestamp DJ performance techniques in a mixed audio file.

Techniques covered:
  - filter_sweeps   : sustained monotonic spectral-centroid slides (hi/lo-pass sweeps)
  - echo_outs       : decaying, evenly-spaced onset trains after a sound is cut (delay tail)
  - loops           : contiguous repeats of a short audio segment at a fixed lag
  - loop_rolls      : loops with very short lag (<0.5s), i.e. stutter/roll effects
  - brakes_spinbacks: rapid downward pitch/centroid slides over 1-4s (brake/spinback candidates)
  - scratches       : short bursts of erratic zero-crossing-rate / spectral-flux activity
  - acapella        : sustained vocal-dominant, bass-light, percussion-light segments
  - drops           : sharp RMS/broadband-energy rise immediately following a quiet breakdown
  - tempo_ramps      : gradual, monotonic local-tempo drift sustained over >=8s

All detectors are heuristic signal-processing proxies, not ground truth. Every
detection carries a confidence label (high/medium/low) and the written report
states what each detector can and cannot distinguish reliably.

Output: dj-style/style_techniques.json (machine-readable) and
        dj-style/style_techniques.md (human-readable).
"""
import json
import sys
import time
from pathlib import Path

import numpy as np
import librosa
import scipy.signal as sig

AUDIO_PATH = "./input/OSO's World Wide Mix Vol 105 - DJ OSO MIGHTY.mp3"
OUT_DIR = Path(".")
SR = 22050
HOP = 512


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", file=sys.stderr)


def fmt_t(t):
    m = int(t // 60)
    s = t - m * 60
    return f"{m:02d}:{s:05.2f}"


def main():
    log("loading audio...")
    y, sr = librosa.load(AUDIO_PATH, sr=SR, mono=True)
    duration = len(y) / sr
    log(f"loaded {duration:.1f}s at sr={sr}")

    # ---- base features -------------------------------------------------
    log("computing base features (rms, centroid, rolloff, zcr, onset env)...")
    rms = librosa.feature.rms(y=y, hop_length=HOP)[0]
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=HOP)[0]
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, hop_length=HOP)[0]
    zcr = librosa.feature.zero_crossing_rate(y, hop_length=HOP)[0]
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
    frame_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=HOP)

    rms_db = librosa.amplitude_to_db(rms, ref=np.max)

    # low-band (sub/bass, <150 Hz) vs vocal-band (300-3400 Hz) energy via mel-like filtering
    log("computing band-limited energy (bass / vocal band)...")
    S = np.abs(librosa.stft(y, hop_length=HOP, n_fft=2048))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    bass_mask = freqs < 150
    vocal_mask = (freqs >= 300) & (freqs <= 3400)
    bass_energy = S[bass_mask, :].mean(axis=0)
    vocal_energy = S[vocal_mask, :].mean(axis=0)
    total_energy = S.mean(axis=0) + 1e-9

    # harmonic/percussive split (for acapella + loop context)
    log("running HPSS (this is the slow step)...")
    y_harm, y_perc = librosa.effects.hpss(y, margin=3.0)
    harm_rms = librosa.feature.rms(y=y_harm, hop_length=HOP)[0]
    perc_rms = librosa.feature.rms(y=y_perc, hop_length=HOP)[0]

    # MFCC for loop self-similarity
    log("computing MFCC for loop detection...")
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=HOP)
    mfcc_norm = mfcc / (np.linalg.norm(mfcc, axis=0, keepdims=True) + 1e-9)

    results = {}

    # ================= 1. FILTER SWEEPS ==================================
    log("detecting filter sweeps...")
    results["filter_sweeps"] = detect_filter_sweeps(centroid, frame_times)

    # ================= 2. ECHO-OUTS / DELAY TAILS =========================
    log("detecting echo-outs / delay tails...")
    results["echo_outs"] = detect_echo_outs(onset_env, frame_times, sr, HOP)

    # ================= 3. LOOPS & LOOP ROLLS ==============================
    log("detecting loops and loop rolls...")
    loops, loop_rolls = detect_loops(mfcc_norm, frame_times, sr, HOP)
    results["loops"] = loops
    results["loop_rolls"] = loop_rolls

    # ================= 4. BRAKES / SPINBACKS ===============================
    log("detecting brakes / spinbacks...")
    results["brakes_spinbacks"] = detect_brakes_spinbacks(centroid, rms_db, frame_times)

    # ================= 5. SCRATCHES =======================================
    log("detecting scratch-like bursts...")
    results["scratches"] = detect_scratches(zcr, onset_env, frame_times)

    # ================= 6. ACAPELLA / VOCAL-ONLY ============================
    log("detecting acapella / vocal-only moments...")
    results["acapella"] = detect_acapella(harm_rms, perc_rms, bass_energy, vocal_energy,
                                            total_energy, frame_times)

    # ================= 7. DROPS AFTER BREAKDOWN ============================
    log("detecting drops after breakdown...")
    results["drops"] = detect_drops(rms_db, bass_energy, frame_times)

    # ================= 8. TEMPO RAMPS =======================================
    log("detecting tempo ramps...")
    results["tempo_ramps"] = detect_tempo_ramps(onset_env, sr, HOP, duration)

    write_outputs(results, duration)
    log("done.")


# -----------------------------------------------------------------------
# 1. Filter sweeps: sliding-window linear regression on spectral centroid
# -----------------------------------------------------------------------
def detect_filter_sweeps(centroid, frame_times):
    fps = 1.0 / np.median(np.diff(frame_times))
    win_s = 3.0
    win = int(win_s * fps)
    step = max(1, win // 4)
    log_centroid = np.log2(np.clip(centroid, 20, None))

    candidates = []
    for start in range(0, len(log_centroid) - win, step):
        seg = log_centroid[start:start + win]
        t = np.arange(win) / fps
        slope, intercept = np.polyfit(t, seg, 1)
        pred = slope * t + intercept
        ss_res = np.sum((seg - pred) ** 2)
        ss_tot = np.sum((seg - seg.mean()) ** 2) + 1e-9
        r2 = 1 - ss_res / ss_tot
        total_change_oct = slope * win_s
        if r2 > 0.6 and abs(total_change_oct) > 0.5:
            candidates.append({
                "start": frame_times[start],
                "end": frame_times[start + win - 1],
                "direction": "rising" if slope > 0 else "falling",
                "octave_change": round(float(total_change_oct), 2),
                "r2": round(float(r2), 2),
            })

    merged = merge_overlapping(candidates, key_dir="direction")
    out = []
    for m in merged:
        dur = m["end"] - m["start"]
        conf = "high" if (m["r2"] > 0.8 and dur >= 2) else ("medium" if m["r2"] > 0.65 else "low")
        out.append({
            "start": round(m["start"], 2), "start_fmt": fmt_t(m["start"]),
            "end": round(m["end"], 2), "end_fmt": fmt_t(m["end"]),
            "duration_s": round(dur, 2),
            "direction": m["direction"],
            "octave_change": m["octave_change"],
            "r2": m["r2"],
            "confidence": conf,
        })
    return out


def merge_overlapping(cands, key_dir=None):
    if not cands:
        return []
    cands = sorted(cands, key=lambda c: c["start"])
    merged = [dict(cands[0])]
    for c in cands[1:]:
        last = merged[-1]
        same_dir = (key_dir is None) or (c[key_dir] == last[key_dir])
        if c["start"] <= last["end"] + 0.5 and same_dir:
            last["end"] = max(last["end"], c["end"])
            last["r2"] = max(last.get("r2", 0), c.get("r2", 0))
            if "octave_change" in c:
                last["octave_change"] = c["octave_change"] if abs(c["octave_change"]) > abs(last.get("octave_change", 0)) else last["octave_change"]
        else:
            merged.append(dict(c))
    return merged


# -----------------------------------------------------------------------
# 2. Echo-outs: decaying, evenly spaced onset-strength peak trains
# -----------------------------------------------------------------------
def detect_echo_outs(onset_env, frame_times, sr, hop):
    fps = sr / hop
    peaks, props = sig.find_peaks(onset_env, height=np.percentile(onset_env, 60),
                                   distance=max(1, int(0.08 * fps)))
    peak_times = frame_times[peaks]
    peak_amps = onset_env[peaks]

    trains = []
    used = set()
    n = len(peaks)
    i = 0
    while i < n - 3:
        if i in used:
            i += 1
            continue
        j = i
        chain = [i]
        while j < n - 1:
            interval0 = peak_times[chain[-1]] - peak_times[chain[0]] if len(chain) < 2 else None
            nxt = j + 1
            if nxt >= n:
                break
            interval = peak_times[nxt] - peak_times[j]
            if len(chain) >= 1:
                ref_interval = (peak_times[chain[1]] - peak_times[chain[0]]) if len(chain) >= 2 else interval
                if ref_interval <= 0 or interval <= 0:
                    break
                if abs(interval - ref_interval) / ref_interval > 0.25:
                    break
                ratio = peak_amps[nxt] / (peak_amps[j] + 1e-9)
                if not (0.25 <= ratio <= 0.95):
                    break
                chain.append(nxt)
                j = nxt
            else:
                chain.append(nxt)
                j = nxt
        if len(chain) >= 4:
            for idx in chain:
                used.add(idx)
            start_t = peak_times[chain[0]]
            end_t = peak_times[chain[-1]]
            period = float(np.mean(np.diff(peak_times[chain])))
            decay_ratios = peak_amps[chain[1:]] / (peak_amps[chain[:-1]] + 1e-9)
            trains.append({
                "start": round(float(start_t), 2), "start_fmt": fmt_t(start_t),
                "end": round(float(end_t), 2), "end_fmt": fmt_t(end_t),
                "repeats": len(chain),
                "period_s": round(period, 3),
                "mean_decay_ratio": round(float(np.mean(decay_ratios)), 2),
                "confidence": "medium" if len(chain) >= 5 and np.std(decay_ratios) < 0.15 else "low",
            })
            i = j + 1
        else:
            i += 1
    return trains


# -----------------------------------------------------------------------
# 3. Loops / loop rolls: fixed-lag self-similarity on MFCC
# -----------------------------------------------------------------------
def detect_loops(mfcc_norm, frame_times, sr, hop):
    fps = sr / hop
    candidate_lags_s = [0.1, 0.15, 0.2, 0.25, 0.3, 0.375, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0]
    n_frames = mfcc_norm.shape[1]
    step_s = 0.25
    step = max(1, int(step_s * fps))

    found = []
    t = 0
    covered_until = -1
    while t < n_frames - 4:
        if frame_times[t] <= covered_until:
            t += step
            continue
        best = None
        for lag_s in candidate_lags_s:
            lag = int(round(lag_s * fps))
            if lag < 1 or t + 2 * lag >= n_frames:
                continue
            a = mfcc_norm[:, t:t + lag]
            b = mfcc_norm[:, t + lag:t + 2 * lag]
            if a.shape[1] != b.shape[1] or a.shape[1] == 0:
                continue
            sim = float(np.mean(np.sum(a * b, axis=0)))
            if sim > 0.90:
                # count how many consecutive repeats
                reps = 2
                k = t + 2 * lag
                while k + lag < n_frames:
                    a2 = mfcc_norm[:, k - lag:k]
                    b2 = mfcc_norm[:, k:k + lag]
                    if a2.shape[1] != b2.shape[1]:
                        break
                    sim2 = float(np.mean(np.sum(a2 * b2, axis=0)))
                    if sim2 > 0.88:
                        reps += 1
                        k += lag
                    else:
                        break
                if reps >= 3 and (best is None or reps > best["reps"]):
                    best = {"lag_s": lag_s, "reps": reps, "sim": sim, "end_frame": k}
        if best:
            start_t = float(frame_times[t])
            end_t = float(frame_times[min(best["end_frame"], n_frames - 1)])
            entry = {
                "start": round(start_t, 2), "start_fmt": fmt_t(start_t),
                "end": round(end_t, 2), "end_fmt": fmt_t(end_t),
                "loop_length_s": best["lag_s"],
                "repeats": best["reps"],
                "similarity": round(best["sim"], 2),
                "confidence": "medium" if best["sim"] > 0.94 and best["reps"] >= 4 else "low",
            }
            found.append(entry)
            covered_until = end_t
            t = best["end_frame"]
        else:
            t += step

    loops = [f for f in found if f["loop_length_s"] >= 0.5]
    loop_rolls = [f for f in found if f["loop_length_s"] < 0.5]
    return loops, loop_rolls


# -----------------------------------------------------------------------
# 4. Brakes / spinbacks: fast downward centroid + loudness slide
# -----------------------------------------------------------------------
def detect_brakes_spinbacks(centroid, rms_db, frame_times):
    fps = 1.0 / np.median(np.diff(frame_times))
    win_s = 2.5
    win = int(win_s * fps)
    step = max(1, win // 4)
    log_centroid = np.log2(np.clip(centroid, 20, None))

    candidates = []
    for start in range(0, len(log_centroid) - win, step):
        seg = log_centroid[start:start + win]
        drop_oct = seg[0] - seg[-1]
        rms_seg = rms_db[start:start + win]
        if drop_oct > 1.0 and np.all(np.diff(seg) <= 0.05):
            candidates.append({
                "start": frame_times[start],
                "end": frame_times[start + win - 1],
                "octave_drop": round(float(drop_oct), 2),
                "ends_quiet": bool(rms_seg[-1] < rms_seg[0] - 6),
            })
    merged = merge_overlapping(candidates)
    out = []
    for m in merged:
        dur = m["end"] - m["start"]
        conf = "medium" if (m.get("octave_drop", 0) > 1.5 and dur <= 4) else "low"
        out.append({
            "start": round(m["start"], 2), "start_fmt": fmt_t(m["start"]),
            "end": round(m["end"], 2), "end_fmt": fmt_t(m["end"]),
            "duration_s": round(dur, 2),
            "octave_drop": m.get("octave_drop"),
            "confidence": conf,
            "note": "downward pitch/centroid slide consistent with a brake or spinback; "
                    "cannot distinguish a manual spinback from a slow filtered outro by this signal alone",
        })
    return out


# -----------------------------------------------------------------------
# 5. Scratches: short bursts of erratic ZCR + onset flux
# -----------------------------------------------------------------------
def detect_scratches(zcr, onset_env, frame_times):
    fps = 1.0 / np.median(np.diff(frame_times))
    win_s = 0.6
    win = max(1, int(win_s * fps))
    step = max(1, win // 2)

    zcr_z = (zcr - zcr.mean()) / (zcr.std() + 1e-9)
    onset_z = (onset_env - onset_env.mean()) / (onset_env.std() + 1e-9)

    candidates = []
    for start in range(0, len(zcr) - win, step):
        z_seg = zcr_z[start:start + win]
        o_seg = onset_z[start:start + win]
        zcr_var = float(np.std(z_seg))
        n_onset_peaks = int(np.sum(o_seg > 1.0))
        if zcr_var > 1.1 and n_onset_peaks >= 3:
            candidates.append({
                "start": frame_times[start],
                "end": frame_times[start + win - 1],
                "zcr_var": round(zcr_var, 2),
                "onset_density": n_onset_peaks,
            })
    merged = merge_overlapping(candidates)
    out = []
    for m in merged:
        out.append({
            "start": round(m["start"], 2), "start_fmt": fmt_t(m["start"]),
            "end": round(m["end"], 2), "end_fmt": fmt_t(m["end"]),
            "duration_s": round(m["end"] - m["start"], 2),
            "confidence": "low",
            "note": "erratic zero-crossing-rate + dense onset bursts; a heuristic proxy that will "
                    "also fire on noisy percussion fills, so treat as low confidence",
        })
    return out


# -----------------------------------------------------------------------
# 6. Acapella / vocal-only: harmonic-dominant, bass-light, sustained
# -----------------------------------------------------------------------
def detect_acapella(harm_rms, perc_rms, bass_energy, vocal_energy, total_energy, frame_times):
    harm_ratio = harm_rms / (harm_rms + perc_rms + 1e-9)
    bass_ratio = bass_energy / total_energy
    vocal_ratio = vocal_energy / total_energy

    fps = 1.0 / np.median(np.diff(frame_times))
    is_vocal_frame = (harm_ratio > 0.65) & (bass_ratio < 0.12) & (vocal_ratio > 0.25)

    segs = frames_to_segments(is_vocal_frame, frame_times, min_dur=4.0, fps=fps)
    out = []
    for s, e in segs:
        idx = (frame_times >= s) & (frame_times <= e)
        conf = "medium" if np.mean(harm_ratio[idx]) > 0.72 and np.mean(bass_ratio[idx]) < 0.08 else "low"
        out.append({
            "start": round(s, 2), "start_fmt": fmt_t(s),
            "end": round(e, 2), "end_fmt": fmt_t(e),
            "duration_s": round(e - s, 2),
            "mean_harmonic_ratio": round(float(np.mean(harm_ratio[idx])), 2),
            "mean_bass_ratio": round(float(np.mean(bass_ratio[idx])), 2),
            "confidence": conf,
        })
    return out


def frames_to_segments(bool_mask, frame_times, min_dur, fps):
    segs = []
    in_seg = False
    start_i = None
    for i, v in enumerate(bool_mask):
        if v and not in_seg:
            in_seg = True
            start_i = i
        elif not v and in_seg:
            in_seg = False
            if frame_times[i - 1] - frame_times[start_i] >= min_dur:
                segs.append((frame_times[start_i], frame_times[i - 1]))
    if in_seg and frame_times[-1] - frame_times[start_i] >= min_dur:
        segs.append((frame_times[start_i], frame_times[-1]))
    return segs


# -----------------------------------------------------------------------
# 7. Drops after breakdown: quiet trough -> sharp rise in level + bass
# -----------------------------------------------------------------------
def detect_drops(rms_db, bass_energy, frame_times):
    fps = 1.0 / np.median(np.diff(frame_times))
    smooth_win = max(1, int(0.5 * fps))
    rms_s = np.convolve(rms_db, np.ones(smooth_win) / smooth_win, mode="same")

    quiet_thresh = np.percentile(rms_s, 15)
    is_quiet = rms_s < quiet_thresh
    quiet_segs = frames_to_segments(is_quiet, frame_times, min_dur=2.0, fps=fps)

    out = []
    for qs, qe in quiet_segs:
        end_idx = np.searchsorted(frame_times, qe)
        look_ahead = int(8 * fps)
        window_end = min(len(rms_s), end_idx + look_ahead)
        if end_idx >= window_end:
            continue
        rise_idx = end_idx + int(np.argmax(rms_s[end_idx:window_end]))
        rise_db = rms_s[rise_idx] - rms_s[end_idx]
        bass_before = np.mean(bass_energy[max(0, end_idx - int(fps)):end_idx])
        bass_after = np.mean(bass_energy[rise_idx:min(len(bass_energy), rise_idx + int(2 * fps))])
        bass_jump = bass_after / (bass_before + 1e-9)
        if rise_db > 6 and bass_jump > 1.3:
            out.append({
                "breakdown_start": round(qs, 2), "breakdown_start_fmt": fmt_t(qs),
                "breakdown_end": round(qe, 2), "breakdown_end_fmt": fmt_t(qe),
                "drop_at": round(float(frame_times[rise_idx]), 2),
                "drop_at_fmt": fmt_t(float(frame_times[rise_idx])),
                "level_rise_db": round(float(rise_db), 1),
                "bass_energy_ratio": round(float(bass_jump), 2),
                "confidence": "medium" if rise_db > 10 and bass_jump > 1.8 else "low",
            })
    return out


# -----------------------------------------------------------------------
# 8. Tempo ramps: sustained monotonic drift in local tempo estimate
# -----------------------------------------------------------------------
def detect_tempo_ramps(onset_env, sr, hop, duration):
    fps = sr / hop
    win_s = 8.0
    hop_s = 4.0
    win = int(win_s * fps)
    step = int(hop_s * fps)

    tempos = []
    centers = []
    for start in range(0, len(onset_env) - win, step):
        seg = onset_env[start:start + win]
        tempo = librosa.feature.tempo(onset_envelope=seg, sr=sr, hop_length=hop,
                                       aggregate=None)
        t_est = float(np.median(tempo)) if len(tempo) else np.nan
        tempos.append(t_est)
        centers.append((start + win / 2) / fps)
    tempos = np.array(tempos)
    centers = np.array(centers)

    ramps = []
    i = 0
    n = len(tempos)
    while i < n - 2:
        j = i + 1
        direction = None
        while j < n:
            if np.isnan(tempos[j]) or np.isnan(tempos[j - 1]):
                break
            ratio = tempos[j] / (tempos[j - 1] + 1e-9)
            if ratio < 0.7 or ratio > 1.43:
                break
            delta = tempos[j] - tempos[j - 1]
            this_dir = "accelerating" if delta > 0.5 else ("decelerating" if delta < -0.5 else "flat")
            if this_dir == "flat":
                j += 1
                continue
            if direction is None:
                direction = this_dir
            elif this_dir != direction:
                break
            j += 1
        span_s = centers[j - 1] - centers[i] if j - 1 > i else 0
        total_change = tempos[j - 1] - tempos[i] if j - 1 < n and j - 1 > i else 0
        if direction and span_s >= 8 and abs(total_change) >= 3:
            ramps.append({
                "start": round(float(centers[i]), 2), "start_fmt": fmt_t(float(centers[i])),
                "end": round(float(centers[j - 1]), 2), "end_fmt": fmt_t(float(centers[j - 1])),
                "direction": direction,
                "bpm_start": round(float(tempos[i]), 1),
                "bpm_end": round(float(tempos[j - 1]), 1),
                "confidence": "low",
                "note": "local-tempo drift estimate; coarse and easily confused with the "
                        "half/double-time ambiguity already flagged in report.md",
            })
            i = j
        else:
            i += 1
    return ramps


def write_outputs(results, duration):
    counts = {k: len(v) for k, v in results.items()}
    payload = {
        "source_file": AUDIO_PATH,
        "duration_s": round(duration, 1),
        "duration_fmt": fmt_t(duration),
        "counts": counts,
        "techniques": results,
        "method_notes": {
            "filter_sweeps": "sliding 3s linear-regression fit on log2(spectral centroid); "
                              "flagged when R^2>0.6 and slope implies >0.5 octave change over the window",
            "echo_outs": "onset-strength peak-picking; chains of >=4 peaks with near-constant "
                          "spacing (±25%) and decaying amplitude (ratio 0.25-0.95) flagged as delay tails",
            "loops": "fixed-lag cosine self-similarity on normalized MFCC frames; candidate lags "
                     "0.1-4.0s; >=3 consecutive repeats at similarity >0.88-0.90 required",
            "loop_rolls": "same detector as loops, restricted to lag <0.5s (stutter/roll range)",
            "brakes_spinbacks": "2.5s windows with monotonic >1 octave downward spectral-centroid "
                                  "slide; cannot distinguish manual spinback from a slow filtered outro",
            "scratches": "0.6s windows with high zero-crossing-rate variance + dense onset bursts; "
                          "will also fire on noisy percussion/vocal chops, so confidence is capped at low",
            "acapella": "HPSS harmonic/percussive ratio + band-energy ratios (bass <150Hz, vocal "
                         "300-3400Hz); segments >=4s with harmonic-dominant, bass-light, vocal-band-rich content",
            "drops": "RMS trough (quietest 15th percentile) sustained >=2s, followed within 8s by "
                     ">6dB rise and >1.3x bass-energy jump",
            "tempo_ramps": "8s-window local tempo via librosa.feature.tempo on onset envelope; "
                            "monotonic multi-window drift >=8s and >=3 BPM flagged, excluding jumps "
                            "that look like half/double-time switches",
        },
        "overall_caveats": [
            "All detections are signal-processing heuristics tuned by hand on this single file; "
            "none are validated against a labeled ground truth, so treat counts and timestamps as "
            "candidates to spot-check by ear, not certainties.",
            "Confidence labels are relative to each other within a technique, not comparable across "
            "techniques (a 'medium' loop detection and a 'medium' drop detection used different thresholds).",
            "Half-time/double-time tempo ambiguity (noted in report.md) can produce false tempo-ramp "
            "detections where the mix actually just changed tracks.",
            "No track identities, filenames, or metadata were available or inferred; nothing here names a track.",
        ],
    }

    json_path = OUT_DIR / "style_techniques.json"
    with open(json_path, "w") as f:
        json.dump(payload, f, indent=2)

    md_path = OUT_DIR / "style_techniques.md"
    write_markdown(md_path, payload)
    print(str(json_path))
    print(str(md_path))


def write_markdown(path, payload):
    lines = []
    lines.append("# Performance technique detection")
    lines.append("")
    lines.append(f"Source: `{payload['source_file']}`  ")
    lines.append(f"Duration: {payload['duration_fmt']} ({payload['duration_s']}s)")
    lines.append("")
    lines.append("All timestamps/MM:SS.ss. Every detector below is a heuristic signal-processing "
                  "proxy, not a validated classifier — read the Method and Caveats under each "
                  "section before trusting a count.")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append("| Technique | Count |")
    lines.append("|---|---|")
    labels = {
        "filter_sweeps": "Filter sweeps",
        "echo_outs": "Echo-outs / delay tails",
        "loops": "Loops (>=0.5s segment)",
        "loop_rolls": "Loop rolls (<0.5s segment)",
        "brakes_spinbacks": "Brakes / spinbacks",
        "scratches": "Scratch-like bursts",
        "acapella": "Acapella / vocal-only moments",
        "drops": "Drops after breakdown",
        "tempo_ramps": "Tempo ramps",
    }
    for key, label in labels.items():
        lines.append(f"| {label} | {payload['counts'].get(key, 0)} |")
    lines.append("")

    for key, label in labels.items():
        items = payload["techniques"].get(key, [])
        lines.append(f"## {label}")
        lines.append("")
        lines.append(f"**Method:** {payload['method_notes'][key]}")
        lines.append("")
        if not items:
            lines.append("No instances detected above threshold.")
            lines.append("")
            continue
        durations = [it.get("duration_s") for it in items if it.get("duration_s") is not None]
        if durations:
            lines.append(f"Count: {len(items)}. Typical duration: "
                          f"{round(float(np.median(durations)), 2)}s "
                          f"(range {round(min(durations),2)}-{round(max(durations),2)}s).")
            lines.append("")
        conf_counts = {}
        for it in items:
            c = it.get("confidence", "n/a")
            conf_counts[c] = conf_counts.get(c, 0) + 1
        lines.append("Confidence breakdown: " + ", ".join(f"{v} {k}" for k, v in conf_counts.items()))
        lines.append("")
        lines.append("Example timestamps (up to 10 shown):")
        lines.append("")
        for it in items[:10]:
            if key == "drops":
                lines.append(f"- breakdown {it['breakdown_start_fmt']}–{it['breakdown_end_fmt']} "
                              f"-> drop at {it['drop_at_fmt']} "
                              f"(+{it['level_rise_db']} dB, bass x{it['bass_energy_ratio']}, "
                              f"confidence: {it['confidence']})")
            elif key == "tempo_ramps":
                lines.append(f"- {it['start_fmt']}–{it['end_fmt']} {it['direction']} "
                              f"{it['bpm_start']}->{it['bpm_end']} BPM (confidence: {it['confidence']})")
            elif key in ("loops", "loop_rolls"):
                lines.append(f"- {it['start_fmt']}–{it['end_fmt']} loop length {it['loop_length_s']}s, "
                              f"{it['repeats']} repeats, similarity {it['similarity']} "
                              f"(confidence: {it['confidence']})")
            elif key == "echo_outs":
                lines.append(f"- {it['start_fmt']}–{it['end_fmt']} period {it['period_s']}s, "
                              f"{it['repeats']} repeats, decay ratio {it['mean_decay_ratio']} "
                              f"(confidence: {it['confidence']})")
            elif key == "acapella":
                lines.append(f"- {it['start_fmt']}–{it['end_fmt']} ({it['duration_s']}s), "
                              f"harmonic ratio {it['mean_harmonic_ratio']}, bass ratio {it['mean_bass_ratio']} "
                              f"(confidence: {it['confidence']})")
            elif key == "filter_sweeps":
                lines.append(f"- {it['start_fmt']}–{it['end_fmt']} {it['direction']}, "
                              f"{it['octave_change']} octaves, R^2={it['r2']} "
                              f"(confidence: {it['confidence']})")
            elif key == "brakes_spinbacks":
                lines.append(f"- {it['start_fmt']}–{it['end_fmt']} ({it['duration_s']}s), "
                              f"{it['octave_drop']} octave drop (confidence: {it['confidence']})")
            else:
                lines.append(f"- {it['start_fmt']}–{it['end_fmt']} (confidence: {it['confidence']})")
        lines.append("")

    lines.append("## Overall caveats")
    lines.append("")
    for c in payload["overall_caveats"]:
        lines.append(f"- {c}")
    lines.append("")

    with open(path, "w") as f:
        f.write("\n".join(lines))


if __name__ == "__main__":
    main()
