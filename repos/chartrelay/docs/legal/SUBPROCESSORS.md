> **DRAFT — NOT LEGAL ADVICE. REQUIRES LAWYER REVIEW BEFORE PUBLICATION.**

# Subprocessors

Who, besides us, may process data when you use ChartRelay. The billing spec lists this as a MUST, and
the Privacy Policy and the DPA both point here.

The **live** list is read from the `SUBPROCESSORS` constant in `src/lib/business.ts`, so the published
page cannot drift from this file. Anything that receives a visitor's IP address belongs on it,
including a font or asset host — this deployment serves its own fonts from the container, so no CDN is
listed.

**A vendor relationship that does not exist is not listed as if it does.** The two tables below are
kept separate for exactly that reason.

---

## Live today

These are processing data now, and are the three names in `SUBPROCESSORS`.

| Subprocessor | What it does | Data it can see | Location | Vendor DPA signed? |
|---|---|---|---|---|
| **Railway** | Hosts the application servers and the SQLite database on a mounted volume | Everything the application holds: accounts, API key hashes, chart specifications, rendered images, usage ledger, logs | United States `[TO BE COMPLETED: confirm the deployment region]` | `[TO BE COMPLETED: accept Railway's DPA and record the date]` |
| **Stripe** | Processes payments and stores billing details | Name, email, card details (collected by Stripe, never by us), billing address, purchase history, subscription and customer IDs | United States, with Stripe's own global infrastructure | `[TO BE COMPLETED: accept Stripe's DPA and record the date]` |
| **Resend** | Delivers account email: verification, password resets, billing and credit notices | Recipient email address, message content | United States | `[TO BE COMPLETED: accept Resend's DPA and record the date]` |

Status notes, so nothing here reads better than it is:

- **Stripe is live in test mode only.** The live Stripe account exists but onboarding was never
  completed, so no real payment has been processed. See `docs/BILLING_DECISIONS.md`.
- **Resend is configured but not sending.** `RESEND_API_KEY` is set; `EMAIL_PROVIDER` and `EMAIL_FROM`
  are not, so no email leaves the application. It is listed as live because it is wired in and will
  send the moment those two variables are set.
- **Railway** is the only one holding customer data today.

## Needs a decision before launch

| Candidate | What it would do | Why it is here |
|---|---|---|
| **Namecheap** | DNS for chartrelay.dev, and **email forwarding for support@chartrelay.dev to the owner's personal inbox** | Support email — which can contain personal data and sometimes account details — passes through Namecheap's forwarding today, and Namecheap is not in `SUBPROCESSORS`. Either list it or move support mail onto a mailbox already covered. **Owner decision.** |

## Anticipated — not engaged

Named in the billing spec as expected, **not in use, no contract, no data**. They must not appear on
the published page until they are, and the published page should say plainly that this table is a
roadmap.

| Anticipated subprocessor | What it would do | Status |
|---|---|---|
| **Merchant of record** | Would become the seller of record and handle EU and UK VAT | **Not chosen.** Stripe Managed Payments has been applied for; Polar (5% + 50¢, +1.5% non-US cards) is the fallback if it is not approved within a week or packs cannot be sold through it. Managed Payments cannot even be applied for from a sandbox account, which is where Stripe sits today. `[TO BE COMPLETED: name the provider, then move this row into the live table with its data categories, location and DPA date.]` |
| **Cloudflare** | Would sit in front of Railway as CDN, WAF and the source of the request-country signal used for sanctions blocking | **Not in place.** DNS is Namecheap with an ALIAS straight to Railway. The region check reads `cf-ipcountry` when present, which means the sanctions country signal is absent until Cloudflare (or an equivalent) is in front. |
| **Analytics provider** | Cookieless product analytics | **None in use**, verified against the codebase: no analytics script, no advertising cookies, no third-party tracker. The spec's preference for cookieless analytics is why there is no cookie banner. If one is added, it goes in the live table and the Privacy Policy's cookie section changes before it ships. |

## How we notify you of changes

- New subprocessors are announced by email to the account address and by updating the published page
  **at least 30 days before** they start processing customer personal data.
- DPA customers may object on reasonable data protection grounds within that window; see section 6 of
  `DPA.md`.
- `[TO BE COMPLETED: the notice is sent by email, and email is not sending yet.]`

## Before the first paid customer

1. Accept each live vendor's DPA and record the date and the version in this file.
2. Decide the Namecheap question.
3. Choose the merchant of record and add it.
4. Publish this list at /subprocessors — there is no such route today — and link it from the Privacy
   Policy and the DPA.
