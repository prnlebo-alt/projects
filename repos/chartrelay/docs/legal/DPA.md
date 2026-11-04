> **DRAFT — NOT LEGAL ADVICE. REQUIRES LAWYER REVIEW BEFORE PUBLICATION.**

# Data Processing Addendum

**The billing spec marks the DPA with ⚖. This document must not be offered for acceptance until a
lawyer has reviewed it.** It is the one document here a customer's own legal team will read line by
line, and a standard-contractual-clauses annex that is wrong is worse than no DPA at all.

**Identity values come from `src/lib/business.ts` and are not retyped here.** `{{contractingParty()}}`
is MadPugExperiment LLC — there is no registered Florida fictitious name, so the LLC contracts alone.
`{{supportEmail()}}` is support@chartrelay.dev. `{{postalAddress()}}` is **unset**:
`[TO BE COMPLETED: virtual-mailbox postal address. A DPA with no processor address will be rejected
by any procurement reviewer, so this blocks publication of this document specifically.]`

---

## 1. Parties, scope and acceptance

This Addendum is between:

- **Processor:** {{contractingParty()}}, {{postalAddress()}}, {{supportEmail()}} ("we", "us"); and
- **Controller:** the ChartRelay account holder that accepts it ("you", "Customer").

It forms part of the ChartRelay Terms of Service (the "Agreement") and applies whenever we process
personal data on your behalf in providing ChartRelay.

**Acceptance is click-through.** You accept this Addendum by ticking the box offered in your
dashboard, or by continuing to use the Service after we notify you that it applies. We record who
accepted, the version accepted, and when. No signature is required, and no countersignature is
offered. If your organisation needs a signed copy, email {{supportEmail()}}.

`[TO BE COMPLETED (engineering): the click-through mechanism does not exist yet — there is no /dpa
route, no acceptance checkbox and no acceptance record. Until it ships, this document cannot be
"accepted" by anyone.]`

Where this Addendum conflicts with the Agreement on the processing of personal data, this Addendum
wins.

## 2. Definitions

"GDPR" means Regulation (EU) 2016/679. "UK GDPR" means the GDPR as it forms part of UK law under the
European Union (Withdrawal) Act 2018, read with the Data Protection Act 2018. "EU SCCs" means the
standard contractual clauses in Commission Implementing Decision (EU) 2021/914. "UK Addendum" means
the ICO's International Data Transfer Addendum to the EU SCCs, version B1.0. "Personal data",
"controller", "processor", "sub-processor", "processing", "data subject" and "personal data breach"
have the meanings given in the GDPR. "Customer Personal Data" means personal data contained in
content you submit to the Service.

## 3. Roles

- You are the **controller** of Customer Personal Data. We are the **processor**.
- You decide what personal data goes into a chart specification, why, and on what lawful basis. A
  render request is your instruction to process it.
- We are an independent **controller** for our own account, billing, security and audit data —
  described in our Privacy Policy, not in this Addendum.
- Where you are yourself a processor for your own customer, you confirm you have that customer's
  authority to appoint us as a sub-processor on these terms.

## 4. Your obligations as controller

You confirm that:

- you have a lawful basis for the processing you instruct, and have given data subjects the notices
  they are owed;
- your instructions do not require us to break data protection law;
- you will not put special category data (GDPR Art. 9), criminal offence data, payment card numbers,
  government identifiers, or children's data into chart content; and
- you understand that **rendered chart URLs are public to anyone holding the link**, and will not put
  personal data into a chart you are not content to publish.

## 5. Our obligations as processor (Art. 28(3))

We will:

**(a) Act only on instructions.** Process Customer Personal Data only to provide, secure and support
the Service, and only on your documented instructions — the Agreement, this Addendum, and your use of
the Service. We will tell you if we believe an instruction breaches data protection law. We will not
sell it, use it for our own purposes, or use it to train machine-learning models.

**(b) Confidentiality.** Ensure anyone who can access it is bound by confidentiality. Today that is
the owner of the business and no other personnel.

**(c) Security.** Keep the technical and organisational measures in **Annex II**, appropriate to the
risk.

**(d) Sub-processors.** Use sub-processors only as section 6 allows.

**(e) Data subject requests.** Help you answer them (section 7).

