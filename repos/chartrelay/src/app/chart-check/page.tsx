import type { Metadata } from "next";
import Link from "next/link";
import { ChartChecker } from "@/components/chart-checker";
import { Footer } from "@/components/footer";
import { Callout, CtaBand, FaqList, FeatureGrid, LandingHero, Section, SectionHead, Steps } from "@/components/landing";
import { planLimits, UNVERIFIED_FREE_LIMIT } from "@/lib/usage/plans";

export const metadata: Metadata = {
  title: "Free chart checker",
  description: "Run ChartRelay's structural chart review on any chart: SVG preview, alt text, and every QA finding with its suggested fix. No account, no API key.",
  alternates: { canonical: "/chart-check" },
};

const RULES = [
  { icon: "01", title: "missing-title", body: "Warning. The title is empty or still the placeholder “Untitled chart”. The fix it suggests: state the decision or metric the reader should understand." },
  { icon: "02", title: "pie-multiple-series", body: "Error. A pie chart was given more than one series, which it cannot compare clearly. It suggests a grouped bar chart, or keeping one series." },
  { icon: "03", title: "pie-too-many-slices", body: "Warning. A pie has more than seven slices. It suggests keeping the largest six categories and grouping the rest as Other." },
  { icon: "04", title: "pie-negative-value", body: "Error. A pie contains a negative value, which no slice can represent. It suggests a bar chart for signed values." },
  { icon: "05", title: "dense-chart", body: "Warning. A non-pie chart carries more than 40 points in total, which will be cramped at that size. It suggests aggregating, filtering, or widening the output." },
  { icon: "06", title: "too-many-series", body: "Warning. More than seven series ask the reader to track too many lines or bars at once. It suggests highlighting the important ones and muting the rest." },
  { icon: "07", title: "low-contrast", body: "Warning. A colour that is actually drawn falls below 3:1 against the chart background — or, on a pie, the white percentage label falls below 3:1 against its slice." },
  { icon: "08", title: "long-labels", body: "Tip. On a non-pie chart, a category label is longer than 12 characters, so the axis shortens it. It suggests shorter labels, or the full names in the subtitle. Pie slice labels are drawn in full, so this tip never fires on a pie." },
];

const STEPS = [
  { title: "Describe the chart", body: "Pick one of the five chart types, give it a title, and paste a category column plus one column per series. Or load an example that is built to fail." },
  { title: "Run the check", body: "The page posts your spec to ChartRelay's public demo endpoint. It renders with the same engine the paid API uses, so the SVG and the findings are the ones you would get in production." },
  { title: "Read the findings", body: "Every finding carries a severity, the rule that fired, what it saw, and a suggested fix. The alt text above them is the description a screen reader would announce." },
  { title: "Automate it", body: "Renders from the API return the same findings on every call, so an agent or a build step can refuse a chart that comes back with an error instead of publishing it." },
];

const FAQ = [
  {
    question: "Do I need an account?",
    answer: "No. This page calls ChartRelay's public demo endpoint, which takes no API key. It is rate limited to 30 requests a minute per IP address; if you hit that, wait a minute or create a free account and call the API directly.",
  },
  {
    question: "What can it check?",
    answer: "Bar, line, area, pie and scatter charts, with up to 12 series and up to 100 points per series. This page renders at the default 900 × 520; the API accepts any size from 320 × 240 up to 2400 × 1600.",
  },
  {
    question: "Will it tell me whether my numbers are right?",
    answer: "No, and nothing here should be read that way. The review only sees the chart specification you submit: its type, title, series and values. It cannot check your figures against a source, spot a bad join, or notice that a total is stale. Structure is all it judges.",
  },
  {
    question: "Do I get a permanent link to the chart?",
    answer: "Not from this page. The demo endpoint renders your chart and returns the SVG in its response without storing the chart. Durable PNG and SVG URLs come from the authenticated API: POST /api/v1/charts stores the render and returns immutable /api/v1/charts/{id}?format=svg and ?format=png links that anyone can load.",
  },
  {
    question: "Can an agent run the same review?",
    answer: "Yes. Every render from the API returns the same findings and the same alt text in its JSON response. The MCP server with its single render_chart tool ships in the repository's mcp/ directory; it is not published to npm yet, so today you run it from the repo.",
  },
];

export default function ChartCheckPage() {
  return (
    <main>
      <LandingHero
        eyebrow="Free chart checker"
        title={<>Find the problem in your chart <span>before your reader does</span></>}
        subtitle="Paste a chart, get the rendered SVG, its alt text, and every structural QA finding with the fix ChartRelay suggests. The same review runs on every chart the API renders."
        actions={
          <>
            <Link className="button" href="#checker">Check a chart</Link>
            <Link className="button button-ghost" href="/docs">Read the API docs</Link>
          </>
        }
        note="No sign-up and no API key. The public demo endpoint allows 30 checks a minute per IP address."
      />

      <Section id="checker">
        <SectionHead
          eyebrow="Try it"
          title="One chart in, one review out."
          body="Describe the chart on the left and the review appears on the right: the rendered SVG, the alt text that ships with it, and each finding with its severity and suggested fix."
        />
        <ChartChecker />
      </Section>

      <Section id="rules" tint>
        <div>
          <SectionHead
            eyebrow="The rules"
            title="Exactly what the review looks for."
            body="Eight rules, no scoring and no black box. When none of them fire, you get a single healthy result instead: no structural chart problems detected."
          />
          <FeatureGrid items={RULES} columns={2} />
          <Callout tone="warn" title="It checks structure, not truth">
            <p>
              The review reads the chart specification you submit and nothing else. It can tell you that nine pie slices will be hard to scan, or that a
              series is too pale to see. It cannot tell you whether the numbers are correct, current, or measuring what you think they measure.
            </p>
            <p>A chart that comes back healthy is a chart that is built sensibly. Checking the data behind it is still your job.</p>
          </Callout>
        </div>
      </Section>

      <Section id="how">
        <SectionHead eyebrow="How it works" title="From a one-off check to every chart you ship." />
        <Steps items={STEPS} />
      </Section>

      <Section id="faq">
        <SectionHead eyebrow="Questions" title="Before you paste anything." />
        <FaqList items={FAQ} />
      </Section>

      <CtaBand
        eyebrow="Ship it"
        title="Run this review on every chart, not just this one."
        body="The API returns the SVG, durable PNG and SVG URLs, the alt text and these findings on every render — so a failing chart never reaches a reader."
        actions={
          <>
            <Link className="button" href="/register">Create a free account</Link>
            <Link className="button button-ghost" href="/mcp">Use it from an agent</Link>
          </>
        }
        note={`Free plan: ${planLimits.free.toLocaleString("en-US")} renders a month once you confirm your email address, ${UNVERIFIED_FREE_LIMIT} before that. One-time render packs are coming soon.`}
      />

      <Footer />
    </main>
  );
}
