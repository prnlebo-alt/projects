# Portfolio

Four projects, all built in 2026 with Claude Code doing much of the implementation. I set the goals, constraints and acceptance tests, and judged the results.

| Project | What it is | Open it |
|---|---|---|
| [`sling-trash/`](sling-trash/) | Pull-to-launch physics puzzle, 15 levels, single-file canvas game with a level solver and test harnesses | [Play / open](https://prnlebo-alt.github.io/projects/sling-trash/) |
| [`pull-sports/`](pull-sports/) | One reusable drag-and-release input class driving three sports (pitch, bat, golf), with live-tunable sliders | [Play / open](https://prnlebo-alt.github.io/projects/pull-sports/) |
| [`dj-mix-analysis/`](dj-mix-analysis/) | Python pipeline that dissects a DJ mix into tempo blocks, keys, energy arc and transitions | `dj-mix-analysis/report.md` |
| [`fee-calculator/`](fee-calculator/) | In-app-purchase fee savings calculator | [Play / open](https://prnlebo-alt.github.io/projects/fee-calculator/) |

## Other repositories

Snapshots of my other repos live in [`repos/`](repos/) (origin and commit in [`repos/SOURCES.md`](repos/SOURCES.md)):

| Folder | What it is |
|---|---|
| [`chartrelay/`](repos/chartrelay/) | SaaS MVP: JSON to accessible SVG/PNG charts with quality review, accounts, hashed API keys, usage metering and Stripe billing |
| [`claude-code-workspace/`](repos/claude-code-workspace/) | Evidence-first market-intelligence system with a frozen architecture and gated build phases |
| [`skyn/`](repos/skyn/), [`project-plant/`](repos/project-plant/), [`skyn-privacy/`](repos/skyn-privacy/) | Browser extension and web app that applies managed UI skins without reading user input |
| [`streetKing/`](repos/streetKing/) | Unity/C# prototype of a 2.5D arcade handball game |
| [`pug-calculator/`](repos/pug-calculator/) | SwiftUI iOS calculator with an animated mascot and a tested engine |
| [`cosmic-unwind/`](repos/cosmic-unwind/) | Browser arena game |
| [`claude-skillz/`](repos/claude-skillz/) | Third-party skill kept with its license (not my work) |

## What to look at first

1. **Sling Trash** — read `sling-trash/MANIFESTO.md` (design and decisions), then `HARDENED_SPEC.md` (numeric acceptance contract), then play it. `tests/` holds the solver notes, harness, pointer test and the art-judging round log that check every level is winnable.
2. **Evaluation notes** — in Sling Trash, an automated judge agent scored the art well while the owner (me) rejected it as generic. The write-up of that gap is in `MANIFESTO.md`.
3. **DJ mix analysis** — `report.md` plus the scripts that produced it (librosa feature extraction, novelty-based transition detection).

## Running

Open any `index.html` in a browser. No build step. The DJ scripts expect an audio file at `./input/` (not included).

## Not included

Third-party audio, captured game binaries and any contact or lead data are deliberately excluded.
