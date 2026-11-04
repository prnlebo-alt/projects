> **DRAFT — NOT LEGAL ADVICE. REQUIRES LAWYER REVIEW BEFORE PUBLICATION.**

# Acceptable Use Policy

This policy forms part of the ChartRelay Terms of Service. It applies to everyone who uses
ChartRelay, including agents acting on your behalf. The Terms of Service it attaches to is marked ⚖ in
the billing spec, so a lawyer reviews this with it.

Identity values come from `src/lib/business.ts`: reports go to `{{supportEmail()}}`
(support@chartrelay.dev); the operator is `{{contractingParty()}}` (MadPugExperiment LLC).

Short version: render charts. Do not use us to break the law, to hurt people, to attack systems, or
to avoid paying for what you use.

## 1. Illegal and infringing content

Do not use ChartRelay to create, store or distribute content that:

- breaks any applicable law;
- infringes someone's copyright, trademark, patent, trade secret or other rights, including rendering
  someone else's protected work or using marks you have no right to use;
- is defamatory, or presents fabricated data as if it came from a named person or organisation;
- is produced from data you had no right to obtain or process, including personal data you have no
  lawful basis for; or
- is designed to mislead about who published it.

## 2. Child sexual abuse material — zero tolerance

**Do not send anything involving the sexual exploitation or abuse of a child.** This covers imagery,
text, labels, filenames and links.

If we find it we will, without warning: block the account permanently, preserve the evidence, and
report it to the National Center for Missing & Exploited Children and to law enforcement. There is no
appeal and no refund.

⚖ *Lawyer: confirm whether ChartRelay is an "electronic communication service" or "remote computing
service" provider with a mandatory reporting duty under 18 U.S.C. § 2258A, and what the preservation
obligation is. This draft commits to reporting voluntarily either way; the question is whether it is
also required and on what timetable.*

## 3. Fraud, phishing and deception

Do not use ChartRelay to build any part of a scam. Specifically, do not render:

- imagery that imitates another company's login screen, security warning, invoice, receipt, bank
  statement, portfolio or dashboard in order to deceive;
- fake "verified", "certified", "audited" or "approved" badges, seals or stamps;
- charts that are part of an investment, trading, crypto, romance or advance-fee scheme, including
  fabricated performance or return figures presented as real;
- content that impersonates a real person, company or public authority; or
- images embedded in phishing email, SMS or landing pages.

A chart image in an email is a credibility prop. We treat fraud use as abuse of the Service itself,
not as something the recipient's spam filter should sort out.

## 4. Attacks on us or anyone else

Do not:

- probe, scan or test the security of ChartRelay or its infrastructure without our written
  permission;
- attempt **server-side request forgery** — using a chart specification, a remote image reference, a
  font or style reference, a redirect or any other input to make our renderer fetch an internal
  address, a cloud metadata endpoint such as `169.254.169.254`, a loopback or link-local address, or
  any `file:`, `chrome:` or other non-HTTPS scheme;
- use ChartRelay as a relay, proxy, scanner or amplifier against any third-party system;
- send input designed to crash, hang, or exhaust the renderer — oversized payloads, deeply nested
  structures, decompression bombs, pathological font or path data;
- interfere with another customer's use, or with our rate limiting, caching or metering; or
- attempt to read another account's data, keys, charts or usage.

Our renderer blocks these and logs attempts. A blocked attempt is still a breach of this policy.

**Security research.** We welcome reports. Test only against your own account, do not degrade the
service for others, do not access data that is not yours, and report what you find to
{{supportEmail()}}. Research within those limits is not a breach of this policy.
`[TO BE COMPLETED: publish a security contact at /.well-known/security.txt and a Security page. The
spec lists this as a SHOULD and neither exists today.]`

## 5. Working around metering or payment

Credit is prepaid, and the ledger is the record. Do not:

- create multiple accounts to repeat the free tier, or use disposable or rotating email domains to do
  it;
- share one key across separate organisations, or pool several accounts' allowances to serve one
  workload;
- manipulate idempotency keys, caching, retries or error paths to get renders you did not pay for;
- tamper with, replay or forge usage reports, credit headers, webhooks or receipts;
- reverse a payment for service you actually received, instead of asking us for a refund; or
- use test keys for production traffic. Test keys are watermarked, unbilled and rate-limited on
  purpose.

## 6. Keys, resale and competing services

- **Do not sell, rent, sublicense or give away your API keys or signing secrets**, and do not resell
  raw API access as a chart-rendering service of your own.
- You may absolutely build a product on ChartRelay and charge for it. The line is whether your
  customers are buying your product or simply buying our API through you.
- Do not use ChartRelay to build a directly competing chart-rendering API, or to benchmark it for a
  competitor without telling us.
- Your keys are yours to protect. Usage incurred by a leaked key is billed to you, which is why
  per-key budgets, scopes and instant revocation exist. Use them.

## 7. Sanctioned countries and people

You may not use ChartRelay if you are located in, ordinarily resident in, or accessing it from:

- **Cuba, Iran, North Korea, Syria**, the **Crimea** region, or the self-declared **Donetsk (DNR)** or
  **Luhansk (LNR)** regions of Ukraine; or
- **Russia or Belarus**.

You also may not use it if you are on a US restricted-party list, including OFAC's SDN list, or are
owned or controlled by someone who is, or if you would be re-exporting the Service to any of the
above.

Russia and Belarus are blocked as a deliberate business decision that goes further than the law
requires; the reasoning is in `docs/BILLING_DECISIONS.md`. We block by card-issuing country and by
the country a request appears to come from. Those are best-effort signals, not a sanctions-screening
service — we do not screen names against lists, and evading the block is itself a breach of this
policy.

⚖ *The spec marks sanctions with ⚖. A lawyer should confirm this list and the screening approach.*

## 8. Other prohibited uses

- Automated mass-rendering intended to degrade the Service rather than to produce charts you use.
- Content that incites violence or harasses a specific person.
- Using the Service in a way that puts us in breach of a provider's own terms, including the
  providers in `SUBPROCESSORS.md`.
- Misrepresenting your identity or location to get access or a price you do not qualify for.

## 9. How we enforce this

What we may do, depending on severity: ask you to stop; rate-limit or throttle; revoke a specific
key; suspend the account; terminate the account; withhold or reverse credit; and report to law
enforcement.

- Where it is reasonable, we tell you first and give you a chance to fix the problem.
- Where the risk is immediate — an attack, apparent CSAM, an active phishing campaign, a sanctions
  hit — we act first and explain after.
- Prepaid credit forfeited on termination for breach is covered by the Terms of Service.
- **Appeal:** email {{supportEmail()}}. A human reviews it. We aim to answer within 5 business days.
  CSAM decisions are not appealable.

## 10. Reporting abuse

To report abuse of ChartRelay — a phishing image, an infringing chart, anything illegal — email
{{supportEmail()}} with the chart URL and what is wrong with it. Include enough detail for us to find
it. For copyright claims, include the information a DMCA notice requires.

`[TO BE COMPLETED: decide whether to register a DMCA agent with the US Copyright Office. Without a
registered agent the statutory safe harbour is not available. ⚖]`

## 11. Changes

We may update this policy. Material changes are emailed to account holders before they take effect.
