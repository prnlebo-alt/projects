import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { businessIdentity, contractingParty, effectiveDate, governingLawState } from "@/lib/business";

export const metadata: Metadata = { title: "Terms of Service (draft)", alternates: { canonical: "/terms" } };

const shell = { width: "min(780px, calc(100% - 40px))", margin: "70px auto 110px" } as const;

/**
 * Rendered per request, because every fact in it comes from the environment: the entity, the contact
 * address, the postal address and the governing-law state. A build-time snapshot would freeze a
 * half-configured deployment's legal text into the bundle.
 */
export const dynamic = "force-dynamic";

export default function TermsPage() {
  const { email, address } = businessIdentity();
  const legalName = contractingParty();
  const effective = effectiveDate();
  const state = governingLawState();
  return <main><article className="docs-content" style={shell}>
    <div className="billing-banner billing-banner-warning" role="note">Draft — pending review. Not yet in effect.</div>
    <span className="eyebrow">Legal</span>
    <h1>Terms of Service</h1>
    {effective && <p>Effective date: {effective}</p>}
    <p>These terms are an agreement between you and {legalName} (&quot;ChartRelay&quot;, &quot;we&quot;, &quot;us&quot;){address ? `, located at ${address}` : ""}. They cover your use of the ChartRelay website, dashboard, and chart rendering API (together, the &quot;Service&quot;). By creating an account or using the Service, you agree to these terms. If you use the Service for a company, you confirm you can bind that company to them.</p>

    <h2>1. Your account</h2>
    <p>You need an account to use the API. Give us accurate information, including a working email address, and keep your password and API keys secret. You are responsible for activity under your account and keys. If you think a key or your account has been compromised, revoke the key in your dashboard and contact us at {email}. You must be at least 18 years old to create an account.</p>

    <h2>2. Using the Service</h2>
    <p>You may use the Service to generate charts for your own products, reports, and automations. You agree not to:</p>
    <ul>
      <li>break the law or infringe anyone&apos;s rights with content you send us or charts you publish;</li>
      <li>send data you are not allowed to share, including sensitive personal data you have no right to process;</li>
      <li>try to get around usage limits, rate limits, or authentication, or share API keys to pool plan limits;</li>
      <li>probe, disrupt, overload, or reverse engineer the Service, or use it to attack other systems;</li>
      <li>resell raw access to the API as a competing chart rendering service.</li>
    </ul>
    <p>We may suspend access that threatens the Service, other customers, or the law. Where reasonable, we will tell you first and give you a chance to fix the problem.</p>

    <h2>3. Your content</h2>
    <p>You keep ownership of the chart specifications and data you send (&quot;Your Content&quot;) and of the charts produced from them. You give us permission to store, process, and serve Your Content only as needed to run, secure, and support the Service. Rendered chart URLs are public to anyone who has the link. Do not put confidential data in charts unless you are comfortable with that.</p>

    <h2>4. Plans, billing, and cancellation</h2>
    <p>The Free plan costs nothing and has the usage limits shown on the <Link href="/pricing">pricing page</Link>. Paid plans are monthly subscriptions billed in advance in US dollars. Payments are processed by Stripe, and your card details go to Stripe, not to us. Subscriptions renew automatically each month until canceled.</p>
    <p>You can cancel at any time from the billing portal in your dashboard. Cancellation takes effect at the end of the current billing period, and you keep paid features until then. Except where the law requires otherwise, we do not give refunds or credits for partial months. You are responsible for any taxes that apply to your purchase.</p>
    <p>We may change prices or plan limits. We will give you at least 30 days&apos; notice by email before a price change affects your subscription, and you can cancel before it takes effect.</p>

    <h2>5. Availability and changes</h2>
    <p>We work to keep the Service running, but we do not promise it will be uninterrupted or error-free, and we do not currently offer a service level agreement. We may change or remove features. If we discontinue the Service, we will give paid customers reasonable notice and a prorated refund of prepaid fees for the unused period.</p>

    <h2>6. Chart accuracy</h2>
    <p>ChartRelay renders what you send and runs automated quality checks. Those checks are guidance, not a guarantee. You are responsible for reviewing charts before relying on or publishing them.</p>

    <h2>7. Disclaimers</h2>
    <p>To the extent the law allows, the Service is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind, whether express or implied, including warranties of merchantability, fitness for a particular purpose, and non-infringement.</p>

    <h2>8. Limitation of liability</h2>
    <p>To the extent the law allows, we are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, revenue, or data. Our total liability for any claim relating to the Service is limited to the greater of the amount you paid us in the 12 months before the claim arose or US$100.</p>

    <h2>9. Indemnity</h2>
    <p>If a third party makes a claim against us because of Your Content or your breach of these terms, you agree to cover our reasonable costs of defending that claim, including legal fees.</p>

    <h2>10. Ending this agreement</h2>
    <p>You may stop using the Service and close your account at any time. We may end these terms or close your account if you materially breach them. Sections 3, 6, 7, 8, 9, and 11 continue after the agreement ends.</p>

    <h2>11. Governing law</h2>
    {state && <p>These terms are governed by the laws of the State of {state}, without regard to its conflict-of-laws rules. Disputes will be heard in the state or federal courts located in {state}, and both parties agree to that jurisdiction.</p>}

    <h2>12. Changes to these terms</h2>
    <p>We may update these terms. If a change is material, we will email account holders at least 30 days before it takes effect. Continuing to use the Service after that date means you accept the updated terms.</p>

    <h2>13. Contact</h2>
    <p>Questions about these terms: {email}, {legalName}{address ? `, ${address}` : ""}. See also our <Link href="/privacy">Privacy Policy</Link>.</p>
  </article><Footer /></main>;
}
