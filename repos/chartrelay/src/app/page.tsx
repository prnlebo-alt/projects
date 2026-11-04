import type { Metadata } from "next";
import Link from "next/link";
import { ChartPreview } from "@/components/chart-preview";
import { Footer } from "@/components/footer";
import { CodeCard, Callout, CtaBand, FaqList, FeatureGrid, LandingHero, Section, SectionHead, Steps } from "@/components/landing";
import { renderChart } from "@/lib/charts/render";
import { sampleSpec } from "@/lib/charts/schema";
// Plan figures come from the ladder rather than being retyped here: this page printed a free tier of
// 1,000 for weeks after the constants said otherwise.
import { planLimits, PLANS, UNVERIFIED_FREE_LIMIT } from "@/lib/usage/plans";

const n = (value: number) => value.toLocaleString("en-US");

export const metadata: Metadata = {
  description: "A chart API for AI agents. Send a small JSON spec and get deterministic SVG, durable PNG and SVG URLs, alt text, and a structural QA review in one call.",
  alternates: { canonical: "/" },
};

const requestSnippet = `curl -X POST "$CHARTRELAY_URL/api/v1/charts" \\
  -H "Authorization: Bearer $CHARTRELAY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "bar",
    "title": "Monthly recurring revenue",
    "series": [{
      "name": "MRR",
      "data": [
        { "label": "Aug", "value": 31200 },
        { "label": "Sep", "value": 33900 }
      ]
    }]
  }'`;

const responseSnippet = `{
  "id": "V1StGXR8_Z5jdH",
  "svg": "<svg xmlns=\\"http://www.w3.org/2000/svg\\" ...>",
  "altText": "Monthly recurring revenue. MRR peaks at 33,900 for Sep and bottoms at 31,200 for Aug. It increased 8.7% from first to last point.",
  "warnings": [
    {
      "severity": "tip",
      "code": "healthy",
      "message": "No structural chart problems detected.",
      "suggestion": "Verify the source data and intended takeaway before publishing."
    }
  ],
  "urls": {
    "svg": ".../api/v1/charts/V1StGXR8_Z5jdH?format=svg",
    "png": ".../api/v1/charts/V1StGXR8_Z5jdH?format=png"
  },
  "usage": { "used": 41, "limit": 1000 }
}`;

// The shape the MCP config will take once @chartrelay/mcp is published. It is not runnable today:
// the package is unpublished and the repository is private, which /mcp says in full.
const mcpSnippet = `{
  "mcpServers": {
    "chartrelay": {
      "command": "npx",
      "args": ["-y", "@chartrelay/mcp"],
      "env": {
        "CHARTRELAY_API_KEY": "cr_live_...",
        "CHARTRELAY_API_URL": "https://your-chartrelay-host"
      }
    }
  }
}`;

