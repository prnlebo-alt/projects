import type { Metadata } from "next";
import Link from "next/link";
import { BillingButton, ManageBillingButton } from "@/components/billing-button";
import { Footer } from "@/components/footer";
import { CtaBand, FaqList, LandingHero, Section, SectionHead } from "@/components/landing";
import { currentAccount } from "@/lib/auth/session";
import { recordActivation, SURVEY_QUESTION, SURVEY_MAX_LENGTH, hasEvent } from "@/lib/metrics/activation";
import { UpgradeSurvey } from "@/components/upgrade-survey";
import { describeBilling } from "@/lib/billing/status";
import type { PaidPlan } from "@/lib/billing/stripe";
import { emailDeliverable } from "@/lib/email/send";
import { planLimits, PLANS, UNVERIFIED_FREE_LIMIT } from "@/lib/usage/limits";

export const metadata: Metadata = {
  title: "Pricing",
  // Both free numbers, because only naming the larger one is a promise the page cannot keep to a workspace
  // whose email is unconfirmed — and, when confirmation email is off, to any new workspace at all.
  description: `Prepaid chart rendering by URL or API. ${planLimits.free.toLocaleString("en-US")} renders a month free with a confirmed email, ${planLimits.developer.toLocaleString("en-US")} for $${PLANS.developer.priceUsd}, ${planLimits.pro.toLocaleString("en-US")} for $${PLANS.pro.priceUsd}, ${planLimits.business.toLocaleString("en-US")} for $${PLANS.business.priceUsd}. One-time render packs are coming soon.`,
  alternates: { canonical: "/pricing" },
};

/** The free tier is not a purchase, so it never starts a checkout. */
function FreeAction({ current }: { current: string | null }) {
  if (current === null) return <Link className="button button-wide" href="/register">Create free account</Link>;
  return <span className="button button-ghost button-wide" aria-disabled="true">Included with every account</span>;
}

function PaidAction({ plan, current, subscribed, children }: { plan: PaidPlan; current: string | null; subscribed: boolean; children: React.ReactNode }) {
  if (current === null) return <Link className="button button-wide" href="/register">Create account</Link>;
  if (current === plan && subscribed) return <ManageBillingButton className="button button-ghost button-wide">Current plan · Manage billing</ManageBillingButton>;
  if (subscribed) return <ManageBillingButton className="button button-wide">Switch plan in billing</ManageBillingButton>;
  return <BillingButton plan={plan}>{children}</BillingButton>;
}

