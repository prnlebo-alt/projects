# OSO World Wide Mix Vol 105 (identified) — Cue Sheet

Rebuilt in djay Pro from the Spotify playlist `OSO World Wide Mix Vol 105 (identified)`, timed to match the original mix's pacing (`dj-style/tracklist.json`).

## How timing was derived

The original tracklist has a `time` field marking when each song entered the original mix. The gap between one song's timestamp and the next song's timestamp is how long that song occupied the mix before the DJ moved on. That gap becomes this song's **play length** here.

Two adjustments:
- **Missing/unidentified songs** (3 NOT FOUND: Noche De Sex, Set De Locura, Tokyo Drift; 2 unidentified Shazam samples) have no track to place in the new mix, so their time slot is absorbed into the song immediately before them (it just plays longer).
- **Duplicate detection** — "Janice STFU" was Shazam-sampled twice in a row (50:45 and 53:00, same song) because it was still playing at the second sample; its play length runs through to the *next distinct* song (Like A G6 at 55:00), not just to the duplicate sample.
- Where the absorbed gap would run longer than the track's real length, it's **capped at the real length** (Finer Things, EoO, Free Your Mind, Janice STFU) — i.e. that track just plays out in full.

**Total new-mix runtime:** ~56:16 (23 tracks; shorter than the original ~58 min because 3 songs are missing)

## Track list

| # | Deck | Start (new mix) | Track | Artist | BPM | Key | Play length | Full length | Orig. mix time |
|---|------|------------------|-------|--------|-----|-----|-------------|-------------|-----------------|
| 1 | 1 | 0:00 | UP! | LoveRance, 50 Cent | 97 | 3B | 2:50 | 3:51 | 00:30 |
| 2 | 2 | 2:50 | Dark Thoughts | Lil Tecca | 102 | 12A | 1:50 | 2:17 | 03:20 |
| 3 | 1 | 4:40 | Asta Afta | Arab, Big Skendo | 100 | 2B | 2:30 | 2:38 | 05:10 |
| 4 | 2 | 7:10 | U Don't Have to Call | USHER | 100 | 4A | 2:40 | 4:29 | 07:40 |
| 5 | 1 | 9:50 | I'm Sprung | T-Pain | 100 | 5A | 2:10 | 3:51 | 10:20 |
| 6 | 2 | 12:00 | I Wanna Love You | Akon, Snoop Dogg | 100 | 9B | 2:30 | 4:07 | 12:30 |
| 7 | 1 | 14:30 | Finer Things | DJ Felli Fel, Kanye West, Jermaine Dupri, Fabolous, Ne-Yo | 101 | 8A | 4:13 | 4:13 | 15:00 |
| 8 | 2 | 18:43 | Safaera | Bad Bunny, Jowell & Randy, Ñengo Flow | 149 | 8A | 2:20 | 4:55 | 19:30 |
| 9 | 1 | 21:03 | EoO | Bad Bunny | 102 | 12A | 3:25 | 3:25 | 21:50 |
| 10 | 2 | 24:28 | Candy | Plan B | 96 | 10A | 2:00 | 3:28 | 26:30 |
| 11 | 1 | 26:28 | +57 | KAROL G, Feid, DFZM, Ovy On The Drums, J Balvin, Maluma, Ryan Castro, Blessd | 92 | 12A | 2:30 | 4:58 | 28:30 |
| 12 | 2 | 28:58 | Culo | Pitbull, Lil Jon | 120 | 10A | 2:30 | 3:39 | 31:00 |
| 13 | 1 | 31:28 | BbY WOW | KAROL G, Judeline, rusowsky | 60* | 10A | 1:30 | 3:46 | 33:30 |
| 14 | 2 | 32:58 | DÁKITI | Bad Bunny, JHAYCO | 110 | 9A | 2:00 | 3:25 | 35:00 |
| 15 | 1 | 34:58 | Titanium | David Guetta, Sia | 126 | 5A | 2:00 | 4:05 | 37:00 |
| 16 | 2 | 36:58 | Don't Wake Me Up | James Hype | 130 | 5A | 1:00 | 2:34 | 39:00 |
| 17 | 1 | 37:58 | Promises (Sonny Fodera Remix) | Calvin Harris, Sam Smith, Sonny Fodera | 123 | 2A | 3:30 | 3:57 | 40:00 |
| 18 | 2 | 41:28 | Free Your Mind | Prospa, Cloonee, Sybil | 128 | 10A | 3:22 | 3:22 | 43:30 |
| 19 | 1 | 44:50 | C'Mon (Catch 'Em by Surprise) | Tiësto, Diplo, Busta Rhymes | 130 | 9B | 1:00 | 3:32 | 47:45 |
| 20 | 2 | 45:50 | The Wave | VINAI, Harrison | 128 | 7B | 2:00 | 3:26 | 48:45 |
| 21 | 1 | 47:50 | Janice STFU | Drake | 126 | 1A | 3:57 | 3:57 | 50:45 |
| 22 | 2 | 51:47 | Like A G6 | Far East Movement, The Cataracs, DEV | 125 | 6B | 1:30 | 3:37 | 55:00 |
| 23 | 1 | 53:17 | Lost In The Music | A7S | 126 | 6B | 2:59 (full, last track) | 2:59 | 56:30 |

