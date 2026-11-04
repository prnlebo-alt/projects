# ChartRelay — Independent Visual Review

**Reviewer:** independent visual review agent (did not build this)
**Date:** 2026-09-24
**Endpoint:** `https://chartrelay.dev/chart` (live production)
**Images:** 76 renders in `reports/golden/`, of which 55 were opened and looked at individually
**Scope:** rendering only. No source file was modified.

---

## Verdict

The editorial renderer — the **default** style, the one every caller gets unless they opt out —
silently discards negative data. A chart of `-10,-25,-40,-15,-30` comes back as an empty grid with a
y-axis reading "1, 1, 1, 0, 0", HTTP 200, `x-chartrelay-findings: tip:healthy`, and an
`x-chartrelay-alt` header confidently describing a peak and a trough that were never drawn
(`reports/golden/edge-all-negative.png`). Worse than the blank chart is the plausible one: given
`10,25,-40,15,30` the chart renders four healthy bars and simply omits C, so the reader concludes C
had no data rather than that C was -40 (`reports/golden/edge-one-negative-editorial.png`). The same
renderer turns a two-series `type=bar` request into a line chart without a word
(`reports/golden/edge-2-series-bar-editorial.png`), draws all 100 x-axis labels on top of each other
at the schema's own 100-point cap (`reports/golden/edge-100-points-cap.png`), and returns a
zero-byte HTTP 500 — no chart, no error card, nothing — for any title or label containing a
character above U+00FF, which is to say for Japanese, Chinese, Korean, Cyrillic, Greek, Arabic,
emoji, the euro sign, an em-dash, and Polish. The classic renderer, by contrast, draws negatives
correctly and honours `type=bar` (`reports/golden/edge-all-negative-classic.png`,
`reports/golden/edge-2-series-bar-classic.png`); every blocker below is a default-path regression
against a sibling that already gets it right. Escaping, the watermark's placement, the refusal cards
and the arithmetic inside the alt text are all genuinely good and should be protected.

**Counts:** 4 blockers, 11 serious, 11 minor.

---

## Failures

### Blockers

| # | Rubric | Image | What I saw |
|---|---|---|---|
| B1 | Axis honesty / Alt vs image | `reports/golden/edge-all-negative.png` | Data `-10,-25,-40,-15,-30`, editorial, light. **No bars drawn at all.** The plot is empty. The y-axis carries five ticks reading `1, 1, 1, 0, 0` — three identical "1"s and two "0"s for a domain of -40..-10. HTTP 200, findings `tip:healthy`. Same on dark (`edge-all-negative-dark.png`) and as a line (`edge-all-negative-line-editorial.png`). Classic draws it correctly with ticks `0,-10,-20,-30,-40` (`edge-all-negative-classic.png`), so this is editorial-only — and editorial is the default. |
| B2 | Axis honesty / Alt vs image | `reports/golden/edge-one-negative-editorial.png`, `reports/golden/edge-mixed-sign.png` | The silent version of B1, and the more dangerous one. `10,25,-40,15,30` renders four bars with C **missing**; nothing marks C as suppressed, so it reads as "no data for C" rather than "-40". In `edge-mixed-sign.png` (`-40,-10,15,60,-5,30`) three of six bars — Jan, Feb, May — are absent from a chart that otherwise looks finished. On the line variant (`edge-mixed-sign-line.png`) the negative segments are drawn *outside* the plot: the stroke runs down through the "May" x-axis label, obscuring it, and off the bottom edge of the canvas. |
| B3 | Legibility | *(no image — zero-byte response)* | Any `title`, `labels` or `names` value containing a codepoint above U+00FF returns **HTTP 500 with an empty body**: no PNG, no refusal card, no `x-chartrelay-error` header. Confirmed for 日本語, 한국어, العربية, Привет, Ω, 🚀, →, —, Łódź and € (`title=ÿ` U+00FF passes, `title=Ā` U+0100 fails). An `<img src>` in an email or README simply shows a broken image. Fields differ arbitrarily: `subtitle`, `source`, `note`, `prefix` and `suffix` accept the same characters and return 200. |
| B4 | Overlap / Legibility | `reports/golden/edge-100-points-cap.png`, `reports/golden/edge-100-points-bar.png` | At exactly 100 points — the schema's own `max(100)` — all 100 x-axis labels are drawn at full size with no thinning, rotation, or truncation, producing a solid unreadable grey smear across the bottom of the canvas that also runs past the right edge of the plot. Zoomed at `reports/golden/` scale the band resolves to overlapping "P1…P100" fragments and nothing legible. `x-chartrelay-findings` does say `warning:dense-chart`, but the chart still ships. |

### Serious

