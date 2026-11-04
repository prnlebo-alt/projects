import type { Metadata } from "next";
import Link from "next/link";
import { ChartPreview } from "@/components/chart-preview";
import { Footer } from "@/components/footer";
import { Callout, CodeCard, CtaBand, FaqList, FeatureGrid, LandingHero, Section, SectionHead, Steps } from "@/components/landing";
import { resolveQuickstartOrigin } from "@/components/quickstart-card";
import { renderStyled } from "@/lib/charts/style";
import { parseChartQuery } from "@/lib/charts/url";
import { watermark } from "@/lib/charts/watermark";

export const metadata: Metadata = {
  title: "Put a chart in an email, a README, Slack or a spreadsheet",
  description: "Copy-paste recipes for GET /chart: HTML email, Markdown, Notion, Slack, Google Sheets, and the generic webhook step in Zapier or Make. No account and no code.",
  alternates: { canonical: "/integrations" },
};

/**
 * Every recipe here is a URL a reader pastes somewhere else, so the origin is read per request from
 * APP_URL rather than baked in at build time, the same way /mcp reads it: a variable-only redeploy onto
 * a new domain does not rebuild the app, and a prerendered copy would keep handing out the old address.
 */
export const dynamic = "force-dynamic";

/** The origin these recipes point at, resolved by the helper /docs and the dashboard card already share. */
const apiOrigin = () => resolveQuickstartOrigin({ appUrl: process.env.APP_URL });

/** The query every recipe below pastes somewhere. One string, so no two recipes can drift apart. */
const MRR_QUERY = "data=18400,21300,24700,26900,31200,33900&labels=Apr,May,Jun,Jul,Aug,Sep&names=MRR&title=Monthly+recurring+revenue&subtitle=Revenue+grew+84%25+over+six+months&prefix=$&source=Source:+finance+ledger";

/**
 * The hero image and the alt text below are produced by running MRR_QUERY through the same parser and
 * renderer GET /chart runs, rather than by drawing something similar beside it. A page of copy-paste
 * URLs that shows a picture the URLs do not produce is the one failure this page cannot afford, and a
 * throw here is a build that stops rather than a recipe that quietly stops matching its illustration.
 */
function demoRender() {
  const parsed = parseChartQuery(new URLSearchParams(MRR_QUERY));
  if (!parsed.ok) throw new Error(`The example chart URL on /integrations is not one GET /chart accepts: ${parsed.error}`);
  return renderStyled(parsed.value.spec, parsed.value.style, parsed.value.chrome);
}

const demoChart = demoRender();

/** Marked, because a reader arrives without a key and this is what an unkeyed request returns. */
const demo = watermark(demoChart.svg);

/** The alt text as it arrives in x-chartrelay-alt: one line, because a header cannot hold a line break. */
const DEMO_ALT = demoChart.altText.replace(/[\r\n]+/g, " ");

const emailRecipe = (origin: string) => `<!-- The editorial canvas is a fixed 860x480, so these numbers match it exactly. -->
<img
  src="${origin}/chart?${MRR_QUERY}"
  alt="${DEMO_ALT}"
  width="860"
  height="480"
  style="max-width:100%;height:auto;display:block;border:0"
>`;

const altRecipe = (origin: string) => `# HEAD is answered without drawing anything, so it carries no alt text.
# Send a GET, keep the headers, throw the image away.
curl -sS -D - -o /dev/null "${origin}/chart?${MRR_QUERY}" | grep -i '^x-chartrelay'

x-chartrelay-alt: ${DEMO_ALT}
x-chartrelay-style: editorial`;

const markdownRecipe = (origin: string) => `![${DEMO_ALT}](${origin}/chart?${MRR_QUERY})

<!-- Two series, as SVG, for a README that renders inline SVG: -->
![North and South pipeline, four quarters](${origin}/chart?type=line&data=12,18,22,31%7C9,11,14,16&names=North,South&labels=Q1,Q2,Q3,Q4&title=Pipeline+by+region&format=svg)`;

const slackRecipe = (origin: string) => `{
  "blocks": [{
    "type": "image",
    "image_url": "${origin}/chart?${MRR_QUERY}",
    "alt_text": "${DEMO_ALT}"
  }]
}`;