export default function Home() {
  const demo = renderChart(sampleSpec);
  return <main>
    <LandingHero
      eyebrow="The chart API for AI agents"
      title={<>Your agent&apos;s charts, <span>checked before they ship.</span></>}
      subtitle="Send a small JSON spec and get back SVG, durable PNG and SVG URLs, alt text, and a structural review in one call. A chart the type cannot honestly represent is rejected outright rather than returned as a success. The same input always gives the same chart, and the value axis always includes zero."
      actions={<>
        <Link className="button" href="/playground">Try the playground</Link>
        <Link className="button button-ghost" href="/docs">Read the API docs</Link>
      </>}
      note={`Structure is enforced; data correctness is not — no API can tell you the numbers are right · No signup for the playground · Free accounts get ${n(planLimits.free)} renders a month once the email is confirmed (${UNVERIFIED_FREE_LIMIT} before that) · No card to start`}
    >
      <ChartPreview svg={demo.svg} />
    </LandingHero>

    <Section tint id="problem">
      <div>
        <SectionHead
          eyebrow="Why agents need this"
          title="Letting the model write plotting code is the fragile part."
          body="A model that emits matplotlib or Chart.js is writing a program you never reviewed, for data you cannot see, into a report that goes straight to someone else."
        />
        <FeatureGrid
          columns={3}
          items={[
            { icon: "01", title: "The output drifts", body: "Generated plotting code is rewritten on every run, so the same question can produce a different-looking chart each time — and sometimes code that does not run at all." },
            { icon: "02", title: "Nothing writes the alt text", body: "A chart image with no text description is unusable for screen readers and worthless in an email client that blocks images. Nobody in the loop writes that description." },
            { icon: "03", title: "Some charts are embarrassing", body: "Nine-slice pies, a legend with twelve series, colours that vanish into the background, an axis that starts at 90 so a 2% change looks like a cliff. No one catches them before the customer does." },
          ]}
        />
      </div>
    </Section>

    <Section id="how-it-works">
      <SectionHead
        eyebrow="How it works"
        title="JSON in. Chart, alt text, and a QA report out."
        body="One POST to /api/v1/charts with a Bearer key. Your agent can act on the answer without a human in the loop."
      />
      <Steps
        items={[
          { title: "Send a small spec", body: "Five chart types, at most 12 series and 100 points per series. A schema this small leaves a model little to get wrong, and an invalid spec comes back as HTTP 400 with the exact field path and what is wrong with it." },
          { title: "Get the chart, the alt text, and the findings", body: "The response carries the SVG itself, durable PNG and SVG URLs, an alt-text summary of what the chart shows, and a list of structural QA findings — each with a severity and a suggested fix." },
          { title: "Or get a refusal, with the reason", body: "When a finding is severe enough that the chart cannot be read honestly — a pie comparing several series, a pie with negative values — the request is rejected and nothing is stored. There is no id and no URL to paste by accident, and the render is not counted. A caller who wants the chart anyway has to ask for it explicitly, on that request." },
          { title: "Let the agent fix and re-render", body: "Every finding names the problem and the remedy, so the agent can revise its own spec and call again before anyone sees the first attempt." },
        ]}
      />
      <div className="lp-grid lp-grid-2" style={{ marginTop: 28 }}>
        {/* A long code line scrolls inside its card: `.lp-grid > * { min-width: 0 }` in globals.css
            stops it widening the grid track. */}
        <div>
          <CodeCard label="POST /api/v1/charts" code={requestSnippet} caption="Authenticate with a Bearer API key from your dashboard. Unset fields fall back to the schema defaults (900 x 520, light theme, legend on)." />
        </div>
        <div>
          <CodeCard label="201 Created" code={responseSnippet} caption="Shape of a real response: id, svg, altText, warnings, urls and usage." />
        </div>
      </div>
    </Section>

    <Section tint id="every-response">
      <div>
        <SectionHead
          eyebrow="Every response"
          title="What comes back in every response."
          body="Not a bare image endpoint. Everything an agent needs to publish the chart, or to decide not to."
        />
        <FeatureGrid
          columns={3}
          items={[
            { title: "Deterministic SVG", body: "The chart is drawn by a plain function in the same process — no headless browser, no screenshot step. The same JSON produces the same SVG." },
            { title: "Durable PNG and SVG URLs", body: "GET /api/v1/charts/{id}?format=svg|png needs no key, so the URL works in Slack, email, and a web page. It is served immutable and cached for a year." },
            { title: "Alt text", body: "Each render returns a written summary: the title, the peak and the low with their labels, and, for time-ordered charts, the change from the first to the last point — or the largest shares for a pie." },
            { title: "Structural QA findings", body: "Missing title, too many slices, a dense chart, too many series, low-contrast colours, and labels the axis will shorten. Each one names a fix, and the chart still renders so the agent can judge the trade-off." },
            { title: "A value axis that includes zero", body: "The scale is computed from zero and the data, never from the data alone, so an agent cannot produce the truncated axis that exaggerates a small change." },
            { title: "Your usage so far", body: "Every render reports the count used this month against your plan limit, so an agent can back off before it hits the quota instead of after." },
          ]}
        />
        <Callout tone="warn" title="What the review does not do">
          <p>The review reads the chart specification, not the world. It can tell you a pie has nine slices or that two series are hard to tell apart; it cannot tell you whether the numbers are right, whether they were pulled from the correct table, or whether the title is a fair reading of them. When it finds nothing, it says so and still asks you to check the data.</p>
          <p>So the two halves of the promise are not equal. <strong>Structure is enforced</strong>: a chart the type cannot represent is refused, and the softer problems come back named. <strong>Correctness is not checked at all</strong>, by us or by anyone. A chart that passes every rule here can still be wrong about the business, and that part still needs a person.</p>
        </Callout>
      </div>
    </Section>

    <Section id="for-agents">
      <SectionHead
        eyebrow="Built for agents"
        title="One HTTP call, or one MCP tool."
        body="ChartRelay is an ordinary JSON API, so it works from any language or agent framework — and that is the route that works today. There is also an MCP server with a single tool, render_chart, returning the same URLs, alt text and findings plus an inline PNG preview, but it is unpublished and available to beta users on request rather than something you can install."
      >
        <p>
          <Link className="button button-ghost" href="/mcp">How to get the MCP server</Link>
          {" "}
          <Link className="button button-ghost" href="/docs">API reference</Link>
        </p>
      </SectionHead>
      <div className="lp-grid lp-grid-2">
        <div>
          <CodeCard
            label="MCP client config (after publication)"
            code={mcpSnippet}
            caption="Not runnable today: @chartrelay/mcp is not on npm and the repository is private, so npx has nothing to fetch and there is nothing to clone. The /mcp page explains how beta users get the server in the meantime."
          />
        </div>
        <div className="lp-card">
          <h3>What the tool returns to the model</h3>
          <p>
            The same render as the REST API: durable PNG and SVG URLs, the alt text, and the quality review with a suggested fix per finding. The tool description tells the model to revise and call again when the review reports a problem, so a bad first attempt is corrected inside the conversation rather than in front of a customer.
          </p>
        </div>
      </div>
    </Section>

    <Section tint id="pricing">
      <div>
        <SectionHead
          eyebrow="Pricing"
          title="Start free, then pay for the renders you use."
          body={`Every plan is prepaid: the free tier is ${n(planLimits.free)} renders a month, a plan buys more, and render packs for topping up are coming soon. Nothing is ever billed past what you bought — when a month's renders run out the API stops and says so.`}
        >
          <p><Link className="button button-ghost" href="/pricing">See the full pricing page</Link></p>
        </SectionHead>
        <FeatureGrid
          columns={3}
          items={[
            { title: "Free — $0", body: `${n(planLimits.free)} renders a month once you confirm your email; ${UNVERIFIED_FREE_LIMIT} before that. No card. SVG, PNG, alt text and QA are all included, the same as on the paid plans. Free charts drawn from a URL carry a small chartrelay.dev mark.` },
            { title: `Developer — $${PLANS.developer.priceUsd}/month`, body: `${n(planLimits.developer)} renders a month, for a side project or a product with its first real traffic. No mark on any chart.` },
            { title: `Pro — $${PLANS.pro.priceUsd}/month`, body: `${n(planLimits.pro)} renders a month, for a product or automation with real traffic. Billed monthly, cancel whenever.` },
            { title: `Business — $${PLANS.business.priceUsd}/month`, body: `${n(planLimits.business)} renders a month, for high-volume reporting and agent fleets.` },
            { title: "Render packs — coming soon", body: `One-time packs of extra renders, for a month that runs long, are not on sale yet. Until then, move up a plan.` },
          ]}
        />
      </div>
    </Section>

    <Section id="faq">
      <SectionHead eyebrow="Questions" title="Straight answers before you sign up." />
      <FaqList
        items={[
          {
            question: "What is ChartRelay not?",
            answer: "It is not a general visualization library and not a dashboard tool. There are five chart types and no maps, no custom layout language and no interactive charts. If you need dozens of chart types, AntV's mcp-server-chart is a free, open-source MCP server covering 25+ of them (as of September 2026), and Vega handles arbitrary specifications. ChartRelay is for the narrower case: an agent that has to produce a chart nobody will review.",
          },
          {
            question: "Does the QA check whether my data is correct?",
            answer: "No, and it never claims to. Every check reads the chart specification — the type, the number of series and points, the colours, the labels, the title. It can catch a pie with negative values or a legend nobody can track. It cannot know whether your numbers are right or whether the title is a fair summary of them. When it finds no structural problem, the finding it returns still asks you to verify the data and the intended takeaway.",
          },
          {
            question: "Which chart types and limits are there?",
            answer: "Bar, line, area, pie and scatter. At most 12 series, at most 100 points per series, a width between 320 and 2,400 pixels and a height between 240 and 1,600, in a light or dark theme. Anything outside those bounds is rejected with a validation error naming the field, rather than silently clipped.",
          },
          {
            question: "What happens when I hit the monthly limit?",
            answer: `The API returns HTTP 429 with a message saying which limit you reached, and stops there — nothing is charged automatically, so you are never billed for an overage you did not choose. The count resets at the start of the next calendar month, UTC, and does not roll over. To keep going before then, move up a plan (one-time render packs are coming soon). If you are on the free tier and have not confirmed your email, confirming it raises the limit from ${UNVERIFIED_FREE_LIMIT} to ${n(planLimits.free)} immediately.`,
          },
          {
            question: "Do I need an account to try it?",
            answer: "Not for the playground. It runs the same rendering engine through a rate-limited public endpoint, so you can edit the JSON and see the SVG, the alt text and the QA findings without signing up. You need a free account only when you want an API key of your own.",
          },
          {
            question: "Can I self-host it?",
            answer: "Not today. The hosted API is the only supported way to run ChartRelay: the source is not public, there is no self-hosting licence and no self-hosted plan. The MCP server is a partial exception — it takes a base URL (CHARTRELAY_API_URL) rather than a fixed host, so it can be aimed at any ChartRelay deployment you have access to — but it is unpublished and the repository is private, so it is shared with beta users on request rather than downloaded.",
          },
        ]}
      />
    </Section>

    <CtaBand
      eyebrow="Try it in a browser tab"
      title="Break a chart on purpose and see what comes back."
      body="Open the playground and try it: add a tenth pie slice, drop the title, pick an unreadable colour, put a negative number in a pie. Every finding comes back with its severity and the fix it wants — and the ones marked error are the ones the API refuses to store."
      actions={<>
        <Link className="button" href="/playground">Open the playground</Link>
        <Link className="button button-ghost" href="/register">Create a free API key</Link>
      </>}
      note={`The playground needs no signup. A free account gives ${n(planLimits.free)} renders a month once your email is confirmed, with no card.`}
    />
    <Footer />
  </main>;
}