| # | Rubric | Image | What I saw |
|---|---|---|---|
| S1 | Alt text vs image | `reports/golden/edge-all-negative.png`, `reports/golden/edge-mixed-sign.png` | The alt header is arithmetically correct about the *data* and wrong about the *picture*. For the empty chart it asserts "peaks at -10 for A and bottoms at -40 for C"; for the mixed-sign chart, "bottoms at -40 for Jan" — a bar that is not on the canvas. A screen-reader user is told about marks a sighted user cannot see. This is the failure mode the brief calls worse than no description. |
| S2 | Alt text vs image | `reports/golden/edge-8-series-pie.png` | Eight series were supplied to a pie. Exactly one was drawn (5 slices, Total 110 = series 1). Series 2–8 are discarded with no visual trace. `x-chartrelay-findings` correctly says `error:pie-multiple-series`, yet the route returns **200 and a chart** rather than a refusal card, and the alt text describes only series 1 without mentioning that seven-eighths of the caller's data is gone. |
| S3 | Axis honesty | `reports/golden/edge-2-series-bar-editorial.png`, `reports/golden/edge-8-series-max.png` | `type=bar` with two or more series silently renders a **line chart** in editorial. `x-chartrelay-style: editorial`, findings `tip:healthy`, alt text says nothing. Classic draws real grouped bars for the identical query (`edge-2-series-bar-classic.png`). Lines imply continuity between categories that bars do not; the caller asked for one and got the other with no notice. |
| S4 | Legibility | `reports/golden/edge-subtitle-cjk.png` | `subtitle=売上高の推移` returns 200 and renders as six last-resort glyph boxes printing their own hex codepoints (`58 4E / F2 55 …`), crushed into an overlapping run before the ASCII text. Classic tofu. The same characters in `title` would have 500'd (B3) and in `source` render perfectly (`edge-source-cyrillic.png` shows "Источник: Тест" cleanly), so the font stack is inconsistent field by field. |
| S5 | Overlap / Clipping | `reports/golden/edge-long-labels.png` | Three 50–70-character labels are drawn full-length at full size and collide into unreadable mush ("…intercCustomerytransferston cost blended across paid and…"). The first label is clipped flush at the **left** canvas edge, the third at the right. No wrapping, rotation, ellipsis or thinning. Findings say `tip:long-labels` — a tip, for a chart whose category axis cannot be read. |
| S6 | Overlap | `reports/golden/edge-long-labels-pie.png` | Same data as a pie: the three legend entries overlap each other into a single illegible line, with each legend colour-chip painted on top of the preceding label's text. |
| S7 | Clipping | `reports/golden/grid-line-editorial-light.png`, `grid-line-editorial-dark.png`, `edge-100-points-cap.png`, `edge-note-greek.png`, `edge-huge-canvas.png` | The editorial end-of-line series label is hard-clipped at the right canvas edge with no ellipsis. "Monthly recurring revenue (line)" renders as "Monthly recurring", cut mid-word flush against x=860. Affects every editorial line/area chart whose series name is longer than ~17 characters — i.e. most real ones, because the series name defaults to the title. |
| S8 | Overlap | `reports/golden/edge-8-series-line.png`, `edge-8-series-max.png` | At the renderer's maximum of 8 series, the stacked end labels collide: each series' end **value** (62, 58, 54, 50, 46, 42, 38) is drawn directly under the next series' **name** and struck through by it. Every value except the last ("34") is unreadable, and that last one floats unattached below "Series 1". |
| S9 | Contrast | `reports/golden/grid-pie-editorial-light.png` | White percentage labels (≈11px bold) sit on slice fills at **3.16–3.87:1** — below the 4.5:1 AA threshold for normal-size text. Measured white-on-slice: May green `#00A383` 3.20, Jul salmon `#E17055` 3.16, Sep gold `#B7791F` 3.64, Aug pink `#E84393` 3.71, Jun blue `#0984E3` 3.87. Only Apr purple `#6C5CE7` (4.86) passes. `schema.ts` claims "at least 3:1 … under white pie labels", which is the **non-text** threshold applied to text. |
| S10 | Contrast / Watermark | `reports/golden/grid-bar-editorial-light.png`, `grid-bar-classic-light.png`, `grid-bar-editorial-dark.png` | The watermark fails AA in every theme: editorial light `#A6A4A0` on `#FCFCFB` = **2.42:1**; classic light = 2.46:1; editorial dark = 3.27:1; classic dark = 3.38:1. `watermark.ts` explicitly aims for the mark to survive rasterisation and downscaling in an email client — at 2.42:1 and 11px it will not. Placement is correct (top-right, outside the plot, never over data in any of the 55 images). |
| S11 | Contrast | `reports/golden/grid-bar-editorial-light.png`, `grid-bar-editorial-dark.png` | Editorial light axis text fails AA: y-ticks `#8E8C86` on `#FCFCFB` = **3.28:1**, x-ticks **3.41:1**. Dark passes (4.53 / 4.72). Separately, the muted "context" bars — every bar except the highlighted one, i.e. most of the ink in the figure — sit at **1.54:1** (light) and **1.81:1** (dark) against the surface, under the 3:1 non-text minimum; on `grid-bar-editorial-dark.png` they are close to invisible. |

### Minor

| # | Rubric | Image | What I saw |
|---|---|---|---|
| M1 | Axis honesty | `reports/golden/grid-bar-classic-light.png`, `edge-single-point.png`, `edge-2-series-bar-classic.png` | Tick values are the data range divided in four and then rounded, instead of a nice-number step. Classic shows `0 / 8.5K / 17K / 25.4K / 33.9K` — inconsistent decimal places within one figure. `edge-single-point.png` shows `0 / 13 / 25 / 38 / 50`: the *printed* values step by 13, 12, 13, 12 while the gridlines are geometrically even, so the labels contradict the spacing. `edge-2-series-bar-classic.png`: `0 / 8.8 / 17.5 / 26.3 / 35`. |
| M2 | Axis honesty | `reports/golden/edge-all-zeros.png`, `edge-single-zero.png` | A constant-zero series produces the same degenerate axis as B1: five ticks reading `1, 1, 1, 0, 0`. Zero-height bars are defensible; an axis that prints "1" three times is not. |
| M3 | Axis honesty | `reports/golden/edge-huge-vs-tiny.png` | The highlighted value label reads **"0M"** for a point whose actual value is 2. The magnitude formatter rounds the label to the axis unit and prints a real value as zero. (The axis itself is correct here: `0 / 2.5M / 5M / 7.5M / 10M`.) |
| M4 | Overlap / Alt vs image | `reports/golden/edge-huge-vs-tiny-pie.png` | The three sliver slices' "0%" labels stack on the same spot at the top of the pie, landing **inside the green 100% slice** — the visible result is a solid green pie annotated "0%" at the top and "100%" at the bottom. |
| M5 | Axis honesty | `reports/golden/grid-pie-editorial-light.png` | Slice percentages read 12+14+16+17+20+22 = **101%**. Independent rounding with no largest-remainder correction. |
| M6 | Alt text vs image | `reports/golden/edge-all-zeros-pie.png` | Nothing is drawn (correct for a zero total, just "Total 0" and a legend), but the alt text claims "Pie chart … across 4 categories. Largest: A 0%, B 0%, C 0%. Smallest: D 0%" — a ranking of an empty figure. Findings say `tip:healthy`. |
| M7 | Alt text vs image | `reports/golden/edge-mixed-sign.png`, `edge-all-negative.png` | Percent change is computed across a sign change and against a negative base: "-40 → 30" is reported as "increased 175.0%", and "-10 → -30" as "decreased 200.0%". Both are arithmetically defensible and editorially meaningless. |
| M8 | Clipping / spec fidelity | `reports/golden/edge-tiny-canvas.png`, `edge-huge-canvas.png` | `w` and `h` are silently ignored by editorial: `w=320&h=240` and `w=2400&h=1600` both produce 860×480. Classic honours them. Two charts on one page will also not match — editorial emits 860×480 while area/pie/scatter fall back to classic at 900×520. |
| M9 | Legibility | `reports/golden/edge-title-118-near-schema-max.png` | A 118-character title — inside the schema's documented `max(120)` — is refused, and the card blames **`series.0.name: Too big: expected string to have <=80 characters`**, a field the caller never supplied. The title is copied into the series name when `names` is absent, so the real title limit is 80; passing `names=Revenue` makes the same 118-char title render fine (`edge-title-118-with-names.png`). |
| M10 | Overlap | `reports/golden/edge-note-greek.png` | The annotation "σ spike here" is struck through by the 3px series line, which cuts across the final "e" and the baseline of "here". No halo or collision avoidance. |
| M11 | spec fidelity | `reports/golden/edge-prefix-suffix.png`, `edge-values-shown.png`, `edge-prefix-suffix-classic.png`, `edge-focus-note-bar.png` | Chrome parameters are accepted and then dropped, differently per renderer. `suffix` is ignored by **both** styles (no " MRR" anywhere). `values=1` is ignored by editorial, honoured by classic. `prefix` is honoured by editorial ("$30K"), ignored by classic. `note` renders on line charts but is silently dropped on bar charts (`edge-focus-note-bar.png` has no annotation at all). All return 200 with `tip:healthy`. |

