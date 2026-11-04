> **DRAFT — NOT LEGAL ADVICE. REQUIRES LAWYER REVIEW BEFORE PUBLICATION.**

# Privacy Policy

Written for the GDPR and the UK GDPR, and usable for US state privacy law. The billing spec does not
mark the Privacy Policy with ⚖, but the transfer section and the retention table below depend on
answers nobody has yet; they are marked inline.

**Identity values come from `src/lib/business.ts` and are not retyped here.**

| Token | Source | Value today |
|---|---|---|
| `{{contractingParty()}}` | `contractingParty()` | MadPugExperiment LLC (no registered DBA) |
| `{{supportEmail()}}` | `supportEmail()` ← `SUPPORT_EMAIL` | support@chartrelay.dev |
| `{{postalAddress()}}` | `postalAddress()` ← `BUSINESS_POSTAL_ADDRESS` | **unset** — `[TO BE COMPLETED: virtual-mailbox postal address]` |
| `{{effectiveDate()}}` | `effectiveDate()` ← `LEGAL_EFFECTIVE_DATE` | **unset** |
| Subprocessor list | `SUBPROCESSORS` | Railway, Resend, Stripe |

---

Effective date: {{effectiveDate()}}

This policy explains what personal data {{contractingParty()}} collects when you use ChartRelay, why,
on what legal basis, how long we keep it, and what you can do about it.

## Who is responsible

- **For your account, billing and our own logs, we are the controller.** Contact:
  {{supportEmail()}}, {{contractingParty()}}, {{postalAddress()}}.
- **For the chart data you send us, you are the controller and we are your processor.** We process it
  on your instructions — a render request is the instruction. Our Data Processing Addendum (`DPA.md`)
  governs that relationship.
- We have not appointed a Data Protection Officer. We do not believe one is required at this size.
  `[TO BE COMPLETED: confirm the Art. 37 assessment with a lawyer and record the conclusion.]`
- **EU/UK Article 27 representative: not appointed.** The spec lists this as a SHOULD at roughly
  €100–300 a year. Until one exists this policy must not claim one.
  `[TO BE COMPLETED: appoint an EU and a UK representative, then publish their names and addresses
  here.]`

## What we collect

| Category | What it is | Where it comes from |
|---|---|---|
| Account data | Email address, name if you give one, a one-way hash of your password, email-verification state | You |
| Authentication data | Session cookie, password-reset tokens | Created by us |
| API credentials | A SHA-256 hash and the prefix and last 4 characters of each key; key name, scopes, budget, expiry, IP allowlist, `last_used_at` | Created by us |
| Chart content | The chart specifications you send — titles, labels, values, styling — and the images rendered from them. May contain personal data if you put it in a chart. | You |
| Usage and metering data | Per-request records: timestamp, key used, units charged, format, cache hit, status, request ID, idempotency key | Created by us |
| Billing data | Plan, subscription status, credit grants and balances, provider customer and subscription IDs, receipts | You, and the payment provider |
| Technical and security data | IP address, user agent, request metadata, rate-limit counters, country code supplied by the network in front of us, audit-log entries for key and plan changes | Your browser or client |
| Support correspondence | Emails you send us and our replies | You |

**We never see your card number.** Card details go to the payment provider.

**Logs are redacted.** `Authorization` headers, URL signatures and chart payloads are stripped from
logs by design.

## Why we use it, and our lawful basis

| Purpose | Data used | Lawful basis (GDPR / UK GDPR Art. 6) |
|---|---|---|
| Create and run your account; authenticate you | Account, authentication | Contract — 6(1)(b) |
| Render charts and serve chart URLs | Chart content, API credentials | Contract — 6(1)(b); as processor, on your instructions |
| Meter usage, enforce caps, show you your usage | Usage, API credentials | Contract — 6(1)(b) |
| Take payment, grant credit, handle refunds and disputes | Billing | Contract — 6(1)(b) |
| Send transactional email: verification, password reset, credit and expiry warnings, billing and renewal notices | Account | Contract — 6(1)(b) |
| Keep the Service secure: rate limiting, abuse and fraud prevention, audit logging, investigating incidents | Technical, usage, account | Legitimate interests — 6(1)(f): running a service that is not abused. We use the least data that works. |
| Block sales to sanctioned countries | Technical, billing | Legal obligation — 6(1)(c), and legitimate interests for the part that is stricter than the law requires |
| Keep tax, accounting and auto-renewal consent records | Billing, account | Legal obligation — 6(1)(c) |
| Answer support requests | Correspondence, account | Contract — 6(1)(b), and legitimate interests |
| Marketing email, if we ever send it | Account | Consent — 6(1)(a) for EU/UK recipients (PECR opt-in). We send none today. |

We do **not** sell personal data, do not share it for cross-context behavioural advertising, and do
**not** use your chart data to train machine-learning models. We do no profiling and no automated
decision-making that has a legal or similarly significant effect on you. Suspension decisions are
reviewed by a human.

## Special category data