**(f) Breach notification.** Notify you of a personal data breach affecting Customer Personal Data
without undue delay, and in any case **within 48 hours** of becoming aware of it, with what we know
at the time: what happened, which data and roughly how many records and data subjects, the likely
consequences, and what we are doing. We will not notify your data subjects or a regulator on your
behalf unless you ask us to in writing. Our internal process is `BREACH_RUNBOOK.md`.
⚖ *Lawyer: 48 hours is a commitment chosen to sit inside your own 72-hour clock. Confirm it is
achievable for a solo operator before it is published — a missed contractual deadline is a breach of
contract on top of the incident.*

**(g) Assistance.** Help you, at your cost for anything beyond routine effort, with data protection
impact assessments and with consultations with a supervisory authority, as far as the information is
ours to give.

**(h) Deletion and return.** On termination, or on your written request, delete Customer Personal
Data. Account deletion in the dashboard does this immediately for the account, its keys, renders and
usage history. Copies already cached by browsers, proxies and link-preview services are outside our
control and may persist for up to a year. We may keep what the law requires us to keep, and keep it
protected while we do.

**Audits.** We will give you the information you reasonably need to show compliance with Art. 28, and
will answer a security questionnaire once a year. We do not hold SOC 2 or ISO 27001 and do not claim
to. On-site audits are not available; where your own regulator requires one, contact us and we will
agree a reasonable alternative. ⚖ *Lawyer: confirm this is an adequate Art. 28(3)(h) audit right.*

## 6. Sub-processors

You give **general written authorisation** for us to appoint sub-processors. The current list, and the
ones we anticipate, are in `SUBPROCESSORS.md`, published at /subprocessors and read from the
`SUBPROCESSORS` constant in `src/lib/business.ts`.

- We impose data protection obligations on each sub-processor that are no less protective than this
  Addendum, and we remain liable for their processing.
- We will give you **at least 30 days' notice** before a new sub-processor starts processing Customer
  Personal Data, by email to your account address and by updating /subprocessors.
- You may object on reasonable data protection grounds within that period. If we cannot resolve the
  objection, you may terminate the affected part of the Service and we will refund prepaid, unused
  fees and unexpired, unused credit for it.

`[TO BE COMPLETED: notice will be sent by email, and the email provider is not yet live — EMAIL_PROVIDER
and EMAIL_FROM are unset. Working email is a precondition for this clause.]`

## 7. Data subject requests

If a data subject contacts us directly about Customer Personal Data, we will not respond on the
substance; we will tell them to contact you and tell you about it without undue delay.

If you cannot answer a request yourself using the dashboard's export and delete tools, we will help
you, at your cost for anything beyond routine effort.

## 8. International transfers

We process Customer Personal Data in the **United States**.

- **EU/EEA transfers.** The EU SCCs are incorporated into this Addendum, **Module Two
  (controller-to-processor)**, with you as data exporter and us as data importer. Clause 7 (docking)
  applies. For Clause 9, **Option 2 (general written authorisation)** applies with a 30-day notice
  period, per section 6. For Clause 11, the optional independent-dispute-resolution body does not
  apply. For Clause 17, the governing law is the law of `[TO BE COMPLETED: EU member state for SCC
  Clause 17 — commonly Ireland or the Netherlands; the Agreement's governing law is Florida, which
  the SCCs cannot use. ⚖]`, and for Clause 18 the forum is the courts of that member state. Annexes
  I, II and III below complete the SCCs.
- **UK transfers.** The UK Addendum is incorporated, with the EU SCCs as the approved addendum and
  this document's Annexes as its Part 1 tables. Neither party may terminate under Section 19 of the
  UK Addendum. ⚖
- **Switzerland.** The EU SCCs apply with "GDPR" read to include the Swiss FADP, "member state" read
  to include Switzerland, and the FDPIC as supervisory authority. ⚖
- Where this Addendum and the SCCs conflict, the SCCs win.
- `[TO BE COMPLETED: no transfer impact assessment has been done, and each sub-processor's own
  transfer mechanism is unrecorded. ⚖]`

We will tell you if we receive a binding government request for Customer Personal Data, unless the
law forbids it, and will challenge a request that appears unlawful.

## 9. Liability

