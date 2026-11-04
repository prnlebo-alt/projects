import type { Metadata } from "next";
import Link from "next/link";
import { ChartPreview } from "@/components/chart-preview";
import { Footer } from "@/components/footer";
import { Callout, CodeCard, ComparisonTable, CtaBand, FaqList, FeatureGrid, LandingHero, Section, SectionHead, Steps } from "@/components/landing";
import { renderChart } from "@/lib/charts/render";
import { sampleSpec } from "@/lib/charts/schema";
import { supportEmail, supportMailto } from "@/lib/support";
import { planLimits, UNVERIFIED_FREE_LIMIT } from "@/lib/usage/plans";

export const metadata: Metadata = {
  title: "MCP server for AI agents",
  description: "One MCP tool that renders a chart and hands back PNG and SVG URLs, alt text, and a structural quality review. Not yet on npm: available to beta users on request.",
  alternates: { canonical: "/mcp" },
};

/**
 * SUPPORT_EMAIL is read per request, the same way /support reads it, so the access instructions on
 * this page reflect the deployment serving them rather than the one that built the image. No address
 * is written into this file: when the channel is unset the page says so instead of printing a
 * placeholder or a mailto that goes nowhere.
 */
export const dynamic = "force-dynamic";

const ACCESS_SUBJECT = "ChartRelay MCP beta access";

/**
 * A mailto link when the support channel is configured, plain text when it is not. Callers embed
 * this mid-sentence, so it never appends a clause of its own — the availability Callout carries the
 * "no channel yet" caveat once, in one place.
 */
function Contact({ children }: { children: string }) {
  const href = supportMailto(ACCESS_SUBJECT);
  if (!href) return <span>{children}</span>;
  return <a href={href}>{children}</a>;
}

/**
 * The tool result below is built from a real render, so the alt text and the quality review on this
 * page are produced by the same code the MCP server calls (src/lib/charts/render.ts, qa.ts) and the
 * same formatting as mcp/index.js formatResult(). Only the render id is illustrative.
 */
const demo = renderChart(sampleSpec);
const DEMO_ID = "kR2pQ7mXa4Tb9F";
const demoIssues = demo.warnings.filter((issue) => issue.code !== "healthy");

/**
 * No domain is written into this file. The deployment's own origin is the one a reader would
 * configure, and it is read per request like everything else on this page; with APP_URL unset the
 * examples fall back to an obvious stand-in rather than inventing a hostname.
 */
function apiHost() {
  return (process.env.APP_URL ?? "https://your-chartrelay-host").replace(/\/+$/, "");
}

function toolResultFor(host: string) {
  return [
    `Chart rendered (id ${DEMO_ID}).`,
    `PNG: ${host}/api/v1/charts/${DEMO_ID}?format=png`,
    `SVG: ${host}/api/v1/charts/${DEMO_ID}?format=svg`,
    `Alt text: ${demo.altText}`,
    demoIssues.length
      ? `Quality review found ${demoIssues.length} issue(s). Consider fixing and re-rendering:\n${demoIssues.map((issue) => `- [${issue.severity}] ${issue.message} Fix: ${issue.suggestion}`).join("\n")}`
      : "Quality review: no structural problems found. Still verify the data and the takeaway in the title.",
    "Usage this month: 42/1000.",
  ].join("\n");
}

/**
 * Both blocks below are shapes, not commands to run today: `@chartrelay/mcp` is unpublished, so the
 * npx form resolves to nothing. They are here because the configuration surface is the part a reader
 * has to evaluate before asking for access, and it will not change when the package ships.
 */
function desktopConfigFor(host: string) {
  return `{
  "mcpServers": {
    "chartrelay": {
      "command": "npx",
      "args": ["-y", "@chartrelay/mcp"],
      "env": {
        "CHARTRELAY_API_KEY": "cr_live_...",
        "CHARTRELAY_API_URL": "${host}"
      }
    }
  }
}`;
}

function claudeCodeCommandFor(host: string) {
  return `claude mcp add chartrelay \\
  -e CHARTRELAY_API_KEY=cr_live_... \\
  -e CHARTRELAY_API_URL=${host} \\
  -- npx -y @chartrelay/mcp`;
}

const retryLoop = `// First attempt: a pie chart with eleven slices.
Quality review found 1 issue(s). Consider fixing and re-rendering:
- [warning] Too many slices make the chart hard to scan. Fix: Keep the
  largest six categories and group the rest as Other.

// The model groups the tail into "Other" and calls render_chart again.
Quality review: no structural problems found. Still verify the data and
the takeaway in the title.`;