---

## Correct, and worth not breaking

Each of these was verified by opening the image, not inferred from code.

- **XML/HTML escaping is airtight.** `&`, `<b>bold</b>`, `>`, `"` and `'` render as literal text in both titles and labels, and `&amp;` round-trips as the five characters the caller typed — `edge-xml-title.png`, `edge-xml-labels.png`, `edge-xml-both.png`. A `<script>` label is drawn as text. No escaping artefacts anywhere.
- **Watermark placement.** Present, top-right, above the plot, never overlapping a mark or a label in any of the 55 images — including the 100-point charts where the plot fills the canvas. Only its contrast is wrong (S10), not its position.
- **Refusal cards.** `refusal-9-series.png` and `refusal-101-points.png` are clear, unclipped, and point at `chartrelay.dev/docs#url`. The 101-point message ("expected array to have <=100 items") and the 9-series message ("Fold the smallest into 'Other', or draw small multiples") are both actionable. The wrong-field problem in M9 is the exception, not the pattern.
- **Alt-text arithmetic.** Where the picture and the data agree, the numbers are exact. I recomputed the 100-point series independently: max 2394 at P86, min 397 at P29, first→last +12.4% — the header matches to the digit (`edge-100-points-cap.png`). The failures in S1/S2/M6 are about *what got drawn*, not about the statistics.
- **Missing title is handled honestly.** `edge-no-title.png` draws "Untitled chart" and emits `warning:missing-title` rather than silently leaving a blank — and gets a clean `0/10/20/30/40` axis.
- **Classic is the sane renderer for hard data.** Negatives (`edge-all-negative-classic.png`), grouped bars (`edge-2-series-bar-classic.png`) and per-bar value labels (`edge-prefix-suffix-classic.png`) all draw correctly. Whatever fixes editorial should be measured against these.
- **Editorial's default look is genuinely good on the happy path.** `grid-bar-editorial-light.png` is a clean chart: zero-based axis, round ticks, one highlighted bar with its value, everything inside the frame. Dark-mode tick contrast passes AA at 4.53:1. This is worth protecting while the edge cases get fixed.
- **Fallback is declared, not hidden.** `area`, `pie` and `scatter` fall back from editorial to classic and say so in `x-chartrelay-style: classic`; I confirmed the editorial and classic renders are byte-identical by SHA-256 for all three types in both themes. That is the right way to do a fallback — and the contrast with the undeclared bar→line substitution in S3 is instructive.

---

## Not tested, and why

- **`format=svg`.** Every render in this set is PNG. The rubric is about what a reader sees in an `<img>`, and the raster path is where the "blank boxes" class of bug lives. Vector-specific issues (font embedding, `textLength`, clip paths) are untested.
- **The classic renderer's full cross-product.** I rendered classic for all five types in both themes, but only viewed classic images where they were diagnostic (bar/line grid, negatives, grouped bars, values). Area/pie/scatter classic were proven byte-identical to their editorial counterparts by hash rather than opened twice.
- **The `spec=` base64url escape hatch.** Everything here used the readable querystring form. Per-series `color`, and series with differing label sets, are only expressible via `spec=` and were not exercised — so custom-colour contrast is unmeasured.
- **`POST /api/v1/charts` and `allowQualityErrors`.** The QA severity gate that would have refused the 8-series pie (S2) only applies on that route. I reviewed the GET `/chart` path the brief named. The interaction between the two is untested.
- **Authenticated rendering.** No `key` was supplied, so every image carries the free-tier watermark. Whether removing the mark reflows the layout — and whether anything currently hidden behind it appears — is untested.
- **Rendering fidelity in real clients.** Contrast figures are computed from the PNG pixels I sampled with a standard WCAG relative-luminance formula. I did not open these in Gmail, Outlook, Slack or a README, so claims about downscaling survivability (S10) are inference from size and measured contrast, not observation.
- **Sizes between 320×240 and 2400×1600 in classic.** Editorial ignores `w`/`h` entirely (M8), so I stopped after establishing that; classic's behaviour across the range is unmeasured.
- **Timing, caching, rate limits, and the 8 KB query ceiling.** Out of scope for a visual review. The 100-point cap was found from `schema.ts` and confirmed at the boundary; `MAX_QUERY_BYTES` was not probed.
- **Exact codepoint boundary of the 500.** I bisected to between U+00FF (passes) and U+0100 (fails) and confirmed ten scripts on the failing side. I did not determine whether the cause is the font subset, an encoding step, or the rasteriser.

---

# Re-check — B1 / B2 (negative values), 2026-09-24

**Verdict: B1, B2, S1 and M2 are fixed. M1 is fixed for editorial. No regression on positive-only
charts. One pre-existing defect survives and is now the most visible thing left in this area.**

## Important: the fix is not deployed

`https://chartrelay.dev` is still serving the old build. A never-before-requested URL
(cache-busted with a novel query param, fresh `x-railway-request-id`, so not a CDN hit) returned
bytes **SHA-256-identical** to the broken pre-fix renders for all-negative, one-negative, mixed-sign
and the positive control. The change is present in the working tree — `src/lib/charts/editorial.ts`
is modified and uncommitted, containing `linearScale`, `niceStep`, `zeroY` and the `down` flag — but
it is not live. **Everything below was verified against `next dev` on localhost:3000 running that
working tree**, not against production. Production still exhibits every symptom in B1/B2.

## Answers to the four questions

