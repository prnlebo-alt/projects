> **DRAFT — NOT LEGAL ADVICE. REQUIRES LAWYER REVIEW BEFORE PUBLICATION.**

# Terms of Service

The billing spec marks Terms of Service with ⚖ — lawyer review is required before this text is
published or relied on. Sections flagged ⚖ below are the ones where a lawyer's answer changes the
wording, not just the style.

**Identity values are not written in this file.** The published page must render them from
`src/lib/business.ts`, which is the single source of truth. Retyping them anywhere else is how a
terms page and a receipt end up naming two different companies.

| Token used below | Source in `src/lib/business.ts` | Value today |
|---|---|---|
| `{{contractingParty()}}` | `contractingParty()` / `LEGAL_NAME` | MadPugExperiment LLC — there is no registered Florida fictitious name, so the LLC is named alone |
| `{{DISPLAY_NAME}}` | `DISPLAY_NAME` | MPE Labs (brand only; never the contracting party) |
| `{{supportEmail()}}` | `supportEmail()` ← `SUPPORT_EMAIL` | support@chartrelay.dev |
| `{{postalAddress()}}` | `postalAddress()` ← `BUSINESS_POSTAL_ADDRESS` | **unset** — `[TO BE COMPLETED: virtual-mailbox postal address. Deliberately blank: the owner runs the company from home and a home address on a terms page cannot be withdrawn once scraped.]` |
| `{{effectiveDate()}}` | `effectiveDate()` ← `LEGAL_EFFECTIVE_DATE` | **unset** — `[TO BE COMPLETED: effective date, set at publication]` |
| `{{governingLawState()}}` | `governingLawState()` ← `LEGAL_GOVERNING_STATE` | **unset in the environment; must be set to `Florida`** |

---

Effective date: {{effectiveDate()}}

These terms are an agreement between you and {{contractingParty()}} ("we", "us"), which operates
ChartRelay. They cover the ChartRelay website, dashboard, chart rendering API and MCP server
(together, the "Service"). By creating an account, buying credit, or calling the API you agree to
them. If you agree on behalf of a company, you confirm you can bind it.

ChartRelay is a product of {{contractingParty()}}. "MPE Labs" and "ChartRelay" are brand names. The
company you contract with is the LLC named above.

## 1. Your account and your keys

You need an account and an API key to use the API. Keep both secret.

- A secret key (`cr_live_…`), a signing secret (`crsig_…`) and a session are credentials. Treat them
  like a password.
- You are responsible for everything done with your keys, including renders, charges and content,
  whether or not you authorised them. **If a key leaks, the usage it incurs is yours.**
- We give you tools to limit that damage: per-key budgets, scopes, expiry, IP allowlists and instant
  revocation. Use them.
- Revoke a leaked key in your dashboard immediately, then email {{supportEmail()}}. We may revoke a
  key ourselves if we believe it is compromised.
- You must be 18 or older.

We show a full key once, at creation. We store only a hash and a prefix, so we cannot recover a key
for you.

## 2. Acceptable use

Your use of the Service is subject to our Acceptable Use Policy, which forms part of these terms and
is incorporated by reference. See `AUP.md` (published at /aup). It prohibits, among other things,
illegal and infringing content, child sexual abuse material, phishing imagery, probing our
infrastructure, working around metering, reselling keys, and use by sanctioned persons.

## 3. Your content

You keep ownership of the chart specifications and data you send ("Your Content") and of the charts
rendered from them. You give us permission to store, process and serve Your Content only as far as
needed to run, secure and support the Service.

Rendered chart URLs are public to anyone holding the link. Do not put confidential data in a chart
unless you accept that.

Where Your Content includes personal data, our Data Processing Addendum (`DPA.md`) applies and you
are the controller.

## 4. Metering and billing

**Prepaid only.** There is no postpaid billing and no invoice at the end of the month. You pay
first; your keys then draw on credit you already hold. We never bill you past what you prepaid.

Credit reaches your account two ways:

- a **subscription**, which grants a fixed number of renders each billing cycle; and
- **render packs**, one-time purchases that work with or without a subscription.

Current plans, prices, included renders and pack sizes are on the pricing page. Prices are in US
dollars.

How usage is counted:

- One successful render of one chart is one unit, unless the pricing page says otherwise for a
  format.
- Usage draws from your monthly allowance first, then from packs.
- **A monthly allowance does not roll over.** It resets at the start of each cycle and unused
  renders are gone.
- **Failed renders, renders rejected by validation, and cache hits are never charged.** If a render
  fails after a unit was reserved, we refund the unit.