// Quotas mirror src/lib/usage/limits.ts; every other line here is verifiable in the same code the
// landing pages cite. Composed with the landing kit (LandingHero / Section / CtaBand) so the page
// keeps the rhythm of /, /mcp, /compare and /chart-check, which all send their CTAs here.
export default async function PricingPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  const account = await currentAccount();
  const { billing: billingParam } = await searchParams;
  const current = account ? account.workspace.plan : null;
  // Only a signed-in visitor is counted: an anonymous pricing view cannot be tied to the sign-up it may
  // later become, so counting it would put a number in the funnel that no ratio below can use.
  if (account) recordActivation(account.workspace.id, "upgrade_page_view");
  // Asked once per workspace, and never of a visitor who has not signed up — there is nothing to ask
  // someone who has not used the product yet.
  const askSurvey = account ? !hasEvent(account.workspace.id, "survey_answer") : false;
  const subscribed = account ? describeBilling(account.workspace).hasLiveSubscription : false;
  // Whether a new account can raise its own limit today. Same helper /support and /forgot-password read, so
  // the page never sells a confirmation step that this deployment cannot perform.
  const canConfirm = emailDeliverable();
  const freeAllowance = `${planLimits.free.toLocaleString("en-US")} renders a month once your email is confirmed`;
  return <main>
    <LandingHero
      eyebrow="Simple monthly plans"
      title={<>Start free. Pay when the API <span>earns its keep</span>.</>}
      subtitle="No fake enterprise maze. Every plan is prepaid: you are never billed for more than you bought, and a plan that runs out stops rather than surprising you. One-time render packs are coming soon."
      note="Paid plans are billed monthly and can be canceled any time from the billing portal."
    />

    <Section id="plans" aria-label="Plans">
      {billingParam === "cancelled" && <div className="billing-banner billing-banner-warning" role="status">Checkout was canceled. You have not been charged.</div>}
      <div className="pricing-grid">
        <article className="price-card"><h2>Free</h2><div className="price">$0<span>/month</span></div><p>For prototypes, side projects, and evaluation.</p><ul><li>{UNVERIFIED_FREE_LIMIT} stored renders monthly, {planLimits.free.toLocaleString("en-US")} with a confirmed email</li><li>Charts carry a small chartrelay.dev mark</li><li>No card</li></ul>{!canConfirm && <p className="empty-copy">Confirmation email is switched off on this deployment right now, so a new account stays at {UNVERIFIED_FREE_LIMIT} a month until it is back. <Link href="/support">Support</Link> raises the limit by hand meanwhile.</p>}<FreeAction current={current} /></article>
        <article className="price-card"><h2>Developer</h2><div className="price">${PLANS.developer.priceUsd}<span>/month</span></div><p>For a product with its first real traffic.</p><ul><li>{planLimits.developer.toLocaleString("en-US")} renders a month</li><li>No mark on any chart</li><li>Render packs for overage (coming soon)</li><li>Email support</li></ul><PaidAction plan="developer" current={current} subscribed={subscribed}>Choose Developer</PaidAction></article>
        <article className="price-card featured"><span className="popular">Best value</span><h2>Pro</h2><div className="price">${PLANS.pro.priceUsd}<span>/month</span></div><p>For products and automations with real traffic.</p><ul><li>{planLimits.pro.toLocaleString("en-US")} renders a month</li><li>No mark on any chart</li><li>Signed URLs and multiple keys</li><li>Render packs for overage (coming soon)</li></ul><PaidAction plan="pro" current={current} subscribed={subscribed}>Choose Pro</PaidAction></article>
        <article className="price-card"><h2>Business</h2><div className="price">${PLANS.business.priceUsd}<span>/month</span></div><p>For high-volume reporting and agent workflows.</p><ul><li>{planLimits.business.toLocaleString("en-US")} renders a month</li><li>Everything in Pro</li><li>IP allowlisting per key</li><li>Priority support</li></ul><PaidAction plan="business" current={current} subscribed={subscribed}>Choose Business</PaidAction></article>
      </div>
    </Section>

    <Section tint id="billing-faq">
      <div>
        <SectionHead
          eyebrow="Before you upgrade"
          title="What the plan actually changes."
          body="The rendering, the alt text and the QA review are identical on every tier. A plan changes two things: it sets how many renders you have prepaid for the calendar month, and it removes the chartrelay.dev mark from charts drawn by URL. When the month's renders run out the API stops rather than billing you for more; render packs, coming soon, will let you top up."
        />
        <FaqList
          items={[
            {
              question: "How do I get rid of the chartrelay.dev mark?",
              answer: "Pass an API key from a paid workspace — Developer, Pro or Business — on the chart URL as ?key=… and the mark is left off. Free keys and anonymous requests keep it. Nothing else about the chart changes — same renderer, same alt text, same QA review.",
            },
            {
              question: "Do charts drawn from a URL count against my monthly renders?",
              answer: "Not as the endpoint stands today. GET /chart is unauthenticated, and a render served through it is not counted against the figures above; a per-address rate limit stops one client monopolising the renderer, and identical URLs come from cache rather than being redrawn. We used to advertise that as unlimited charts by URL on every tier. We no longer do: what a plan sells is the monthly renders above, and we would rather describe how the endpoint behaves now than promise it will never be metered.",
            },
            {
              question: "What is the difference between a chart by URL and a stored render?",
              answer: "A chart by URL is drawn on demand and never kept: the URL is the chart, so it can live in an email or a README for years. A stored render is created with POST /api/v1/charts, is kept with its alt text and QA findings, and gets a short permanent link you can revisit. Those are the ones the monthly figures count.",
            },
            {
              question: "What happens when I hit the monthly limit?",
              answer: `The API returns HTTP 429 with a message naming the limit you reached, and stops there. Nothing is charged automatically, so you are never billed for an overage you did not choose: either move up a plan (one-time render packs are coming soon) or the count resets at the start of the next calendar month, UTC. The monthly allowance does not roll over.`,
            },
            {
              question: "Why does the free tier need a confirmed email?",
              answer: canConfirm
                ? `The free tier is ${planLimits.free.toLocaleString("en-US")} renders a month, and it starts when you confirm your address. Confirming takes one click and needs no card. Until then a new workspace has ${UNVERIFIED_FREE_LIMIT} — that is what stops one person opening a thousand free accounts, and it is the reason the free tier can be as large as it is.`
                : `The free tier is ${planLimits.free.toLocaleString("en-US")} renders a month and starts when you confirm your address. Confirmation email is not being delivered on this deployment at the moment, so a new workspace stays at ${UNVERIFIED_FREE_LIMIT} until it is switched back on; support raises the limit by hand in the meantime — write to support@chartrelay.dev and it is done the same day.`,
            },
            {
              question: "Can I cancel?",
              answer: "Yes. Manage billing opens the Stripe billing portal, where you can cancel; the subscription then runs to the end of the period you have already paid for and drops back to the free tier.",
            },
            {
              question: "Does a bigger plan render better charts?",
              answer: "No. Deterministic SVG, durable PNG and SVG URLs, alt text and the full QA review ship on the free tier as well, and there is no premium chart type. The one visible difference is the chartrelay.dev mark on charts drawn from a URL, which a paid key removes; stored renders never carry it.",
            },
          ]}
        />
      </div>
    </Section>

    {askSurvey ? <Section><UpgradeSurvey question={SURVEY_QUESTION} maxLength={SURVEY_MAX_LENGTH} /></Section> : null}

    <CtaBand
      eyebrow="No card to look around"
      title="Try a render before you pick a plan."
      body="The playground runs the same rendering engine through a public, rate-limited endpoint. No account needed to see the SVG, the alt text and the QA findings."
      actions={<>
        <Link className="button" href="/playground">Open the playground</Link>
        <Link className="button button-ghost" href="/docs">Read the API reference</Link>
      </>}
      note={canConfirm
        ? `A free account gets you an API key of your own. A new workspace gets ${UNVERIFIED_FREE_LIMIT} renders a month until the owner confirms their email address. Confirming it raises the limit to ${planLimits.free.toLocaleString("en-US")} immediately — same features, no card.`
        : `A free account gets you an API key of your own, and ${freeAllowance}. Confirmation email is not being delivered on this deployment at the moment, so a new workspace stays at ${UNVERIFIED_FREE_LIMIT} until it is switched back on; support raises the limit by hand in the meantime.`}
    />
    <Footer />
  </main>;
}
