import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { supportEmail, supportMailto } from "@/lib/support";
import { businessIdentity, contractingParty, effectiveDate, SUBPROCESSORS } from "@/lib/business";

export const metadata: Metadata = { title: "Privacy Policy (draft)", alternates: { canonical: "/privacy" } };

/**
 * The contact line is rendered from SUPPORT_EMAIL at request time, through the same helpers /support
 * uses, so this page degrades honestly instead of printing a placeholder address that bounces.
 */
export const dynamic = "force-dynamic";

const shell = { width: "min(780px, calc(100% - 40px))", margin: "70px auto 110px" } as const;

/** A mailto when an address is configured, otherwise a truthful note. Never a made-up address. */
function PrivacyContact() {
  const address = supportEmail();
  const mailto = supportMailto("ChartRelay privacy request");
  if (!address || !mailto) return <>the support channel listed on our <Link href="/support">support page</Link> (an address is being set up; until it is published, use the dashboard tools above)</>;
  return <a href={mailto}>{address}</a>;
}

export default function PrivacyPage() {
  return <main><article className="docs-content" style={shell}>
    <div className="billing-banner billing-banner-warning" role="note">Draft — pending review. Not yet in effect.</div>
    <span className="eyebrow">Legal</span>
    <h1>Privacy Policy</h1>
    {effectiveDate() && <p>Effective date: {effectiveDate()}</p>}
    <p>This policy explains what personal information {contractingParty()} (&quot;ChartRelay&quot;, &quot;we&quot;, &quot;us&quot;){businessIdentity().address ? `, located at ${businessIdentity().address},` : ""} collects when you use the ChartRelay website and API, how we use it, and the choices you have.</p>

    <h2>What we collect</h2>
    <ul>
      <li><strong>Account details.</strong> Your name, email address, and password. We store only a one-way hash of your password, never the password itself.</li>
      <li><strong>API keys.</strong> We store a hash and a short prefix of each key so we can recognize it. We cannot show you a full key again after it is created.</li>
      <li><strong>Chart data.</strong> The chart specifications you send (titles, labels, values, and styling) and the charts we render from them.</li>
      <li><strong>Usage data.</strong> Records of API calls and renders, timestamps, and which key was used, so we can enforce plan limits and show you usage.</li>
      <li><strong>Billing details.</strong> Your plan, subscription status, and Stripe customer and subscription identifiers. Card numbers and payment details are collected and stored by Stripe, not by us.</li>
      <li><strong>Technical data.</strong> IP addresses and request information, used for security and rate limiting. We set a session cookie to keep you signed in. We do not use advertising cookies.</li>
    </ul>

    <h2>How we use it</h2>
    <ul>
      <li>To provide the Service: authenticate you, render charts, host chart URLs, and meter usage.</li>
      <li>To bill you for paid plans and manage your subscription.</li>
      <li>To send transactional email, such as email verification, password resets, and important account or billing notices.</li>
      <li>To keep the Service secure, prevent abuse, and fix problems.</li>
      <li>To meet legal obligations.</li>
    </ul>
    <p>We do not sell your personal information, and we do not use your chart data to train machine learning models.</p>

    <h2>Who we share it with</h2>
    <p>We share information only with service providers that help us run ChartRelay, and only as much as they need:</p>
    <ul>
      {SUBPROCESSORS.map((sub) => <li key={sub.name}><strong>{sub.name}</strong>, which {sub.purpose}.</li>)}
    </ul>
    <p>We may also disclose information if the law requires it, to protect rights and safety, or as part of a merger or sale of the business, in which case this policy continues to apply to your information.</p>

    <h2>Public chart URLs</h2>
    <p>Rendered chart URLs are not secret. Anyone with a link can view that chart. Do not include confidential or sensitive personal data in chart specifications.</p>

    <h2>How long we keep it</h2>
    <p>We keep account information while your account is open. Chart data and usage records are kept while your account is open so rendered URLs keep working, unless you ask us to delete them. When you delete your account from the dashboard, your account, workspace, API keys, renders and usage history are removed from our database immediately, and the rendered chart URLs stop being served. Copies of chart images already held by browsers, proxies or link-preview caches are outside our control and may keep displaying for up to a year, because chart assets are served with a long cache lifetime. Billing records are kept by Stripe under their own retention rules, and we may keep the minimum needed for legal, tax, or accounting reasons.</p>

    <h2>Security</h2>
    <p>We use reasonable safeguards, including hashed passwords and API keys, signed session cookies, and encrypted connections. No system is perfectly secure, and we cannot guarantee absolute security.</p>

    <h2>Your choices and rights</h2>
    <p>Two of these rights are self-service and need no request at all. In the <strong>Danger zone</strong> of your <Link href="/dashboard">dashboard</Link>, <strong>Export my data</strong> downloads a JSON file of everything we hold for the account, and <strong>Delete account</strong> removes it permanently. For anything else — correcting details, or a question about what an export contains — write to <PrivacyContact />. Depending on where you live, you may have additional rights under local law. We will not discriminate against you for exercising them.</p>

    <h2>Children</h2>
    <p>ChartRelay is not intended for anyone under 18, and we do not knowingly collect information from children.</p>

    <h2>International users</h2>
    <p>ChartRelay is operated from the United States, and your information is processed in the United States.</p>

    <h2>Changes to this policy</h2>
    <p>If we make a material change, we will email account holders before it takes effect and update the effective date above.</p>

    <h2>Contact</h2>
    <p>Privacy questions or requests: <PrivacyContact />. {contractingParty()}{businessIdentity().address ? `, ${businessIdentity().address}` : ""}. See also our <Link href="/terms">Terms of Service</Link> and our <Link href="/support">support page</Link>.</p>
  </article><Footer /></main>;
}