**1. Is every bar drawn, and is a negative bar proportional to its value measured from zero? — Yes.**
`reports/golden/fix-all-negative-bar-light.png`: all five bars present, hanging from a zero line at
y=118. Measured bar heights are 76 / 190 / 306 / 114 / 229 px for −10 / −25 / −40 / −15 / −30. The
−40 bar is 306px, so the scale is 7.65 px/unit; expected lengths are 76.5 / 191.25 / 306 / 114.75 /
229.5. Every bar is within 1px of proportional, and every bar starts at exactly y=118. Confirmed in
both themes (`fix-all-negative-bar-dark.png`). `fix-one-negative-bar-light.png` draws C at −40 below
a baseline-coloured zero line with positives above it; `fix-mixed-sign-bar-light.png` draws all six
bars including May at −5.

**2. Does anything overprint the x-axis labels or leave the canvas on the mixed-sign line? — No.**
Measured rather than eyeballed: counting series-coloured pixels in the label band (y≥430) and on the
last two rows of the canvas gives **0 and 0** for `fix-mixed-sign-line-light.png`,
`fix-mixed-sign-line-dark.png`, `fix-all-negative-line-light.png` and `fix-all-negative-line-dark.png`.
The same count on the pre-fix `edge-mixed-sign-line.png` is **226** in the label band and **6** on the
bottom edge. The series now stays inside the plot in every case.

**3. Are the tick labels free of the repeated-value problem? — In the cases you asked about, yes.
In general, no.** Clean and evenly spaced for: all-negative `0/−10/−20/−30/−40`; one-negative
`40/20/0/−20/−40`; mixed-sign `75/50/25/0/−25/−50`; all-zeros `0/1` (M2 fixed); positive
`0/10K/20K/30K/40K`. `niceStep` also fixes M1 for editorial as a bonus — `fix-ticks-single-point.png`
now reads `0/20/40/60` where it used to read `0/13/25/38/50`. **But see R1 below:** any domain whose
nice step falls below 1 reproduces the exact repeated-tick symptom.

**4. Did positive-only charts get worse? — No.** Bar geometry is pixel-identical: tracing the Sep
column, the blue bar begins at y=165 and the baseline sits at y=423 in both the pre-fix production
render and the post-fix local render, and all six bar tops match exactly (283/261/235/218/186/165).
A whole-image diff shows 0.865% of pixels differing, entirely confined to text rows (title, ticks,
x-labels, watermark) with none in the bar bodies. That residue is environmental, not a regression:
the control — a pie chart, which falls back to the classic renderer and whose code path this change
did not touch — diffs **1.100%** between the same two environments, i.e. more than the chart that
actually changed. Local-vs-production font rasterization accounts for all of it.

## New finding

| # | Severity | Rubric | Image | What I saw |
|---|---|---|---|---|
| R1 | Serious | Axis honesty | `reports/golden/fix-ticks-tiny-negative.png`, `fix-ticks-frac-positive.png` | The repeated-tick problem is not gone, it has moved to fractional domains. `-0.3,-0.7,-0.45` produces five ticks reading **`-0, -0, -0, -1, -1`**, and the focus label reads **`-0`** for a value of −0.45. `0.3,0.7,0.45` produces **`1, 1, 0, 0, 0`** with a focus label of `0` for 0.45. The *scale* is correct — bars are proportional and the domain snaps to 0..1 in steps of 0.25 — so this is the **tick formatter**, which rounds to integers before printing and cannot render a step below 1. It also emits a negative zero (`-0`). **This is pre-existing, not a regression:** production renders the identical `1,1,0,0,0` for the same data (`reports/golden/prod-ticks-frac-positive-prefix.png`). But it now matters more, because it is the same visible symptom you just fixed everywhere else, and it will hit any percentage, rate, ratio or conversion-funnel chart — which is a large share of what this product is for. |

## Confirmed, not assumed: the alt text

You were right not to touch it, and it is now correct about the picture. I checked each header
against the image I opened:

- `fix-all-negative-bar-light.png` — "peaks at −10 for A and bottoms at −40 for C": A is the
  shortest bar, C the longest. Both are drawn. Correct.
- `fix-one-negative-bar-light.png` — "peaks at 30 for E and bottoms at −40 for C": E is the tallest
  bar above zero, C the deepest below it. Correct.
- `fix-mixed-sign-bar-light.png` — "peaks at 60 for Apr and bottoms at −40 for Jan": both drawn,
  both extremal. Correct.
- `fix-all-zeros-bar-light.png` — "stays flat at 0 across all 5 points": correct, and the axis now
  agrees with the sentence instead of contradicting it.

**S1 is resolved as a consequence of the render fix, with no change to the alt generator.** The
statistics were always right; the picture caught up.

One caveat, unchanged and still open from the original report (M7): percent change is still computed
across a sign change and against a negative base. `fix-mixed-sign-bar-light.png` carries "It
increased 175.0% from first to last point" for −40 → 30, and `fix-all-negative-bar-light.png` says
"decreased 200.0%" for −10 → −30. Both are arithmetically defensible and editorially meaningless,
and negative bases are now much more likely to reach a reader, because negative charts finally
render.

## Your judgement call on the x-axis labels

**Keep them at the foot. Your call was right, and the images support it.** Three reasons from what I
looked at. First, on `fix-mixed-sign-bar-light.png` the zero line sits at roughly 60% of the plot
height; labels on it would land between Jan's and Feb's descending bars and read as annotations on
those bars rather than as the category axis. Second, the position would move with the data — foot of
the plot for all-positive, mid-chart for mixed, top for all-negative
(`fix-all-negative-bar-light.png`, where zero is the top gridline and labels there would collide with
the title block). A category axis that relocates between two charts on the same page is worse than
one that is occasionally far from its bars. Third, the zero line is already doing a job: it is
painted in the baseline colour and is visibly heavier than the gridlines, which is what makes the
sign of each bar readable at a glance. Putting text on it would blunt exactly the signal the fix
just added. The only cost is a long gap between a short negative bar and its label
(`fix-one-negative-bar-light.png`, bar C), and that is much the smaller problem.

## S3 — correction, and which problem to fix

**My report was wrong on the facts and I withdraw that wording.** `x-chartrelay-note` is present on
multi-series bar requests and says exactly what you quoted; I verified it against production. I
missed it because my capture script recorded only `x-chartrelay-alt`, `-findings` and `-style`, so
the header never reached my notes. My error, not a reporting gap on your side.

**On which problem to fix: mark the substitution in the figure. Do not refuse.**

