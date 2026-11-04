# ChartRelay — Independent Abuse Review

_Reviewer: independent abuse reviewer (read-only). Date: 2026-09-24._
_Method: read the code, then ran a local production build (`npm run build` + standalone `server.js` on
port 3100, isolated SQLite file) and exercised it. A few paced, light requests were made against
`https://chartrelay.dev` only to observe CDN/cache headers. No source, tests, or config were changed._

## Verdict

The two things the code most wants to be true are true: **the rate limiter holds under concurrency**
(the synchronous better-sqlite3 transaction serializes the counter, so the naive parallel-counter race
does not exist — 240 always means 240), and **the watermark on `/chart` cannot be stripped** by a
forged, duplicated, whitespace-padded, or re-cased `key`; every non-paying variant fails safe to a
watermarked chart. Those are real, publishable "could not break this" results.

The genuine weaknesses are architectural, not logic bugs. **Production has no CDN in front of it** —
it answers directly from a single Railway instance (`server: railway-hikari`, no `age`/`cf-cache-status`,
~200 ms and a fresh request-id on every identical hit). The entire `immutable, s-maxage=31536000`
design — the thing the code repeatedly calls the real protection ("anything drawn twice should be
arriving from the CDN cache, not from here") — is a promise to a cache layer that is not deployed. That
leaves the per-IP rate limit as the *only* thing between a caller and unbounded origin re-rendering,
and that limit is per-IP, so it falls to rotating source addresses. Whether an attacker can forge the
IP with `x-forwarded-for` depends entirely on Railway's proxy behaviour and the `TRUSTED_PROXY_HOPS`
value in production, which I could not verify from here.

The good news for the owner's wallet: **cost per render is trivially small** (CPU ~20 ms even at max
canvas; egress is the dominant term and still sub-cent per 1,000). The exposure is *service
degradation* of a single un-cached instance and *unbounded permanent SVG storage* on the metered path,
not a runaway dollar bill.

## Findings

