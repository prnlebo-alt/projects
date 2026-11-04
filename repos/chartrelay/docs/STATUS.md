# ChartRelay status

Maintained by the daily ChartRelay status agent (Claude scheduled task `chartrelay-status-agent`, about 9:05 AM local). Keep this file short.

- **Phase:** Deployed to Railway and billing verified in Stripe test mode. Email is not configured yet, and live mode is off. The product leads with charts-in-a-URL (GET /chart), which is unauthenticated and not metered as the route stands today. Billing moved to the four-tier prepaid ladder in `docs/BILLING_SPEC.md` (free 250 / developer $19 / pro $59 / business $149, plus a $10 render pack); whether anonymous URL charts stay unmetered is still an open decision for the owner.
- **Production URL:** https://chartrelay.dev (the old chartrelay-production.up.railway.app 308s to it for pages; /api/* still answers there so older chart URLs keep working)
- **Hosting:** Railway project `proactive-spontaneity`, service `chartrelay`, volume `chartrelay-volume` mounted at `/app/.data`; auto-deploys on every push to `main` of `prnlebo-alt/chartrelay` (private).
- **Stripe mode:** test (Skyn sandbox). Live mode is not enabled.
- **Last report:** 2026-10-08 20:45 (daily status agent)
- **Test data in production:** three smoke-test accounts on `@example.com` (`prod-smoke-0922`, `persist-check-0922`; the first was lost with a pre-volume deployment). They are safe to delete later.

## Health

| Check | Result | When |
|---|---|---|
| `npm run lint` | pass | 2026-10-08 |
| `npm test` | pass (42 files, 548 tests, 6s clean run) | 2026-10-08 |
| `npm run build` | pass | 2026-10-08 |
| `npm audit` | 0 vulnerabilities | 2026-09-22 |
| MCP server tests | pass (1 test, 1 file) | 2026-10-08 |
| `GET /chart` live | pass: PNG and SVG, alt text in `x-chartrelay-alt`, refusal drawn as an image, mark present | 2026-09-24 |
| Fonts in the container | fixed: PNGs were tofu on every render before 2026-09-24 12:00; cached ones cleared and re-rasterised | 2026-09-24 |
| Local Stripe test-mode flow | pass: Pro checkout, webhook replay, duplicate guard, portal, cancel → free, Scale $99 | 2026-09-22 |
| Gauntlet (5 reviewers, adversarial verify, fix, independent evaluation) | PASS: 21 of 21 confirmed findings resolved | 2026-09-22 |
| `npm run check:uptime` (production) | pass: 5 of 5 — health, home, pricing, render, billing-webhook | 2026-10-08 |
| Production `/api/health` | 200 `{"status":"ok"}` | 2026-10-08 |
| Production smoke test | pass: pages 200, security headers, register, render, PNG, session, bad login 401, billing 503 until keys set, unsigned webhook refused | 2026-09-22 |
| Production data persistence across redeploy | pass: account and chart survived a forced redeploy (volume at `/app/.data`) | 2026-09-22 |
| Deployed Stripe test-mode billing | pass: config loaded, Checkout session created with Pro price, signed webhook from Stripe accepted, plan → PRO (10,000), duplicate checkout → portal, portal opens, cancellation → FREE | 2026-09-22 |
| Marketing pages live | pass: /, /mcp, /compare, /chart-check all 200, unique titles + canonicals, no horizontal scroll at 375px, sitemap/robots/OG image served, chart checker returns real QA findings | 2026-09-22 |
| Beta readiness (account export/delete, /support, quickstart, attribution, ops runbook, uptime check, self-hosted backups) | pass: 223 tests; live journey verified (register → export → delete → login refused) | 2026-09-22 |
| Uptime monitor | scripts/uptime-check.mjs + scheduled check every 30 min; alerts only on failure | 2026-09-22 |
| Backups | working but STALE: latest `backups/chartrelay-2026-10-01-0821.sqlite` (188 KB) is 7 days old; nothing schedules them | 2026-10-08 |
| Disk on this Mac | 5.6 GB free (98% full), above the 2 GB warning line (5.5 GB on 10-06) | 2026-10-08 |
| Custom domain | live: https://chartrelay.dev serves all pages and the API; legacy host 308s for pages; support@chartrelay.dev forwards | 2026-09-22 |
| Codex independent audit (round 1) | 8 defects found that two Claude review rounds missed, incl. an exploitable quota bypass and a billing-state regression; all 8 fixed and verified by mutation testing | 2026-09-23 |

**Backups: a restore point exists, but nothing takes one unless someone runs it.** `ADMIN_TOKEN` is set
in Railway and mirrored locally, so `npm run backup -- https://chartrelay.dev` works; the newest copy is
2026-10-01 08:21, now 7 days old; the one before it was from 2026-09-29. There is no schedule; it only runs when this Mac is on and something asks. Railway volume
snapshots and `railway ssh` remain plan-gated and unverified. The restore drill passed locally on
2026-09-24 (`docs/RESTORE.md`); restoring onto the Railway volume is still unrehearsed.