Refusing is the wrong trade here. The caller who writes `type=bar` with three series has a real
chart they want; a refusal card gives them nothing and pushes them to `style=classic`, which draws
grouped bars correctly today — so the refusal is not a safety measure, it is a redirect away from
your better renderer. And your note text already concedes the substitution is deliberate and
defensible ("so that a single bar can hold the argument"). You do not refuse things you believe are
right.

The actual defect is the one you named: the figure is the only artifact that survives the trip to an
`<img src>`, and it currently carries no trace of the decision. Everything I checked confirms the
figure is the only durable channel — headers vanish, and the alt text for
`edge-2-series-bar-editorial.png` says "1 more series shown" without ever saying "as lines".
A short subtitle or eyebrow line in the figure itself — the same slot the "Total 156.4K" caption
occupies on pies, which renders legibly in every pie I opened — would put the substitution where the
reader is. You already have the precedent and the layout slot for it.

Worth noting the contrast with your own best practice: the area/pie/scatter editorial-to-classic
fallback is declared in `x-chartrelay-style`, and I confirmed by SHA-256 that those renders are
byte-identical to classic. That fallback is invisible in the figure too — but it is invisible because
nothing about the picture misleads. The bar-to-line case is different in kind, because lines assert
continuity between categories that bars do not. That assertion is made in the ink, so the correction
belongs in the ink.

## Re-check scope

Rendered locally and opened: all-negative bar and line, one-negative bar, mixed-sign bar and line,
all-zeros bar, positive regression bar — each in both themes (14 images, `fix-*.png`), plus four
tick-quality probes (`fix-ticks-*.png`) and one production control
(`prod-ticks-frac-positive-prefix.png`). Not re-tested: everything outside the negative-value change —
the U+0100 500 (B3), the 100-point label overplot (B4), long labels, the pie multi-series drop, and
all contrast measurements. None of those code paths were touched, and none were re-verified.
No source file was edited by me; `src/lib/charts/editorial.ts` remains modified by you and uncommitted.

---

# Re-check 2 — deployed build, commit b05a4a4, 2026-09-24

**Verdict: on production, B1, B2, R1, S1 and M1-for-editorial are all genuinely gone, and the
positive path is byte-for-byte unchanged. The rounding change did not break anything I could find —
but it fixed one of three number formatters, and the two it left behind now produce the same class
of defect it was written to remove. The case you asked me to hunt for is real and I reproduced it.**

## Deploy confirmed live

Production was still on the old build for the first three polls (SHA-256 `4d039859a41c026e`,
identical to the broken pre-fix bytes). On the fourth it changed. Every render below was fetched
from `chartrelay.dev` with a unique cache-busting parameter, so none of it can be a cached response.
Local tree is clean at `b05a4a4` and matches.

## 1. B1, B2 and R1 on the deployed build — all confirmed gone

- **B1** `reports/golden/prod-b1-all-negative-bar.png`: all five bars drawn, every one starting at
  y=118. Measured heights 76 / 190 / 305 / 114 / 228 px for −10 / −25 / −40 / −15 / −30 against a
  scale of 7.625 px per unit — expected 76.2 / 190.6 / 305 / 114.4 / 228.8. Every bar proportional
  within 1px. Confirmed in dark (`prod-b1-all-negative-bar-dark.png`) and as a line
  (`prod-b1-all-negative-line.png`).
- **B2** `prod-b2-one-negative-bar.png` and `prod-b2-mixed-sign-bar.png`: no bar is missing; C at −40
  and Jan/Feb/May all render below a baseline-coloured zero line.
- **B2 (line)** `prod-b2-mixed-sign-line.png`: series-coloured pixels in the x-label band = **0**,
  on the last two canvas rows = **0**. The pre-fix render scores 226 and 6 on the same test.
- **R1** `prod-r1-frac-negative.png`: ticks `0 / −0.2 / −0.4 / −0.6 / −0.8`, focus label `−0.45`, no
  negative zero. Exactly as you described. `prod-r1-frac-positive.png` likewise.

## 2. The case you asked me to hunt for — confirmed, and it is the one you guessed

| # | Severity | Rubric | Image | What I saw |
|---|---|---|---|---|
| R2 | Serious | Axis honesty | `reports/golden/hunt-tiny-below-cap.png` | Data `0.00001, 0.00002, 0.000015`. The bars are drawn correctly and proportionally, and **all four y-axis ticks read `0`** — four identical zeros at four different heights — with a focus label of `0`. A reader sees a clear trend over an axis that says nothing happened. This is the pre-R1 defect in its purest form: not "1,1,0,0,0" but "0,0,0,0". The boundary is exactly where you predicted: `hunt-tiny-sub-cap-2.png` (`0.0001/0.0003/0.0002`) is **perfect** — `0 / 0.0001 / 0.0002 / 0.0003` — because four decimals suffice. One decade smaller and the whole axis collapses. Real money at fractions of a cent, per-unit API pricing, and failure rates all live here. |

`hunt-needs-5-decimals.png` (`0.000123456…`) is the softer version: the axis is correct
(`0 / 0.0001 / … / 0.0004`) but the focus label reads `0.0003` for a bar visibly sitting above the
0.0003 gridline at ~0.000345. Same family as M3, much milder.

## 3. What got worse, and what did not

**Nothing got worse. I can put a hash on that.** The canonical positive editorial chart, fetched
from the same production host before and after the change, is **byte-identical**:
`grid-bar-editorial-light.png` and `confirm-m1-editorial-awkward.png` both hash to `7f2923f380e5669a`.
That is a stronger result than the 0.865% local diff I reported last round, and it retires that
caveat: the happy path did not move at all. The classic renderer is byte-identical too
(`edge-all-negative-classic.png` = `confirm-m1-classic-negative.png` = `e8033b3dd4e98bd4`),
confirming it was untouched.

Spot checks across the blast radius all came back clean: integers stay integers
(`hunt-integers-unchanged.png`, `0/10/20/30/40`, no spurious `.0`); currency keeps its cents on the
value while the axis stays whole (`hunt-currency-cents.png`, axis `$0…$4`, focus `$2.25`);
sub-10K decimals print in full (`hunt-large-with-decimal.png`, focus `3,456.7`); an exact zero among
negatives draws no bar and keeps its category label (`hunt-zero-among-negatives.png`).

**But two formatters did not get the fix, and both now show the defect it was written to remove.**

