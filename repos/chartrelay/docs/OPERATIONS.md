# ChartRelay operations runbook

Day-2 operations for the deployed service: what to watch, what to do when it breaks, and how to get the
data back. `docs/DEPLOY.md` covers first-time setup; this file assumes the service is already running.

Shape of the system, because every procedure below depends on it:

- **One** Railway service, **one** replica, built from the repo `Dockerfile`.
- **One** persistent volume mounted at `/app/.data`, holding the SQLite database (`DATABASE_PATH`,
  normally `/app/.data/chartrelay.db`) plus its `-wal` and `-shm` files. **The volume is the only
  copy of production data.** No other database exists.
- Pushes to `main` auto-deploy. A redeploy replaces the container; the volume survives.

Contents:

1. [The uptime check](#1-the-uptime-check)
2. [Reading Railway logs](#2-reading-railway-logs)
3. [What /api/health proves — and what it does not](#3-what-apihealth-proves--and-what-it-does-not)
4. [When health is red](#4-when-health-is-red)
5. [Rolling back a deploy](#5-rolling-back-a-deploy)
6. [Backup and restore](#6-backup-and-restore)
7. [Disk and volume sizing](#7-disk-and-volume-sizing)
8. [The daily status agent](#8-the-daily-status-agent)
9. [Incident checklists](#9-incident-checklists)
10. [Routine maintenance](#10-routine-maintenance)

---

## 1. The uptime check

```bash
npm run check:uptime                      # defaults to $APP_URL, then the production URL
npm run check:uptime -- https://chartrelay.example --json --timeout=5000
```

`scripts/uptime-check.mjs` is dependency-free Node (no install needed beyond Node 22) and sends no
credentials. It runs five checks:

| Check | Request | Pass | Fail |
|---|---|---|---|
| `health` | `GET /api/health` | 200 and `{"status":"ok"}` | anything else |
| `home` | `GET /` | 200 | anything else |
| `pricing` | `GET /pricing` | 200 | anything else |
| `render` | `POST /api/demo/render` with a two-bar spec | 200 with an `svg` in the body — a chart really was drawn | anything other than 200 or 429 |
| `billing-webhook` | `POST /api/billing/webhook` with no signature | 400 — the route refused an unsigned request, so `STRIPE_WEBHOOK_SECRET` is loaded | anything other than 400 or 503 |

The webhook probe is unsigned, so the route can only reject it; it changes nothing. A **503** there is
reported as `warn`, not a failure: it means `STRIPE_WEBHOOK_SECRET` is unset, so Stripe events are not
being processed. That is the expected state before billing is configured and an incident after it.

The render probe uses the unauthenticated demo route, so it needs no key, writes no row and leaves no
usage behind. A **429** is a `warn`: the demo rate limit (30/minute per IP) fired, which proves the route
is alive but not that it rendered. It is the only check that exercises the product's actual job — the two
page checks would stay green through a total render outage.

Exit code is `0` when nothing failed (warnings allowed) and `1` otherwise, so it drops straight into
cron, a CI step, or any monitor that runs a command. `--json` prints `{baseUrl, checkedAt, ok, counts,
checks[]}` for machines. Each request has its own timeout (default 10s), so a hung server cannot hang
the check.

This script is a **probe you run**, not a monitor. Nothing runs it on a schedule unless you set that
up. For unattended alerting, point an external uptime service (UptimeRobot, Better Stack, Healthchecks
— any of them) at `https://<domain>/api/health` and alert on non-200 or on a body that is not
`{"status":"ok"}`.

---

## 2. Reading Railway logs

The app logs to stdout/stderr; Railway captures everything.

**Dashboard:** project `proactive-spontaneity` → service `chartrelay`. The **Deployments** tab lists
every build; open one for its **Build Logs** and **Deploy Logs**. The service's **Observability**/logs
view shows the running container's output, with a filter box and a time range.

**CLI** (`npm i -g @railway/cli`, then `railway login` and `railway link` once in this repo):

```bash
railway logs              # tail the active deployment
railway logs --build      # build output for the latest deployment
```

Confirm flag names with `railway logs --help`; the CLI changes faster than this document.

Log lines worth knowing, all of them greppable:

| Pattern | Meaning | Action |
|---|---|---|
| `[config] FATAL:` | Startup refused: `SESSION_SECRET` missing or shorter than 32 chars. The process exits, so the deploy never becomes healthy. | Fix the variable, redeploy. |
| `[config] WARNING:` | Email is not configured (`EMAIL_PROVIDER` is not `resend`, or its API key/from address are missing). The server runs, but verification and reset emails throw. | See `docs/DEPLOY.md` → Resend setup. |
| `[billing-alert] ACTION REQUIRED` | One workspace has **two** entitled Stripe subscriptions. A customer may be double-charged. | Cancel and refund the duplicate in the Stripe Dashboard, same day. |
| `Stripe webhook rejected: STRIPE_WEBHOOK_SECRET is not configured.` | Every Stripe event is being refused with 503; plans will not update. | Set the variable from the endpoint's signing secret. |
| `Checkout unavailable: STRIPE_PRICE_… is not configured.` | Upgrade buttons fail. | Set the price IDs for the current Stripe mode. |
| `SQLITE_CANTOPEN`, `attempt to write a readonly database` | The container cannot write the volume. | See [When health is red](#4-when-health-is-red), item 2. |
| `SQLITE_BUSY`, `database is locked` | Write contention or a stuck writer. | Item 3 below. |
| `Verification email failed:`, `Password reset email failed:` | The provider rejected the message, or none is configured. | [Emails not sending](#c-emails-not-sending). |
| `Chart render failed:`, `PNG rasterization failed for render …` | A render blew up; the caller got a 5xx. | Grab the spec from the caller and reproduce locally. |
| `[account-deleted] user=… workspace=…` | A customer deleted their account. Informational. | None. |
| `[account-delete-blocked] workspace=… stripeStatus=…` | A deletion was refused because Stripe still shows a non-terminal subscription. Working as intended. | None, unless a customer says they already cancelled — then check the subscription in Stripe. |
| `Account deletion blocked: could not confirm subscription state with Stripe` | Stripe was unreachable, so the route failed closed and refused the deletion. | Check Stripe status and the API key; the customer can retry. |
| `backup served … bytes` | Someone downloaded a full database snapshot through `/api/admin/backup`. | Expect one per scheduled backup. Any you cannot account for means `ADMIN_TOKEN` is compromised: rotate it and redeploy. |

Secrets are never logged: config checks print names and lengths only, and Stripe errors print type,
code and request id. If you ever see a key value in the logs, treat it as exposed and roll it.

Railway retains a limited window of logs by plan. Copy anything you need for an incident write-up out
of the dashboard while you are in it.

---

## 3. What `/api/health` proves — and what it does not

The route (`src/app/api/health/route.ts`) runs `select 1` against SQLite and answers:

- `200 {"status":"ok"}` — the process is up **and** it opened and queried the database file on the
  volume. That is the check that matters: a container whose volume is missing or read-only fails here.
- `503 {"status":"error"}` — the query threw. Details are deliberately withheld from the response;
  they are in the logs.

It does **not** prove: emails send, Stripe is configured, renders succeed, the volume has free space,
quotas are right, or that any page renders. Those are separate checks — the uptime script additionally
fetches **the home and pricing pages specifically** (two of the eleven public routes, not all of them),
renders a chart through `/api/demo/render`, and probes the webhook route; billing and email are verified
by the checklists in `docs/DEPLOY.md`.

Railway uses `/api/health` (via `railway.json`) only as a **deploy gate**: traffic is routed once it
returns 200, and after that Railway stops asking. Ongoing monitoring is yours to set up.

---

## 4. When health is red

Work top to bottom. Most outages here are the first item.

1. **Recent deploy?** Railway → Deployments. Did one land just before the failure started? Read its
   build and deploy logs for `[config] FATAL:` or a crash loop (restart policy is `ON_FAILURE`, up to
   10 retries). If a deploy is the cause, [roll back](#5-rolling-back-a-deploy) first and diagnose
   afterwards. Also check whether a variable was edited — saving a variable triggers a redeploy.
2. **Volume full or unwritable?** Railway → the service's volume shows used vs total. If it is at or
   near capacity, SQLite cannot write and health goes 503. Free space by lowering
   `PNG_CACHE_MAX_BYTES` (evicted PNGs regenerate on demand) and redeploying, or grow the volume in
   Railway. If instead the logs say `SQLITE_CANTOPEN` or `readonly database`, it is permissions:
   confirm `RAILWAY_RUN_UID=0` is set (the image runs as uid 1001, Railway mounts volumes as root) and
   that `DATABASE_PATH` points **inside** `/app/.data`.
3. **Database locked?** `SQLITE_BUSY` / `database is locked` means another writer held the file past
   the 5s busy timeout. With one replica this should be rare and self-clearing. If it persists:
   confirm replicas is still **1** (two containers on one volume will do this), then restart the
   service. Never delete `chartrelay.db-wal` by hand while the app is running — that discards
   committed transactions.
4. **Stripe config?** Not a health-route failure, but check it while you are here: run
   `npm run check:uptime`. A `warn` on `billing-webhook` means `STRIPE_WEBHOOK_SECRET` is missing and
   plan changes are being dropped. In the Stripe Dashboard, the webhook endpoint's delivery list shows
   failures; fix the variable and **Resend** the failed events — the app is idempotent (it records
   processed event ids), so replaying is safe.
5. **Still red with nothing obvious?** Restart the service (Railway → the deployment's menu →
   **Restart**). If a restart fixes it, capture the logs from before the restart — a restart destroys
   your evidence, not the cause.

---

## 5. Rolling back a deploy

Railway keeps previous deployments and can re-run any of them:

1. Railway → service `chartrelay` → **Deployments**.
2. Find the last deployment that was healthy (green, and you know the site was fine on it).
3. Its menu → **Redeploy** (some Railway versions label this **Rollback**/**Restore**). Confirm.
4. Watch until the healthcheck passes, then run `npm run check:uptime`.

What a rollback does and does not do:

- The **volume is untouched**. Data written by the bad version stays. Rollback un-ships code, it does
  not un-write rows.
- **Migrations are additive only** (`src/lib/db/index.ts` runs `CREATE TABLE IF NOT EXISTS` and
  `ALTER TABLE ADD COLUMN`; nothing drops or renames), so an older image tolerates a newer file. Keep
  it that way: a destructive migration would make rollback unsafe.
- **Variables are not rolled back.** If the bad deploy came with a variable change, revert that too, or
  the old image starts with the new variables.
- Because `main` auto-deploys, a rollback is temporary: the next push to `main` ships whatever is on
  `main`. Fix forward, or revert the commit, before pushing again.

Billing emergency rollback is separate: remove `STRIPE_LIVE_MODE` (live keys are then refused) or
disable the endpoint in Stripe. Subscriptions keep billing inside Stripe regardless — manage them
there.

---

## 6. Backup and restore

The volume is the only copy. Decide how much data you can afford to lose and back up at least that
often; for a low-traffic service, daily is a reasonable floor.

### 6.0 Current state — is there a restore point?

The first question in a data-loss incident, answered before the three procedures below. **Keep this
table current**; the daily status agent mirrors it in `docs/STATUS.md`.

| Path | Available today? | Precondition | Last verified |
|---|---|---|---|
| §6.1 `npm run backup` | **Working (first backup 2026-09-22 18:03).** `ADMIN_TOKEN` is set in Railway via its `${{secret(32)}}` generator and mirrored in local `.env.local`. Run `npm run backup -- https://chartrelay-production.up.railway.app`; the script refuses localhost, verifies the SQLite header, and prunes after 14 days | nothing — it works today | 2026-09-22 |
| §6.2 Railway volume snapshots | **Not available.** Checked in the Railway UI on 2026-09-22: the Backups panel states that creating backups and point-in-time recovery are Pro-plan only, and the volume currently has none | Railway Pro plan (~$20/month) | never |
| §6.3 `railway ssh` hot copy | **Untested.** The Railway CLI is not installed on the owner's Mac (checked 2026-09-22), and `railway ssh` is plan-gated. Install the CLI and run it once outside an incident | Railway CLI + a plan that allows SSH | never |
| §6.4 cold copy | Yes, with downtime | Ability to stop the service | never |

**So: as of 2026-09-22 there is no verified restore point, and losing the volume loses everything.**
Fixing that is one variable and one redeploy — set `ADMIN_TOKEN` (§6.1) and run `npm run backup` once.
Do it before there is a customer whose data you would have to apologise for.

Whoever changes any of this: update the three cells above with what you actually observed and the date,
not what you intend to do.

### 6.1 `npm run backup` — the primary path

The repo ships a self-hosted backup path that needs no Railway plan features:

```bash
ADMIN_TOKEN=… APP_URL=https://chartrelay.example npm run backup
```

`scripts/backup.mjs` downloads `GET /api/admin/backup` (a consistent `VACUUM INTO` snapshot, streamed),
writes it to `./backups/chartrelay-<date>-<time>.sqlite`, checks the SQLite header before keeping the
file, and prunes copies older than 14 days. Both values may live in `.env.local` instead of the command
line.

Before it works, set **`ADMIN_TOKEN`** (at least 24 characters, e.g. `openssl rand -hex 32`) as a Railway
variable and redeploy. Until then the endpoint answers **404** — deliberately, so an install that never
opted in does not advertise the route. A 401 means your local token does not match the server's, and a
429 means you hit the endpoint's own rate limit (5 attempts / 10 minutes per client).

The downloaded file is a complete copy of production: password hashes, API key hashes, every chart.
Treat it as a secret — keep it off shared drives and out of the repo (`backups/` must stay ignored).

Run it from a machine that is actually on, on a schedule you will notice failing (a `cron` entry plus a
calendar reminder to check `ls -lh backups/` weekly is enough for one person). Restore-test at least
once a quarter: §6.5 into a throwaway local checkout, not production.

### 6.2 Railway volume backups

Railway can snapshot a volume on a schedule and restore it (availability and retention depend on your
plan — check the volume's own panel in the dashboard, since the trial plan the service is on today may
not include it).

1. Railway → the service canvas → the volume → its **Backups**/settings panel.
2. Enable scheduled backups and set the retention you want.
3. Take one manual snapshot now, so a known-good point exists.
4. **Test the restore once.** An untested backup is a guess. Restore into a *new* service with its own
   volume, point a throwaway `APP_URL` at it, and confirm the app starts and old accounts are present.
   Never rehearse a restore over production.

### 6.3 Manual hot copy from inside the container (fallback)

Only when §6.1 is unavailable — no `ADMIN_TOKEN` set yet, or the route is not reachable.

**Precondition, discover it now rather than mid-incident:** `railway ssh` needs a Railway plan that
includes shell access into the running container. On the trial plan the service is on today it may
simply refuse. Run `railway ssh` once while nothing is on fire and record the answer in §6.0. If it is
not available, this section is not a fallback you have — §6.1 and §6.4 are the only paths.

SQLite is in WAL mode, so copying `chartrelay.db` with `cp` while the server writes can produce a
torn file. Use SQLite's online backup API, which the container already has via `better-sqlite3`:

```bash
railway ssh            # opens a shell in the running container; confirm with `railway ssh --help`
# inside the container:
node -e 'const D=require("better-sqlite3");const db=new D(process.env.DATABASE_PATH||"/app/.data/chartrelay.db",{readonly:true});const out="/app/.data/backup-"+new Date().toISOString().slice(0,10)+".db";db.backup(out).then(r=>{console.log("wrote",out,r);process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})'
ls -lh /app/.data
```

That produces a consistent snapshot **on the same volume** — it protects against a bad migration or an
accidental delete, not against losing the volume. Get it off the box as well: the simplest reliable way
is to stream it out over the same session, e.g. `railway ssh "cat /app/.data/backup-YYYY-MM-DD.db" >
backup.db` if your CLI accepts a command argument, or `base64 /app/.data/backup-…db` in the session and
decode locally. Verify whatever you download before trusting it:

```bash
node -e 'const D=require("better-sqlite3");const db=new D("backup.db",{readonly:true});console.log(db.pragma("integrity_check"));console.log(db.prepare("select count(*) c from users").get())'
```

Delete the in-volume copy afterwards so backups do not eat the disk (they count against the volume, and
they contain password hashes and API key hashes — treat the file as a secret).

### 6.4 Cold copy (with downtime)

Cleanest and slowest: stop the service (Railway → the deployment → **Remove**/pause, or scale to 0 if
your plan allows), then copy `chartrelay.db` plus `chartrelay.db-wal` and `chartrelay.db-shm` together.
Copied alone, the `.db` file may be missing the newest committed transactions that still live in the
WAL.

### 6.5 Restore

1. Stop the service so nothing writes during the swap.
2. Put the snapshot in place as `/app/.data/chartrelay.db` and **delete any stale `-wal` and `-shm`
   files** beside it — they belong to the old database and will corrupt the restored one.
3. Start the service. Migrations are idempotent and re-run on boot.
4. Verify: `npm run check:uptime`, then log in and confirm an account, an API key and a plan look right.
5. **Reconcile Stripe.** Subscription state that changed after the snapshot is not in the restored
   database. In the Stripe Dashboard, resend recent `customer.subscription.*` and
   `checkout.session.completed` events to the webhook endpoint; the app is idempotent, so replaying is
   safe and repairs plans.

---

## 7. Disk and volume sizing

Everything is in one SQLite file. What grows:

| Data | Growth | Bounded? |
|---|---|---|
| `renders` — spec, SVG text, alt text, warnings | ~2.5–10 KB per render (a 4-bar chart measured **2.4 KB** of SVG on 2026-09-22) | **No.** Grows forever unless you prune. |
| `renders.png` — cached PNGs | up to 512 KB each, 200 MB total by default | Yes — `PNG_CACHE_MAX_BYTES` |
| `usage_events` — one row per render | tens of bytes | No, but negligible |
| `users`, `workspaces`, `api_keys`, `auth_tokens`, `stripe_events` | small | Effectively yes |
| `rate_limits` | pruned to the last hour automatically | Yes |
| WAL file | transient, checkpointed | Yes |

Rule of thumb: **volume ≥ PNG cache budget + (expected renders × 10 KB) + 1 GB headroom.** At Scale
limits (100,000 renders/month) the SVG text alone is roughly 250 MB–1 GB per month, which is the number
to plan around — not the PNG cache.

`PNG_CACHE_MAX_BYTES` (integer bytes; `200MB` would parse as 200 bytes) caps stored PNGs. When the
total exceeds it, the oldest PNGs are cleared down to 80% of the budget and are re-rasterized on the
next request — the chart is never lost, only the cached bitmap. Today's deployment sets **100 MB**,
sized for the trial volume. Lowering it frees space at the cost of CPU on cache misses; raising it
trades disk for speed. Keep it well under the volume size, since the same disk holds the rest of the
database, the WAL, and any backup you leave there.

Watch the volume's usage graph in Railway. When the SVG text (not the PNG cache) is what fills it,
the answer is a retention policy for old renders — there is none in the code today, so that is a
product decision to make before it becomes urgent.

---

## 8. The daily status agent

A Claude scheduled task named `chartrelay-status-agent` runs each morning (about 9:05 local) and
maintains **`docs/STATUS.md`**: the current phase, the production URL and hosting facts, a health table
(lint, tests, build, audit, the production smoke checks), recent changes, and the "Waiting on the owner"
list. It is defined in the Claude scheduled-tasks UI, not in this repository, so this file cannot be
the source of truth for its schedule or prompt — check the task itself.

How to use it: read `docs/STATUS.md` first each day. Treat its health table as a *report*, not a
monitor — it records what was true when the agent last ran. If an item there is stale or contradicts
what you see, trust `npm run check:uptime` and the Railway dashboard, and fix the file.

---

## 9. Incident checklists

Start every incident with `npm run check:uptime -- --json` and a look at Railway logs; both are
read-only and take seconds. Write down the time you started.

### A. Site down

1. `npm run check:uptime`. Which checks fail — all of them (the service), or one (a route)?
2. All failing / connection refused → is the service running at all? Railway → Deployments: crashed,
   building, or restarting? Read the deploy log.
3. `health` failing while pages answer → database, not web: [When health is red](#4-when-health-is-red).
4. Pages failing while `health` passes → the app is up but rendering broke: look for a recent deploy and
   roll back.
5. `render` failing while everything else passes → the site is up and the product is not. Charts are
   what customers pay for, so treat it as an outage: check the logs for `Chart render failed:` and roll
   back the last deploy. A `warn` there is only the demo rate limit; re-run the check in a minute.
6. Everything green from your machine but users report an outage → DNS or certificate. Check the custom
   domain's status in Railway → Settings → Networking, and try the `*.up.railway.app` URL directly. If
   the Railway URL works and the custom domain does not, it is DNS/TLS, not the app.
7. Mitigate first ([rollback](#5-rolling-back-a-deploy) or restart), then diagnose from the logs you
   saved.

### B. Billing broken

Symptoms: upgrade button errors, a paying customer still shows Free, or plans do not change.

1. `npm run check:uptime` — a `warn` on `billing-webhook` means `STRIPE_WEBHOOK_SECRET` is missing;
   everything else billing-related will be broken downstream of that.
2. Stripe Dashboard → Developers → Webhooks → the endpoint → recent deliveries. 4xx/5xx responses name
   the problem: 503 (no secret configured), 400 (bad signature — the secret belongs to a *different*
   endpoint or to `stripe listen`), 500 (processing threw; the app does not record it, so Stripe
   retries).
3. Check that key and price IDs are in the **same mode**: a test-mode key with live price IDs, or the
   reverse, fails. `STRIPE_LIVE_MODE=enabled` is required for any `*_live_*` key.
4. After fixing a variable and redeploying, **Resend** the failed events from the Stripe Dashboard.
   Processed event ids are recorded, so replays cannot double-apply.
5. A customer is charged but shows Free with no failed deliveries → open their subscription in Stripe,
   confirm which price it uses; an unrecognized price logs `uses an unrecognized price` and leaves the
   plan alone. That means `STRIPE_PRICE_PRO`/`STRIPE_PRICE_SCALE` do not match the live prices.
6. `[billing-alert]` in the logs is its own incident: cancel and refund the duplicate subscription in
   Stripe the same day, then check the workspace's plan.
7. Never debug billing by making Stripe API calls with production keys from a laptop. The Dashboard
   shows everything needed.

### C. Emails not sending

Today's production deployment has **no email provider configured**. Verification emails are therefore
not delivered: in production `sendEmail` throws and the route logs `Verification email failed:`. The
product now says so rather than pretending otherwise — `/forgot-password` replaces its form with a
notice and sends people to `/support`, and `/support` bucket 06 explains the state — but an unverified
free account has **0 renders/month** instead of 250, so it cannot render at all, and a customer who
forgets their password has no self-service route back in. This is a real customer-facing defect, and it
is more serious than it was under the old ladder, where unverified still meant 100 renders.

1. Startup logs: a `[config] WARNING` about `EMAIL_PROVIDER` means nothing has been configured yet →
   follow the Resend setup section in `docs/DEPLOY.md`. That is the fix; there is no workaround.
2. Configured but failing: `Email provider rejected the message (HTTP …)` names the provider's status.
   401/403 → bad or revoked `RESEND_API_KEY`. 403/422 → `EMAIL_FROM` is not on a verified domain.
   429 → sending rate limit.
3. Accepted by the provider but not in the inbox → deliverability, not the app. Check the provider's
   delivery log for bounces/spam, and re-check SPF, DKIM and DMARC for the sending domain.
4. Unblock an affected customer meanwhile — raise their limit by hand:

   ```
   npm run verify:user -- them@example.com https://chartrelay.dev
   ```

   That is `POST /api/admin/users/verify-email`, authorized by `ADMIN_TOKEN`. It marks one account's
   email confirmed, which is what lifts a free workspace from 0 to 250 renders/month. It is
   idempotent, it changes nothing else, and it logs the user id without the address. This is the lever
   `/register` promises when it says support can raise the limit by hand — it does not fix password
   lockout, which still needs working email.
5. A locked-out customer (forgotten password, no email) still cannot be let back in. There is no
   workaround for that one; ship the provider.
6. Verify the fix end to end by registering a fresh account and watching the email arrive in a real
   inbox — the same check as in the deploy acceptance list.

---

## 10. Routine maintenance

Weekly, or after any change:

- `npm run check:uptime` (add `--json` if you keep the output).
- Skim Railway logs for `[billing-alert]`, `[config]`, and `SQLITE`.
- Check the volume's used space against [sizing](#7-disk-and-volume-sizing).
- Confirm a backup exists and is recent; restore-test it at least once a quarter.
- `npm audit`, `npm run lint`, `npm test` locally before pushing anything.
- In Stripe, confirm no webhook deliveries are failing.

Before touching production data by hand: take a snapshot first (§6.1), and prefer a one-off script over
an interactive shell — you cannot undo a typo in `sqlite3`.