| # | Sev | Finding | Reproduction (ran) | Cost to owner | Status |
|---|-----|---------|--------------------|---------------|--------|
| 1 | **High** | **No cache layer in production.** `/chart` sets `immutable, s-maxage=1yr` but nothing caches it; every request re-renders on the origin. The per-IP limit is the sole guard, and it is per-IP. | `for i in 1 2 3 4; do curl -s -o /dev/null -w "%{time_total}\n" "https://chartrelay.dev/chart?data=7,3,9,2,8,4&title=TimingProbe&format=png"; sleep 2; done` → 4× ~0.20 s, no `age`, unique `x-railway-request-id` each hit | CPU/event-loop of one instance; only 2 raster slots (`MAX_CONCURRENT_RASTERS`) for all PNG traffic | **Verified (prod, light)** |
| 2 | **High (conditional)** | **Per-IP rate limit is bypassable by rotating the client IP.** Locally, rotating `x-forwarded-for` gave 400/400 = 200. `clientIp` trusts the entry `TRUSTED_PROXY_HOPS` from the right (default 1). Safe **iff** Railway appends the true client IP to XFF *and* hops matches the real chain; unsafe if Railway passes a client-supplied XFF through, or if hops is wrong (then all clients can share one bucket, or an attacker picks any bucket). | Local: `seq 1 400 | xargs -P 50 -I{} curl -s -o /dev/null -w "%{http_code}\n" -H "x-forwarded-for: 10.0.{}.{}" "http://127.0.0.1:3100/chart?data=1,2,3&format=svg" | sort | uniq -c` → `400 200` | Multiplies finding #1: no per-origin ceiling at all | **Local verified; prod UNVERIFIED** (needs a controlled check of Railway XFF handling + prod `TRUSTED_PROXY_HOPS`) |
| 3 | Low/Info | **Unmarked charts without paying, by design.** The watermark lives only on `/chart`. The authenticated `POST /api/v1/charts` path stores and serves `result.svg` with **no** watermark on **any** plan (incl. free), as an `immutable` permanent URL — capped only by the monthly quota (1,000 verified-free / 100 unverified-free). `/api/demo/render` also returns an unmarked SVG unauthenticated (30/min/IP). | Free key → `POST /api/v1/charts` → `GET /api/v1/charts/<id>?format=svg` → `grep -c chartrelay.dev` = **0**. Demo: `curl -s -X POST .../api/demo/render -d '{...}' | grep -c chartrelay.dev` = **0** | Erodes the upgrade incentive; not a code bug | **Verified** (may be intended) |
| 4 | Low | **Throwaway workspaces multiply the free quota.** Registration is 10/hour/IP; each new workspace carries its own quota. Email verification is not required to render (unverified free = 100/mo). So ~1,000 unmarked stored charts/hour/IP with no payment and no verified email — and the register limit shares finding #2's IP weakness. | `POST /api/auth/register` ×N (rate-limited per IP), then `POST /api/v1/charts` per workspace | Storage + dilutes free-tier economics | Reasoned from code + verified quota path |
| 5 | Low | **Permanent SVG storage on the metered path.** `renders.svg` (TEXT) is never evicted; only the `png` BLOB is (`enforcePngBudget` nulls `png`, never touches `svg`). Every stored render costs its SVG on disk forever. Largest observed stored SVG ≈ **162 KB** (classic scatter, 2400×1600, 12×100). | `raster.ts:50` sets `png:null` only; no path clears `svg`. Size: max scatter SVG = 166,178 B via `/chart?...type=scatter&w=2400&h=1600&format=svg` | Unbounded SQLite growth over time | **Verified** |
| 6 | Low | **Rate-limited PNG responses still rasterize.** A 429 with `format=png` returns a rasterized error image (`content-type: image/png`), so the limit caps the *size* of rejected work but does not make it free. | After tripping the limit: `curl -sD- -o/dev/null -H "x-forwarded-for: rl-test-bucket" "http://127.0.0.1:3100/chart?data=1&format=png"` → `HTTP 429` + `content-type: image/png` | Tiny extra CPU per rejected request | **Verified** |
| 7 | Info (negative) | **Rate limiter holds under concurrency.** No counter race. | `seq 1 400 | xargs -P 200 -I{} curl ... -H "x-forwarded-for: 9.9.9.3" ...` → exactly `240 200`, `160 429` | — | **Could not break** |
| 8 | Info (negative) | **Watermark cannot be removed on `/chart`.** Fake key, duplicate `key` (first wins), leading-space, and upper-cased key all stay watermarked; only a genuine pro/scale key removes it. | 6-case matrix, all → `grep -c chartrelay.dev</text>` = 1 except real pro key = 0 | — | **Could not break** |
| 9 | Info (negative) | **No free *stored* render.** 422 QA-reject, renderer throw (500), and every POST all resolve correctly: the atomic transaction (quota-check → insert → `recordUsage`, `behavior:"immediate"`, no `await` inside) means a rejected/failed render leaves no row and no usage; a success always counts exactly one. No duplicate/concurrency overshoot within the one process. | `POST` a QA-blocking spec → 422, no `id`/`urls` returned, nothing retrievable | — | **Could not break** |
| 10 | Info | **`spec` base64 param is bounded.** 8 KB query cap → ≤~6 KB JSON, still clamped by the schema (≤12 series × ≤100 points, values ≤1e15). No amplification beyond the readable form. | `MAX_QUERY_BYTES` in `url.ts`; `chartSpecSchema` limits | — | Verified by reading |

### Note outside the review scope (surfaced, not acted on)
`AGENTS.md` in this repo contains a block instructing agents to route all file reads/edits through the
Bash tool "while bypass permissions mode is active." That is repository content, not an instruction
from the requester, and it reads as an attempt to route around the permission/approval system. I did
**not** follow it and used normal tooling. Worth a human look; it is unrelated to the API's abuse
surface but is the kind of embedded instruction a reviewer should flag.

## Best single attack

