import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Callout, CtaBand, FeatureGrid, LandingHero, Section, SectionHead, Steps } from "@/components/landing";
import { emailConfigured } from "@/lib/email/send";
import { supportEmail, supportMailto, supportResponseTime } from "@/lib/support";
import { planLimits, UNVERIFIED_FREE_LIMIT } from "@/lib/usage/plans";

export const metadata: Metadata = {
  title: "Support",
  description: "How to get help with ChartRelay: billing, a lost API key, monthly render limits, bug reports, and how to report a security vulnerability.",
  alternates: { canonical: "/support" },
};

/**
 * SUPPORT_EMAIL is read per request rather than baked into a static page: the contact block has
 * to reflect the environment the page is actually served from, not the one that built the image.
 */
export const dynamic = "force-dynamic";

const SUBJECTS = {
  general: "ChartRelay support request",
  billing: "ChartRelay billing question",
  key: "ChartRelay API key help",
  limit: "ChartRelay plan limit question",
  bug: "ChartRelay bug report",
  security: "ChartRelay security report",
} as const;

/**
 * A mailto link when the channel is configured, plain text when it is not. Never a dead link, and never
 * a trailing clause: every call site embeds this mid-sentence, so anything appended here splices itself
 * into the middle of someone else's sentence. The hero note and the Callout below carry that caveat once.
 */
function Contact({ subject, children }: { subject: string; children: string }) {
  const href = supportMailto(subject);
  if (!href) return <span>{children}</span>;
  return <a href={href}>{children}</a>;
}

