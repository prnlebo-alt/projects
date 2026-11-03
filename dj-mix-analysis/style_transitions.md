# Transition analysis: OSO's World Wide Mix Vol 105 - DJ OSO MIGHTY.mp3

Measured directly from the audio with a custom detector (chroma-CQT + MFCC two-window novelty, combined with band-energy and spectral-centroid derivatives; see `scripts/detect_transitions.py` and `scripts/refine_transitions.py`). Track identities are not known; only acoustic measurements are reported.

**How to read this table:** `Start`/`End` bound the window where the novelty curve (the measured blend of tonal, timbral and spectral change) is elevated around each transition peak -- treat them as the audible blend/cut zone, not a verified two-stem overlap (no source separation was used). `Bass swap` is the time of steepest rise in sub-150 Hz energy inside that window -- a proxy for where the incoming track's bass takes over, not a certainty when `distinct=No`. `On bar?` checks phase against a beat grid anchored to the strongest nearby onset; true downbeat position was not independently verified, so treat this column as approximate. BPM values come from onset-autocorrelation tempo estimation on 20-24s windows before/after the transition and are quantized to the estimator's resolution; where the mix sits in a known half/double-time ambiguous zone (per `report.md`), the value shown is folded into the 60-180 BPM range and may be off by a factor of 2 from the 'true' musical tempo.

## Transition table