Each party's liability under this Addendum is subject to the limits in the Agreement, including the
cap at the fees paid in the 12 months before the claim. ⚖ *Lawyer: decide deliberately whether a
data-protection breach by us should sit inside that cap or outside it. Many enterprise customers will
push for a higher or uncapped figure, and the SCCs' own liability clause cannot be cut down by this
section.*

## 10. Term

This Addendum applies for as long as we process Customer Personal Data for you, and the obligations
that should outlive it do.

---

# Annex I — Description of the processing

**A. List of parties**

| | Data exporter | Data importer |
|---|---|---|
| Name | The Customer that accepted this Addendum | {{contractingParty()}} |
| Address | The address on the Customer's account | {{postalAddress()}} — `[TO BE COMPLETED]` |
| Contact | The account's email address | {{supportEmail()}} |
| Role | Controller (or processor for its own customer) | Processor |
| Activities | Using ChartRelay to render charts | Providing ChartRelay |

**B. Description of the transfer**

- **Categories of data subjects:** anyone whose personal data the Customer chooses to include in a
  chart specification. Typically none, or the Customer's own staff, customers or end users. The
  Customer controls this entirely.
- **Categories of personal data:** whatever appears in chart content — labels, series names,
  annotations, titles and values. These may be names, email addresses, identifiers, amounts or dates.
  Also the Customer's own account and contact data where it is personal data of an individual user.
- **Special category data:** none. The Service is not designed for it and section 4 prohibits it.
- **Frequency:** continuous, for as long as the Customer calls the API.
- **Nature and purpose:** receiving a chart specification, validating it, rendering an image, caching
  and serving that image at a URL, metering the request, and storing the specification and image
  while the account is open.
- **Retention:** as set out in the Privacy Policy's retention table. Deleted immediately on account
  deletion; `[TO BE COMPLETED: time-based purge of stored chart content and logs is not implemented.]`
- **Sub-processors:** see `SUBPROCESSORS.md`; subject matter, nature and duration as above.

**C. Competent supervisory authority**

`[TO BE COMPLETED: for SCC Annex I.C this is determined by the exporter's establishment, and for the
UK it is the ICO. We have no Art. 27 representative and no EU establishment, so this must be settled
with a lawyer rather than asserted. ⚖]`

---

# Annex II — Technical and organisational measures

These are the measures in place today. Nothing aspirational is listed.

- **Encryption in transit.** HTTPS everywhere, HSTS, a strict Content-Security-Policy, and a tighter
  policy on chart asset routes.
- **Credential handling.** Passwords and API keys stored as one-way hashes; full keys displayed once;
  keys carry a prefix and checksum so an invalid key is rejected before any database lookup; signed
  session cookies.
- **Access control.** Per-key scopes, optional per-key budgets, optional expiry, optional IP
  allowlists, instant revocation, and rotation that keeps an old key valid for 7 days. Admin routes
  sit on a separate authentication path. Multi-factor authentication on the provider accounts.
- **Metering integrity.** An append-only usage ledger with atomic reserve/charge/refund, a unique
  index enforcing idempotency, a non-negative balance constraint, and a sweeper that refunds stalled
  reservations.
- **Logging and redaction.** `Authorization` headers, URL signatures and chart payloads are stripped
  from logs. Key creation, rotation and revocation, plan changes, credit grants and admin actions are
  recorded in an audit log.
- **Input and renderer hardening.** Payload, data-point and output-size limits per tier; a render
  timeout and memory cap; remote fetches off by default, and where allowed restricted to HTTPS with
  private, loopback and link-local addresses blocked and redirects re-checked.
- **Abuse controls.** Rate limits per key, per account and per IP; email verification before a key is
  issued; signup caps; region blocking.
- **Webhook integrity.** Signature verification and replay deduplication on every payment webhook.
- **Backups and recovery.** Daily database backups with a rehearsed restore procedure
  (`docs/RESTORE.md`). `[TO BE COMPLETED: backups are run manually today and the newest copy has been
  as much as a week old. Schedule them before publishing this annex, or state the real frequency.]`
- **Personnel.** One person — the owner — has production access. No other staff.
- **Certifications.** None. We do not hold SOC 2 or ISO 27001 and do not claim to.

---

# Annex III — Sub-processors

As listed in `SUBPROCESSORS.md` at the time of acceptance, which marks which sub-processors are live
and which are anticipated. Today the live list is Railway (hosting and database), Stripe (payments)
and Resend (account email, configured but not yet sending).