| # | Severity | Rubric | Image | What I saw |
|---|---|---|---|---|
| R3 | Serious | Alt text vs image | `reports/golden/hunt-tiny-mixed-sign.png`, `hunt-tiny-sub-cap-2.png` | **The alt-text formatter was not updated, so the figure and its description now disagree — in the opposite direction from S1.** On `hunt-tiny-mixed-sign.png` the picture is flawless (ticks `0.0075 … −0.005`, focus `−0.002`, every bar drawn) while its `x-chartrelay-alt` reads "peaks at **0.01** for B and bottoms at **−0** for A" — B is 0.006, A is −0.004, and `−0` is the exact negative zero `fixed()` was written to prevent, reproduced on three separate datasets. I measured the boundary by sweeping magnitudes: the alt text rounds to **two** decimals, so it collapses to "0" below 0.005 while the axis stays correct down to 0.0001. `hunt-tiny-sub-cap-2.png` is the clean demonstration — axis reads `0.0001/0.0002/0.0003`, alt says "peaks at 0 for B and bottoms at 0 for A". Before this change the statistics were right and the picture was wrong; for small numbers it is now the other way round. |
| R4 | Serious | Axis honesty | `reports/golden/hunt-mixed-magnitude.png`, `hunt-unit-boundary-1B.png` | **The compaction path ignores the new `step`.** Source confirms it: the `max >= 10_000` branch of `makeFormat` hardcodes `fixed(v / divisor, 1)` and never consults `decimalsFor`. So on a 0…1M axis the ticks print `0 / 0.3M / 0.5M / 0.8M / 1M` for true values 0 / **250,000** / 500,000 / **750,000** / 1,000,000 — two of four mislabelled, and as printed the values step 0.3, 0.2, 0.3, 0.2 while the gridlines are evenly spaced. Identical at the next unit up: `0 / 0.3B / 0.5B / 0.8B / 1B` for 250M and 750M. It bites whenever `niceStep` picks its 2.5 option at the decade below the divisor. **M3 is still live in the same branch**: `hunt-mixed-magnitude.png` labels a value of 2.5 as **`0M`**. This is pre-existing rather than a regression — but it is now the only formatter still rounding blind, and it covers every chart at or above 10K, which is most business data. |

## 4. Side effects you asked me to confirm rather than take on trust

- **S1 — gone, confirmed on production.** `prod-b1-all-negative-bar.png` alt says "peaks at −10 for
  A and bottoms at −40 for C"; A is the shortest bar and C the longest, both drawn. Same for
  `prod-b2-one-negative-bar.png` and `prod-b2-mixed-sign-bar.png`. The alt generator was not touched
  and did not need to be — for these charts. See R3 for where it now fails instead.
- **M1 for editorial — gone, confirmed.** `confirm-m1-editorial-single.png` reads `0 / 20 / 40 / 60`;
  the pre-fix render of the same query read `0 / 13 / 25 / 38 / 50`.
- **M1 for classic — still open, exactly as you said.** `confirm-m1-classic-still-open.png` reads
  `0 / 8.5K / 17K / 25.4K / 33.9K`. Unchanged and real.
- **M7 — still open and now easier to reach.** With negatives rendering, negative bases are common:
  one probe returned "increased **20100.0%**" for −0.001 → 0.2. Percent change across a sign change
  remains arithmetic without meaning.

## Observation, not a finding

Two transient `502`s across roughly 130 production requests in this session (one on a long title
last round, one on `hunt-unit-boundary-1B`), both of which succeeded on immediate retry with
identical bytes three times running. Infrastructure, not the renderer — noting it only because I hit
it twice.

## Re-check 2 scope

Opened on the deployed build: all-negative bar (light and dark) and line, one-negative bar,
mixed-sign bar and line, both fractional R1 cases, eleven rounding probes, three unit-boundary
probes, and four side-effect confirmations. Plus two magnitude sweeps read from headers rather than
images. **Not re-tested:** B3 (the U+0100 500), B4 (100-point label overplot), long labels, the pie
multi-series drop, S3, and all contrast measurements — none of those code paths were touched.
No source file was edited by me; the working tree is clean at `b05a4a4`.

---

# Re-check 3 — deployed build, commits fbb219c + 688b3fc, 2026-09-24

**Verdict: all four confirmed fixed on production, and the happy path did not move — 8 of 10
ASCII baselines are byte-identical and the 2 that differ are your intended tick change. Your
font-metrics worry is disproved. But your instinct about the font test was right for a different
reason than you expected: it proved the three families you installed and nothing else, and five
scripts still render as hex boxes — now silently, at HTTP 200, where they used to fail loudly.**

Deploy verified by bytes first, as before: production served the old build for six polls and
changed on the seventh. Local clean at `688b3fc`. Every render below carries a unique
cache-busting parameter.

## 1. The happy path did not move — and that answers your font-metrics question

`grid-bar-editorial-light.png` still hashes to **`7f2923f380e5669a`**, unchanged across every
round. I widened it to ten ASCII baselines spanning both renderers, all five chart types and both
themes:

| result | baselines |
|---|---|
| **byte-identical** | editorial bar (light + dark), editorial line, editorial scatter, editorial pie, classic bar, untitled bar, classic bar (2nd query) — **8 of 10** |
| differ, intended | `edge-single-point.png` (`0/13/25/38/50` → `0/20/40/60`) and `edge-xml-title.png` (`0/8/15/23/30` → `0/10/20/30`) — both are the M1 tick fix from the previous round against a pre-M1 baseline |

I opened `v3-xml-title.png` to be sure the second one was the tick change and not a metrics shift:
the title's ASCII and punctuation are pixel-unchanged, only the gridline values moved.
**If "Noto Sans CJK SC" were resolving ahead of Liberation Sans for ASCII, none of those eight
hashes could survive** — every glyph advance would differ. They did survive. Latin metrics are
untouched in both renderers.

## 2. Tiny values, R4 and R3 — all confirmed

- **Tiny values** `v3-tiny-below-cap.png`: ticks `0 / 0.00001 / 0.00002 / 0.00003`, focus
  `0.000015`. Exactly as you described. I pushed two decades further —
  `v3-tiny-extreme.png` (`0.0000001…`) reads `0 / 0.00000005 / 0.0000001 / 0.00000015 / 0.0000002`
  with focus `0.00000015`. The cap is genuinely gone, not merely moved.
- **R4** `v3-r4-million-boundary.png` reads `0 / 0.25M / 0.5M / 0.75M / 1M`;
  `v3-r4-billion-boundary.png` reads `0 / 0.25B / 0.5B / 0.75B / 1B`. Both were the mislabelled
  `0.3M / 0.8M` case. Correct and evenly spaced as printed.
