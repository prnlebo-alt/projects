import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Footer } from "@/components/footer";
import {
  API_KEY_ONE_TIME_NOTICE,
  KEY_ENV_VAR,
  QUICKSTART_KEY_PLACEHOLDER,
  REGISTRATION_EXAMPLE,
  registrationCurl,
  resolveQuickstartOrigin,
} from "@/components/quickstart-card";

export const metadata: Metadata = { title: "API documentation", alternates: { canonical: "/docs" } };

/** The shape POST /api/auth/register returns. The notice is the string the route actually sends. */
const registerResponse = `{
  "ok": true,
  "apiKey": "cr_live_...",
  "apiKeyNotice": "${API_KEY_ONE_TIME_NOTICE}"
}`;

/** Documented against registrationSchema; tests/docs-consistency.test.ts parses the example with it. */
const registrationFields: { field: keyof typeof REGISTRATION_EXAMPLE; rules: string }[] = [
  { field: "name", rules: "Required. 2–80 characters after trimming. Names your workspace." },
  { field: "email", rules: "Required. A valid address, lower-cased on the way in. One account per address." },
  { field: "password", rules: "Required. 10–128 characters." },
];

const rejection = `{
  "error": "The chart was not stored: QA review found 1 blocking problem. Nothing was saved and no render was counted.",
  "code": "quality-rejected",
  "blocking": [{
    "severity": "error",
    "code": "pie-negative-value",
    "message": "A pie chart cannot represent negative values.",
    "suggestion": "Use a bar chart for signed values."
  }],
  "warnings": [ ... every finding, blocking or not ... ],
  "override": {
    "field": "allowQualityErrors",
    "value": true,
    "effect": "Resend the same request with this field set to store the chart despite these findings. It then counts as one render."
  }
}`;

const example = `{
  "type": "bar",
  "title": "Monthly recurring revenue",
  "subtitle": "Revenue grew 84% over six months",
  "width": 900,
  "height": 520,
  "theme": "light",
  "showLegend": true,
  "showValues": true,
  "series": [{
    "name": "MRR",
    "color": "#6C5CE7",
    "data": [
      { "label": "August", "value": 31200 },
      { "label": "September", "value": 33900 }
    ]
  }]
}`;

/**
 * Encoded here rather than pasted in, so the documented `spec` value is one this deployment's own
 * decoder accepts: a hand-copied string that drifted from the JSON printed beside it would document a
 * chart nobody can draw, which is the exact failure the rest of this page exists to prevent.
 */
const SPEC_EXAMPLE = {
  type: "pie",
  title: "Share of revenue",
  series: [{ name: "Share", data: [{ label: "Direct", value: 42 }, { label: "Partners", value: 33 }, { label: "Marketplace", value: 25 }] }],
};

const specParam = Buffer.from(JSON.stringify(SPEC_EXAMPLE)).toString("base64url");

const specEncodingExample = `# Any language that can base64url-encode JSON can build this parameter.
node -e 'console.log(Buffer.from(JSON.stringify(${JSON.stringify(SPEC_EXAMPLE)})).toString("base64url"))'
# -> ${specParam}`;

/** Built against the origin serving this page, so every URL here is one a reader can paste and fetch. */
const urlExamples = (origin: string) => `# A single-series bar. Editorial style and PNG are the defaults.
${origin}/chart?data=18400,21300,24700,26900,31200,33900&labels=Apr,May,Jun,Jul,Aug,Sep&title=Monthly+recurring+revenue&prefix=$&source=Source:+finance+ledger

# Two series drawn as lines, returned as SVG, with the last point annotated.
${origin}/chart?type=line&data=12,18,22,31%7C9,11,14,16&names=North,South&labels=Q1,Q2,Q3,Q4&title=Pipeline+by+region&suffix=+deals&note=South+flattened&noteAt=3&format=svg

# A pie, which the editorial renderer cannot draw: it comes back classic and x-chartrelay-note says so.
${origin}/chart?spec=${specParam}

# The same chart without the chartrelay.dev mark, on a paid (Developer, Pro or Business) key.
${origin}/chart?data=18400,21300,24700,26900,31200,33900&title=Monthly+recurring+revenue&key=cr_live_...`;