- Retries sent with the same `Idempotency-Key` return the stored result and cost nothing extra.
- Every response carries your remaining balance in `X-ChartRelay-Credits-Remaining`.

**Our ledger is the record.** Usage is metered by our own append-only ledger, not by the payment
provider. That ledger is the authoritative record of what you used and what you have left. If you
think it is wrong, email {{supportEmail()}} within 60 days of the charge and we will investigate and
correct genuine errors. ⚖ *Lawyer: confirm this dispute window and that it does not cut off rights a
consumer cannot waive.*

**Running out.** When your allowance and packs are exhausted, the API returns `402
credits_exhausted` with a top-up link. It does not keep rendering and bill you later.

## 5. Prepaid credits and expiry

- Credit is a prepaid entitlement to renders. **It is not money, has no cash value, earns no
  interest, and cannot be transferred, sold or exchanged for cash** except where the law requires.
- **Render packs expire 12 months after purchase.** Unused renders in an expired pack are forfeited.
  We email you 14 days and 3 days before a pack with credit left expires.
- Monthly allowances expire at the end of each cycle (section 4).
- We draw from credit that expires soonest first.
- Credit we give you for goodwill or as a service credit may carry a shorter expiry, which we will
  tell you at the time.

⚖ *Lawyer: credit expiry and forfeiture is the clause most likely to be unenforceable in some
consumer jurisdictions (US state gift-card analogues; EU/UK unfair terms). Confirm the 12-month
expiry survives for consumer buyers, and whether it must be disclosed at checkout as well as here.
The spec already requires the expiry to appear in checkout.*

## 6. Subscriptions, auto-renewal and cancellation

- Subscriptions are billed in advance and **renew automatically** each cycle until you cancel.
- You consent to automatic renewal by ticking an unticked box at checkout. We keep a record of that
  consent.
- You can cancel at any time, yourself, from your dashboard. No email or phone call is needed.
- Cancellation takes effect at the end of the cycle you have paid for. You keep paid features until
  then.
- We send an annual reminder that the subscription is still running.
- **Auto top-up is off by default.** If you turn it on, you set the threshold and a monthly cap on
  how many packs it may buy, and you can turn it off yourself at any time. Turning it on uses the
  same unticked-box consent and the same off switch.

⚖ *Lawyer: this section is written to meet ROSCA and the California Automatic Renewal Law
(disclosure before consent, affirmative unticked consent, records kept at least three years, online
self-serve cancellation, reminders). Confirm the reminder cadence and the exact pre-checkout
disclosure.*

Plan changes are self-serve. A downgrade takes effect at the next cycle.

## 7. Taxes and who takes your money

Prices exclude tax unless stated. Any sales tax, VAT or GST that applies is added at checkout.

Payments are handled by a payment provider, and card details go to that provider, not to us. For
some sales the provider acts as **merchant of record**, which means it — not us — is the seller for
tax purposes and its terms also apply to the transaction. Your receipt and your card statement will
name that provider.

`[TO BE COMPLETED: name the merchant of record and the statement descriptor once chosen. Stripe
Managed Payments has been applied for; Polar is the fallback. Not yet decided, so no provider is
named here. A Managed Payments statement reads LINK.COM*; the direct-Stripe descriptor would be
CHARTRELAY.DEV.]`

## 8. Refunds

Our refund and cancellation policy (`REFUNDS.md`, published at /refunds) forms part of these terms
and is incorporated by reference. It is linked from the pricing page and from checkout.

In short: subscriptions can be cancelled at any time and are not refunded for partial cycles; packs
are refundable only as that policy sets out; failed renders are never charged; and nothing in the
policy removes a statutory refund or withdrawal right you have as a consumer.

## 9. Suspension and termination

We may suspend or limit your access, or revoke a key, if:

- you breach these terms or the AUP;
- your use threatens the Service, other customers, or anyone's security;
- payment fails, is reversed, or is disputed;
- you appear to be in a blocked country or on a sanctions list (section 12); or
- the law requires it.

Where it is reasonable, we tell you first and give you a chance to fix the problem. Where the risk is
immediate — a live attack, apparent illegal content, or a chargeback — we act first and tell you
after.

If a payment is reversed or disputed, we reverse the credit it bought. If that would make your
balance negative, your keys pause until the balance is settled.

You may close your account at any time from your dashboard.

If **we** end the Service or terminate you without cause, we refund the unused part of your current
subscription period and any unexpired, unused pack credit. If we terminate you **for breach**, unused
credit may be forfeited. ⚖ *Lawyer: review the for-breach forfeiture. A penalty clause can fail, and
a partial refund may be the safer default.*

## 10. Availability — no SLA on self-serve plans

