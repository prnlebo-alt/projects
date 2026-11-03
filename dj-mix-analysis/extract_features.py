"""
Load the mix once, compute features needed for transition detection, cache to disk.
Run: .mix-venv/bin/python -I dj-style/scripts/extract_features.py
"""
import numpy as np
import librosa
import os

AUDIO_PATH = "./input/OSO's World Wide Mix Vol 105 - DJ OSO MIGHTY.mp3"
OUT_DIR = "./cache"
os.makedirs(OUT_DIR, exist_ok=True)

SR = 22050
HOP = 512  # ~23.2ms frames, ~43 fps

print("Loading audio (read-only)...")
y, sr = librosa.load(AUDIO_PATH, sr=SR, mono=True)
duration = len(y) / sr
print(f"Loaded. sr={sr}, duration={duration:.2f}s ({duration/60:.2f} min)")

print("Computing STFT magnitude...")
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=HOP))
freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
frame_times = librosa.frames_to_time(np.arange(S.shape[1]), sr=sr, hop_length=HOP)

print("Computing band energy (RMS-equivalent from STFT) for low/mid/high bands...")
low_mask = freqs < 150
mid_mask = (freqs >= 150) & (freqs < 2000)
high_mask = freqs >= 2000

low_energy = np.sqrt(np.mean(S[low_mask, :] ** 2, axis=0))
mid_energy = np.sqrt(np.mean(S[mid_mask, :] ** 2, axis=0))
high_energy = np.sqrt(np.mean(S[high_mask, :] ** 2, axis=0))
total_energy = np.sqrt(np.mean(S ** 2, axis=0))

print("Computing chroma (CQT-based)...")
chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=HOP)

print("Computing MFCC...")
mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=HOP)

print("Computing onset envelope...")
onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)

print("Computing spectral centroid...")
centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=HOP, n_fft=2048)[0]

np.savez(
    os.path.join(OUT_DIR, "features.npz"),
    sr=sr,
    hop=HOP,
    duration=duration,
    frame_times=frame_times,
    low_energy=low_energy,
    mid_energy=mid_energy,
    high_energy=high_energy,
    total_energy=total_energy,
    chroma=chroma,
    mfcc=mfcc,
    onset_env=onset_env,
    centroid=centroid,
)
print(f"Saved features to {os.path.join(OUT_DIR, 'features.npz')}")

# Also save the raw onset envelope times separately for beat tracking re-use
onset_times = librosa.frames_to_time(np.arange(len(onset_env)), sr=sr, hop_length=HOP)
np.savez(os.path.join(OUT_DIR, "onset_times.npz"), onset_times=onset_times)
print("Done.")