- **M3** `v3-r4-m3-huge-vs-tiny.png`: the value of 2 beside 10,000,000 now prints **`2`**, not `0M`.
- **R3** `v3-tiny-mixed-sign.png`: the figure is right (ticks `0.0075 … −0.005`, focus `−0.002`)
  **and** its `x-chartrelay-alt` now reads "peaks at 0.006 … bottoms at −0.004". No negative zero,
  no collapse to 0. The three formatters agree. S1's inverse is closed.

## 3. Your mixed-unit decision — the principle is right, the scope is too wide

**Short answer: "2" beside "10M" does not read as a bug. "900K" beside "10M" does.**

On `v3-r4-m3-huge-vs-tiny.png` the unit-less `2` sits above a bar of no visible height on an axis
labelled in M. It reads correctly, because the *absence* of a suffix is doing the disambiguating
work — a bare number next to M-suffixed ticks reads as a raw quantity, and the flat bar confirms it.
You are right that restating a real number as zero is the worse failure. Keep that.

But the rule is not scoped to the case that motivated it. It fires on any value smaller than the
chart's unit, not only on values that would round to zero:

| # | Severity | Rubric | Image | What I saw |
|---|---|---|---|---|
| V2 | Serious | Axis honesty | `reports/golden/v3-unit-scope-900k.png`, `v3-unit-scope-ladder.png` | A value of **900,000 prints as `900K`** on a chart whose axis is `0 / 2.5M / 5M / 7.5M / 10M` — even though `0.9M` is exactly representable and the bar is a clearly visible 9% of the axis. The figure carries **`10M`, `900K`, `400K`, `3M`** over an all-M axis. `v3-unit-scope-ladder.png` shows the threshold precisely: 1,000,000 prints `1M` but 900,000 would print `900K`, so two quantities 11% apart print in two different units. Reading `900K` against `3M` now requires a mental conversion, and the bare digits (900 vs 3) suggest the opposite ordering at a glance. **This is the "$34K beside $33.9K" defect your own file argues against, one decade up.** The M3 case never needed this much reach: scoping the own-scale rule to values that would otherwise round to zero in the chart's unit keeps the lie fixed and the inconsistency out. |

## 4. S4 — checked directly on the subtitle path, fixed

I did not infer this from the title. `v3-font-subtitle-cjk.png`, subtitle `売上高の推移 CJK subtitle`,
zoomed: real glyphs, correctly spaced, sitting cleanly beside the ASCII run. The original render of
the identical query produced six last-resort boxes printing their own hex codepoints. Gone.

## 5. What the font change missed

Your worry was that a wrong family name would still render via fontconfig fallback and your test
would pass while proving nothing. That is close to what happened — not because a name is wrong, but
because the test only covered the three families you installed.

| # | Severity | Rubric | Image | What I saw |
|---|---|---|---|---|
| V1 | Serious | Legibility | `reports/golden/v3-script-Thai.png`, `v3-script-Devanagari.png`, `v3-script-Bengali.png`, `v3-script-Tamil.png`, `v3-script-Ethiopic.png` | I swept twelve scripts beyond the three you installed. Seven render correctly — Hebrew, Georgian, Armenian, Traditional Chinese, Vietnamese, Greek, Cyrillic. **Five render as hex-box tofu: Thai, Devanagari, Bengali, Tamil, Ethiopic.** All five return **HTTP 200**, so the failure is now silent where it used to be a loud 500. Devanagari alone covers Hindi and Marathi. `font-noto-cjk` / `-arabic` / `-emoji` cover exactly what they say; the Indic, Thai and Ethiopic ranges have no font behind them. |
| V3 | Minor | Legibility | `reports/golden/v3-font-emoji-labels.png` | Emoji render as **monochrome silhouettes**, not colour. I measured the label region: maximum channel spread 8/255, and 1/255 in the title — effectively greyscale. `font-noto-emoji` is the outline variant; `font-noto-color-emoji` is the colour one. A rocket reads as a grey shape and the 📊 in the title is a faint thin mark. Not broken — no tofu, no 500 — but a caller putting 🎉 in a label is doing it for the colour. |

Everything else in the font change checks out, verified by opening and zooming: CJK and Korean
render cleanly (`v3-font-title-cjk.png`); **Arabic is genuinely shaped and joined with correct RTL
order**, not isolated letterforms (`v3-font-arabic.png`, title and all four category labels);
combining accents compose (`v3-font-combining.png` — `Café Naïve Sůrd`, `Noürdström`); per-character
fallback works mid-string (`v3-font-mixed-scripts.png` mixes Latin, CJK, emoji and Arabic in one
title); and the **classic renderer gets the fonts too** (`v3-font-cjk-classic.png`), which the
commit message did not claim and is worth knowing.

## 6. Two things about the description that the font fix exposed

| # | Severity | Rubric | Evidence | What I saw |
|---|---|---|---|---|
| V4 | Minor | Alt text vs image | headers on `v3-font-title-cjk` and a `Café` control | Any non-ASCII in the alt text makes the **whole header percent-encoded**, signalled by a companion `x-chartrelay-encoded: x-chartrelay-alt`. It is deliberate, lossless and signalled, which is better than I first assumed. Two caveats. It reinvents **RFC 8187**, which exists for exactly this (`x-chartrelay-alt*=UTF-8''%E5%A3%B2%E4%B8%8A`) and which HTTP libraries already decode — a bespoke scheme means every consumer needs custom logic. And the encoding catches the literal percent sign in your own generated sentence, so an undecoding consumer reads "It increased **200.0%25**". A title of `Café revenue` — previously served fine, since it is inside Latin-1 — now yields `Caf%C3%A9 revenue`, so this is a quiet behaviour change for existing Western-European callers, not only for new ones. |
| V5 | Minor (pre-existing) | Alt text vs image | `format=svg` output | The SVG carries `role="img"` and **no `<title>`, `<desc>` or `aria-label`**. The generated description lives only in a response header — which a browser never exposes to an `<img src>`, the product's flagship use case. So in an email or a README the chart is announced as an unnamed image, and `role="img"` without an accessible name is worse than no role at all. Not caused by this change; surfaced by it, because the description is now correct for every language and still cannot reach the reader. |

## As instructed, not reported as new

M1 in the classic renderer (`v3-font-cjk-classic.png` shows `0 / 85 / 170 / 255 / 340`) and M7
(percent change across a sign change) are both still live and both left open on purpose.

