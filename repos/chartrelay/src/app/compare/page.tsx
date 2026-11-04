import type { Metadata } from "next";
import Link from "next/link";
import { ChartPreview } from "@/components/chart-preview";
import { Footer } from "@/components/footer";
import { Callout, CodeCard, ComparisonTable, CtaBand, FaqList, FeatureGrid, LandingHero, Section, SectionHead, Steps } from "@/components/landing";
import { renderChart } from "@/lib/charts/render";
import { sampleSpec } from "@/lib/charts/schema";
import { planLimits, PLANS, UNVERIFIED_FREE_LIMIT } from "@/lib/usage/plans";

export const metadata: Metadata = {
  title: "Compare: ChartRelay, QuickChart, AntV and model-written code",
  description: "An honest comparison of four ways to render charts in an automated pipeline, including when not to choose ChartRelay.",
  alternates: { canonical: "/compare" },
};

const CHECKED = "as of September 2026";

const n = (value: number) => value.toLocaleString("en-US");

const unverified = "Not graded here — read their docs.";

const request = `curl -X POST "$CHARTRELAY_URL/api/v1/charts" \\
  -H "Authorization: Bearer $CHARTRELAY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "bar",
    "title": "Weekly signups",
    "series": [{
      "name": "Signups",
      "data": [
        { "label": "Mon", "value": 18 },
        { "label": "Tue", "value": 24 }
      ]
    }]
  }'`;

const approaches = [
  {
    icon: "01",
    title: "ChartRelay",
    body: "A hosted API. Your agent posts one small JSON object and gets back SVG, durable PNG and SVG URLs, alt text and structural QA findings in the same response. Five chart types, and nothing to run yourself.",
  },
  {
    icon: "02",
    title: "QuickChart",
    body: `A hosted chart image service. Its published pricing (${CHECKED}) is a free tier of 10,000 images a month and a Professional plan at $40 a month for unlimited images. We have not graded its features on this page — read their docs.`,
  },
  {
    icon: "03",
    title: "AntV mcp-server-chart",
    body: `A free, open-source MCP server covering 25+ chart types that you run yourself (${CHECKED}). If breadth of chart types or keeping rendering inside your own infrastructure matters most, start here.`,
  },
  {
    icon: "04",
    title: "The model writes plotting code",
    body: "Ask the model for matplotlib or Chart.js code and execute it. Maximum flexibility, and you own the sandbox, the dependencies, the failure modes and whatever the generated code decides to do differently on the next run.",
  },
];

const columns = ["ChartRelay", "QuickChart", "AntV mcp-server-chart", "Model writes the code"];

const rows = [
  {
    label: "What the model has to produce",
    cells: [
      "One JSON object: type, title and series with labelled points. Rejected specs come back with the exact field path that failed.",
      unverified,
      unverified,
      "Runnable code. Nothing validates it until it executes.",
    ],
  },
  {
    label: "Chart types",
    cells: ["Five: bar, line, area, pie, scatter.", unverified, `25+ (${CHECKED}).`, "Whatever the library supports."],
  },
  {
    label: "Alt text with every render",
    cells: [
      "Yes. Every response includes alt text, and the SVG carries it in a <title> and <desc>.",
      unverified,
      unverified,
      "Only if the generated code writes it.",
    ],
  },
  {
    label: "Structural QA on every render",
    cells: [
      "Yes: missing title, pie misuse, overcrowded charts, too many series, weak colour contrast and truncated labels, each with a suggested fix.",
      unverified,
      unverified,
      "No, unless you build the checks.",
    ],
  },
  {
    label: "Value axis always includes zero",
    cells: [
      "Always, on bar, line, area and scatter. It is not configurable.",
      unverified,
      unverified,
      "Up to the code the model wrote that time.",
    ],
  },
  {
    label: "Same input, same image",
    cells: [
      "Yes. Rendering is a pure function of the spec, covered by a test that renders twice and compares.",
      unverified,
      unverified,
      "Not by default. Generated code varies between runs.",
    ],
  },
  {
    label: "Durable image URLs",
    cells: [
      "Yes. A public, immutable URL per render, in SVG or PNG.",
      unverified,
      unverified,
      "You store and serve the file yourself.",
    ],
  },
  {
    label: `Published price (${CHECKED})`,
    cells: [
      `Free: ${n(planLimits.free)} renders a month (${UNVERIFIED_FREE_LIMIT} until the owner confirms their email). Developer $${PLANS.developer.priceUsd} for ${n(planLimits.developer)}, Pro $${PLANS.pro.priceUsd} for ${n(planLimits.pro)}, Business $${PLANS.business.priceUsd} for ${n(planLimits.business)}. One-time render packs are coming soon. Everything is prepaid: no overage billing.`,
      "Free: 10,000 images a month. Professional: $40 a month, unlimited.",
      "Free and open source; you pay for what you run it on.",
      "No licence cost; you pay for tokens and for the sandbox that runs the code.",
    ],
  },
  {
    label: "Who operates it",
    cells: ["We do.", "They do.", "You do.", "You do."],
  },
];