| # | Start | End | Overlap (s) | Overlap (bars) | BPM before | BPM after | Bass swap @ | Swap frac | Swap distinct | On bar? (approx) | Type |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 01:26.96 | 01:31.56 | 4.6 | 1.9 | 99.4 | 99.4 | 01:29.00 | 0.44 | Yes | No | hard cut |
| 2 | 02:31.84 | 02:40.01 | 8.2 | 3.4 | 99.4 | 99.4 | 02:39.24 | 0.91 | Yes | No | echo-out |
| 3 | 03:36.20 | 03:46.67 | 10.5 | 5.9 | 136.0 | 136.0 | 03:39.27 | 0.29 | Yes | No | short blend |
| 4 | 04:34.69 | 04:42.61 | 7.9 | 3.3 | 99.4 | 99.4 | 04:38.27 | 0.45 | Yes | No | short blend |
| 5 | 06:28.35 | 06:37.29 | 8.9 | 3.7 | 99.4 | 99.4 | 06:34.48 | 0.69 | Yes | Yes | short blend |
| 6 | 07:05.13 | 07:21.48 | 16.3 | 6.8 | 99.4 | 99.4 | 07:20.20 | 0.92 | Yes | No | short blend |
| 7 | 09:09.01 | 09:15.40 | 6.4 | 2.6 | 99.4 | 99.4 | 09:15.40 | 1.0 | Yes | No | short blend |
| 8 | 10:44.79 | 10:52.71 | 7.9 | 3.3 | 99.4 | 99.4 | 10:47.86 | 0.39 | Yes | No | short blend |
| 9 | 13:16.00 | 13:27.75 | 11.7 | 4.9 | 99.4 | 99.4 | 13:17.79 | 0.15 | Yes | No | short blend |
| 10 | 15:17.84 | 15:29.33 | 11.5 | 4.8 | 99.4 | 99.4 | 15:28.31 | 0.91 | No | No | short blend |
| 11 | 17:26.31 | 17:33.98 | 7.7 | 3.8 | 136.0 | 99.4 | 17:32.19 | 0.77 | No | No | tempo-jump |
| 12 | 17:56.96 | 18:04.88 | 7.9 | 3.3 | 99.4 | 99.4 | 17:56.96 | 0.0 | Yes | No | filter sweep |
| 13 | 19:03.63 | 19:10.78 | 7.2 | 3.5 | 136.0 | 99.4 | 19:03.63 | 0.0 | Yes | Yes | tempo-jump |
| 14 | 20:13.10 | 20:18.98 | 5.9 | 2.4 | 99.4 | 99.4 | 20:18.98 | 1.0 | Yes | No | short blend |
| 15 | 21:22.07 | 21:27.17 | 5.1 | 2.5 | 136.0 | 99.4 | 21:22.83 | 0.15 | Yes | No | tempo-jump |
| 16 | 21:58.34 | 22:04.47 | 6.1 | 2.5 | 99.4 | 99.4 | 22:02.17 | 0.62 | No | Yes | short blend |
| 17 | 22:55.29 | 23:01.42 | 6.1 | 2.5 | 99.4 | 99.4 | 22:55.81 | 0.08 | No | Yes | short blend |
| 18 | 26:11.46 | 26:20.14 | 8.7 | 3.6 | 99.4 | 99.4 | 26:17.08 | 0.65 | Yes | No | short blend |
| 19 | 27:01.26 | 27:15.31 | 14.0 | 5.8 | 99.4 | 99.4 | 27:01.52 | 0.02 | Yes | No | short blend |
| 20 | 27:48.26 | 27:54.14 | 5.9 | 2.4 | 99.4 | 99.4 | 27:50.30 | 0.35 | Yes | No | short blend |
| 21 | 29:57.50 | 30:07.46 | 10.0 | 5.2 | 129.2 | 123.0 | 30:03.12 | 0.56 | Yes | No | short blend |
| 22 | 31:46.31 | 31:53.21 | 6.9 | 3.5 | 123.0 | 123.0 | 31:48.61 | 0.33 | Yes | No | echo-out |
| 23 | 33:54.02 | 34:01.68 | 7.7 | 3.9 | 123.0 | 123.0 | 33:59.13 | 0.67 | No | No | short blend |
| 24 | 34:35.40 | 34:48.68 | 13.3 | 6.2 | 123.0 | 99.4 | 34:38.21 | 0.21 | No | No | tempo-jump |
| 25 | 37:47.99 | 37:54.88 | 6.9 | 3.5 | 123.0 | 123.0 | 37:53.35 | 0.78 | No | No | short blend |
| 26 | 40:19.19 | 40:28.39 | 9.2 | 4.9 | 129.2 | 129.2 | 40:19.19 | 0.0 | Yes | No | short blend |
| 27 | 41:34.80 | 41:45.78 | 11.0 | 5.9 | 129.2 | 129.2 | 41:35.82 | 0.09 | Yes | Yes | short blend |
| 28 | 42:00.08 | 42:10.05 | 10.0 | 5.4 | 129.2 | 129.2 | 42:06.21 | 0.62 | Yes | Yes | short blend |
| 29 | 43:13.90 | 43:26.16 | 12.3 | 6.6 | 129.2 | 129.2 | 43:20.80 | 0.56 | Yes | Yes | short blend |
| 30 | 43:55.02 | 44:03.45 | 8.4 | 4.5 | 129.2 | 129.2 | 43:57.83 | 0.33 | No | No | echo-out |
| 31 | 44:29.51 | 44:37.68 | 8.2 | 4.4 | 129.2 | 129.2 | 44:29.51 | 0.0 | Yes | No | short blend |
| 32 | 45:03.22 | 45:08.33 | 5.1 | 2.8 | 129.2 | 129.2 | 45:04.75 | 0.3 | No | No | short blend |
| 33 | 45:17.78 | 45:36.94 | 19.2 | 10.3 | 129.2 | 129.2 | 45:34.64 | 0.88 | Yes | Yes | short blend |
| 34 | 46:43.35 | 46:59.69 | 16.3 | 8.8 | 129.2 | 129.2 | 46:43.35 | 0.0 | Yes | No | short blend |
| 35 | 47:07.87 | 47:15.02 | 7.2 | 3.9 | 129.2 | 129.2 | 47:11.44 | 0.5 | Yes | No | filter sweep |
| 36 | 47:34.94 | 47:43.62 | 8.7 | 4.7 | 129.2 | 129.2 | 47:41.07 | 0.71 | No | No | short blend |
| 37 | 47:59.97 | 48:06.61 | 6.6 | 3.6 | 129.2 | 129.2 | 48:03.29 | 0.5 | Yes | No | echo-out |
| 38 | 48:27.56 | 48:38.54 | 11.0 | 5.9 | 129.2 | 129.2 | 48:33.18 | 0.51 | Yes | No | short blend |
| 39 | 50:08.96 | 50:27.86 | 18.9 | 10.2 | 129.2 | 129.2 | 50:09.98 | 0.05 | Yes | No | short blend |
| 40 | 53:35.34 | 53:44.79 | 9.5 | 5.1 | 129.2 | 129.2 | 53:35.59 | 0.03 | Yes | Yes | short blend |
| 41 | 55:12.14 | 55:16.99 | 4.9 | 2.6 | 129.2 | 129.2 | 55:16.99 | 1.0 | Yes | No | short blend |
| 42 | 55:51.22 | 55:58.88 | 7.7 | 4.1 | 129.2 | 129.2 | 55:54.28 | 0.4 | Yes | No | echo-out |
| 43 | 57:44.12 | 57:48.71 | 4.6 | 2.5 | 129.2 | 129.2 | 57:48.20 | 0.89 | No | No | short blend |
| 44 | 58:05.83 | 58:12.98 | 7.2 | 3.8 | 129.2 | 129.2 | 58:12.98 | 1.0 | Yes | Yes | short blend |
| 45 | 59:23.22 | 59:29.86 | 6.6 | 3.6 | 129.2 | 129.2 | 59:24.75 | 0.23 | No | No | short blend |