const sheetsRecipe = (origin: string) => `=IMAGE("${origin}/chart?${MRR_QUERY}")

Built from cells instead of typed out — row 1 holds the labels, row 2 the numbers:

=IMAGE("${origin}/chart?title=" & ENCODEURL(A2)
  & "&labels=" & ENCODEURL(TEXTJOIN(",", TRUE, B1:G1))
  & "&data=" & TEXTJOIN(",", TRUE, B2:G2))`;

const automationRecipe = (origin: string) => `${origin}/chart?title={{title}}&labels={{labels}}&data={{values}}&prefix=$

Percent-encode anything that can contain a space or punctuation before you
concatenate it. A space may also be written as +, which is what the examples
on this page use.`;

export default function IntegrationsPage() {
  const origin = apiOrigin();
  return (
    <main>
      <LandingHero
        eyebrow="Integrations"
        title={<>Put a chart where <span>JavaScript cannot run</span></>}
        subtitle="One URL returns the image itself. If a tool accepts an image URL — an HTML email, a README, a Notion page, a Slack message, a spreadsheet cell, an automation step — it already accepts a ChartRelay chart. There is nothing to install and nothing to sign up for."
        actions={<>
          <Link className="button" href="/docs#url">Read the URL reference</Link>
          <Link className="button button-ghost" href="/playground">Open the playground</Link>
        </>}
        note="No account and no key. As this endpoint stands today a render through it is not counted against a plan's monthly renders; the only ceiling on it is a per-address rate limit. Free charts carry a small chartrelay.dev mark; a key from a paid workspace removes it."
      >
        <ChartPreview svg={demo} />
      </LandingHero>

      <Section id="anatomy">
        <SectionHead
          eyebrow="The whole idea"
          title="The URL is the chart"
          body="There is no upload, no id to keep and no second request. The numbers, the labels and the title all travel in the querystring, and the answer is a PNG. Change a number in the URL and you have a different chart."
        />
        <CodeCard
          label="The chart in the hero, as a URL"
          code={`${origin}/chart?${MRR_QUERY}`}
          caption={<>Every parameter here is documented with its default and its limits in the <Link href="/docs#url-parameters">URL reference</Link>. <code>format=svg</code> returns SVG instead of PNG; <code>style=classic</code> asks for the older drawing.</>}
        />
        <FeatureGrid
          columns={3}
          items={[
            { icon: "ALT", title: "The description comes back in a header", body: <>Every successful render carries <code>x-chartrelay-alt</code>: a sentence built from the data. Read it once, paste it into the <code>alt</code> attribute, and the chart is still readable when the image is not.</> },
            { icon: "ERR", title: "A mistake arrives as a picture", body: "A mistyped parameter comes back as a small card saying what was wrong, with a 4xx status. An <img> tag cannot show a JSON body, so the reason is drawn instead of hidden behind a broken-image icon." },
            { icon: "CDN", title: "Fetched once, then cached", body: "A successful chart is served immutable with a one-year age. Mail clients and chat apps fetch through image proxies that would otherwise re-render the same chart for every recipient." },
            { icon: "8KB", title: "8 KB of querystring", body: <>Past that the request is refused, because long URLs are truncated at different undocumented lengths by browsers, proxies and mail clients. For a bigger chart, <Link href="/docs#quickstart">post it to the JSON API</Link> and paste the short URL it returns.</> },
            { icon: "240", title: "240 requests a minute per address", body: "An abuse ceiling rather than a quota — it is not your monthly allowance, and a URL render is not counted against that allowance today. Anything drawn twice should be coming from a cache. Over the ceiling you get a 429 with a retry-after." },
            { icon: "QA", title: "Nothing is reviewed here", body: <>This endpoint draws what you ask for. The structural review that can refuse a chart lives on the JSON API and in the free <Link href="/chart-check">chart checker</Link>.</> },
          ]}
        />
      </Section>

      <Section id="email" tint>
        <div>
          <SectionHead
            eyebrow="Recipe 01"
            title="HTML email"
            body="The case the endpoint exists for. No mail client runs your JavaScript, and most will not render an SVG either, so a PNG behind an <img> tag is the only thing that works everywhere."
          />
          <CodeCard
            label="HTML email · the image tag"
            code={emailRecipe(origin)}
            caption={<>PNG is the default, so there is nothing to ask for. The fixed <code>860x480</code> is the editorial canvas; in the <code>classic</code> style the size is whatever <code>w</code> and <code>h</code> you sent, and defaults to <code>900x520</code>. If your templating layer is strict about markup, write each <code>&amp;</code> between parameters as <code>&amp;amp;</code> — it is the same URL once the client has parsed the attribute.</>}
          />
          <Callout tone="warn" title="Fill in the alt attribute, and mean it">
            <p>Mail clients commonly block remote images until the reader allows them, and some readers never do. We have not measured how often that happens and will not invent a figure — but a blocked image is not a rare event, and when it happens the <code>alt</code> attribute is the whole message.</p>
            <p>ChartRelay writes that sentence for you and returns it in <code>x-chartrelay-alt</code>. It is worth fetching once when you build the template rather than shipping <code>alt=&quot;chart&quot;</code>.</p>
          </Callout>
          <CodeCard
            label="Terminal · read the alt text back"
            code={altRecipe(origin)}
            caption={<>The alt text is identical whichever renderer drew the chart, so switching <code>style</code> never changes what you tell a screen reader. <code>x-chartrelay-note</code> joins these headers when the drawing is not the one you asked for.</>}
          />
        </div>
      </Section>

      <Section id="markdown">
        <SectionHead
          eyebrow="Recipe 02"
          title="Markdown and READMEs"
          body="Ordinary image syntax. The alt text goes in the square brackets, which is the part most generated READMEs leave empty."
        />
        <CodeCard
          label="Markdown"
          code={markdownRecipe(origin)}
          caption={<>Write a space as <code>+</code> and a series separator as <code>%7C</code>: a bare <code>|</code> is not a legal URL character and some Markdown renderers will cut the link at it. Both decode to the same thing before the chart is read.</>}
        />
        <Callout title="Which format for a README">
          <p>PNG is the safe answer and needs no parameter. <code>format=svg</code> is sharper and smaller, and works where inline SVG is allowed — but several README renderers strip or refuse SVG images, so reach for it only when you know the one you are publishing to.</p>
        </Callout>
      </Section>

      <Section id="notion" tint>
        <div>
          <SectionHead
            eyebrow="Recipe 03"
            title="Notion"
            body="Notion has no ChartRelay integration, and does not need one: an image block that points at a URL is enough."
          />
          <Steps
            items={[
              { title: "Build the URL", body: <>Start from the example above, or open the <Link href="/playground">playground</Link>, get the chart right, and copy the query out of it.</> },
              { title: "Add an image block", body: "Type /image on a new line, choose the option that takes a link rather than an upload, and paste the URL." },
              { title: "Leave the format alone", body: <>PNG is the default and is the safe choice inside a document you will export to PDF later.</> },
              { title: "Caption it with the alt text", body: <>Notion&apos;s caption is visible to everyone, not only to screen readers, so the sentence from <code>x-chartrelay-alt</code> earns its place there.</> },
            ]}
          />
          <Callout tone="warn" title="The numbers are frozen at the moment you paste">
            <p>A chart URL always draws exactly the data written into it, so a page that should track changing numbers needs the URL rebuilt when the numbers change — by hand, or by whatever already writes the page. Nothing here polls a data source.</p>
          </Callout>
        </div>
      </Section>

      <Section id="slack">
        <SectionHead
          eyebrow="Recipe 04"
          title="Slack"
          body="Two ways in, depending on whether a person or a program is posting."
        />
        <FeatureGrid
          columns={2}
          items={[
            { icon: "YOU", title: "Pasting it yourself", body: "Put the URL on a line of its own in the message. Slack fetches image URLs and shows the picture under the message." },
            { icon: "BOT", title: "Posting from a program", body: <>Use a Block Kit <code>image</code> block, below. It takes an <code>alt_text</code> field — fill it from <code>x-chartrelay-alt</code> rather than repeating the title.</> },
          ]}
        />
        <CodeCard
          label="Slack · Block Kit payload"
          code={slackRecipe(origin)}
          caption="Keep the default PNG here. Slack fetches the image through its own proxy, which is exactly the case the one-year immutable cache header is for."
        />
      </Section>

      <Section id="sheets" tint>
        <div>
          <SectionHead
            eyebrow="Recipe 05"
            title="Google Sheets"
            body="IMAGE() takes a URL and draws the result in the cell, which turns a row of numbers into a chart without leaving the sheet."
          />
          <CodeCard
            label="Google Sheets · IMAGE()"
            code={sheetsRecipe(origin)}
            caption={<>Leave <code>format</code> at its default: <code>IMAGE()</code> wants a raster image, not SVG. <code>ENCODEURL()</code> matters on anything a person typed — a stray <code>&amp;</code> or <code>#</code> in a title otherwise ends the parameter early.</>}
          />
          <Callout title="A comma is the separator, not a thousands mark">
            <p>Send raw numbers. <code>1,234</code> is two data points, not one — the comma separates one value from the next, and the split happens before any number is read. Strip formatting in the sheet, or point <code>TEXTJOIN</code> at the unformatted values.</p>
            <p>Decimals, negatives and the Unicode minus a spreadsheet pastes are all understood. A cell that is not a number at all is refused by position — <code>&quot;TBD&quot; at position 2 is not a number</code> — rather than drawn as a zero.</p>
          </Callout>
        </div>
      </Section>

      <Section id="automation">
        <SectionHead
          eyebrow="Recipe 06"
          title="Zapier, Make, and anything else with an HTTP step"
          body="These recipes are string concatenation, not an integration. That is the honest description, and it is also why they work in any tool that can build a URL."
        />
        <Callout tone="warn" title="There is no ChartRelay app on Zapier or Make">
          <p>Neither has been published, so there is no ChartRelay connector to search for in either catalogue. What follows uses the generic step every automation tool ships with: <strong>Webhooks by Zapier</strong>, or Make&apos;s <strong>HTTP</strong> module. If you find something claiming to be a ChartRelay app in either catalogue, it is not ours.</p>
        </Callout>
        <Steps
          items={[
            { title: "Build the URL as text", body: <>Concatenate the origin, <code>/chart?</code>, and your parameters, interpolating fields from earlier steps. Most tools do this inline in the next step&apos;s input; a formatter step is only needed when you want to reuse the string.</> },
            { title: "Often you need no HTTP step at all", body: "If the destination takes an image URL — a Slack message, an email body, a Notion block — paste the built URL straight into that field and stop. The HTTP step is only for when you need the image file itself." },
            { title: "When you do need the file, GET it", body: <>Point <strong>Webhooks by Zapier</strong> at the URL with a GET, or use Make&apos;s <strong>HTTP &rsaquo; Make a request</strong> module, and hand the response on as a file attachment.</> },
            { title: "Check the response is an image, not a refusal", body: <>A 4xx still returns a picture, so a step that only checks &quot;did I get an image?&quot; will pass a chart that failed. Check the status code, or read <code>x-chartrelay-error</code>, which carries the same sentence the picture shows.</> },
          ]}
        />
        <CodeCard
          label="The URL to build, with fields from an earlier step"
          code={automationRecipe(origin)}
          caption={<>The placeholder syntax belongs to your tool, not to ChartRelay. Everything after <code>?</code> is documented in the <Link href="/docs#url-parameters">URL reference</Link>.</>}
        />
      </Section>

      <Section id="watch" tint>
        <div>
          <SectionHead
            eyebrow="Before you ship it"
            title="Four things worth knowing first"
            body="None of these is a surprise if you read them now. All of them are a surprise in someone else's inbox."
          />
          <FeatureGrid
            columns={2}
            items={[
              { icon: "KEY", title: "A key in a URL is a key you have published", body: <>Anything that can see the URL can see the <code>key</code> parameter: mail relays, image proxies, CDN and server logs, anyone who forwards the message. Use it where the URL stays inside systems you control, and treat a key that has been in a public URL as disclosed.</> },
              { icon: "PUB", title: "A chart URL is public", body: "There is no authentication on this endpoint, so anyone holding the URL can draw the chart. Do not put numbers in one that you would not put on a public page." },
              { icon: "FIT", title: "Pie, area and scatter fall back", body: <>The editorial renderer draws bar and line today. Ask it for a pie, an area or a scatter and you get the classic drawing instead, with <code>x-chartrelay-note</code> saying so. A multi-series bar is drawn as lines, and says so the same way.</> },
              { icon: "MARK", title: "The mark is the price", body: <>Free charts carry a small <code>chartrelay.dev</code> mark in the top-right corner. A key from a <Link href="/pricing">Developer, Pro or Business</Link> workspace removes it; a key that is missing, unrecognised or on a free workspace is not an error, the chart simply keeps the mark.</> },
            ]}
          />
        </div>
      </Section>

      <Section id="faq">
        <SectionHead eyebrow="Questions" title="Fair questions about pasting a URL into things" />
        <FaqList
          items={[
            { question: "Do I need an account?", answer: <p>No. <code>GET /chart</code> is unauthenticated, and a render through it is not counted against a plan&apos;s monthly renders today. An account is worth having if you want the <code>chartrelay.dev</code> mark gone, or you want the <Link href="/docs">JSON API</Link> — which is what the monthly figures on the <Link href="/pricing">pricing page</Link> measure.</p> },
            { question: "Is this endpoint metered?", answer: "Not as it stands today: a render drawn from a URL is not counted against your plan's monthly renders. The limits that do apply here are 240 requests a minute per IP address and 8 KB of querystring. We used to advertise this as unlimited renders on every tier, and we have stopped — what a plan sells is the monthly renders listed on the pricing page, and we would rather describe how the endpoint behaves now than promise it will never be metered." },
            { question: "Why did my chart come back as a grey card with a sentence on it?", answer: <p>That is the error. An <code>&lt;img&gt;</code> tag cannot show a JSON body, so a refusal is drawn as the image and names the parameter that was wrong. The status is 4xx and <code>x-chartrelay-error</code> carries the same sentence.</p> },
            { question: "Can I make the chart bigger?", answer: <p>In the classic style, yes: <code>w</code> and <code>h</code> take 320–2400 and 240–1600. The editorial style draws on a fixed 860x480 canvas that its type sizes and spacing are tuned to, and accepts <code>w</code> and <code>h</code> without using them. Scale the image in the page instead, or send <code>style=classic</code>.</p> },
            { question: "Which chart types can I ask for?", answer: <p>Bar, line, area, pie and scatter — the same five the JSON API takes. Bar and line are drawn in the editorial style; the other three fall back to the classic renderer and say so in <code>x-chartrelay-note</code>.</p> },
            { question: "My URL got too long.", answer: <p>Past 8 KB of querystring the request is refused rather than half-drawn, because long URLs are truncated at different undocumented lengths by browsers, proxies and mail clients. Post the chart to <code>/api/v1/charts</code> instead and use the short asset URL it hands back — that is what the refusal tells you to do.</p> },
            { question: "Is the chart checked before it is drawn?", answer: <p>Not here. This endpoint draws what you ask for; the structural review that refuses a chart outright belongs to the JSON API. Paste a chart into the free <Link href="/chart-check">chart checker</Link> first if you want the findings.</p> },
            { question: "Will the URL keep working?", answer: "The URL is the chart — the same query can only ever produce the same image, which is why it is served with a one-year immutable cache header. Nothing is stored on our side for it to expire." },
          ]}
        />
      </Section>

      <CtaBand
        eyebrow="Try it now"
        title="Paste a URL into the thing you were going to screenshot"
        body="No signup, nothing to install. Change a number in the query and fetch it again."
        actions={<>
          <Link className="button" href="/docs#url">Read the URL reference</Link>
          <Link className="button button-ghost" href="/playground">Open the playground</Link>
        </>}
        note="Free charts carry a small chartrelay.dev mark, and removing it is one of the things a paid plan buys. The other is the month's prepaid renders — which, today, a chart drawn from a URL does not spend."
      />
      <Footer />
    </main>
  );
}
