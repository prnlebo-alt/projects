> **DRAFT — NOT LEGAL ADVICE. REQUIRES LAWYER REVIEW BEFORE PUBLICATION.**

# Breach response runbook

One page, for the hour it is needed. The billing spec requires: 72-hour regulator notice as
controller, customer notice as processor, and US state law. Contact details come from
`src/lib/business.ts` (`{{supportEmail()}}`, `{{contractingParty()}}`).

**A breach is not only a hacker.** A lost laptop, a leaked `.env`, a backup in the wrong place, an
export emailed to the wrong customer, a misconfigured route serving another account's charts, or a
provider telling us *they* were breached all count.

## Who does what

There is one person. That is the plan's biggest weakness and it is stated rather than hidden.

| Role | Who |
|---|---|
| Incident lead, decision maker, regulator and customer notices | **Anthony** (owner) |
| Deputy, if the owner is unreachable for more than 12 hours | `[TO BE COMPLETED: nobody is named. Pick someone, or accept that the 72-hour clock can run out while on a flight.]` |
| Outside counsel | `[TO BE COMPLETED: name and phone. Engage before an incident, not during one.]` |
| Cyber insurance / breach coach | `[TO BE COMPLETED: none known to exist.]` |
| Provider contacts | Railway, Stripe, Resend support channels — see `SUBPROCESSORS.md` |

## Hour 0–2: contain and record

1. **Start a log.** One file, timestamps in UTC, every action and every decision with the reason.
   This becomes the Art. 33(5) record and the evidence if a regulator asks.
2. **Stop the bleeding.** Revoke exposed credentials — API keys, `SESSION_SECRET`, `ADMIN_TOKEN`,
   Stripe keys, Resend key, deploy keys. Rotate, do not just disable. Suspend affected accounts or
   keys if that is what stops it.
3. **Preserve evidence before cleaning up.** Snapshot the database and logs, and copy them somewhere
   the attacker cannot reach. Do not redeploy over the state you need.
4. **Do not email anyone yet** beyond the people helping. An early wrong statement is hard to take
   back.

## Hour 2–24: assess

Answer these in the log:

- What data, for how many accounts and how many individuals?
- Is it our controller data (accounts, billing, logs) or customer content we process on their behalf?
  **Usually both, and the two trigger different duties.**
- Is it still happening? How did it start, and when?
- Any special category data, card numbers or passwords in clear text? (Card numbers should be
  impossible — Stripe holds them, not us. If they appear, escalate to Stripe immediately.)
- Which jurisdictions do the affected people live in?
- Likely consequences: credential stuffing, fraud, exposure of private chart content?

**Then make the one call that matters:** is there a *risk to the rights and freedoms* of individuals?
If yes, the regulator clock is already running from the moment of awareness.

## As controller: 72 hours

For our own account, billing, log and security data we are the controller.

- **GDPR Art. 33: notify the competent supervisory authority within 72 hours of becoming aware**,
  unless the breach is unlikely to risk individuals' rights and freedoms. If you cannot assemble all
  the facts in time, **notify anyway and supplement later** — a partial notice on time beats a
  complete one late.
- **UK GDPR Art. 33: notify the ICO within 72 hours** on the same test. The ICO has an online form
  and a phone line.
- Which EU authority: `[TO BE COMPLETED: we have no EU establishment and no Art. 27 representative,
  so the one-stop shop does not apply and notice may be owed to each affected member state's
  authority. Settle this with a lawyer before an incident. ⚖]`
- **GDPR Art. 34: notify affected individuals without undue delay** where the risk to them is high —
  plainly, what happened, what data, what we are doing, what they should do, and who to contact.
- Record every breach in an internal register, including the ones we decide not to report, with the
  reason.

## As processor: notify our customers

For chart content we process on a customer's behalf, the customer is the controller and **their**
72-hour clock depends on us.

- **Notify every affected customer without undue delay, and in any case within 48 hours of becoming
  aware** — the commitment in section 5(f) of `DPA.md`.
- Send: what happened and when, which of their data and roughly how many records, the likely
  consequences, what we have done, what we recommend they do, and a named contact.
- **Do not notify their data subjects or a regulator for them** unless they ask in writing.
- Follow up with corrected facts as they firm up. Do not wait for certainty.
- Send it from the account email address on file. `[TO BE COMPLETED: email is not sending yet
  (EMAIL_PROVIDER / EMAIL_FROM unset). Today this would be a manual send from the owner's inbox.]`

## US state law

- **Notify affected residents of each US state** under that state's breach notification law. All
  states have one, and the triggers, deadlines and content differ — the common trigger is unencrypted
  personal information such as name plus email credentials, account number or government ID.
- **Florida (FIPA, Fla. Stat. § 501.171):** notice to affected individuals expected within 30 days,
  and notice to the Florida Department of Legal Affairs where more than 500 Florida residents are
  affected. ⚖ *Confirm the current thresholds and timing with a lawyer; do not rely on this line
  alone.*
- If more than 500 residents anywhere are affected, expect an attorney-general notice and, in some
  states, credit-bureau notice. Get counsel involved before sending anything.
- Passwords are stored hashed and API keys are stored hashed, which materially changes what must be
  notified in several states. Say so accurately in the notice — and only if it is true of this
  incident.

## Providers and payments

- If a provider caused it, open a ticket immediately and keep their written account. Our duty to our
  customers does not transfer to them.
- If billing data is involved, tell Stripe (and the merchant of record, once there is one) and follow
  their instructions. PCI scope is SAQ A through hosted Checkout; a breach that touches card data
  would change that and must go to the provider the same day.
- If a customer API key leaked, revoke it, email the owner, and point them at per-key budgets — the
  control that caps the damage.

## After: close it out

1. Written post-incident review within two weeks: root cause, what the controls missed, what changes.
2. Fix the control, and add the test that would have caught it.
3. Update this runbook with what was actually unclear in the moment.
4. Keep the log, the notices and the register for at least `[TO BE COMPLETED: confirm the retention
   period for breach records with a lawyer.]`

## Things that will go wrong, written down now

- **One person.** No deputy means the 72-hour clock can run while the only decision maker is asleep
  or unreachable. Naming a deputy is the cheapest fix on this page.
- **Email cannot send.** The notification channel is not configured.
- **No regulator contact is pre-identified**, and no counsel is on retainer. Both are hours lost at
  the worst time.
- **Backups are manual** and have been a week stale, which affects both recovery and the ability to
  prove what the data looked like before.