We do not want special category data (Art. 9) and the Service is not designed for it. Do not put
health, biometric, racial, political, religious, trade-union or sexual-orientation data into a chart
specification. If you do, you are the controller for it and you are responsible for having a lawful
basis and an Art. 9 condition.

## How long we keep it

| Data | Retention |
|---|---|
| Account, API key records, chart content, usage history | While your account is open. **Delete account** in the dashboard removes the account, workspace, keys, renders and usage history from our database immediately, and the rendered chart URLs stop being served. |
| Rendered image cache | Bounded by size, not by age (default 200 MB), so there is no fixed retention period. Entries are evicted as the cache fills. `[TO BE COMPLETED: decide whether to add a time-based purge — the spec lists payload retention as a SHOULD — and state the period here.]` |
| Copies in browsers, proxies and link-preview caches | Up to a year, because chart assets are served with a long cache lifetime. Outside our control once served. |
| Ledger entries needed for billing integrity (credit grants, charges, refunds) | Kept after account deletion only as a billing tombstone where needed for accounting and dispute defence. `[TO BE COMPLETED: state the period. Confirm with an accountant; do not publish a number nobody has confirmed.]` |
| Tax and accounting records | As long as tax law requires. `[TO BE COMPLETED: confirm the US federal and Florida retention period with an accountant.]` |
| Auto-renewal consent records | At least 3 years, as the California Automatic Renewal Law expects. |
| Security and request logs | `[TO BE COMPLETED: no log-retention period is configured or enforced today. Decide one — 30 or 90 days are common — implement it, then publish it.]` |
| Support email | `[TO BE COMPLETED: support mail currently forwards to a personal inbox; decide a retention period and state it.]` |
| Billing records held by the payment provider | Under that provider's own retention rules, which we do not control. |

## Who we share it with

We share personal data only with providers that help us run ChartRelay, and only what they need. The
current and anticipated list, with what each one does and whether it is live today, is in
`SUBPROCESSORS.md` (published at /subprocessors). The live list is read from the `SUBPROCESSORS`
constant in `src/lib/business.ts`, so this page and that one cannot disagree.

Today that list is: **Railway** (hosting and database), **Resend** (account email), **Stripe**
(payments). We serve our own fonts from the container, so no font or asset CDN receives your IP
address.

We may also disclose data when the law requires it, to protect rights or safety, or as part of a
merger or sale of the business — in which case this policy continues to apply.

## International transfers

We operate from the United States, and your data is processed in the United States.

If you are in the EEA, the UK or Switzerland, that is a transfer out of your region. We rely on:

- the **EU Standard Contractual Clauses** (Commission Decision 2021/914) and the **UK International
  Data Transfer Addendum** in our own Data Processing Addendum with you, where you are the
  controller; and
- the equivalent clauses in each provider's own data processing agreement, where we pass data to a
  provider.

`[TO BE COMPLETED: for each provider in SUBPROCESSORS.md, record whether its DPA has been accepted,
on what date, and which transfer mechanism it uses. None of that is recorded today. Also decide
whether a transfer impact assessment is needed and have a lawyer confirm it. ⚖]`

## Cookies

We use one cookie: a signed session cookie that keeps you signed in. It is essential, so there is no
cookie banner — by design, per the spec. We run **no analytics product, no advertising cookies and no
third-party trackers**, which was verified against the codebase.

If cookieless analytics is added later, this section and the subprocessor list must be updated before
it ships.

## Public chart URLs

Rendered chart URLs are not secret. Anyone with the link can see that chart. Signed URLs and expiry
are available on paid plans, but a signed URL is still public once shared. Do not put personal or
confidential data in a chart you would not publish.

## Your rights

If you are in the EEA or the UK, you have the right to: access your data; correct it; have it
erased; restrict or object to processing; receive it in a portable form; withdraw consent where we
rely on consent; and complain to a supervisory authority — your local DPA in the EEA, or the
Information Commissioner's Office in the UK. If you are in California or another US state with a
privacy law, you have comparable rights, including the right not to be discriminated against for
using them.

Two rights need no request at all. In the **Danger zone** of your dashboard:

- **Export my data** downloads a JSON file of everything we hold for the account.
- **Delete account** removes it permanently.

For anything else, email {{supportEmail()}}. We answer within one month, as the GDPR requires. We may
ask you to confirm your identity. We do not charge for a first request.

If your request concerns chart data you sent on behalf of someone else, we will refer you to our
customer, who is the controller for it.

## Children

ChartRelay is not for anyone under 18 and we do not knowingly collect children's data.

## Security

Passwords and API keys are stored hashed. Sessions are signed. Connections are encrypted. Logs
redact credentials, signatures and chart payloads. Backups are taken and a restore has been
rehearsed. No system is perfectly secure and we do not claim it is. If a breach affects you, our
notification process is in `BREACH_RUNBOOK.md`.

## Changes

If we make a material change we email account holders before it takes effect and update the
effective date above.

## Contact

{{contractingParty()}}
{{postalAddress()}}
{{supportEmail()}}
