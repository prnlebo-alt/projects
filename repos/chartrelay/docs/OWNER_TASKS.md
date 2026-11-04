# The three things left

Everything else is done, deployed and verified. These three need you, and nothing else does.

Run `npm run owner:status` at any point to see which are still outstanding, checked against the live
site rather than from memory.

---

## 1. A business postal address · Gate S

**Why this exists:** CAN-SPAM requires a physical postal address in any marketing or lifecycle email.
You run this company from home, and a home address published on a terms page is scraped, mirrored and
archived within days — no later edit takes it back. So the code was built to have no default: while
`BUSINESS_POSTAL_ADDRESS` is unset the legal pages omit the address line entirely, and every
non-transactional email is refused and logged rather than sent without one.

**What still sends today:** receipts, sign-up confirmations and password resets. Those are
transactional, they need no postal address, and withholding one would strand a customer mid-task.

**What is blocked today:** anything promotional — upgrade nudges, onboarding sequences, newsletters.

### A correction to something I said earlier

I implied a street address was required. It is not. The FTC's CAN-SPAM compliance guide names three
acceptable options: a street address, **a PO Box registered with USPS**, or **a private mailbox
registered with a commercial mail receiving agency**. All three satisfy the law. A street address is a
credibility preference on a terms page, not a legal requirement.

### Check this first — it may be the bigger problem

Florida publishes your **registered agent address and principal office address on Sunbiz**, in
unredacted PDFs, under the Sunshine Law. If MadPugExperiment LLC currently lists your home address
there, **it is already public**, and a mailbox that only fixes the website fixes half the problem.