## Distribution summary

- Transitions found: **45**
- Overlap duration: median **3.8 bars** (7.9s), range 1.9-10.3 bars (4.6-19.2s)
- Type breakdown:
  - short blend: 73% (33/45)
  - echo-out: 11% (5/45)
  - tempo-jump: 9% (4/45)
  - filter sweep: 4% (2/45)
  - hard cut: 2% (1/45)
- Bass swap is a distinct, single rise point in **73%** of transitions (33/45); the rest show a more gradual/multi-step low-end change
- Bass swap position within the overlap window: median **45%** of the way through (i.e. the incoming bass tends to take over past the midpoint of the blend, not at the very start)
- Bass swap lands within ~12% of a bar boundary (approximate beat-grid phase check) in **22%** of cases (10/45) -- treat this figure cautiously; see caveats

## Method notes

1. Features (chroma-CQT, MFCC-13, spectral centroid, 3-band RMS energy: <150 Hz / 150-2000 Hz / >2000 Hz) were extracted over the full file at ~43 fps, then pooled to ~3.9 fps.
2. A combined novelty curve was built from two-window (8s and 24s) cosine-distance novelty on chroma and MFCC, plus energy- and centroid-derivative terms, z-scored and summed.
3. Peaks were picked with a minimum 20s spacing and a prominence threshold; the top 45 candidates by prominence were kept and refined (all have overlap >= ~1.9 bars and clear multi-feature agreement, i.e. 'clear transitions' per the task's own detector).
4. For each candidate, the novelty curve was walked outward from the peak to the nearest point where it falls to ~35% of peak-above-baseline, giving overlap start/end.
5. BPM before/after come from onset-envelope autocorrelation tempo estimation (`librosa.feature.tempo`) over the 20s window immediately before/after the overlap, folded into 60-180 BPM.
6. Bass-swap time = time of maximum positive slope of the <150 Hz energy curve inside the overlap window; 'distinct' means that slope peak is >2x the window's derivative noise floor.
7. Bar-boundary check anchors a 4-beat bar grid to the strongest onset within 1s of the bass-swap time at the local BPM, then checks phase -- approximate, no independent downbeat detector.
8. Type labels are rule-based from the measurements above (hard cut: overlap <2s; tempo-jump: |BPM change| >8%; filter sweep: centroid sweeps >45% of its mean, >60% monotonic, within <20s; echo-out: total energy decays through most of the first third of the window while the low band stays below its window median, i.e. a decaying tail with a bass gap; long blend: >=12 bars; otherwise short blend).

## Caveats

- This is acoustic measurement, not stem separation: overlap bounds, bass-swap points and type labels are all inferred from mixed-signal features, not from isolated incoming/outgoing tracks. Treat all of the above as the best available estimate from a single-channel analysis, not ground truth.
- BPM is quantized by the tempo estimator's autocorrelation resolution (same few values recur across the file); where the baseline report (`report.md`) flags half/double-time ambiguity, the true musical tempo may be exactly half or double the value shown here.
- Bar-boundary alignment is phase-estimated from the nearest strong onset, not a verified downbeat; treat the On-bar column as a rough indicator, not a confirmed measurement.
- Echo-out and filter-sweep labels are heuristic proxies on a handful of measured curves; a few borderline cases could be mislabeled as 'short blend' or vice versa.
- Track names are not known or guessed anywhere in this analysis.

