# Board

What is being worked, what is parked, and why. One line each; the detail lives in `docs/GATES.md`
for anything waiting on the owner.

## Feature freeze

**In force.** No new chart types until the freeze lifts. Polish, correctness, security and the
gates are all still in scope — the freeze is on surface area, not on quality.

## Parked — awaiting 3 user requests

These are built and tested in `src/lib/charts/editorial.ts`; they are simply not reachable, because
nothing in the schema or the URL API names them. They stay that way until three separate people ask.

| Form | State | Unparks when |
|---|---|---|
| Slope chart | renderer done, tested | 3 user requests |
| Waterfall | renderer done, tested | 3 user requests |
| Dot plot | renderer done, tested | 3 user requests |

Requests are counted from support email, the studio survey, and anything a customer says in writing.
Two people asking for "before and after" counts as two slope requests; guessing on their behalf does
not count at all.

The composite report figure — headline numbers, an annotated plot and small multiples in one image —
is parked on the same terms and is not in the repository at all; it exists only as a prototype.

## Now

- **Gate A (email)** — waiting on the owner to create a Resend account and set `RESEND_API_KEY`.
- **Gate S (postal address)** — waiting on a virtual mailbox. Blocks lifecycle email only.
- **Independent review** — starts in a fresh, read-only session once Gate A is closed, so the golden
  set is rendered against a deployment that can actually send mail.

## Done this cycle

Charts in a URL · the four-tier prepaid ladder with a render pack (replacing unlimited-with-a-mark
pricing) · editorial as the default renderer · the studio ·
fonts in the container (every PNG before it was tofu) · the support lever for raising a limit by hand ·
legal pages driven from the environment instead of placeholders · the lifecycle email guard.

---

## Post-review state — 2026-09-24

Independent review complete (visual, abuse, security), all blockers and serious findings fixed,
deployed and verified on production. 548 tests, every fix mutation-checked. See
`docs/DEPLOY_READINESS.md`.

Shipped since the freeze, all of it repair or the owner's explicit item 4 rather than new features:

- Negative and mixed-sign data draws correctly; one number formatter across both renderers.
- Twelve scripts render, including CJK, Arabic, Devanagari, Bengali, Tamil, Thai and Ethiopic.
- Category labels thin instead of overprinting at high point counts.
- The editorial SVG carries its own `<title>`/`<desc>`; the bar-to-line substitution is stated in the figure.
- Cross-site guards on five session-authenticated routes; login backoff now actually delays.
- Activation instrumentation and the one-question upgrade survey (`npm run metrics`).
- Restore rehearsed and documented (`docs/RESTORE.md`).

Still parked, unchanged: **slope, waterfall and dot charts — awaiting 3 user requests.**

Open decisions that are not code:

- **No CDN in front of chartrelay.dev.** The caching design in the code protects nothing today.
- **`?key=` in chart URLs.** URL signing is the better design and gets more expensive to adopt the
  longer the current scheme ships.
- **Inbox placement at Gmail and Outlook** has never been checked with a real message.