We work to keep the Service up and we publish incidents, but **self-serve plans carry no service
level agreement, no uptime commitment and no service credits.** The Service is offered as is and as
available. We may change, add or remove features, and we will give notice of material changes that
reduce what you already paid for.

An SLA exists only if we sign a separate written agreement with you that says so.

## 11. Warranties and liability

To the extent the law allows, the Service is provided **"as is" and "as available"**, with no
warranties of any kind, express or implied, including merchantability, fitness for a particular
purpose and non-infringement.

We render what you send. Automated chart quality checks are guidance, not a guarantee. You are
responsible for reviewing a chart before you publish it or rely on it.

To the extent the law allows:

- We are not liable for indirect, incidental, special, consequential or punitive damages, or for
  lost profits, revenue, goodwill or data.
- **Our total liability for all claims relating to the Service is capped at the fees you actually
  paid us in the 12 months before the claim arose.** If you paid us nothing, our liability is zero.
- Nothing in these terms excludes liability that cannot be excluded by law, including for fraud,
  death or personal injury caused by negligence, or a consumer's non-excludable statutory rights.

⚖ *Lawyer: (a) the live /terms page currently caps at "the greater of 12 months of fees or US$100" —
decide which stands and make the page match this file; (b) confirm the cap and the exclusions hold
for EU/UK consumers; (c) decide whether the cap should be uncapped for a data-protection breach by
us, since the DPA points back to this cap.*

## 12. Export control and sanctions

You may not use the Service, and we will not knowingly provide it, if you are:

- located in, ordinarily resident in, or accessing it from **Cuba, Iran, North Korea, Syria, the
  Crimea region, or the self-declared Donetsk (DNR) or Luhansk (LNR) regions of Ukraine**;
- located in, ordinarily resident in, or accessing it from **Russia or Belarus**; or
- a person on a US restricted-party list, including OFAC's SDN list, or owned or controlled by such a
  person.

You confirm none of the above applies to you, and that you will not export, re-export or make the
Service available in breach of US export control or sanctions law.

We block by card-issuing country and by the country the request appears to come from. Those checks
are best effort; they are not a sanctions-screening service, and we do not screen names against SDN
lists. We may suspend an account on a sanctions signal while we look into it.

**Russia and Belarus are blocked as a business decision, not because comprehensive sanctions require
it.** The reasoning is recorded in `docs/BILLING_DECISIONS.md`: a solo operator with no compliance
function, card rails to both largely severed, near-zero revenue forgone, and a cost of being wrong
out of all proportion to a $19 subscription.

⚖ *Lawyer: the spec marks sanctions with ⚖. Confirm this clause and the country list, and whether a
public statement that we block more than the law requires creates any exposure.*

## 13. Changes to these terms

We may update these terms. If a change is material we email account holders at least 30 days before
it takes effect and update the effective date. Continuing to use the Service after that date means
you accept the change. If you do not accept it, cancel before it takes effect; we will refund the
unused part of a subscription period you have already paid for.

## 14. Other terms

- **Entire agreement.** These terms, the AUP, the refund policy, the DPA (if signed) and the pricing
  page are the whole agreement between us.
- **No assignment** by you without our written consent. We may assign to a successor in a merger or
  sale of the business.
- **Severability.** If a clause is unenforceable, the rest stands.
- **No waiver.** Not enforcing a clause once does not waive it.
- **Survival.** Sections 3, 5, 9, 11, 12 and 14 survive termination.
- **Force majeure.** Neither party is liable for events beyond its reasonable control.

⚖ *Lawyer: decide whether to add an arbitration clause and a class-action waiver, or deliberately
leave them out. They are absent from this draft on purpose, as a choice for the owner rather than a
default.*

## 15. Governing law

These terms are governed by the laws of the State of {{governingLawState()}} — **Florida** — without
regard to its conflict-of-laws rules. Disputes will be heard in the state or federal courts located
in `[TO BE COMPLETED: Florida county for venue — depends on where the LLC's principal address will
be. Do not guess.]`, and both parties consent to that jurisdiction.

Nothing here removes a consumer's right to bring a claim in the courts of their own country of
residence where local law gives them that right.

The published page omits this clause entirely until `LEGAL_GOVERNING_STATE` is set, because
`governingLawState()` returns null and a governing-law clause naming no state is worse than none.
**Set `LEGAL_GOVERNING_STATE=Florida` before publication.**

## 16. Contact

{{contractingParty()}}
{{postalAddress()}}
{{supportEmail()}}

See also our Privacy Policy, Acceptable Use Policy, refund policy, subprocessor list and Data
Processing Addendum.
