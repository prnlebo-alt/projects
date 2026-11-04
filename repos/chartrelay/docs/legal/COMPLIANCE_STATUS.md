> **DRAFT — NOT LEGAL ADVICE. REQUIRES LAWYER REVIEW BEFORE PUBLICATION.**

# Compliance status

Every row of the compliance checklist in `docs/BILLING_SPEC.md`, as it actually stands on 2026-10-08.
⚖ marks the rows the spec says need a lawyer. Status is one of **DONE**, **DRAFTED** (text exists,
not reviewed, not published), **NOT STARTED**, **BLOCKED-ON-OWNER** (nothing a build session can do).

**Read these three first:**

1. **No legal document is published.** Eight drafts exist in `docs/legal/`. The live site has only an
   older draft `/terms` and `/privacy`, and those predate the prepaid-credits billing model.
2. **Three gaps block everything else:** no business address, no merchant of record, and a Stripe
   account that is still a sandbox. None is fixable in code.
3. **The documents describe the spec's billing model, not today's product.** Today `GET /chart` is
   unmetered and the plans are Pro and Scale; the credits-and-packs ledger is not built. These terms
   must not take effect before it is, or they describe a product that does not exist.

## The checklist

| # | Item | Priority | Status | Where it lives | What specifically remains |
|---|---|---|---|---|---|
| 1 | Terms of Service ⚖ | MUST | DRAFTED | `docs/legal/TERMS.md`; live draft `src/app/terms/page.tsx` | Lawyer review. Rewrite the page from this draft — it has no credits, no expiry, no sanctions clause, and caps liability at "greater of 12 months or $100" instead of 12 months. Set `LEGAL_EFFECTIVE_DATE` and `LEGAL_GOVERNING_STATE=Florida` (unset, so the governing-law clause renders as nothing today). Fill venue county and merchant of record. |
| 2 | Privacy Policy | MUST | DRAFTED | `docs/legal/PRIVACY.md`; live draft `src/app/privacy/page.tsx` | Retention periods for logs, ledger tombstones, tax records and support mail are unknown and marked. Record each vendor's transfer mechanism. Decide the Art. 37 DPO assessment. Then publish. |
| 3 | Data Processing Addendum ⚖ | MUST | DRAFTED | `docs/legal/DPA.md` | Lawyer review of the SCC selections. Pick the Clause 17 member state and the Annex I.C authority. Build the click-through: no `/dpa` route, no checkbox, no acceptance record. Needs the postal address. |
| 4 | Subprocessor list | MUST | DRAFTED | `docs/legal/SUBPROCESSORS.md`; `SUBPROCESSORS` in `src/lib/business.ts` | **No vendor DPA is recorded as accepted** — Railway, Stripe and Resend all outstanding. Decide the Namecheap question (support mail forwards through it today and it is not listed). Publish `/subprocessors`. |
| 5 | Payload retention | SHOULD | NOT STARTED | — | Chart specifications and rendered images are stored for the life of the account, and the image cache is bounded by size (200 MB default), not age. Decide a retention window, implement a purge, then publish the period. |
| 6 | EU/UK Art. 27 representative ⚖ | SHOULD | BLOCKED-ON-OWNER | — | Appoint an EU and a UK representative (~€100–300/yr each) and publish their details. Until then the Privacy Policy must not claim one, and the EU regulator for a breach notice is unsettled. |
| 7 | Cookie banner | Avoid | DONE | `src/lib/auth/session.ts`; verified across `src/` | One essential signed session cookie. No analytics product, no ad cookies, no third-party tracker. Keep it this way: adding cookieless analytics means a subprocessor row and a Privacy Policy change first. |
| 8 | Refund and cancellation policy | MUST | DRAFTED | `docs/legal/REFUNDS.md` | Publish `/refunds` and link it **from the pricing page and from checkout** — the spec requires both and neither link exists. Collect the EU/UK withdrawal acknowledgement at checkout. Check the policy against the merchant of record's own rules. |
| 9 | Acceptable Use Policy | MUST | DRAFTED | `docs/legal/AUP.md` | Publish `/aup` and incorporate it by reference on the live terms page. Decide whether to register a DMCA agent. Publish a security contact. |
| 10 | Stripe website checklist | MUST | BLOCKED-ON-OWNER | `/pricing`, `/privacy`, `/support`; HTTPS live | Present: product description, prices with currency, support email, privacy policy, HTTPS. Missing: a published refund policy (row 8) and a business address (row 11). The Stripe account itself is still a sandbox and was never onboarded. |
| 11 | Public business address | MUST | BLOCKED-ON-OWNER | `postalAddress()` in `src/lib/business.ts` | Buy a virtual mailbox and set `BUSINESS_POSTAL_ADDRESS`. Deliberately unset — a home address on a terms page cannot be withdrawn once scraped. Also add it to `.env.example`, which documents none of the four new legal variables. |
| 12 | Auto-renewal consent | MUST | NOT STARTED | Terms §6; `src/app/api/billing/checkout` | Drafted in the Terms only. No unticked consent box, no stored consent record, no annual reminder exists. Self-serve cancellation does exist via the billing portal. ROSCA and the California ARL need all four. |
| 13 | Statement descriptor | SHOULD | BLOCKED-ON-OWNER | Stripe account settings | Set `CHARTRELAY.DEV` once the live account is activated. A Managed Payments sale shows `LINK.COM*` instead, which the Terms already warn about. |
| 14 | US sales tax ⚖ | MUST | NOT STARTED | — | Nobody has checked whether Florida taxes SaaS, or set up nexus monitoring. Accountant and lawyer question; no number or conclusion is asserted anywhere in these drafts. |
| 15 | EU VAT / UK VAT | MUST | BLOCKED-ON-OWNER | — | Depends entirely on the merchant of record, which is not chosen. Stripe Managed Payments cannot be applied for from a sandbox account, so activating Stripe comes first. Polar is the fallback. |
| 16 | PCI DSS | MUST | NOT STARTED | `next.config.ts` (CSP); hosted Checkout | Controls are in place — hosted Checkout means SAQ A, and a strict CSP is set site-wide with a tighter one on chart asset routes. The SAQ A itself has not been completed, and no one has confirmed in writing that no card data reaches the app. |
| 17 | Sanctions ⚖ | MUST | NOT STARTED | `src/lib/compliance/regions.ts` | The list is right — Cuba, Iran, North Korea, Syria, Russia, Belarus, plus Crimea/DNR/LNR subdivisions — but **nothing imports this module**: no middleware, no checkout card-country check, no signup check. The request-country signal reads `cf-ipcountry`, which is absent until Cloudflare is in front. (`src/` is being edited concurrently; re-check before relying on this row.) |
| 18 | CAN-SPAM / PECR | MUST | BLOCKED-ON-OWNER | — | No marketing email is sent today, so nothing is currently non-compliant. Before the first send: a postal address in the footer (row 11), an unsubscribe link, and EU/UK opt-in. Email cannot send at all yet — `EMAIL_PROVIDER` and `EMAIL_FROM` are unset. |
| 19 | Breach response | MUST | DRAFTED | `docs/legal/BREACH_RUNBOOK.md` | Name a deputy (one person today, so the 72-hour clock can run out while they are unreachable). Line up counsel. Identify the EU regulator (row 6). Fix the notification channel — email does not send. |
| 20 | Accessibility | SHOULD | NOT STARTED | — | One design-and-accessibility audit of the landing pages was done in September. No WCAG 2.2 AA audit of the dashboard, checkout or legal pages. |
| 21 | Trademark search | SHOULD | BLOCKED-ON-OWNER | — | USPTO, EUIPO and WIPO, classes 9 and 42, for "ChartRelay" and "MPE Labs". Not started. |
| 22 | Trust pages | SHOULD | NOT STARTED | — | None exist: no `/.well-known/security.txt`, no status page, no Security page, no changelog. The AUP's security-research section points at a security contact that has to be created. |
| 23 | SOC 2 | LATER | NOT STARTED | — | Deliberate. `DPA.md` Annex II states plainly that we hold no certifications; keep it that way until a deal pays for one. |

## Gaps that are not on the spec's checklist

- **`.env.example` documents none of `BUSINESS_POSTAL_ADDRESS`, `LEGAL_DBA`,
  `LEGAL_EFFECTIVE_DATE` or `LEGAL_GOVERNING_STATE`.** A deployment set up from it renders legal pages
  with the address, the effective date and the whole governing-law clause silently missing. (Not fixed
  here: this task was scoped to `docs/legal/`.)
- **No published route exists for the AUP, refunds, subprocessors or the DPA.** Four of the eight
  documents have nowhere to live.
- **Namecheap forwards support@chartrelay.dev to a personal inbox** and is not on the subprocessor
  list.
- **`contractingParty()` names the LLC alone** because no Florida fictitious name is registered. If
  the owner ever wants contracts to say "MPE Labs", that is a §865.09 filing first, then
  `LEGAL_DBA` — not a text edit.