export default async function DocsPage() {
  // The quickstart is copied verbatim into a terminal, so it has to name the origin this deployment
  // actually answers on rather than a build-time guess. Reading headers() also keeps the page out of the
  // prerender, so a deployment that moves domains stops serving the old address immediately. Header
  // values are trusted only for a loopback host — see resolveQuickstartOrigin, which is shared with the
  // dashboard card so the two surfaces cannot disagree about where to send a developer's key.
  const requestHeaders = await headers();
  const origin = resolveQuickstartOrigin({
    appUrl: process.env.APP_URL,
    forwardedHost: requestHeaders.get("x-forwarded-host"),
    host: requestHeaders.get("host"),
  });
  return <>
    <main className="docs-shell"><aside className="docs-nav"><strong>API documentation</strong><a href="#quickstart">Quickstart</a><a href="#register">Create an account</a><a href="#schema">Chart schema</a><a href="#response">Response</a><a href="#quality">Quality enforcement</a><a href="#assets">Asset URLs</a><a href="#url">Charts in a URL</a><a href="#errors">Errors</a></aside><article className="docs-content"><span className="eyebrow">Version 1</span><h1>Render trustworthy charts from JSON.</h1><p>ChartRelay accepts one small chart specification and returns raw SVG, durable SVG and PNG URLs, accessible text, and an explainable QA report.</p>
    <h2 id="quickstart">Quickstart</h2><p>Two requests: create an account to get a key, then render a chart with it. Both target <code>{origin}</code>, the origin serving this page. Never expose a production key in browser code.</p>
    <h3 id="register">1. Create an account</h3><p>Sign up in the browser at <Link href="/register">/register</Link>, or post the same fields. <strong>All three are required</strong> — <code>name</code> as well as <code>email</code> and <code>password</code>. A body missing any of them is refused with <code>400</code>, and the error names the field that is missing.</p>
    <div className="code-card"><header>Terminal</header><pre><code>{registrationCurl(origin)}</code></pre></div>
    <div className="lp-table-wrap" role="region" aria-label="Registration fields" tabIndex={0}><table className="api-table"><caption>Every field accepted by POST /api/auth/register. Scroll sideways on a narrow screen.</caption><thead><tr><th>Field</th><th>Type</th><th>Rules</th></tr></thead><tbody>{registrationFields.map(({ field, rules }) => <tr key={field}><td><code>{field}</code></td><td>string</td><td>{rules}</td></tr>)}<tr><td><code>source</code></td><td>string</td><td>Optional attribution slug from a <code>?ref=</code> link. Anything that is not a short lowercase slug is dropped rather than rejected.</td></tr></tbody></table></div>
    <p>A successful registration returns <code>200</code> with your API key in full. This response is the only copy of it:</p>
    <div className="code-card"><header>200 OK</header><pre><code>{registerResponse}</code></pre></div>
    <aside className="lp-note lp-note-warn"><strong>Save the key out of this response</strong><p>{API_KEY_ONE_TIME_NOTICE}</p><p>Your dashboard lists keys by prefix only (<code>cr_live_…</code>) because the full value is never stored, so there is nowhere to look it up afterwards.</p></aside>
    <h3>2. Render a chart</h3><p>Export the key as <code>{KEY_ENV_VAR}</code> — the same variable the dashboard quickstart and the <Link href="/mcp">MCP server</Link> use — and send it as a Bearer token.</p><div className="code-card"><header>Terminal</header><pre><code>{`curl -X POST ${origin}/api/v1/charts \\
  -H "Authorization: Bearer ${QUICKSTART_KEY_PLACEHOLDER}" \\
  -H "Content-Type: application/json" \\
  --data '${example}'`}</code></pre></div>
    <h2 id="schema">Chart schema</h2><div className="lp-table-wrap" role="region" aria-label="Chart schema fields" tabIndex={0}><table className="api-table"><caption>Every field accepted by POST /api/v1/charts. Scroll sideways on a narrow screen.</caption><thead><tr><th>Field</th><th>Type</th><th>Rules</th></tr></thead><tbody><tr><td><code>type</code></td><td>string</td><td>bar, line, area, pie, or scatter. Every type uses a categorical axis; scatter plots each value at its label in input order and has no numeric x-axis.</td></tr><tr><td><code>title</code></td><td>string</td><td>Up to 120 characters. Defaults to “Untitled chart”, which QA flags as missing-title.</td></tr><tr><td><code>subtitle</code></td><td>string</td><td>Optional, up to 180 characters</td></tr><tr><td><code>width</code></td><td>integer</td><td>320–2400, defaults to 900</td></tr><tr><td><code>height</code></td><td>integer</td><td>240–1600, defaults to 520</td></tr><tr><td><code>theme</code></td><td>string</td><td>light or dark, defaults to light</td></tr><tr><td><code>showLegend</code></td><td>boolean</td><td>Defaults to true. Pie legends name the slices; without a legend, pie slices are labeled directly.</td></tr><tr><td><code>showValues</code></td><td>boolean</td><td>Defaults to false. Prints each value on the chart.</td></tr><tr><td><code>series</code></td><td>array</td><td>1–12 series, each with 1–100 data points. Points are matched to categories by label, in first-seen order across all series.</td></tr><tr><td><code>series[].name</code></td><td>string</td><td>1–80 characters</td></tr><tr><td><code>series[].color</code></td><td>string</td><td>Optional six-digit hex such as <code>#6C5CE7</code> (three-digit hex is rejected). Ignored by pie charts, which color each slice from the palette.</td></tr><tr><td><code>series[].data[].label</code></td><td>string</td><td>1–80 characters. Axis labels longer than 12 characters are shortened.</td></tr><tr><td><code>series[].data[].value</code></td><td>number</td><td>Any finite number, up to a magnitude of 1e15. A negative value in a pie chart is a QA error: the request is refused with 422 unless <code>allowQualityErrors</code> is set.</td></tr><tr><td><code>allowQualityErrors</code></td><td>boolean</td><td>Defaults to false. Sent alongside the chart, but not part of it and not stored with the spec. When true, QA findings with severity <code>error</code> no longer block the request: the chart is stored, the render is counted, and the findings are still returned in <code>warnings</code>.</td></tr></tbody></table></div>
    <h2 id="response">Response</h2><p>A successful request returns HTTP <code>201</code>. The raw SVG is included for immediate use. The <code>warnings</code> array contains the QA findings that did not block the render — warnings and tips, each with a concrete correction. Unless you sent <code>allowQualityErrors</code>, a <code>201</code> also means QA found nothing blocking: a chart that violates the schema rules is refused before it is stored (see <a href="#quality">quality enforcement</a>).</p><div className="code-card"><header>201 Created</header><pre><code>{`{
  "id": "V1StGXR8_Z5jdH",
  "svg": "<svg ...>...</svg>",
  "altText": "Monthly recurring revenue...",
  "warnings": [{
    "severity": "tip",
    "code": "healthy",
    "message": "No structural chart problems detected.",
    "suggestion": "Verify the source data..."
  }],
  "urls": {
    "svg": "https://.../api/v1/charts/V1StGXR8_Z5jdH?format=svg",
    "png": "https://.../api/v1/charts/V1StGXR8_Z5jdH?format=png"
  },
  "usage": { "used": 17, "limit": 100 }
}`}</code></pre></div>
    <h2 id="quality">Quality enforcement</h2><p>Every render is reviewed, and each finding carries a severity.</p><ul><li><strong>error</strong> — the chart cannot represent the data it was given. Two rules produce one today: <code>pie-negative-value</code> and <code>pie-multiple-series</code>. The request is refused with <code>422</code>. Nothing is stored, no asset URL is issued, and the render is not counted against your quota.</li><li><strong>warning</strong> and <strong>tip</strong> — advisory. The chart is stored and returned with <code>201</code>, and the findings come back in <code>warnings</code> so you can decide.</li></ul><p>A <code>422</code> names every blocking finding with its code, message and suggested fix, so a client can correct the specification and retry in one step.</p><div className="code-card"><header>422 Unprocessable Content</header><pre><code>{rejection}</code></pre></div>
    <p>If you want the chart despite the findings — reproducing an existing report, or storing something a human has already signed off — send <code>{`"allowQualityErrors": true`}</code> in the same object as the chart. Enforcement is downgraded for that request only: the chart is stored, the render is counted, and the same findings are returned in <code>warnings</code>. There is no account-level setting for this; the default is enforcement.</p>
    <p>The public <Link href="/chart-check">chart checker</Link> never enforces, because its purpose is showing you what is wrong. Its response marks each finding with <code>blocksPublish</code> and carries an <code>enforcement</code> object saying whether this API would have refused the chart.</p>
    <h2 id="assets">Asset URLs</h2><p>Generated assets are immutable. The only supported query parameter is <code>format</code>; any other parameter is rejected with 400. Use the SVG URL for responsive product interfaces and the PNG URL for email, social posts, and systems that reject SVG.</p>
    <h2 id="url">Charts in a URL</h2><p><code>GET /chart</code> carries the whole chart in the querystring and answers with the image itself, so a chart works wherever an image URL works and JavaScript does not: an HTML email, a README, a Slack message, a Notion page, a PDF, a spreadsheet cell, a no-code automation. It needs no account and no key, it is not metered, and nothing drawn through it counts against the monthly quota above. <Link href="/integrations">Integrations</Link> turns each of those surfaces into a copy-paste recipe.</p>
    <div className="code-card"><header>GET /chart</header><pre><code>{urlExamples(origin)}</code></pre></div>
    <p>A vertical bar separates one series from the next. It is written <code>%7C</code> above because a bare <code>|</code> is not a legal URL character and strict clients reject it; the two are identical by the time the query is read, so write whichever your tool tolerates.</p>
    <h3 id="url-forms">Two ways to say it</h3><p>The readable form spells the chart out in ordinary parameters — <code>data</code>, <code>labels</code>, <code>names</code> — and is meant to be typed by hand or assembled by a tool that only knows how to concatenate strings. The <code>spec</code> form carries a whole chart as base64url-encoded JSON — the same object documented under <a href="#schema">chart schema</a>, without the request-level options that only the JSON API reads — for anything the readable form cannot express.</p>
    <p>When <code>spec</code> is present it wins outright: <code>data</code>, <code>labels</code>, <code>names</code>, <code>type</code>, <code>title</code>, <code>subtitle</code>, <code>theme</code>, <code>w</code>, <code>h</code>, <code>legend</code> and <code>values</code> are all ignored rather than merged, so there is never a question of which half of a half-written chart won. <code>format</code>, <code>style</code>, <code>key</code> and the presentation parameters — <code>source</code>, <code>prefix</code>, <code>suffix</code>, <code>focus</code>, <code>note</code>/<code>noteAt</code> — still apply.</p>
    <div className="code-card"><header>Terminal</header><pre><code>{specEncodingExample}</code></pre></div>
    <h3 id="url-parameters">Parameters</h3><div className="lp-table-wrap" role="region" aria-label="URL chart parameters" tabIndex={0}><table className="api-table"><caption>Every parameter GET /chart reads. Scroll sideways on a narrow screen.</caption><thead><tr><th>Parameter</th><th>Default</th><th>Rules</th></tr></thead><tbody>
      <tr><td><code>data</code></td><td>Required</td><td>Comma-separated numbers; <code>|</code> (or <code>%7C</code>) starts another series. Every series needs at least one value and all of them need the same count. Decimals, negatives and the Unicode minus a spreadsheet emits are all accepted. A cell that is not a number is refused by position rather than drawn as zero, and there are no thousands separators — the comma already separates one value from the next, so <code>1,234</code> is two points.</td></tr>
      <tr><td><code>labels</code></td><td><code>1</code>, <code>2</code>, <code>3</code>…</td><td>One comma-separated label per value. Must match the number of values in a series exactly.</td></tr>
      <tr><td><code>names</code></td><td>See rules</td><td>One comma-separated name per series. Must match the number of series exactly. Left out, several series become <code>Series 1</code>, <code>Series 2</code>… and a single series takes the <code>title</code>, or <code>Value</code> when there is no title.</td></tr>
      <tr><td><code>type</code></td><td><code>bar</code></td><td>bar, line, area, pie or scatter — the same five the JSON API takes. Only bar and line are drawn in the editorial style; see <a href="#url-style">styles</a>.</td></tr>
      <tr><td><code>title</code></td><td><code>Untitled chart</code></td><td>Up to 120 characters.</td></tr>
      <tr><td><code>subtitle</code></td><td>None</td><td>Up to 180 characters.</td></tr>
      <tr><td><code>theme</code></td><td><code>light</code></td><td>light or dark. Both renderers honour it.</td></tr>
      <tr><td><code>w</code> / <code>h</code></td><td><code>900</code> / <code>520</code></td><td>Width 320–2400, height 240–1600. <strong>Classic style only.</strong> The editorial renderer draws on a fixed 860×480 canvas that its type sizes and paddings are tuned to, so it accepts these and does not use them.</td></tr>
      <tr><td><code>legend</code></td><td><code>1</code></td><td><code>0</code> or <code>false</code> turns the legend off; any other value turns it on. <strong>Classic style only.</strong> The editorial renderer labels lines at their ends and draws its own legend when there is more than one series.</td></tr>
      <tr><td><code>values</code></td><td><code>0</code></td><td>Prints each value on the chart. <code>0</code> or <code>false</code> is off, any other value is on. <strong>Classic style only.</strong> The editorial column chart always labels its focus bar and nothing else.</td></tr>
      <tr><td><code>format</code></td><td><code>png</code></td><td>png or svg. Anything else is refused rather than silently defaulted.</td></tr>
      <tr><td><code>style</code></td><td><code>editorial</code></td><td>editorial or classic. Anything else is refused. See <a href="#url-style">styles</a>.</td></tr>
      <tr><td><code>key</code></td><td>None</td><td>An API key. On a paid workspace — Developer, Pro or Business — it removes the <code>chartrelay.dev</code> mark; see <a href="#url-mark">the free-tier mark</a>.</td></tr>
      <tr><td><code>source</code></td><td>None</td><td>A credit line under the chart, e.g. <code>Source: finance ledger</code>. <strong>Editorial style only.</strong></td></tr>
      <tr><td><code>prefix</code></td><td>None</td><td>Written before every number, e.g. <code>$</code>. <strong>Editorial single-series bar only.</strong></td></tr>
      <tr><td><code>suffix</code></td><td>None</td><td>Written after every number, e.g. <code> deals</code>. <strong>Editorial line form only.</strong> A suffix also switches the axis back to full numbers, because a compacted <code>1.0Kms</code> is not a unit anyone writes.</td></tr>
      <tr><td><code>focus</code></td><td>The last bar</td><td>Which bar carries the argument, counting from 0. Must be a whole number of 0 or more, and must name a bar that exists — an index past the last bar fails the render and you get the error image instead of a chart. <strong>Editorial single-series bar only:</strong> that bar is drawn in the series colour with its value printed above it, and the rest go quiet.</td></tr>
      <tr><td><code>note</code> + <code>noteAt</code></td><td>None</td><td>A leader-line annotation attached to one point of the first series. <code>noteAt</code> is required whenever <code>note</code> is given, counts from 0, and must name a point that exists — an index past the end fails the render and you get the error image instead of a chart. <strong>Editorial line form only.</strong></td></tr>
      <tr><td><code>spec</code></td><td>None</td><td>A whole chart as base64url-encoded JSON, in the shape documented under <a href="#schema">chart schema</a>. Padding is optional. Anything that is not valid base64url JSON, or is JSON the chart schema rejects, is refused with the schema's own message.</td></tr>
    </tbody></table></div>
    <p>The schema limits from <a href="#schema">chart schema</a> apply to both forms: 1–12 series, 1–100 points each, labels and names of 1–80 characters, and values up to a magnitude of 1e15.</p>
    <h3 id="url-style">Editorial and classic</h3><p>Two renderers draw the same numbers. The editorial one is the default and is the better chart — one focus bar in colour against quiet ones, lines labelled at their ends, room for a source line and an annotation. It draws only <code>bar</code> and <code>line</code> today.</p>
    <ul><li>A <strong>pie, area or scatter</strong> asked for in the editorial style is drawn in the classic style instead, and the response says so in <code>x-chartrelay-note</code>. It is never quietly turned into a chart type you did not ask for.</li><li>A <strong>bar chart with more than one series</strong> is drawn in the editorial style as lines, and says so in the same header. The editorial column chart carries one series by design, because its whole argument is a single bar against quiet ones.</li><li><code>style=classic</code> pins the old drawing, so a page already built around it is not moved by a deployment. Classic honours <code>w</code>, <code>h</code>, <code>legend</code> and <code>values</code>, and ignores <code>source</code>, <code>prefix</code>, <code>suffix</code>, <code>focus</code> and <code>note</code>.</li></ul>
    <p>The description of the chart does not change with the renderer: <code>x-chartrelay-alt</code> is the same sentence either way. The picture changes; the facts stated about it do not.</p>
    <h3 id="url-headers">Response headers</h3><div className="lp-table-wrap" role="region" aria-label="Response headers on GET /chart" tabIndex={0}><table className="api-table"><caption>Headers returned by GET /chart. Scroll sideways on a narrow screen.</caption><thead><tr><th>Header</th><th>When</th><th>Value</th></tr></thead><tbody>
      <tr><td><code>x-chartrelay-alt</code></td><td>200</td><td>A sentence describing the chart from its data — the peak, the low, the first-to-last change, or the largest shares for a pie. Line breaks are collapsed to spaces so it is a legal header value. Read it back and put it in the <code>alt</code> attribute: an editorial SVG carries <code>role=&quot;img&quot;</code> but no embedded <code>&lt;title&gt;</code> or <code>&lt;desc&gt;</code>, and a PNG cannot carry one at all, so this header is the only copy of the description that travels with the image.</td></tr>
      <tr><td><code>x-chartrelay-style</code></td><td>200</td><td><code>editorial</code> or <code>classic</code> — the renderer that actually drew this image, which is not always the one asked for.</td></tr>
      <tr><td><code>x-chartrelay-note</code></td><td>200, when there is something to say</td><td>Why the drawing is not the one you asked for, in a sentence you can show a user: an editorial request that fell back to classic, or a multi-series bar drawn as lines. Absent when the request was drawn as asked.</td></tr>
      <tr><td><code>x-chartrelay-error</code></td><td>400</td><td>The refusal in the same words printed on the error image, for a caller that can read headers.</td></tr>
      <tr><td><code>retry-after</code></td><td>429</td><td>Seconds until the rate-limit window resets.</td></tr>
      <tr><td><code>content-type</code></td><td>Always</td><td><code>image/png</code>, or <code>image/svg+xml; charset=utf-8</code> with <code>format=svg</code>. Refusals use the format that was asked for, so an <code>&lt;img&gt;</code> expecting a PNG still gets a PNG.</td></tr>
      <tr><td><code>cache-control</code></td><td>Always</td><td><code>public, max-age=31536000, s-maxage=31536000, immutable</code> on a 200, <code>no-store</code> on a refusal.</td></tr>
    </tbody></table></div>
    <h3 id="url-errors">Errors come back as images</h3><p>An <code>&lt;img&gt;</code> tag cannot show a JSON body. A caller who mistypes a parameter in an email template would get a broken-image icon and no idea why, so the reason is drawn as the image instead: a small card naming what was wrong and pointing back at this section. The status stays 4xx, so a programmatic caller still sees a failure, and <code>x-chartrelay-error</code> carries the same sentence.</p>
    <p>The refusals are specific by design — <code>&quot;TBD&quot; at position 2 is not a number</code>, <code>labels has 1 entries but data has 2 values per series</code>, <code>note needs noteAt, a whole number counting from 0, saying which point it points at</code>. Read the card and fix the named parameter. A renderer that throws is reported as a 400 too, with the failure's own message rather than a blamed parameter.</p>
    <p>This endpoint does not run the <a href="#quality">quality enforcement</a> that <code>POST /api/v1/charts</code> runs. A chart with a structural problem is drawn, and the findings are not returned. If you want them, post the chart to the JSON API or paste it into the <Link href="/chart-check">chart checker</Link>.</p>
    <h3 id="url-limits">Query length, caching and rate limits</h3><ul>
      <li><strong>8 KB of querystring.</strong> Longer than that and the request is refused, because browsers, proxies and mail clients truncate long URLs at different undocumented lengths and a chart that renders for the author and breaks in someone else's inbox is worse than one that refuses up front. Past 8 KB, <code>POST /api/v1/charts</code> and use the short asset URL it returns — that is what the refusal tells you to do.</li>
      <li><strong>Cached hard.</strong> The URL <em>is</em> the chart, so the same URL can only ever produce the same image. Successful renders are served <code>immutable</code> with a one-year age. <code>immutable</code> matters more than the age: mail clients and Slack fetch through image proxies that would otherwise re-render the same chart for every recipient.</li>
      <li><strong>240 requests a minute per IP address.</strong> Not a quota — an abuse ceiling, and not your plan&apos;s monthly renders. A chart drawn through this endpoint is not counted against that allowance as the endpoint stands today; anything drawn twice should be arriving from a cache rather than from the renderer. Over the ceiling you get a 429 with <code>retry-after</code>.</li>
      <li><strong><code>HEAD</code> is answered without drawing anything</strong>, which is what link unfurlers and mail proxies send first.</li>
    </ul>
    <h3 id="url-mark">The free-tier mark</h3><p>Free charts carry a small <code>chartrelay.dev</code> mark in the top-right corner, outside the plot. Removing it is one of the two things a paid plan buys; the other is the month&apos;s prepaid renders, which a chart drawn through this endpoint does not currently spend. Pass an API key from a paid workspace as <code>key=</code> and the chart is drawn without the mark — see <Link href="/pricing">pricing</Link>.</p>
    <aside className="lp-note lp-note-warn"><strong>A key in a URL is a key you have published</strong><p>Anything that can see the URL can see the key: mail relays, image proxies, CDN and server logs, anyone who forwards the message or views the page source. Use <code>key=</code> where the URL stays inside systems you control, and treat a key that has been in a public URL as disclosed — revoke it from your dashboard and issue another.</p><p>A key that is missing, unrecognised, or on a free workspace is not an error. The chart is drawn and keeps the mark, so an expired subscription degrades to a marked chart rather than to a broken image.</p></aside>
    <h2 id="errors">Errors</h2><div className="lp-table-wrap" role="region" aria-label="Error responses" tabIndex={0}><table className="api-table"><caption>Status codes returned by the v1 API. Scroll sideways on a narrow screen.</caption><thead><tr><th>Status</th><th>Meaning</th></tr></thead><tbody><tr><td>400</td><td>Either the body could not be parsed as JSON — <code>details.reason</code> quotes the parser, and no field paths are given because no fields were read — or it parsed and failed validation, in which case <code>details.issues</code> lists each problem with the path to the field, such as <code>series.1.data.3.label</code>.</td></tr><tr><td>401</td><td>The Bearer API key is missing or invalid.</td></tr><tr><td>404</td><td>The requested asset does not exist.</td></tr><tr><td>413</td><td>The request body is larger than 256 KB.</td></tr><tr><td>422</td><td>The specification is valid JSON and valid against the schema, but QA found a blocking problem. See <a href="#quality">quality enforcement</a>. Nothing was stored and no render was counted.</td></tr><tr><td>429</td><td>The workspace reached its monthly render limit. Only quota exhaustion returns 429.</td></tr><tr><td>500</td><td>A server error. It is not a quota problem and does not count against usage; retry later.</td></tr></tbody></table></div>
    <p>Registration is not part of the v1 API and answers differently. <code>400</code> names the fields that are missing or invalid rather than describing the payload in general; <code>409</code> means an account already exists for that email; <code>415</code> means the request was not sent as <code>application/json</code>; <code>429</code> means too many accounts have been created from your network within the hour.</p>
    <p>If a response still makes no sense after checking this table, <Link href="/support">support</Link> explains what to send us — and what never to include in a report.</p>
  </article></main>
    <Footer />
  </>;
}