`docs/OPERATIONS.md` §6.0 still ends with "as of 2026-09-22 there is no verified restore point" — that
sentence is stale and contradicts its own table. Only the owner or a build session can fix it; the
status agent may not edit that file.

When refreshing the table above, write the number you actually observed — the old row carried a test
count that was 40% low for weeks.

## Recent changes

- 2026-10-08: no commits since 2026-09-24 22:15 (`6eb3b0c`); `reports/` still untracked. Lint, 548 tests (42 files), build, MCP test (1) all pass; production 5/5. `EMAIL_PROVIDER` and `EMAIL_FROM` still missing. Newest backup is 7 days old.

- 2026-09-24, charts in a URL. `GET /chart` takes the whole chart in its querystring and answers with a
  PNG or SVG, which is the shape the category actually sells: an `<img src>` in an email, a README, Slack,
  Notion or a no-code step cannot POST a body and fetch a second URL. Unauthenticated, and not counted
  against any plan's monthly allowance as the route stands; a paid key passed as `?key=` removes the
  chartrelay.dev mark. Refusals
  are drawn as an image, because an `<img>` cannot show a JSON body. `/chart` is exempt from the
  canonical-host redirect for the same reason `/api/` is — mail proxies do not all follow a 308. Docs at
  `/docs#url` and recipes at `/integrations` (no Zapier app is claimed, because none exists).

- 2026-09-24, **every PNG ever served from production was unreadable**. `node:22-alpine` ships no fonts, so
  librsvg resolved every family to nothing and drew each glyph as `.notdef` — valid images of tofu boxes at
  the correct dimensions and byte counts. It survived because every check was structural; nobody looked at
  one. The image now installs `font-liberation` and `font-dejavu`, `src/lib/charts/fonts.ts` is the single
  place a stack is written and names those families explicitly, and `tests/fonts.test.ts` fails if either
  half drifts. Cached PNGs written before the fix are cleared by a one-time repair keyed to SQLite's
  `user_version`, not to `SCHEMA_VERSION` (a per-process hot-reload marker that resets every container).

- 2026-09-24, the editorial renderer and the paste-a-spreadsheet on-ramp. Five forms (columns, lines,
  slope, dot plot, waterfall) drawn in a report register, on the eight-slot palette validated for
  colour-blind separation and surface contrast in both modes — never cycled, because two series sharing a
  hue destroys identity. Editorial is now the default style; `style: "classic"` pins the old drawing, and
  a form the editorial renderer cannot draw falls back and says so rather than silently becoming a
  different chart. `src/lib/charts/infer.ts` turns text pasted out of Excel, Sheets or Notion into a spec
  and explains its choice in one plain sentence.

- 2026-09-24, support can now raise a limit by hand — `POST /api/admin/users/verify-email` behind
  `ADMIN_TOKEN`, `npm run verify:user`. `/register` had promised this for weeks with nothing behind it:
  the only writers of `email_verified_at` need an email to reach the user, and the Railway trial gives no
  shell. Used once, on the owner's account.

- 2026-09-24, `/pricing` claimed "no watermark" after the mark shipped. Fixed, with a test that fails if
  any page denies the mark the renderer applies.

- 2026-09-24, both scheduled agents had been dead since 2026-09-22: each hung on its first shell command
  waiting for an approval prompt nobody was there to answer, which wedged the schedule. A narrow allowlist
  in `~/.claude/settings.json` and single-command prompts fixed it; both have completed runs since.

- Two Codex review attempts produced nothing: the first was refused by its provider's classifier, the
  second ran 1h46m with no output and no filesystem activity and was killed. The independent-review slot
  is currently empty.

- 2026-10-06: no commits since 2026-09-24 22:15 (`6eb3b0c`); `reports/` still untracked. Lint, build, MCP test pass; tests 548/548 on a clean run (earlier runs timed out under machine load, not real failures). Production 5/5. Disk down to 5.5 GB free.

- 2026-10-01: no new commits since the 2026-09-29 status report (`d84f18d`). `reports/` still untracked. Lint, 548 tests (42 files), build, MCP test (1) pass; production healthy 5/5. Disk recovered to 7.9 GB free.

- 2026-09-29: quiet since 2026-09-24 22:15 (`6eb3b0c`) — five days, no commits. `main` is level with
  `origin/main` and nothing is unpushed; `reports/` is untracked (review write-ups and golden/baseline
  fixtures — decide whether it belongs in the repo). Lint, 548 tests, build and the 7 MCP tests pass;
  production healthy.

