> **DRAFT — NOT LEGAL ADVICE. REQUIRES LAWYER REVIEW BEFORE PUBLICATION.**

# Refund and Cancellation Policy

This policy forms part of the ChartRelay Terms of Service. The billing spec requires it to be
**linked from the pricing page and from checkout** — neither link exists today, and Stripe's own
website checklist requires it too.

Identity values come from `src/lib/business.ts`: requests go to `{{supportEmail()}}`
(support@chartrelay.dev); the seller is `{{contractingParty()}}` (MadPugExperiment LLC), except where
a merchant of record is the seller of record — see "Who you actually paid" below.

---

## The short version

| What you bought | Can you cancel? | Do you get money back? |
|---|---|---|
| Monthly subscription | Yes, any time, yourself, in the dashboard | Access continues to the end of the cycle you paid for. No refund for a partial cycle. |
| Render pack | Nothing to cancel — it is a one-time purchase | Full refund within 14 days if **no** renders from it have been used. Otherwise no refund. |
| Auto top-up | Yes, turn it off yourself any time | Each pack it already bought follows the pack rule above |
| Failed renders | — | Never charged in the first place |

We would rather fix a problem than argue about $19. If something went wrong, email
{{supportEmail()}}.

## Cancelling a subscription

- Cancel at any time from your dashboard. No email, no phone call, no retention queue.
- Cancellation takes effect at the end of the current billing period. You keep paid features and your
  remaining allowance until then.
- The allowance does not roll over and is not refunded as credit.
- Any render packs you hold keep working after the subscription ends, until they are used or they
  expire.

## Subscription refunds

Subscriptions are prepaid monthly. We do not refund partial months, with these exceptions:

- **We broke it.** A material outage or defect that stopped you using the Service for a meaningful
  part of the cycle: tell us and we will refund or credit fairly.
- **You were billed after cancelling**, or billed twice: full refund.
- **You never used it.** If you were charged for a renewal and used no renders in that cycle, ask
  within 14 days of the charge and we will refund it.
- **A price change you did not accept.** If we raise your price and you cancel before it takes
  effect, you are not charged the new price.
- **We terminate you without cause, or we shut the Service down.** We refund the unused part of the
  period you paid for, and any unexpired, unused pack credit.
- **The law requires it.** See "Consumers in the EU and UK" below.

## Render pack refunds

- **Unused pack, within 14 days of purchase:** full refund, no questions.
- **Partly used pack:** no refund. Credit that has been spent on renders has been delivered.
- **Unused pack, after 14 days:** no refund as a rule. Ask anyway if something unusual happened.
- **Packs expire 12 months after purchase.** Unused renders in an expired pack are forfeited and are
  not refunded. We email you 14 days and 3 days before a pack with credit left expires, and the
  expiry is stated at checkout.
- Credit is not money. It has no cash value, earns no interest, and cannot be transferred or cashed
  out.

⚖ *Lawyer: confirm the 12-month expiry and the no-refund-after-use rule are enforceable against
consumers in the US, EU and UK, and whether any US state's gift-card or stored-value rules apply to
prepaid API credit.*

## What is never charged

- Renders that fail on our side.
- Renders rejected by validation, including over-limit payloads.
- Cache hits.
- Retries that carry the same `Idempotency-Key` as a request we already answered.

If a unit was reserved for a render that then failed, it is refunded to your balance automatically.
No request needed. If you think you were charged for a failed render, email {{supportEmail()}} with
the request ID.

## Consumers in the EU and UK

If you bought as a consumer rather than for a business, you may have a statutory **14-day right to
withdraw** from a distance contract. Because ChartRelay is digital content delivered immediately, we
ask you to acknowledge at checkout that you want it supplied straight away and that you lose the
withdrawal right once supply begins. That acknowledgement does not affect your rights if the Service
is faulty or not as described.

Nothing in this policy limits a consumer's non-excludable statutory rights.

⚖ *Lawyer: confirm the withdrawal-right waiver wording and that checkout actually collects the
acknowledgement. The checkout does not collect it today.*

## Who you actually paid

Payments are handled by a payment provider, and for some sales that provider is the **merchant of
record** — the seller for tax purposes. Where that is the case, the refund goes through that provider
and its own refund rules and timescales apply in addition to this policy. Your receipt and your card
statement name the provider.

`[TO BE COMPLETED: name the merchant of record. Stripe Managed Payments has been applied for, with
Polar as the fallback; the choice is not made. Check its refund rules against this policy once chosen
— a provider's rules can be stricter than ours, and the published policy must not promise something
the provider will not do.]`

## How to ask for a refund

Email {{supportEmail()}} with the account email, roughly when you were charged, and what you want
refunded. You do not need a reason for the no-questions cases above.

- We reply within `[TO BE COMPLETED: state a real target. The default published support response is
  2 business days.]`
- Approved refunds go back to the original payment method.
- How long the money takes to appear is up to your bank and the payment provider, typically several
  business days. We do not control that.
- A refund reverses the credit it bought. If that leaves your balance negative, your keys pause until
  it is settled.

## Chargebacks

Please ask us first. A chargeback costs us a dispute fee, and the first thing it does is reverse the
credit and pause your keys — which is slower and worse for you than a refund. If you have already
filed one, email us and we will still try to help.

## Changes

We may update this policy. Material changes are emailed to account holders before they take effect,
and the version that applies to a purchase is the one published when you made it.