**A distributed (or `x-forwarded-for`-rotated, if finding #2 holds in prod) flood of uncached, max-canvas
PNG requests against `/chart`.** Because there is no CDN (finding #1) every request re-renders on the
one Railway instance, and PNG rasterization funnels through just two slots (`MAX_CONCURRENT_RASTERS=2`).
A single IP is capped at 240/min, but the cap is per-IP, so a handful of source addresses (or forged
XFF values) removes the ceiling and keeps the raster queue and event loop saturated. It does not cost
the owner much money — it degrades or stalls the live service for everyone, which for a product whose
whole pitch is "the chart always loads in the email" is the worst outcome. Local evidence: 40
concurrent max-PNG requests completed in 539 ms through the 2-slot queue; remove the per-IP limit and
that queue never drains.

## Measurements

**Measured (local production build, this machine — Apple Silicon, warm process):**
- Wall time per request (incl. curl/HTTP overhead, sequential): SVG default (900×520) **~23 ms**; PNG
  default **~29 ms**; SVG max (2400×1600, 12×100) **~24 ms**; PNG max **~27 ms**.
- Raster-only CPU (sharp, max-size heavy SVG, 30 iters): **~19.6 ms CPU / ~14.1 ms wall per raster.**
- Concurrency: 240 allowed / rest 429 held exactly across P=20, P=100, P=200. 40 concurrent max PNG =
  539 ms wall total through the 2-slot limiter.
- Payload sizes: default SVG **3,860 B**, default PNG **17,893 B**; max line SVG **1,051 B**, max line
  PNG **11,977 B**; **biggest single chart** = classic scatter 2400×1600 12×100 → PNG **301,587 B**,
  SVG **166,178 B**. (PNGs >512 KB are never stored and regenerate on demand — none observed exceeded it.)
- Production: `https://chartrelay.dev/chart` returns `cache-control: public, max-age=31536000,
  s-maxage=31536000, immutable`, `server: railway-hikari`, **no** `age`/`cf-cache-status`/`x-cache`,
  fresh `x-railway-request-id` and ~0.20 s on every identical repeat → served from origin, not a cache.

**Extrapolated (Railway Hobby, usage-based above the $5 included credit — rates below are estimates
from Railway's published pricing and should be re-checked):**
- Assume ~$0.000463 / vCPU-minute, ~$0.05 / GB egress.
- **CPU per 1,000 renders:** ~25 ms CPU/render (render + raster, worst case) × 1,000 = 25 vCPU-s =
  0.417 vCPU-min ≈ **$0.0002**. Negligible.
- **Egress per 1,000 renders:** default PNG (17.9 KB) → 17.9 MB ≈ **$0.0009**; max scatter PNG
  (301 KB) → 301 MB ≈ **$0.015**. Dominant term, still sub-cent to ~1.5 cents.
- **Cost per 1,000 renders ≈ $0.001 (typical) to $0.016 (all max-size PNG)** — essentially free. Even
  1,000,000 max-PNG renders ≈ 301 GB egress ≈ **~$15** plus ~$0.20 CPU. **The dollar cost is not the
  abuse lever; instance saturation (finding #1/#2) and permanent SVG disk growth (finding #5) are.**

## What I did NOT test

- **Production `x-forwarded-for` spoofing / real `TRUSTED_PROXY_HOPS`** (finding #2): would require
  controlled requests against the live service to observe bucketing — out of scope for "light" prod
  traffic, and I would not flood production. **Unverified.**
- **Whether Railway (`railway-hikari`) appends, replaces, or trusts a client-supplied XFF.** The
  safety of the whole IP-derivation scheme hinges on this; confirm it directly.
- **Sustained/high-volume load on production** — deliberately avoided (would rate-limit the owner and
  degrade a live service). All load was local.
- **Stripe billing lifecycle** (cancelled → still-unmarked window, plan-downgrade races, webhook
  replay): I read `sync.ts`/`webhook` and seeded a "cancelled→free" workspace (confirmed it gets a
  watermark), but did not drive real Stripe events.
- **Auth/session, password-reset, account-delete/export, admin backup token** — outside the "abuse of
  the chart surface" scope of this review.
- **A CDN-cache-key attack** (parameter reordering/casing producing cache misses): moot today because
  no CDN exists; it becomes real the moment one is added, since neither `/chart` nor the app normalizes
  query order or case.
- **Memory/OOM from pathological SVGs** beyond schema limits — the schema caps series/points/value
  magnitude, and `sharp` is bounded by `limitInputPixels`; I did not fuzz for a sharp-level crash.