const notForYou = [
  {
    icon: "01",
    title: "You need many chart types, or maps",
    body: "ChartRelay draws five chart types and no maps. If you need breadth — geographic, statistical or network charts — use AntV's mcp-server-chart, which is free, open source and covers 25+ types, or have the model write code against a full plotting library.",
  },
  {
    icon: "02",
    title: "You want the cheapest bulk rendering",
    body: `On published pricing in September 2026, QuickChart offers 10,000 images a month free and $40 a month for unlimited images; our Pro plan is $${PLANS.pro.priceUsd} for ${n(planLimits.pro)} renders and Business is $${PLANS.business.priceUsd} for ${n(planLimits.business)}. If images per dollar is the deciding number, use QuickChart.`,
  },
  {
    icon: "03",
    title: "You need to self-host",
    body: "ChartRelay is a hosted API. There is no self-host build or licence today, so if the data cannot leave your network, run AntV's mcp-server-chart inside it, or render with your own code in your own sandbox.",
  },
];

const steps = [
  {
    title: "Render the same spec twice",
    body: "Use the playground, or the request below, and compare the two SVGs byte for byte. Determinism is the claim that is cheapest to disprove, so test it first.",
  },
  {
    title: "Send a chart you know is bad",
    body: "An eleven-slice pie, or eight series on one axis. Read the QA findings that come back and decide whether an agent could act on them without a human.",
  },
  {
    title: "Check the price against your real volume",
    body: "Count the charts your pipeline will actually make in a month, then compare that number with each vendor's current published pricing rather than with the table above.",
  },
];

const faqs = [
  {
    question: "Is this comparison fair?",
    answer: "It is as fair as we can make it while only claiming things we can support. Every ChartRelay row is checked against the code that runs the API. For QuickChart and AntV we cite their public pages, checked on 22 September 2026, and leave the rest of the grid ungraded rather than guessing on a competitor's behalf. Prices and features change: check their current pages yourself before you decide.",
  },
  {
    question: "Does the QA check tell me whether my numbers are right?",
    answer: "No. It reads the structure of the chart you asked for — how many slices, how many series, contrast, labels, a missing title — and nothing about the truth of the data. A chart of completely wrong numbers can come back healthy.",
  },
  {
    question: "Can I use the MCP server today?",
    answer: "It ships with the repository as the package @chartrelay/mcp with one tool, render_chart. It is not published to npm yet, so today you run it from a checkout and point your MCP client at the local file; npm publication is planned.",
  },
  {
    question: "What are the hard limits on a chart?",
    answer: "Up to 12 series, up to 100 points per series, and an image between 320 and 2400 pixels wide and 240 to 1600 pixels tall. Anything outside that is rejected with the field path that failed, so an agent can correct it and retry.",
  },
  {
    question: "What happens when I run out of renders?",
    answer: `The API answers HTTP 429 with a message naming the monthly limit, and stops there — nothing is billed past what you prepaid. Free workspaces get ${n(planLimits.free)} renders a month, or ${UNVERIFIED_FREE_LIMIT} until the owner confirms their email address. One-time render packs are coming soon.`,
  },
];

