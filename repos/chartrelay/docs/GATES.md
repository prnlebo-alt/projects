# Gates

The four things that must be true before ChartRelay can take money from a stranger, plus the two
approval points in the review that follows. Each gate is either **OPEN** (waiting on the owner),
**IN PROGRESS** (waiting on the build session), or **CLOSED**.

Gates are worked **in order**. Nothing below an open gate is prompted for until it closes.

**The owner never pastes a secret into chat.** When a secret is needed, this file names the exact
variable and where to set it. The build session reads secrets from `.env.local` or from the deployed
environment; it never prints one, and it never asks for one in conversation.

---

## Gate A — Email · **CLOSED except one untested path**

Production sends email. `chartrelay.dev` is verified at Resend (DKIM and both SPF CNAMEs reading
*Verified*, DMARC resolving), the API key authenticates and is scoped to sending on that domain only,
and Railway carries `EMAIL_PROVIDER`, `EMAIL_FROM`, `SUPPORT_EMAIL` and `RESEND_API_KEY`.

**Proven, not assumed:**

| Check | Evidence |
|---|---|
| Key authenticates, correctly scoped | `GET /domains` returns 401 `restricted_api_key` — a key that could list domains would be over-permissioned |
| Domain accepted as a sender | direct send accepted, message id returned |
| The deployed app sends | password reset triggered against production, **Delivered** in Resend's log |
| Third-party acceptance | Yahoo accepted it; Gmail accepted the earlier one |
| Degraded copy retired itself | `/register`, `/forgot-password`, `/support` all clean — the copy reads `emailDeliverable()` and switched on deploy with no code change |

**The gap, stated plainly:** the *confirmation* email on sign-up has not been exercised, because doing
so means registering an account with a real inbox and the build session does not create accounts. The
code path is shared with the reset mail that did deliver, so the risk is low — but it is untested, and
low risk is not the same as tested. Register once at `/register` with a real address to close it.

A second gap: nobody has opened either delivered message. "Delivered" is Resend's word for the
receiving server accepting it — it does not prove the link inside works, or that the message landed in
an inbox rather than a spam folder. A brand-new sending domain with `p=none` and no sending history is
exactly the profile Gmail and Outlook treat cautiously at first. That is what the deliverability probe
in the review is for.

### What the owner does

1. **Create a Resend account** at <https://resend.com>. The free tier sends 3,000 emails a month,
   100 a day, which is far more than this deployment needs.
2. **Add the domain** `chartrelay.dev` under **Domains → Add Domain**. Region: pick the one closest to
   the Railway deployment. Do **not** add DNS records yet — the build session reads them from Resend's
   API and hands back the exact values to paste into Namecheap.
3. **Create an API key** under **API Keys → Create API Key**, permission **Sending access**, domain
   `chartrelay.dev`.
4. **Set the key in two places.** It is the one secret the owner sets personally:
   - Railway → service `chartrelay` → Variables → `RESEND_API_KEY`
   - Locally, appended to `~/Projects/chartrelay/.env.local` as `RESEND_API_KEY=re_…`
     (the build session needs it to read the DNS records, poll verification and send the test emails;
     it only ever reports the prefix and the length).
5. **Set three more Railway variables** — none of them secret:

   | Variable | Value |
   |---|---|
   | `EMAIL_PROVIDER` | `resend` |
   | `EMAIL_FROM` | `no-reply@chartrelay.dev` |
   | `SUPPORT_EMAIL` | `support@chartrelay.dev` |

6. Say so here, and the build session takes over.

### Progress

- **Done:** `EMAIL_PROVIDER=resend`, `EMAIL_FROM=no-reply@chartrelay.dev` and `SUPPORT_EMAIL` are set
  in Railway and deployed. Safe to deploy without the key: registration already catches a failed send
  and logs it, and `emailConfigured()` stays false until all three of provider, key and from exist, so
  the honest-degradation copy is unchanged.
- **Done:** the domain is registered in Resend (region us-east-1) and its DNS records are below.
- **Done:** all four DNS records added at Namecheap by the build session and confirmed resolving from
  1.1.1.1 — DKIM, both SPF CNAMEs and DMARC. The ALIAS on `@`, the `_railway-verify` TXT and the apex
  SPF for email forwarding were left untouched, and `chartrelay.dev` and its MX records still resolve.
- **In progress:** Resend verification triggered; status moved from *Not Started* to **Pending**
  ("Looking for DNS records"). Resend warns this can take a few hours on Namecheap.
- **Blocked:** `RESEND_API_KEY` is not set anywhere yet. Until it is, `emailConfigured()` stays false,
  the honest-degradation copy stays up, and no email can be sent even once the domain verifies.

### The four DNS records

Read from Resend's own page data rather than its display, which truncates the DKIM key with an
ellipsis. Namecheap → Domain List → **Manage** → **Advanced DNS** → Add New Record.