- Codex (a different model) audited the code independently and found what two in-house review rounds missed: monthly quotas were bypassable with concurrent requests (20 requests at 99/100 all succeeded), concurrent webhooks could restore a stale more-expensive plan, the account export was bounded by rows rather than bytes (~600 MB possible), an unrecognized Stripe price still granted paid limits via stale metadata, `incomplete` subscriptions did not block a second checkout, extreme numbers produced NaN in SVG, and two tests were vacuous. All fixed; an independent verifier reran each reproduction and proved the new tests fail without the fix. 261 tests.

- Beta readiness round: self-service data export and account deletion (deletion refuses while a Stripe subscription is live, verified against Stripe rather than local state), /support with an env-configured contact channel, dashboard quickstart for first render, ?ref= signup attribution, docs/OPERATIONS.md runbook, uptime check script, and a self-hosted backup endpoint + `npm run backup`.
- Critical fix found by audit: in production "Forgot password" promised an email that could never be sent (no email provider). It now says so honestly, without revealing whether an account exists, and points to support.

- Beta-audit fixes: password reset no longer claims to send a link on a deployment with no email provider; `/support` tests `EMAIL_PROVIDER === "resend"` through one shared helper; account deletion now confirms with Stripe before deleting and leaves a billing tombstone; the data export carries `users.source` and `renders.apiKeyId`; the export GET has the cross-site guard; the quickstart curl origin no longer comes from request headers; `/support` is in the sitemap; deletion ends on a confirmation page; `ADMIN_TOKEN`, `SUPPORT_EMAIL` and `SUPPORT_RESPONSE_HOURS` are documented; the uptime check now renders a real chart.

- Marketing site: rewritten home page, /mcp (agent integration), /compare (four-way comparison incl. when not to choose ChartRelay), /chart-check (free no-signup QA tool), shared landing design kit, sitemap, robots, Open Graph image, grouped footer navigation. Two independent audits (truthfulness vs code, design/accessibility) produced 22 findings, all fixed — including cutting an unverifiable "MIT-licensed" claim rather than inventing a licence.

- Gauntlet hardening: login lockout-DoS fix, spoof-proof client IP for rate limits, webhook ordering and checkout race fixes, bounded PNG rendering and cache, SVG control-character sanitizing, correct multi-series and pie labels, security headers, stronger `SESSION_SECRET` checks, docs made truthful.
- Launch prep: `/api/health`, draft `/terms` and `/privacy` pages, `railway.json`, `docs/DEPLOY.md` runbook.
- Private GitHub repo created: `prnlebo-alt/chartrelay`. The Railway GitHub App is installed with access to this repo only.

## Waiting on the owner

- [x] `ADMIN_TOKEN` generated by Railway and deployed; `/api/admin/backup` is armed.
- [x] Railway backup options checked on 2026-09-22: managed volume backups are Pro-plan only, so the self-hosted path is the one we have (`docs/OPERATIONS.md` §6).

- [x] Repo deploy key added; code pushed to GitHub.
- [ ] In the Stripe sandbox, **roll** the secret key and the restricted key (they appeared on screen in a work session), then update the Railway variable and local `.env.local`. Do this before live mode.
- [x] Stripe webhook endpoint `we_1UIYHMLVPzjDg7SQVzTFBrQr` created for the deployed site with the 4 events; deliveries verified.
- [x] `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` set in Railway; deployed test-mode billing passed end to end.
- [x] Domain live: chartrelay.dev (Namecheap, ALIAS → Railway, certificate issued). `APP_URL`, canonical URLs, sitemap and the Stripe webhook all moved to it.
- [x] Support address: support@chartrelay.dev, forwarded by Namecheap to the owner's inbox; shown on /support and /privacy.
- [ ] **Half done: email still cannot send.** `RESEND_API_KEY` is set now, but `EMAIL_PROVIDER` and `EMAIL_FROM` are both still missing, so nothing is sent — a key alone changes nothing. Set both (locally and in Railway) to finish it.
- [x] Backups working: newest copy 2026-10-01 08:21 (7 days old — run `npm run backup -- https://chartrelay.dev`). It only runs when this Mac is on and someone runs it — a `cron` entry would close the week-long gap this run found.
- [x] Restore rehearsed locally 2026-09-24 and passed (`docs/RESTORE.md`); the drill found that a plain file copy restores an empty database. Restoring onto the Railway volume is still unrehearsed.
- [ ] Disk: 5.6 GB free (98% full), steady since 10-06; free some space before builds break.
- [ ] Optional: add `www.chartrelay.dev` (blocked by the Railway trial's one-custom-domain limit).
- [ ] Fill in the business details in `/terms` and `/privacy` (bracketed placeholders), ideally with a lawyer's review.
- [ ] Before real launch: upgrade Railway from the trial ($5 / 30 days).
- [ ] Optional: approve publishing `@chartrelay/mcp` to npm and posting the launch copy in `marketing/`.