export default function McpPage() {
  const address = supportEmail();
  const accessMailto = supportMailto(ACCESS_SUBJECT);
  const host = apiHost();
  const toolResult = toolResultFor(host);
  return (
    <main>
      <LandingHero
        eyebrow="Model Context Protocol"
        title={<>Give your assistant a chart it can <span>hand straight to a human</span></>}
        subtitle="ChartRelay has an MCP server with one tool, render_chart. The model sends a small JSON spec and gets back durable PNG and SVG URLs, alt text, and a structural quality review it can act on before anyone sees the chart."
        actions={<>
          {accessMailto
            ? <a className="button" href={accessMailto}>Ask for beta access</a>
            : <Link className="button" href="/register">Get a free API key</Link>}
          <Link className="button button-ghost" href="#availability">How to get it</Link>
        </>}
        note="Not on npm, and the repository is private: the MCP server is available to beta users on request today. The HTTP API behind it is open to anyone with a free key."
      >
        <ChartPreview svg={demo.svg} />
      </LandingHero>

      <Section id="availability">
        <SectionHead
          eyebrow="Availability"
          title="You cannot install this yet, and here is the honest state of it"
          body="The rest of this page describes the tool accurately — what it sends, what comes back, what it costs you in quota. What it cannot do is hand you a copy, because there is nothing public to fetch."
        />
        <Callout tone="warn" title="Nothing to install today">
          <p><code>@chartrelay/mcp</code> has not been published to npm, and the repository it lives in is private, so there is no <code>npx</code> command and no checkout you can clone. Any <code>npx -y @chartrelay/mcp</code> line you find elsewhere — including in the config shapes below — is what the setup will be after publication, not something that works now.</p>
          {address
            ? <p>Until then the server is shared with beta users individually. <Contact>{`Write to ${address}`}</Contact> saying which MCP client you use, and you will get the server and the exact setup for it, or a plain no if the beta is closed.</p>
            : <p>Until then the server is shared with beta users individually, but this deployment has no support address configured, so there is no contact channel to point you at yet. This section will carry the address as soon as one is live.</p>}
        </Callout>
        <FeatureGrid
          columns={3}
          items={[
            { icon: "API", title: "The API needs none of this", body: <>render_chart is a thin wrapper over one HTTP endpoint. A <Link href="/register">free key</Link> and a POST to <code>/api/v1/charts</code> gets you the same render, alt text and findings from any language, today.</> },
            { icon: "TRY", title: "The behaviour is testable now", body: <>The <Link href="/playground">playground</Link> and the <Link href="/chart-check">chart checker</Link> run the same renderer and the same review this tool calls, with no account, so you can judge the output before asking for anything.</> },
            { icon: "WAIT", title: "What publication would change", body: "Only distribution. The tool name, the spec it takes, the text it returns and the three environment variables are what they will be; a published package makes them installable in one line." },
          ]}
        />
      </Section>

      <Section id="what-it-does" tint>
        <div>
          <SectionHead
            eyebrow="One tool"
            title="What render_chart gives the model"
            body="Every successful call returns a block of text the model can read and quote, plus an inline PNG so it can see what it made."
          />
          <FeatureGrid
            columns={3}
            items={[
              { icon: "PNG", title: "A durable PNG URL", body: "Served from GET /api/v1/charts/[id]?format=png with a one-year immutable cache header. Paste it into chat, an email, or a Slack message." },
              { icon: "SVG", title: "A durable SVG URL", body: "The same chart at ?format=svg, for web pages and documents. The SVG carries a <title> and <desc> from the chart's title and alt text." },
              { icon: "ALT", title: "Alt text", body: "A sentence generated from the data: the peak, the low, and the first-to-last change for time-ordered charts. Pie charts get their largest shares instead." },
              { icon: "QA", title: "A quality review", body: "Structural findings with a severity and a concrete fix — missing title, too many pie slices, a crowded chart, weak colour contrast, over-long axis labels." },
              { icon: "IMG", title: "An inline PNG preview", body: "The server fetches its own PNG and attaches it to the tool result, so the model can look at the chart rather than trust the spec. Turn it off with one environment variable." },
              { icon: "USE", title: "Your usage so far", body: "Each result ends with the renders used against this month's quota, so an agent working in a loop can tell how much room is left." },
            ]}
          />
          <CodeCard
            label="What the model reads back"
            code={toolResult}
            caption="Generated on this page by the same renderer the API uses; the id and host are illustrative. URLs point at whatever CHARTRELAY_API_URL you configure."
          />
        </div>
      </Section>

      <Section id="setup">
        <SectionHead
          eyebrow="Setup"
          title="What the setup will look like"
          body="Two shapes, neither of which runs today. They are worth reading now because they are the whole integration: one entry in a config file, three environment variables, no other moving parts."
        />
        <Steps
          items={[
            { title: "Create an API key", body: <><Link href="/register">Register for a free account</Link> and copy the key that is shown once. It starts with <code>cr_live_</code>. This part works today and is useful on its own — the same key calls the HTTP API.</> },
            {
              title: "Get the server",
              body: address
                ? <>The step that does not exist yet. <Contact>Ask for beta access</Contact> and you will be sent the server plus the setup for your client; when the package is published this becomes the <code>npx</code> line below and nothing else changes.</>
                : <>The step that does not exist yet, and this deployment has no support address configured to request it through. When the package is published this becomes the <code>npx</code> line below and nothing else changes.</>,
            },
            { title: "Point it at a ChartRelay instance", body: <>Set <code>CHARTRELAY_API_URL</code> to the deployment you render against. The built-in default is a placeholder domain, so it is always worth setting explicitly.</> },
            { title: "Add the entry to your client and restart it", body: "Then ask the assistant for a chart. It calls render_chart and replies with the URLs, the alt text and the review." },
          ]}
        />
        {/* A wide <pre> scrolls inside its own card: `.lp-grid > * { min-width: 0 }` in globals.css
            stops it stretching the grid track. */}
        <div className="lp-grid lp-grid-2" style={{ marginTop: 28 }}>
          <div>
            <CodeCard
              label="Claude Desktop · claude_desktop_config.json (after publication)"
              code={desktopConfigFor(host)}
              caption="Not runnable yet: npx cannot resolve @chartrelay/mcp until it is published. Beta users get a working equivalent with their copy of the server."
            />
          </div>
          <div>
            <CodeCard
              label="Claude Code · terminal (after publication)"
              code={claudeCodeCommandFor(host)}
              caption="The same server, added to Claude Code. The API key is stored by your MCP client, never by this page."
            />
          </div>
        </div>
      </Section>

      <Section id="environment" tint>
        <div>
          <SectionHead
            title="Environment variables"
            body="These three are the whole configuration surface; the server reads nothing else."
          />
          <ComparisonTable
            caption="Environment variables read by the MCP server, version 0.1.0."
            rowHeader="Variable"
            columns={["Default", "What it does"]}
            rows={[
              {
                label: <code>CHARTRELAY_API_KEY</code>,
                cells: ["Required — no default", "Sent as a Bearer token on every render. Without it, the tool returns an error telling the model to create a key instead of failing silently."],
              },
              {
                label: <code>CHARTRELAY_API_URL</code>,
                cells: [<code key="d">https://chartrelay.example</code>, "The ChartRelay instance to call. The built-in default is a placeholder domain, so set this explicitly — to this deployment or to your own."],
              },
              {
                label: <code>CHARTRELAY_INCLUDE_IMAGE</code>,
                cells: [<code key="d">true</code>, "Set it to false to skip the inline PNG preview and return only the text block. Useful when you are paying for image tokens you do not need."],
              },
            ]}
            footnote="Each render_chart call counts as one render against your plan's monthly quota, the same as a direct API call."
          />
        </div>
      </Section>

      <Section id="qa-loop">
        <SectionHead
          eyebrow="Self-correction"
          title="The quality review is written for a model to act on"
          body="Every finding carries a severity, a plain description of the problem, and a suggested fix. The tool description tells the model to revise the spec and call again when the review reports issues, so a bad chart can be caught before it reaches a person."
        />
        <CodeCard
          label="A two-call loop"
          code={retryLoop}
          caption="Both messages are the exact strings in the quality review. Nothing here is automatic: the model chooses whether to re-render."
        />
        <FeatureGrid
          columns={3}
          items={[
            { title: "Errors", body: "A pie chart with more than one series, or with negative values — cases the chart type genuinely cannot represent. The API refuses these rather than storing a chart, so the tool reports an error instead of handing the model a URL." },
            { title: "Warnings", body: "A missing or placeholder title, more than seven pie slices, more than forty points on a non-pie chart, more than seven series, or a series colour under 3:1 against the background." },
            { title: "Tips", body: "Category labels over twelve characters, which get shortened on the axis. When nothing else fires, a single tip says no structural problems were found." },
          ]}
        />
      </Section>

      <Section id="limits" tint>
        <div>
          <SectionHead
            title="What the agent can and cannot do"
            body="Worth reading before you let a model publish charts on your behalf."
          />
          <SectionHead headingLevel={3} title="It can" />
          <FeatureGrid
            columns={2}
            headingLevel={4}
            items={[
              { title: "Draw five chart types", body: "Bar, line, area, pie, and scatter. Colours, light or dark theme, legend on or off, and values printed on the marks are all part of the spec." },
              { title: "Handle real-sized data", body: "Up to 12 series of up to 100 points each, at any size from 320x240 to 2400x1600 pixels." },
              { title: "Share the result with anyone", body: "GET /api/v1/charts/[id] needs no key, so the PNG and SVG URLs work in an email or a public page. Renders are immutable: the same id always returns the same image." },
              { title: "Fix its own chart", body: "Read the quality review, adjust the spec, and call render_chart again — no human in the loop for a mis-shaped chart." },
            ]}
          />
          <SectionHead headingLevel={3} title="It cannot" />
          <FeatureGrid
            columns={2}
            headingLevel={4}
            items={[
              { title: "Tell you whether the data is true", body: "The review inspects the chart's structure — series counts, slice counts, density, contrast, labels. It never sees your source system and cannot check that a number is right." },
              { title: "Plot an x/y relationship", body: "Scatter places each value as a dot at its category label, in input order. There is no numeric x-axis, so it will not show a correlation." },
              { title: "Crop the value axis", body: "The axis always includes zero. That rules out the exaggerated-difference chart, and it also rules out zooming in on a narrow range on purpose." },
              { title: "Change or delete a render", body: "The v1 API is POST to create and GET to read. There is no edit and no delete, and no way to make a published URL private after the fact." },
            ]}
          />
          <Callout tone="warn" title="Treat chart URLs as public">
            Anyone with the id can fetch the PNG or the SVG without an API key. Do not let an agent render data you would not put on a public URL.
          </Callout>
        </div>
      </Section>

      <Section id="faq">
        <SectionHead title="Questions" />
        <FaqList
          items={[
            { question: "Can I install it from npm?", answer: "No. @chartrelay/mcp has not been published, so npx cannot fetch it, and the repository it lives in is private, so there is nothing to clone either. Publication is intended but not scheduled here, and this page will stop saying all this when it happens." },
            { question: "So how do I actually get it?", answer: address
                ? <p>By asking. <Contact>{`Email ${address}`}</Contact> with the MCP client you use. The beta is small and hand-run, so expect a real answer rather than an automatic download — including a no if it is full.</p>
                : <p>Individually, from the people running the beta — but this deployment has no support address configured, so there is no channel to publish here yet. The HTTP API needs no beta access: a <Link href="/register">free key</Link> gets you the same renders today.</p> },
            { question: "Which MCP clients will it work with?", answer: "Any client that can launch a stdio MCP server, which includes Claude Desktop and Claude Code. The server uses the official @modelcontextprotocol/sdk and exposes a single tool, so there is nothing client-specific in it." },
            { question: "Do I need the MCP server to use ChartRelay?", answer: <p>No, and this is the important part: the MCP server is a thin wrapper over one HTTP endpoint. Post to /api/v1/charts with a Bearer key instead — the <Link href="/docs">API docs</Link> cover the request and response in full, and nothing on this page is available there that is not available over HTTP.</p> },
            { question: "What happens when I run out of renders?", answer: "The tool returns an error the model can read, saying the monthly limit was reached, with a link to the pricing page. It does not silently return an old chart, and a server error is never reported as a quota problem." },
            { question: "Does the model see the chart, or only a link?", answer: "Both, by default. The tool result carries the text block and an inline PNG of the chart. Set CHARTRELAY_INCLUDE_IMAGE to false if you only want the text." },
            { question: "Can I point it at my own deployment?", answer: "Not by running ChartRelay yourself: ChartRelay is not offered for self-hosting today, so there is no deployment of your own for it to talk to. What CHARTRELAY_API_URL gives you is a configurable target rather than a host compiled into the server — it takes any base URL, so the same server can be aimed at whichever ChartRelay deployment you have access to, which today means this hosted API." },
          ]}
        />
      </Section>

      <CtaBand
        eyebrow="Get started"
        title="Start with the API, ask about the MCP server"
        body="A free key works today and gives you the same renders, alt text and review the tool returns. The MCP wrapper is the part you have to ask for."
        actions={<>
          <Link className="button" href="/register">Get a free API key</Link>
          <Link className="button button-ghost" href="/docs">Read the API docs</Link>
        </>}
        note={`${planLimits.free.toLocaleString("en-US")} renders a month on the free plan once your email is confirmed (${UNVERIFIED_FREE_LIMIT} before). No card required.`}
      />
      <Footer />
    </main>
  );
}