\* djay likely half-time-detected BbY WOW (true tempo probably ~120 BPM); treated as 60↔120 equivalent in the transition analysis below.

## Transitions

BPM gaps are normalized for half/double-time (e.g. 149 vs 102 is really a ~2x reggaeton/hip-hop jump). Gap ≤ 6 BPM → beatmatched blend; above that → hard cut (filter sweep + FX, no sync). Camelot distance > 2 on a blend is flagged as a key clash to ride by EQ rather than harmonically.

1. **UP! (D1) → Dark Thoughts (D2)** @ 2:50 — gap 5.0, key dist 4 — BLEND, *key clash, by ear*
2. **Dark Thoughts (D2) → Asta Afta (D1)** @ 4:40 — gap 2.0, key dist 3 — BLEND, *key clash, by ear*
3. **Asta Afta (D1) → U Don't Have to Call (D2)** @ 7:10 — gap 0.0, key dist 3 — BLEND, *key clash, by ear*
4. **U Don't Have to Call (D2) → I'm Sprung (D1)** @ 9:50 — gap 0.0, key dist 1 — BLEND
5. **I'm Sprung (D1) → I Wanna Love You (D2)** @ 12:00 — gap 0.0, key dist 5 — BLEND, *key clash, by ear*
6. **I Wanna Love You (D2) → Finer Things (D1)** @ 14:30 — gap 1.0, key dist 2 — BLEND
7. **Finer Things (D1) → Safaera (D2)** @ 18:43 — gap 26.5, key dist 0 — **HARD CUT**
8. **Safaera (D2) → EoO (D1)** @ 21:03 — gap 47.0, key dist 4 — **HARD CUT**
9. **EoO (D1) → Candy (D2)** @ 24:28 — gap 6.0, key dist 2 — BLEND
10. **Candy (D2) → +57 (D1)** @ 26:28 — gap 4.0, key dist 2 — BLEND
11. **+57 (D1) → Culo (D2)** @ 28:58 — gap 28.0, key dist 2 — **HARD CUT**
12. **Culo (D2) → BbY WOW (D1)** @ 31:28 — gap 0.0, key dist 0 — BLEND
13. **BbY WOW (D1) → DÁKITI (D2)** @ 32:58 — gap 5.0, key dist 1 — BLEND
14. **DÁKITI (D2) → Titanium (D1)** @ 34:58 — gap 16.0, key dist 4 — **HARD CUT**
15. **Titanium (D1) → Don't Wake Me Up (D2)** @ 36:58 — gap 4.0, key dist 0 — BLEND
16. **Don't Wake Me Up (D2) → Promises (Sonny Fodera Remix) (D1)** @ 37:58 — gap 7.0, key dist 3 — **HARD CUT**
17. **Promises (Sonny Fodera Remix) (D1) → Free Your Mind (D2)** @ 41:28 — gap 5.0, key dist 4 — BLEND, *key clash, by ear*
18. **Free Your Mind (D2) → C'Mon (Catch 'Em by Surprise) (D1)** @ 44:50 — gap 2.0, key dist 2 — BLEND
19. **C'Mon (Catch 'Em by Surprise) (D1) → The Wave (D2)** @ 45:50 — gap 2.0, key dist 2 — BLEND
20. **The Wave (D2) → Janice STFU (D1)** @ 47:50 — gap 2.0, key dist 7 — BLEND, *key clash, by ear*
21. **Janice STFU (D1) → Like A G6 (D2)** @ 51:47 — gap 1.0, key dist 6 — BLEND, *key clash, by ear*
22. **Like A G6 (D2) → Lost In The Music (D1)** @ 53:17 — gap 1.0, key dist 0 — BLEND

**Summary:** 16 blends (6 flagged for key clash — EQ/filter-led, not harmonic), 6 hard cuts (filter sweep + FX, no sync).

## Execution plan

Driven in djay Pro via:
- **Track loading:** djay's own UI (right-click row → "Load on Deck N"), alternating decks 1/2 per the table above. The djayctl MIDI bridge's `load_track` is a no-op (not mapped), so every load is a direct UI action.
- **Mixing moves:** `djayctl` over the `Codex Serato Control` IAC MIDI bus — `sync`, `play`, `crossfader`, `low`/EQ, `filter`, `fx` — timed against the start times above.
- **Blend transitions:** sync incoming deck, kill its low end, ramp crossfader over ~15–19s, swap bass at the midpoint, fade filter back in on the outgoing deck, pause it once past the crossfade.
- **Hard cuts:** filter sweep down on the outgoing deck, brief FX, then a direct crossfader cut to the incoming deck (no sync — BPM gap too large to blend).

Safety: `./bin/djayctl emergency_stop` pauses both decks, zeroes volume, and centers the crossfader — used if anything goes wrong mid-run.
