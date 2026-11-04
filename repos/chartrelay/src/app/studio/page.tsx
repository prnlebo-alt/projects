import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ChartStudio } from "@/components/chart-studio";
import { Footer } from "@/components/footer";
import { Callout, FaqList, FeatureGrid, LandingHero, Section, SectionHead, Steps } from "@/components/landing";
import { resolveQuickstartOrigin } from "@/components/quickstart-card";

export const metadata: Metadata = {
  title: "Paste a spreadsheet, get a chart",
  description: "Paste cells straight from Excel, Google Sheets or Notion and get a chart with a URL you can put in an email, a README or a Slack message. No account, no JSON, no signup.",
  alternates: { canonical: "/studio" },
};

const READS = [
  { icon: "01", title: "However you pasted it", body: "Tabs from Excel, commas from Google Sheets, semicolons from a European locale, pipes from a Markdown table. The separator is detected rather than asked for, and quoted fields containing it survive." },
  { icon: "02", title: "Numbers as people write them", body: "$1,234.56 · 45% · (1,234) for a negative · 1.2K · a Unicode minus sign · padded whitespace. A cell that cannot be read is named and refused, never silently treated as zero." },
  { icon: "03", title: "Header or no header", body: "Whether row one holds names or numbers is worked out from the cells themselves. Four-digit years across the top are read as a header rather than charted as data." },
  { icon: "04", title: "One column or twelve", body: "A label column plus any number of numeric columns. Each extra column becomes its own series, named from its header." },
];

const STEPS = [
  { title: "Paste", body: "Select the cells in your spreadsheet, copy, and paste them into the box. Nothing is uploaded — the reading happens in your browser." },
  { title: "Read what it decided", body: "It says which chart form it picked and why, in one sentence. Change the type, the title, the theme or the source line if you disagree." },
  { title: "Take the URL", body: "The chart is drawn by a URL, so the URL is the deliverable. Paste it into an email, a README, Notion, Slack or a spreadsheet cell." },
  { title: "Or take the code", body: "The same chart as an API call, ready for the moment you want this to happen on a schedule instead of by hand." },
];

const FAQ = [
  {
    question: "Is my data uploaded anywhere?",
    answer: "The table you paste is read in your browser and never sent to us as a table. The chart itself is drawn on our server, so the numbers and labels that end up in the picture travel in the chart URL — treat that URL as you would the chart. If the data should not leave your machine at all, run the API yourself against your own deployment.",
  },
  {
    question: "Do I need an account?",
    answer: "No. Charts drawn from a URL need no account and no key, and as the endpoint stands today they are not counted against any plan's monthly renders. Free ones carry a small chartrelay.dev mark; a key from a paid workspace — Developer, Pro or Business — passed on the URL removes it.",
  },
  {
    question: "Why did it pick that chart type?",
    answer: "It reads the shape of your data: labels that look like time with four or more rows become a line, values that add to about 100 in six rows or fewer become a pie, and everything else becomes a bar. It will never hand you a form its own quality review would refuse — a pie with negative values, for instance, is not offered.",
  },
  {
    question: "It refused my table. Why?",
    answer: "It refuses rather than guess when a cell is not a number, when rows have different lengths, when no numeric column exists, when there are fewer than two rows, or when there are more than 100 rows or 12 numeric columns. The message names the row and the cell so you can fix it and paste again.",
  },
  {
    question: "Can I change the chart after it is drawn?",
    answer: "Change the title, type, theme, style or source line here and the URL updates with it. Anything beyond that is a parameter on the URL itself, all of which are listed in the reference.",
  },
];

export default async function StudioPage() {
  // The page hands out a URL people paste elsewhere, so it has to name the origin this deployment
  // actually answers on rather than a build-time guess. Same helper the docs and the dashboard card
  // use, so no two surfaces can disagree about the address.
  const requestHeaders = await headers();
  const origin = resolveQuickstartOrigin({
    appUrl: process.env.APP_URL,
    forwardedHost: requestHeaders.get("x-forwarded-host"),
    host: requestHeaders.get("host"),
  });

  return (
    <>
      <main>
        <LandingHero
          eyebrow="Studio"
          title={<>Paste a spreadsheet. <span>Take away a URL.</span></>}
          subtitle="Copy cells out of Excel, Sheets or Notion and paste them below. You get a chart worth showing someone, and a link that works in an email, a README or a Slack message. No account, no JSON, nothing to install."
          note="Reading happens in your browser. Charts by URL need no key, and today they do not spend a plan's monthly renders."
        >
          <ChartStudio origin={origin} />
        </LandingHero>

        <Section id="reads" tint>
          <SectionHead
            eyebrow="What it understands"
            title="Paste it the way it came out of the spreadsheet."
            body="No reformatting, no cleaning, no template to fill in. The awkward things real exports contain are handled, and the ones that cannot be handled are named rather than guessed at."
          />
          <FeatureGrid items={READS} />
        </Section>

        <Section id="how">
          <SectionHead eyebrow="How it works" title="Four steps, and the last one is optional." />
          <Steps items={STEPS} />
        </Section>

        <Section id="honest" tint>
          <SectionHead eyebrow="Where the data goes" title="Worth being precise about." />
          <Callout tone="warn" title="The chart URL contains your numbers">
            <p>
              A chart drawn from a URL carries its own data in that URL — that is what makes it work without an upload, an account or an
              expiring link. Anyone who has the URL can see the labels and values in it. For a chart nobody else should see, post it to the
              JSON API instead, which returns a short link that reveals nothing, or run ChartRelay on your own infrastructure.
            </p>
          </Callout>
        </Section>

        <Section id="faq">
          <SectionHead eyebrow="Questions" title="The ones worth answering up front." />
          <FaqList items={FAQ} />
        </Section>

        <Section id="next" tint>
          <SectionHead
            eyebrow="When by hand stops being enough"
            title="The same chart, on a schedule."
            body="Everything this page does is one API call. A free key gets you stored charts with their alt text and quality findings, and a short permanent URL for each one."
          />
          <p className="section-actions">
            <Link className="button" href="/register">Get a free API key</Link>
            <Link className="button button-ghost" href="/docs">Read the reference</Link>
            <Link className="button button-ghost" href="/integrations">See where a chart URL fits</Link>
          </p>
        </Section>
      </main>
      <Footer />
    </>
  );
}