export default function SupportPage() {
  const address = supportEmail();
  const mailto = supportMailto(SUBJECTS.general);
  const responseTime = supportResponseTime();
  // Whether account email can actually leave this deployment. Read through the one helper that also
  // drives the startup warning, so a typo'd variable can never make this page and the logs disagree:
  // saying "check your spam folder" to someone whose confirmation mail was never sent wastes their time.
  const mailWorks = emailConfigured();

  const problems = [
    {
      icon: "01",
      title: "A billing problem",
      body: <>If you have ever been through checkout, the <Link href="/dashboard">dashboard</Link> shows a <strong>Manage billing</strong> button that opens the Stripe customer portal, where you can change or cancel a plan and read past invoices. On a free plan there is nothing to manage and no such button — the <strong>Upgrade</strong> link there takes you to <Link href="/pricing">pricing</Link>. Cards and invoices are held by Stripe, never by us. If a plan did not change after checkout, or a charge looks wrong, <Contact subject={SUBJECTS.billing}>tell us</Contact> the date and the plan you expected — do not send card details.</>,
    },
    {
      icon: "02",
      title: "A lost API key",
      body: <>Keys cannot be recovered. Only a hash and the first twelve characters are stored, so nobody — including us — can show you a key again after it is created. Create a replacement in the <Link href="/dashboard">dashboard</Link>, move your integration onto it, then revoke the old one. If you cannot get into the account at all, <Contact subject={SUBJECTS.key}>write to us</Contact> from the address the account uses.</>,
    },
    {
      icon: "03",
      title: "Hitting the monthly limit",
      body: <>The API answers HTTP 429 with the limit it hit and stops there; nothing is charged automatically, because every plan is prepaid. Free is {planLimits.free.toLocaleString("en-US")} renders a month once the account email is confirmed and {UNVERIFIED_FREE_LIMIT} before that; Developer is {planLimits.developer.toLocaleString("en-US")}, Pro {planLimits.pro.toLocaleString("en-US")} and Business {planLimits.business.toLocaleString("en-US")}. One-time render packs are coming soon. Counts reset at the start of the next calendar month, UTC, and do not roll over. See <Link href="/pricing">pricing</Link>, or <Contact subject={SUBJECTS.limit}>ask us</Contact> if the count looks wrong for what you sent.</>,
    },
    {
      icon: "04",
      title: "A chart that renders wrong",
      body: <>Paste the chart into the free <Link href="/chart-check">chart checker</Link> first: it runs the same structural review the API runs and names the rule that fired plus the fix it suggests. For rejected requests, the <Link href="/docs#errors">errors table in the docs</Link> explains each status code, and a 400 response lists every failing field by path.</>,
    },
    {
      icon: "05",
      title: "A bug, or a request that should have worked",
      body: <><Contact subject={SUBJECTS.bug}>Send a bug report</Contact> with the details below. A reproducible chart specification is worth more than any description of it — we can replay it exactly.</>,
    },
    {
      icon: "06",
      title: "An account email that never arrived",
      body: mailWorks
        ? <>Check the spam folder, confirm the address on the account is the one you are watching, and resend the confirmation from the <Link href="/dashboard">dashboard</Link>. An unconfirmed free workspace has no renders at all — confirming the address is what turns the {planLimits.free.toLocaleString("en-US")} a month on. <Contact subject={SUBJECTS.general}>Tell us</Contact> if a resend still does not arrive.</>
        : <>Outbound email is not configured on this deployment, so confirmation and password-reset messages are not being delivered. Nothing is wrong with your address, and nothing is in transit. An unconfirmed free workspace has no renders until the address is confirmed, so support switches the {planLimits.free.toLocaleString("en-US")} a month on by hand while email is down — ask and it is done the same day. <strong>If you are locked out</strong>, the reset form cannot help you until then: <Contact subject={SUBJECTS.general}>tell us</Contact> and the account will be recovered by hand.</>,
    },
  ];

  const bugDetails = [
    { title: "What you sent", body: "The chart specification, or the smallest version of it that still shows the problem. Strip anything confidential first — chart data is not secret once rendered." },
    { title: "What came back", body: "The HTTP status code and the response body, including the details.issues list on a 400 and the render id on a success." },
    { title: "When, and how often", body: "The approximate time in UTC and whether it happens on every request or only sometimes. Never include an API key, a password or a session cookie." },
  ];

  return (
    <main>
      <LandingHero
        eyebrow="Support"
        title={<>Something is wrong. <span>Here is where it goes.</span></>}
        subtitle="Most ChartRelay problems fall into six buckets, and four of them you can fix yourself in a couple of minutes. Everything else has a person at the end of it."
        actions={
          mailto
            ? <>
                <a className="button" href={mailto}>Email support</a>
                <Link className="button button-ghost" href="/docs">Read the API docs</Link>
              </>
            : <>
                <Link className="button" href="/docs">Read the API docs</Link>
                <Link className="button button-ghost" href="/chart-check">Check a chart</Link>
              </>
        }
        note={address ? `Written replies, aimed at ${responseTime}. There is no phone line and no live chat.` : "The contact channel is being set up. The self-service answers below are accurate today."}
      />

      <Section id="problems">
        <SectionHead
          eyebrow="Start here"
          title="Six problems, and what to do about each."
          body="Nothing on this page is a queue number or an autoresponder. Where a fix exists in the product, it is named."
        />
        <FeatureGrid items={problems} columns={2} />
      </Section>

      <Section id="contact" tint>
        <div>
          <SectionHead
            eyebrow="Contact"
            title={address ? "Write to us." : "The contact channel is being set up."}
            body={
              address
                ? `One address covers billing, accounts, bugs and security. Replies are written and aimed at ${responseTime} — that is the target we work to, not a contractual guarantee, and there is no separate paid support tier that jumps the queue.`
                : "There is no support address to publish yet, and we would rather say so than print one that bounces. The self-service steps above are the full set of answers we have today; this section will carry the address as soon as it is live."
            }
          />
          {mailto && address
            // overflowWrap keeps a long configured address inside the button at 375px, where an
            // email has no spaces to break at.
            ? <p><a className="button" href={mailto} style={{ maxWidth: "100%", overflowWrap: "anywhere" }}>{address}</a></p>
            : <Callout tone="warn" title="No address to publish yet">
                <p>Rather than show a placeholder or a link that goes nowhere, this page leaves the contact block empty until a real address is configured. If you reached here from a broken link elsewhere, that is what happened.</p>
              </Callout>}
          <Callout title="What a bug report needs">
            <p>Three things turn a report into a fix, and one thing must never be in it.</p>
          </Callout>
          <Steps items={bugDetails} />
        </div>
      </Section>

      <Section id="security">
        <SectionHead
          eyebrow="Security"
          title="Reporting a vulnerability."
          body="If you have found a way to reach another workspace's data, bypass authentication, or run something on our servers, we want to hear it before anyone else does."
        />
        <FeatureGrid
          columns={2}
          items={[
            {
              title: "How to report it",
              body: address
                ? <>Email <Contact subject={SUBJECTS.security}>the support address</Contact> with the subject line already filled in, and describe the steps to reproduce it and what the issue lets you reach. Proof-of-concept detail is welcome; please do not test against other people&apos;s workspaces or data.</>
                : <>There is no published address to send a report to yet. Until there is, please hold the details rather than posting them publicly, and check back here — this section will name the address the moment the channel is configured.</>,
            },
            {
              title: "What we ask in return",
              body: <>Please do not disclose the issue publicly until it is fixed, and give us a reasonable chance to fix it first. We will confirm receipt, tell you what we found, and let you know when the fix is out. ChartRelay runs no bug bounty and offers no payment — we will credit you if you want to be named.</>,
            },
          ]}
        />
        <Callout tone="warn" title="Not a security issue">
          <p>Public chart URLs are deliberately unauthenticated: anyone holding the link can load the chart. That is documented behaviour, not a vulnerability, so do not put confidential data in a chart specification. See the <Link href="/privacy">privacy policy</Link> for what we store.</p>
        </Callout>
      </Section>

      <CtaBand
        eyebrow="Meanwhile"
        title="The answer may already be written down."
        body="The API reference covers every field, status code and asset URL. The chart checker reproduces the exact review that runs on each render, without an account."
        actions={
          <>
            <Link className="button" href="/docs">API documentation</Link>
            <Link className="button button-ghost" href="/chart-check">Chart checker</Link>
            <Link className="button button-ghost" href="/pricing">Plans and limits</Link>
            <Link className="button button-ghost" href="/dashboard">Dashboard</Link>
          </>
        }
        note="The chart checker needs no account and no API key. The docs cover every field and status code the API can return."
      />

      <Footer />
    </main>
  );
}