Look up the LLC on [Sunbiz](https://search.sunbiz.org) before choosing a provider. If a home address is
on that filing, pick a provider that can serve as registered agent too, and change both at once.

### What to do

1. Get a virtual mailbox (options below). You will need **USPS Form 1583**, which normally requires a
   notary and two forms of ID — the recommended provider does it for you, online and free, which is
   worth more than a couple of dollars a month of price difference.
2. **Ask the provider for the exact line-by-line address to publish.** USPS rules require mail to a
   CMRA to carry a `PMB` or `#` designator, and explicitly prohibit combining a suite element with the
   mailbox number. Several providers market a "unique suite number" rather than a PMB. Publishing a
   format USPS will not deliver to defeats the entire point, so get it in writing before it goes on
   your terms page.
### Which provider

Prices verified against vendor pricing pages on 2026-09-24. Beware searching this yourself: several
high-ranking "best virtual mailbox" articles are AI-generated with badly wrong prices.

| Provider | Florida address | Cost | Form 1583 notarisation |
|---|---|---|---|
| **Florida Registered Agent LLC** | St. Petersburg, real street | **$49/yr**, or **$98/yr** with your own suite number | **Free, online, they do it** |
| Anytime Mailbox | 243 FL locations incl. Miami, Tampa | $5.99–$9.99/mo | ~$25 via partner notary |
| iPostal1 | Many FL | $14.99/mo for a business name | $25 |
| VirtualPostMail | Brandon FL | $20/mo, registered agent included | Waived via selfie-with-ID |
| Stable / LegalZoom | Not confirmed / Miami | $39–$59/mo | — |

**Recommended: Florida Registered Agent LLC at $98/year.** It is roughly $8 a month, it is a genuine
Florida street address, it notarises Form 1583 for you at no charge, and — the reason it wins — it is
registered-agent-first, so the same address can serve as registered agent, principal office, mailing
address and the CAN-SPAM footer. That solves the Sunbiz exposure above and the terms-page address in
one purchase. Take the $98 tier over the bare $49 for your own suite number rather than a shared
building address.

**Runner-up: Anytime Mailbox at $9.99/month** if you want the address decoupled from your registered
agent, or want a specific city — a Miami address photographs well on a SaaS site. Roughly $120/year
plus a ~$25 notary fee, and scanning terms vary by individual operator, so check the specific location.

Avoid Stable and LegalZoom at your volume: 5–12× the cost for no benefit. Earth Class Mail no longer
exists independently — it redirects to LegalZoom.

Mail volume for a pre-revenue product will be near zero, so low scan allowances are not a real
constraint.

### Setting it

1. Set it in Railway → service `chartrelay` → **Variables**:

   ```
   BUSINESS_POSTAL_ADDRESS=123 Example St Ste 400, Cityname FL 33101
   ```

2. **Click Deploy.** Railway stages variables and does not apply them until you do. This has already
   caught us once — `LEGAL_GOVERNING_STATE` was set and left unstaged, and `/terms` silently had no
   governing-law clause for a day.
3. Verify: `npm run owner:status` — it reads `/terms` and tells you whether an address is actually
   published.

### While you are there

Two more variables, both optional and neither blocking:

| Variable | Value | Effect while unset |
|---|---|---|
| `LEGAL_EFFECTIVE_DATE` | `2026-10-01` or whenever you launch | `/terms` claims no effective date rather than a false one |
| `LEGAL_DBA` | `MPE Labs`, **only after** filing a Florida fictitious name (§865.09) | Legal pages name MadPugExperiment LLC alone, which is the honest default |

Do not set `LEGAL_DBA` before the filing exists. Asserting an unregistered "doing business as" on a
legal page is a claim the state has not agreed to.

**You may not need a DBA at all.** If the product is sold under the LLC's registered name, nothing is
required. Two things to know if you do file one: §865.09 requires certifying that intent to register
was advertised in a newspaper **in the county of your principal place of business** — which would be
Pinellas County if you use the St. Petersburg address, a county you do not operate in. Legal, but a
mismatch worth a call to the Division of Corporations (850-245-6058) first. And if you want the brand
protected rather than merely declared, a fictitious name registration is not a trademark and does not
stop anyone else using "MPE Labs".

---

## 2. Look at the baseline set · Gate E

**Why this exists:** the review found four blocking visual defects that a fully green test suite had
been passing over for weeks — including every chart being drawn in tofu boxes. A test can tell you a
chart was produced. Only looking tells you it was right.

These 30 charts are about to be frozen as pixel-diff baselines, meaning any future change that alters
them fails the build. **A baseline approved without being looked at freezes whatever bug it contains**,
which is exactly how the tofu shipped.

### What to do

```bash
npm run golden
```

That renders the set from live production into `reports/baseline/` and writes a contact sheet. Then
open `reports/baseline/index.html` in a browser.

Scroll through it. You are not judging whether they are beautiful — you are checking that nothing is
**wrong**: no clipped text, no overlapping labels, nothing unreadable, no number that contradicts the
bar beside it. Every caption says what that image is testing and what used to be broken about it.

- **If it all looks right**, say so and I will add the regression tests that freeze it.
- **If anything looks wrong**, name the file. It gets fixed before it is frozen.

It should take about five minutes.

---

## 3. Switch Stripe to live · Gate F

**Do this last**, after the other two.

### The trap, first

**Price IDs are mode-specific.** The live key will not recognise the current `price_…` IDs, because
those are test-mode objects. If you swap only the key, checkout fails at the moment a real customer
clicks Subscribe, with an error that looks like their fault and happens in front of them.

In the Stripe dashboard, switch to **live mode**, open each product, and use **Copy to live mode** —
then take the *new* price IDs. This does not duplicate anything in test mode; live and test are
separate ledgers and always have been.

### What to do

1. In Stripe, turn **Test mode** off.
2. Copy both products to live mode; note the new `price_…` IDs.
3. Create a **live-mode webhook endpoint** pointing at `https://chartrelay.dev/api/billing/webhook`.
   It is a different object from the test-mode one and has its **own signing secret**. Send it the same
   events the test endpoint receives.
4. **Check it before you deploy it.** Locally, with the live values in your environment:

   ```bash
   npm run ship:preflight
   ```

   It authenticates the key, confirms both prices exist in live mode, are active and are recurring,
   confirms a webhook endpoint exists, and names anything that is wrong in plain language. It never
   prints a secret — only a recognised prefix and a length.

5. Set all four in Railway and **click Deploy**:

   ```
   STRIPE_SECRET_KEY=sk_live_…
   STRIPE_WEBHOOK_SECRET=whsec_…      (the live endpoint's secret, not the test one)
   STRIPE_PRICE_PRO=price_…           (the live price)
   STRIPE_PRICE_SCALE=price_…         (the live price)
   ```

6. **Buy your own product.** Use a real card, subscribe to Pro, confirm the plan changes in the app,
   then cancel and refund yourself. Nothing else proves the whole path — key, price, checkout, webhook,
   database write — actually works end to end. A test-mode success does not, because the webhook
   secret, the price and the key are all different objects in live mode.

7. Tell me `/ship` and I will draft the listings — MCP registry, n8n node, Show HN — and hold them at
   the PUBLISH gate. Nothing gets posted anywhere public until you have read it.

---

## Not tasks

Three decisions I flagged that are **not** blocking and should not be treated as a list:

- **No CDN in front of chartrelay.dev.** Only matters once traffic exists. A spend decision.
- **`?key=` in chart URLs.** URL signing is the better design, and this is the one item that gets more
  expensive the longer it ships — worth deciding before customers depend on it, not urgent today.
- **Gmail and Outlook inbox placement** has never been checked with a real message. Only matters once
  you are emailing customers.

You could ship, get no sign-ups for a fortnight, and correctly do none of them.