export default function ComparePage() {
  const demo = renderChart(sampleSpec);
  return (
    <main>
      <LandingHero
        eyebrow="Compare"
        title={<>Four ways to put a chart <span>in an automated pipeline.</span></>}
        subtitle="ChartRelay, QuickChart, AntV's open-source MCP server, or letting the model write plotting code. Here is what each one is good at, including the cases where you should not pick us."
        actions={<>
          <Link className="button" href="/playground">Try the playground</Link>
          <Link className="button button-ghost" href="/docs">Read the API docs</Link>
        </>}
        note="Competitor details come from public pages checked on 22 September 2026. Pricing changes — confirm the current numbers on each vendor’s own site before deciding."
      >
        <ChartPreview svg={demo.svg} />
      </LandingHero>

      <Section id="approaches">
        <SectionHead
          eyebrow="The options"
          title="What you are actually choosing between"
          body="All four end with an image in a report, an email or a Slack message. They differ in what the model has to get right, who operates the renderer, and what arrives with the image."
        />
        <FeatureGrid items={approaches} columns={2} />
      </Section>

      <Section id="table" tint>
        <div>
          <SectionHead
            eyebrow="Side by side"
            title="The comparison, with the gaps left visible"
            body="Every ChartRelay cell is checked against the code that runs the API. Where we have not verified another tool's behaviour, the cell says so instead of guessing."
          />
          <ComparisonTable
            caption="ChartRelay rows verified against the code that runs the API. Competitor pricing from published pricing pages, checked 22 September 2026."
            rowHeader="Capability"
            columns={columns}
            rows={rows}
            footnote={<>
              Sources: quickchart.io/pricing (free tier 10,000 images a month; Professional $40 a month, unlimited) and the AntV mcp-server-chart project, a free open-source MCP server with 25+ chart types, both checked 22 September 2026. “Not graded here” means we did not test that behaviour, not that the tool lacks it. Check the current pricing and docs yourself before you commit.
            </>}
          />
          <Callout tone="warn" title="What the QA pass does not do">
            QA inspects the structure of the chart: the number of slices and series, colour contrast, label length, a missing title. It cannot tell you whether the data behind the chart is correct, current, or measuring the right thing. That judgement stays with a person.
          </Callout>
        </div>
      </Section>

      <Section id="not-for-you">
        <SectionHead
          eyebrow="Honest limits"
          title="When not to choose ChartRelay"
          body="Three cases where another tool on this page is the better answer. If one of them describes you, take the recommendation — a bad fit costs you more than a lost signup costs us."
        />
        <FeatureGrid items={notForYou} columns={3} />
      </Section>

      <Section id="fit" tint>
        <div>
          <SectionHead
            eyebrow="Where we do fit"
            title="Charts that go out without a human looking first"
            body="ChartRelay is built for the pipeline where nobody reviews the image before a customer sees it: one strict schema the model can fill, the same picture for the same input, alt text in the response, and structural findings the agent can act on before publishing."
          />
          <CodeCard
            label="POST /api/v1/charts"
            code={request}
            caption={<>The response carries the SVG, durable PNG and SVG URLs, alt text and QA findings. The full schema and error format are on the <Link href="/docs">API docs</Link> page.</>}
          />
        </div>
      </Section>

      <Section id="evaluate">
        <SectionHead eyebrow="Check it yourself" title="Three tests worth running before you believe any of this" />
        <Steps items={steps} />
      </Section>

      <Section id="faq">
        <SectionHead eyebrow="Questions" title="Fair questions about this page" />
        <FaqList items={faqs} />
      </Section>

      <CtaBand
        eyebrow="Try it, do not take our word"
        title="Render a chart and judge the output"
        body="The playground needs no account. If ChartRelay is the wrong tool for your pipeline, this page told you which page to read next."
        actions={<>
          <Link className="button" href="/playground">Open the playground</Link>
          <Link className="button button-ghost" href="/pricing">See pricing</Link>
        </>}
        note={`Free plan: ${n(planLimits.free)} renders a month once you confirm your email, ${UNVERIFIED_FREE_LIMIT} before that. No card required.`}
      />
      <Footer />
    </main>
  );
}