Enter the Host **exactly as written here**. Namecheap appends `.chartrelay.dev` itself; pasting the
full name silently creates `resend._domainkey.chartrelay.dev.chartrelay.dev` and verification then
never passes. TTL stays **Automatic** for all four.

| Type | Host | Value |
|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDPjS8pNBLg5BlpRAOOB8hFj9j1CE5u8P3M/Kh7qO+HxFxTvsoPQHRvn829YNbofUzE40lUsGYeDA7Wrlb1DlFVJ/408sBp9HiIwegRD2D3+iAgD7l+IpwqYEzc7bmfkqWzTlkKKt0SIDfAl02ldkPfvcUVnYMy6lNFKCbypfG06wIDAQAB` |
| CNAME | `rsend` | `rsend.forge.rmta.net` |
| CNAME | `send` | `send.forge.rmta.net` |
| TXT | `_dmarc` | `v=DMARC1; p=none;` |

DMARC is marked optional by Resend and is being added anyway: Gmail and Outlook increasingly treat
its absence as a spam signal, and those two are exactly what the deliverability test targets.

**Two records must not be touched:** the **ALIAS** on `@` pointing at Railway, which is the live site,
and the **MX** records for Namecheap email forwarding, which is what makes `support@chartrelay.dev`
work. Resend's SPF uses a `send` CNAME rather than an apex TXT, so it does not collide with either.
- Polls Resend until the domain verifies.
- Sends a real confirmation email, a real password-reset email and a real support email, and confirms
  each one arrives, renders and has a working link.
- Removes the honest-degradation copy from `/forgot-password`, `/register` and `/support`, which
  currently tells people email is switched off. That copy is guarded by tests, so it comes out in the
  same commit as the change that makes it untrue.

---

## Gate B — Legal · **IN PROGRESS, two answers outstanding**

`/terms` and `/privacy` used to be live with seven bracketed placeholders across them — the first two
pages a procurement review opens, advertising that nobody had finished them. They are gone.

### Status: mostly done, two facts outstanding

The placeholders are gone from both live pages. Every fact now comes from the environment, and a fact
that is not set omits its sentence rather than printing a bracket. What renders today:

| Fact | Source | Today |
|---|---|---|
| Legal name | code (`LEGAL_NAME`) | MadPugExperiment LLC — **confirm the exact spelling** |
| Contact | `SUPPORT_EMAIL` | support@chartrelay.dev |
| Postal address | `BUSINESS_POSTAL_ADDRESS` | unset → no address line (see the SPEND gate) |
| Effective date | `LEGAL_EFFECTIVE_DATE` | unset → line omitted; filled at `/ship` |
| Governing law | `LEGAL_GOVERNING_STATE` | unset → **clause omitted entirely** |
| Subprocessors | code | Railway, Resend, Stripe |

### What the build session needs from the owner

1. **Legal name spelling** — capitalisation, spacing, and whether it is `LLC`, `L.L.C.` or something
   else. It goes on a contract, so it is worth being exact about.
2. **Governing-law state** — Railway variable `LEGAL_GOVERNING_STATE`. Until it is set the terms have
   **no governing-law clause at all**, which is a materially weaker contract. Florida, on what the
   build session knows of the LLC; confirm rather than assume.

No address is requested here, and none should ever be given here. See the SPEND gate.

### Done without input

Subprocessors are listed from code so the page and any future DPA cannot drift: **Railway** (hosting),
**Resend** (account email), **Stripe** (payments). No font or CDN host is listed because this
deployment serves its fonts from its own container — checked, not assumed.

`/privacy` already carries the data section: what is stored, how long, that export and deletion are
self-service from the dashboard, and that a chart URL is not secret because it carries its own data.

---

## Gate C — Stripe keys and history · **CLOSED for the secret key**

The sandbox secret key and restricted key appeared on screen during an earlier working session. They
are test-mode keys, so the blast radius is a sandbox — but they must not survive into live mode.

### Done

The secret key was rotated on 2026-09-24 with a **24-hour expiry on the old one**, so there was no
window where checkout was broken — both keys were valid while the new one was deployed and verified.
The old key ended `bmDM`; the new one ends `cglx`.

| Check | Result |
|---|---|
| New key authenticates | `GET /v1/balance` → 200 |
| Reads the existing prices | Pro $29/mo and Scale $99/mo, both active, **neither recreated** |
| Performs the real operation | a Checkout session was created against the Pro price — `status=open`, `livemode=false`, URL issued |
| Production picked it up | unsigned webhook returns **400**, not 503, so billing config loaded |
| Webhook untouched | Stripe's own rotation notice: endpoints created with a key stay active, so `STRIPE_WEBHOOK_SECRET` did not change |

### Git history: clean

Every blob in all 58 commits, every tracked file, and every commit message, checked against ten
credential shapes — Stripe secret/restricted/webhook, Resend, AWS, GitHub, OpenAI, private-key blocks
and JWTs. **Seven hits, all test fixtures**: literal strings such as `sk_test_fake_unit`
in `vitest.config.ts`. No real credential has ever been committed to this repository.

### Still open

The **restricted key** (`rk_test_…`) has not been rotated. It shows `Last used: —` — nothing has ever
called it, so nothing depends on it. Rotating it is hygiene; deleting it is better, because an unused
credential in a dashboard is only ever a liability.

Worth keeping in proportion: these are **sandbox** keys. Stripe's own banner says changes there do not
affect real customers or payments. The exposure was never dangerous; the rotation was practice for the
day live keys exist, and that practice is now done.

---

## Gate D — Railway plan · **CLOSED**

On the **Hobby** plan ($5/month plus usage) as of 2026-09-24. The trial is gone, and with it the
expiry that was 28 days out.

- **Volume survived the plan change** — checked, not assumed: 5 users and 8 renders still present in a
  backup taken afterwards.
- **`www.chartrelay.dev` added.** The one-domain limit is lifted; the `www` CNAME and its
  `_railway-verify.www` TXT are in at Namecheap and resolving. The ALIAS on `@`, the MX records and
  the Resend DKIM were all re-checked afterwards and are intact.

**The upgrade did not buy backups.** Railway states plainly that creating backups and point-in-time
recovery are **Pro-plan only** — Hobby does not include them. The self-hosted `npm run backup` path
in `docs/OPERATIONS.md` §6 therefore remains the only backup story, and that document stays correct
as written. Worth being blunt: the gate's original justification listed "no managed volume backups"
as a trial limitation, and that one is still true on Hobby.

Still outstanding, unchanged by the upgrade: **no restore has ever been rehearsed** (§6.5), and the
local backup only runs when this Mac is on.

---

## Gate S — Postal address and lifecycle email · **OPEN, waiting on owner**

**The owner runs this company from home, and that address is never published.** Not on the site, not
in a legal page, not in an email footer, not in the repository, and not in a commit. An address on a
terms page is scraped, mirrored and archived within days; no later edit takes it back.

The working tree, all 52 commits and every commit message have been scanned for street lines, PO
boxes and `CITY, ST 00000` tails. **Nothing was found** — there is no address to remove. A test now
fails if one is ever written into `src/`, so the only place one can live is an environment variable.

### What this blocks today

Lifecycle email — onboarding nudges, upgrade prompts, product news — **cannot be sent**. CAN-SPAM and
its equivalents require a physical postal address on that kind of message, so `sendEmail` refuses any
message marked `kind: "lifecycle"` and logs the refusal. Transactional email is untouched:
confirmations, password resets and receipts always send, address or no address.

### What the owner does

1. Get a **virtual mailbox** — a commercial mail-forwarding address. Anything that gives a real street
   address the business may publish. This costs money, which is why it is its own gate.
2. Set it in Railway as `BUSINESS_POSTAL_ADDRESS`, one line, exactly as it should appear in public.
3. Say so here. **Do not put the address in chat** — set the variable and say it is set.

### What the build session does

Confirms it renders on `/terms`, on `/privacy` and in the footer of a lifecycle email, confirms a
transactional email still does **not** carry it, and then unblocks lifecycle sending.

---

## Gate E — Visual baselines · **OPEN, waiting on owner — but no longer blocking**

The review is **complete**. Three reviewers ran read-only in a fresh session with no shared context:
visual, abuse and security. They found 4 blockers, 11 serious and 11 minor visual defects, no critical
or high security findings, and two architectural abuse findings. Every blocker and every serious
finding is fixed, deployed and verified on production by opening the rendered image — see
`docs/DEPLOY_READINESS.md` and `reports/`.

Three rounds of re-checks followed, each verified against the deployed build rather than the working
tree. Two of the reviewer's own findings were withdrawn after the build session could not reproduce
them and sent back measurements; both corrections are recorded in `reports/VISUAL_REVIEW.md`.

**What is still owed here:** the owner looking at the golden set in `reports/golden/` and agreeing the
charts are right, before those images are frozen as pixel-diff baselines. A baseline approved without
being seen just freezes whatever bug it contains, which is the exact failure that put tofu boxes into
production for weeks.

This no longer blocks Gate F. The regression tests it would add are a ratchet against future change,
not a condition of the current build being correct — that has been established by rendering and
reading the images.

---

## Gate F — Ship · **READY, waiting on `/ship`**

`docs/DEPLOY_READINESS.md` is written. The build session has stopped.

**Only two things stand between here and taking money, and both are the owner's:**

1. **Gate S** — a virtual mailbox, then `BUSINESS_POSTAL_ADDRESS` in Railway. Until then lifecycle and
   marketing email cannot go out. Transactional mail is unaffected.
2. **`/ship`** — switching Stripe from test to live keys.

Everything else is done. Switching Stripe to live mode happens on the owner's explicit `/ship`, and
not before.

After ship, the listings work (MCP registry, n8n node, Show HN) is drafted and held at the **PUBLISH**
gate — nothing is posted anywhere public without the owner reading it first.
