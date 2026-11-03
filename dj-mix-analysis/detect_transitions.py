"""
Detect candidate transition points using a two-window novelty curve on
chroma + MFCC + spectral-centroid features, combined with band-energy
crossover detection. Picks peaks, applies min-spacing, ranks by prominence.

Run: .mix-venv/bin/python -I dj-style/scripts/detect_transitions.py
"""
import numpy as np
import os
from scipy.signal import find_peaks
from scipy.ndimage import median_filter

CACHE = "./cache/features.npz"
OUT = "./cache/novelty.npz"

d = np.load(CACHE)
sr = int(d["sr"])
hop = int(d["hop"])
frame_times = d["frame_times"]
chroma = d["chroma"]  # (12, T)
mfcc = d["mfcc"]      # (13, T)
centroid = d["centroid"]
low_energy = d["low_energy"]
mid_energy = d["mid_energy"]
high_energy = d["high_energy"]
total_energy = d["total_energy"]

fps = sr / hop
print(f"fps={fps:.2f}, frames={len(frame_times)}, duration={frame_times[-1]:.1f}s")

# Downsample to a coarser grid for novelty computation (~4 fps -> 0.25s bins)
target_fps = 4.0
factor = max(1, int(round(fps / target_fps)))
print(f"Downsample factor={factor} -> ~{fps/factor:.2f} fps")

def downsample_mean(x, factor, axis=-1):
    n = x.shape[axis]
    n_trim = (n // factor) * factor
    if axis == -1:
        xt = x[..., :n_trim]
        shape = xt.shape[:-1] + (n_trim // factor, factor)
        return xt.reshape(shape).mean(axis=-1)
    else:
        raise NotImplementedError

chroma_ds = downsample_mean(chroma, factor, axis=-1)          # (12, T')
mfcc_ds = downsample_mean(mfcc, factor, axis=-1)                # (13, T')
centroid_ds = downsample_mean(centroid[None, :], factor, axis=-1)[0]
low_ds = downsample_mean(low_energy[None, :], factor, axis=-1)[0]
mid_ds = downsample_mean(mid_energy[None, :], factor, axis=-1)[0]
high_ds = downsample_mean(high_energy[None, :], factor, axis=-1)[0]
total_ds = downsample_mean(total_energy[None, :], factor, axis=-1)[0]
times_ds = downsample_mean(frame_times[None, :], factor, axis=-1)[0]

T = chroma_ds.shape[1]
print(f"T'={T} frames at ~{fps/factor:.2f} fps")

def zscore(x):
    return (x - x.mean()) / (x.std() + 1e-9)

def two_window_novelty(feat, win_frames):
    """For each t, cosine distance between mean(feat[t-win:t]) and mean(feat[t:t+win])."""
    F, T = feat.shape
    novelty = np.zeros(T)
    # normalize columns to unit norm for cosine distance robustness
    norms = np.linalg.norm(feat, axis=0) + 1e-9
    featn = feat / norms
    for t in range(win_frames, T - win_frames):
        a = featn[:, t - win_frames:t].mean(axis=1)
        b = featn[:, t:t + win_frames].mean(axis=1)
        na = np.linalg.norm(a) + 1e-9
        nb = np.linalg.norm(b) + 1e-9
        cos_sim = np.dot(a, b) / (na * nb)
        novelty[t] = 1.0 - cos_sim
    return novelty

fps_ds = fps / factor

# Two window sizes: ~8s (short blends / cuts) and ~24s (long blends)
win_short = int(round(8 * fps_ds))
win_long = int(round(24 * fps_ds))

print(f"Computing chroma novelty (win_short={win_short} frames = {win_short/fps_ds:.1f}s)...")
chroma_nov_short = two_window_novelty(chroma_ds, win_short)
print(f"Computing chroma novelty (win_long={win_long} frames = {win_long/fps_ds:.1f}s)...")
chroma_nov_long = two_window_novelty(chroma_ds, win_long)

print("Computing MFCC novelty (short)...")
mfcc_nov_short = two_window_novelty(mfcc_ds, win_short)
print("Computing MFCC novelty (long)...")
mfcc_nov_long = two_window_novelty(mfcc_ds, win_long)

# Energy-based novelty: rate of change of total energy envelope + centroid sweep
total_smooth = median_filter(total_ds, size=int(fps_ds * 2) + 1)
energy_deriv = np.abs(np.gradient(total_smooth))

centroid_smooth = median_filter(centroid_ds, size=int(fps_ds * 2) + 1)
centroid_deriv = np.abs(np.gradient(centroid_smooth))

combined = (
    1.4 * zscore(chroma_nov_short) +
    1.6 * zscore(chroma_nov_long) +
    1.2 * zscore(mfcc_nov_short) +
    1.4 * zscore(mfcc_nov_long) +
    0.6 * zscore(energy_deriv) +
    0.4 * zscore(centroid_deriv)
)
combined_smooth = median_filter(combined, size=int(fps_ds * 3) + 1)

min_spacing_s = 20.0
min_spacing_frames = int(round(min_spacing_s * fps_ds))

peaks, props = find_peaks(combined_smooth, distance=min_spacing_frames, prominence=0.5)
print(f"Found {len(peaks)} candidate peaks before filtering")

order = np.argsort(-props["prominences"])
peaks_sorted = peaks[order]
proms_sorted = props["prominences"][order]

np.savez(
    OUT,
    times_ds=times_ds,
    fps_ds=fps_ds,
    combined=combined,
    combined_smooth=combined_smooth,
    chroma_nov_short=chroma_nov_short,
    chroma_nov_long=chroma_nov_long,
    mfcc_nov_short=mfcc_nov_short,
    mfcc_nov_long=mfcc_nov_long,
    energy_deriv=energy_deriv,
    centroid_deriv=centroid_deriv,
    low_ds=low_ds, mid_ds=mid_ds, high_ds=high_ds, total_ds=total_ds,
    centroid_ds=centroid_ds,
    peaks=peaks, proms=props["prominences"],
)

print("\nTop candidates by prominence:")
for p, pr in zip(peaks_sorted[:60], proms_sorted[:60]):
    t = times_ds[p]
    mm = int(t // 60)
    ss = t % 60
    print(f"  {mm:02d}:{ss:05.2f}  (t={t:.2f}s)  prominence={pr:.3f}")

print(f"\nSaved novelty data to {OUT}")
