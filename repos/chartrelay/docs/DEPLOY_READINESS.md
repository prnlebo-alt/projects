# ChartRelay — deploy readiness

Written 2026-09-24, after an independent three-part review (visual, abuse, security) conducted in a
fresh session with no shared context, and the fixes that followed. Every claim here was verified
against the deployed site or a run of the code, not inferred from a diff.

**Assessment: ready to ship, with two things only the owner can do.** They are listed first.

---

## Blocking on the owner

### 1. Gate S — a business postal address

`BUSINESS_POSTAL_ADDRESS` is unset, deliberately. The owner runs this company from home, and a home
address on a terms page is scraped and archived within days; no later edit takes it back. Unset is the
safe state and the code is built around it: the legal pages omit the address line rather than print a
placeholder, and every **non-transactional** email is refused and logged. Receipts, confirmations and
password resets are unaffected and always send.

**Action:** get a virtual mailbox, then set `BUSINESS_POSTAL_ADDRESS` in Railway. Until then, no
lifecycle or marketing email can go out — which is correct under CAN-SPAM, not a bug.

### 2. Stripe live mode

Still on test keys, awaiting `/ship`. Key rotation was rehearsed once already with zero downtime.

### Worth doing, not blocking

- `LEGAL_EFFECTIVE_DATE` — unset, so `/terms` claims no effective date rather than a false one.
- `LEGAL_DBA` — a Florida fictitious name registration (§865.09). Until it exists the legal pages name
  MadPugExperiment LLC alone, which is the honest default; "MPE Labs" stays a brand, not a contracting
  party.
- `EMAIL_FROM` and `EMAIL_PROVIDER` are flagged by `npm run check:env --production`. Email is working in
  production, so these are set there; the warning is from the local environment.

---

## What the review found, and what happened

Three reviewers, read-only, no shared context, told that "I could not break this" was a valid result.

| Area | Result |
|---|---|
| Security | No critical, no high. 3 medium, 4 low, 6 informational. |
| Abuse | Rate limiter and watermark both survived every attack. 2 architectural findings. |
| Visual | **4 blockers, 11 serious, 11 minor.** Not shippable as it stood. |

The visual review earned the exercise. Every blocker was on the **editorial** renderer — the default —
and the classic renderer handled each case correctly, so all four were default-path regressions
against a sibling that already worked.

### Fixed and verified on production

- **Negative values were silently discarded.** All-negative data drew an empty plot under an axis
  reading `1, 1, 1, 0, 0`, at HTTP 200, with alt text confidently describing bars that were not on the
  canvas. Mixed-sign data was worse because it was quieter: the negative bars were simply absent.
- **Any character above U+00FF returned HTTP 500 with an empty body.** Not the fonts and not the
  renderer — an HTTP header value is a ByteString, and the alt text ships in one. In an `<img src>`
  that is a broken-image icon, and it ruled out every non-English customer.
- **Twelve scripts now render**, including Japanese, Korean, Chinese, Arabic (correctly shaped and
  joined), Hebrew, Devanagari, Bengali, Tamil, Thai and Ethiopic. The first font fix covered three and
  left five silently broken at HTTP 200; the second round found them.
- **Three number formatters became one.** An axis that read `0, 0, 1, 1, 1`; a tick at 250,000 labelled
  `0.3M`; a point of −0.004 described as "−0"; 900,000 printed as `900K` beside `10M`. One rule now:
  a number may be shortened, never restated.
- **100 category labels** were drawn at full size into an unreadable band that ran off the plot. Labels
  thin to what fits; every mark is still drawn.
- **The editorial SVG had `role="img"` and no `<title>` or `<desc>`**, so the description this product
  computes so carefully was unreachable in an `<img src>` — the flagship surface.
- **A multi-series bar chart silently became a line chart.** The response header said so; an `<img>`
  never sees a header. The figure now says it in the figure.
- **Five session-authenticated routes had no cross-site guard**, including the one that returns a live
  plaintext API key. SameSite=Lax was the only layer, and SameSite is site-scoped.
- **The login backoff did not delay anything.** Thirty concurrent guesses ran ~9× faster than ten
  sequential ones, because every request slept at the same time. Attempts against one account now queue.
- **`/chart` served a user-influenced SVG under the permissive site CSP.** It gets the inert sandboxed
  policy now.
- **`sessionUserId()` deleted** — an unused export that returned a user id without checking revocation.

### Deliberately not fixed

- **Slope, waterfall and dot charts** stay parked under the feature freeze, awaiting 3 user requests.
- **M7's percent-change** is fixed, but percentage change is now simply not reported across a sign
  change or from a negative base. "-40 → 30 increased 175%" is arithmetically true and editorially
  useless.
- **The `?key=` in a chart URL.** A key in a URL lands in browser history, proxy logs and Referer
  headers, and the docs page tells people to paste these URLs into READMEs. URL signing is the better
  design. It is a breaking change to the public surface and is the one item that gets more expensive
  the longer it ships — decide it deliberately, before there are customers, not after.

---

## Known gaps, stated plainly

**There is no CDN in front of chartrelay.dev.** Verified: no `age` header, no cache status, every
identical request re-renders on the single Railway instance. The `immutable` / `s-maxage` caching
design in the code is therefore protecting nothing today. Cost is not the problem — a measured ~$0.001
to $0.016 per 1,000 renders — but the instance is the only thing absorbing a flood, and the per-IP
rate limit is the only ceiling. This is a spend decision, not a code change.

**Per-IP rate limiting depends on `TRUSTED_PROXY_HOPS` being right for the deployment.** It defaults to
1, which is correct behind Railway. It is now covered by `check:env` so it cannot be silently wrong.

**Email deliverability to Gmail and Outlook has never been tested.** DKIM, SPF and DMARC are configured
and mail demonstrably arrives — a password reset token was issued and used three minutes later — but
inbox placement with an embedded chart at those two providers has not been checked. It needs real
accounts at both and a person to look.

**Restoring onto the Railway volume has not been rehearsed.** The restore drill ran locally and passed:
snapshot integrity ok, all nine tables, every row intact, migrations ran forward on the restored file.
It also surfaced the trap that matters — the live `.db` file was 4 KB while 820 KB sat in the `-wal`
beside it, so **copying `chartrelay.db` alone restores an empty database that opens cleanly**. The
backup endpoint uses `VACUUM INTO` and is correct. See `docs/RESTORE.md`. The platform steps are still
untested; do that once before there is a customer to lose.

**Managed backups are a Railway Pro feature** and this is a Hobby plan, so `npm run backup` is the only
backup that exists. It is a pull, which means it only runs when someone runs it.

**The sign-up confirmation email has not been tested end to end** on production.

---

## State

- **548 tests passing**, 42 files. Lint and types clean. Production build succeeds.
- Every fix in this round is **mutation-checked** — the tests were verified to fail against the old
  behaviour, so none of them are vacuous.
- Gates A (email), B (legal), C (Stripe), D (Railway) closed. **S (postal address) and F (ship) open.**
- Activation instrumentation is live: signup, first render, second-day render, upgrade-page view,
  checkout start, plus one optional survey question. `npm run metrics` prints the weekly funnel.

## The honest summary

The product works, it is materially better than it was a day ago, and the failures it had were the
embarrassing kind — charts that returned 200 and could not be read, a description that contradicted
the picture, an entire class of customer locked out by a header encoding. None of those were found by
a test suite that was already green; they were found by rendering images and opening them.

That is the lesson worth keeping: **this codebase's tests can tell you a chart was produced. Only
looking can tell you it was right.**