## Re-check 3 scope

Opened: 10 hash baselines, 19 font and formatter renders, 4 unit-clash probes, and a 12-script
contact sheet. **Not re-tested:** B4 (100-point label overplot), S3, S5 (long-label overlap), S7
(end-label clipping, still visible in `v3-font-mixed-scripts.png`), the pie multi-series drop, and
all contrast measurements. RTL *layout* mirroring — whether an Arabic chart should order categories
right-to-left — was not assessed; only shaping and joining were, which is all the commit claimed.
No source file was edited by me; the tree is clean at `688b3fc`.

---

# Correction to V2 — 2026-09-24

**V2 as filed is wrong and I withdraw it. You are right on every point.**

I recovered the exact parameters I sent. Both renders that produced the finding carried
`style=classic` **and** `values=1`:

```
https://chartrelay.dev/chart?type=bar
  &data=10000000,900000,400000,3000000
  &labels=Ten+million,Nine+hundred+k,Four+hundred+k,Three+million
  &title=Is+900k+printed+as+0.9M+or+900K
  &style=classic&values=1&format=png
```

`v3-unit-scope-ladder.png` was the same: `style=classic&values=1`. So the `900K` I measured was a
**value label in the classic renderer**, never an axis tick, and never the editorial renderer. Your
hypothesis was exactly right, including the file and mechanism.

## The isolation, four cells, one variable at a time

I rendered the same data across renderer × `values` on the deployed build:

| image | renderer | `values` | axis | value labels |
|---|---|---|---|---|
| `reports/golden/v4-cellA-editorial-novalues.png` | editorial | off | `0 / 2.5M / 5M / 7.5M / 10M` | none |
| `reports/golden/v4-cellB-editorial-focus-on-900k.png` | editorial | off, `focus=1` | `0 / 2.5M / 5M / 7.5M / 10M` | **`0.9M`** |
| `reports/golden/v4-cellC-editorial-values1.png` | editorial | on (ignored) | `0 / 2.5M / 5M / 7.5M / 10M` | focus only |
| `reports/golden/v4-cellD-classic-novalues.png` | classic | off | `0 / 2.5M / 5M / 7.5M / 10M` | none |
| `reports/golden/v4-cellE-classic-values1.png` | classic | **on** | `0 / 2.5M / 5M / 7.5M / 10M` | **`10M`, `900K`, `400K`, `3M`** |

**Exactly one cell of five produces `900K`, and it is the one you predicted.** Cell B is the decisive
one: editorial, focused directly on the 900,000 bar, prints **`0.9M`**. Your `collapsesToZero` rule
never fires for 900,000, precisely as you said. The axis is `0 / 2.5M / 5M / 7.5M / 10M` in all five
cells — there is no K anywhere in the editorial renderer, at any tick, under any parameter I tried.

My ladder observation was worthless as evidence, for the reason you gave: `1,000,000 → 1M` is what
you get when the rule *never* fires, not when it fires inconsistently. I read a consistent result as
a threshold. And I attributed a pre-existing classic-renderer defect to the commit I was reviewing,
which is the specific error I am here to avoid.

## The finding, restated correctly

| # | Severity | Rubric | Image | What I saw |
|---|---|---|---|---|
| V2′ | Minor, **pre-existing**, classic renderer only | Axis honesty | `reports/golden/v4-cellE-classic-values1.png` | With `style=classic&values=1`, the per-value label formatter picks a unit per value, so one figure carries `10M`, `900K`, `400K`, `3M` over an axis labelled entirely in M. Comparing the `900K` bar to the `3M` bar needs a mental conversion, and the bare digits (900 vs 3) suggest the opposite ordering at a glance. This is the same family as M1 in classic — that renderer formats each number on its own terms rather than choosing once per figure. **Untouched by 688b3fc; not a regression.** A sibling of M1, to fix whenever classic gets its pass. |

**The editorial unit rule is correct as written and I have no finding against it.** My earlier
verdict on the `2`-beside-`10M` case stands unchanged and was measured on the right renderer:
a bare unit-less number beside M-suffixed ticks reads correctly, and it is the right trade against
restating a real value as zero.

## Scoreboard on my own accuracy

Two errors across this review, both the same shape — reporting a mechanism I had not isolated:
S3 ("silent", when a header existed that my capture script did not record) and V2 (attributing a
classic value-label defect to the editorial axis rule). Both were caught by you, from the code,
against images I had genuinely opened. The images were real in both cases; the attribution was not.
Where I have isolated a variable — the eight byte-identical hashes, the five tofu scripts, the
zero-stray-pixel label band — the method held. The lesson I am taking is that "I opened the image"
licenses a claim about *what is on the canvas*, never about *which code put it there*, and V2
crossed that line.

## On the alt header: my recommendation is your option B

Take **raw for anything Latin-1, RFC 8187 `x-chartrelay-alt*` when it cannot be** — with one
amendment and one caveat.

The reason is the failure mode, not the fidelity. Both schemes are lossless to a consumer that
implements them. They differ in what happens to a consumer that does not, and the current scheme
fails *silently and plausibly*: `Caf%C3%A9 revenue` and `increased 200.0%25` look close enough to
right to ship unnoticed, and they now reach Western-European callers who were working fine before.
Option B fails *loudly or not at all* — a Latin-1 title keeps working untouched, and a consumer
ignorant of the `*` form gets nothing rather than garbage.

**Amendment:** when the value cannot be represented, omit `x-chartrelay-alt` entirely rather than
emitting a mangled version, and always emit `x-chartrelay-alt*`. Absence is a signal a consumer can
act on; a plausible-looking corrupted string is not. This also makes the `%25` problem disappear
by construction, since an ASCII-only sentence never leaves the raw path.

**Caveat on "raw":** raw is only safe for genuinely Latin-1 characters. HTTP/1.1 header values are
historically ISO-8859-1 and many clients still decode them that way, so raw UTF-8 for `é` would
reach a naive consumer as `CafÃ©`. Gate the raw path on "every codepoint ≤ U+00FF", encoded as
Latin-1 — not on "no percent-encoding needed". That is a narrower test than it first looks and it is
the one that makes the scheme correct.

**And the caveat that matters most:** this is second-order. A browser never exposes response headers
to an `<img src>`, so on the flagship surface *no* header scheme reaches the reader — which is why
the `<title>`/`<desc>` item you have queued at #2 is worth more than either option here. I would do
#2 first and pick option B when you are next in that file.
