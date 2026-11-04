# ChartRelay launch copy (drafts)

Links point at `chartrelay.dev`, which is live. Add `?ref=<channel>` to every link so signups can be attributed. Nothing here has been posted.

**Before posting anything, two things have to stay true.**

1. **The MCP server is not obtainable.** `@chartrelay/mcp` is unpublished and its repository is private, so no draft here may present it as something a reader can install. It is available to beta users on request, and that is how every mention must read. The Reddit post and the MCP directory listing below are therefore **blocked until publication** — they exist only to sell a thing nobody can get.
2. **Only structure is enforced.** A chart the type cannot represent is refused; a merely questionable chart renders with the finding attached; nothing checks whether the numbers are right. No draft may imply that a chart from ChartRelay needs no human review of its data.

---

## Homepage hero (proposed refresh)

**Eyebrow:** The chart API for AI agents
**Headline:** Your agent's charts, checked before they ship.
**Subhead:** Send a small JSON spec and get back PNG, SVG, alt text, and a structural review in one call. A chart the type cannot honestly represent is refused outright rather than returned as a success. The same input always gives the same chart. The value axis always starts at zero.
**Primary CTA:** Try it free (no card)
**Secondary CTA:** Read the API docs
**Proof line:** 250 free renders monthly (confirmed email) · PNG + SVG + alt text · Works with any agent framework
**Honesty line (must ship with the hero):** Structure is enforced; data correctness is not — no API can tell you the numbers are right.

---

## Show HN

**Title (80 char max):**
Show HN: ChartRelay – a chart API for AI agents, with alt text and chart QA

**Body:**
Hi HN. I built ChartRelay because every agent I worked on eventually needed to put a chart in a report, and every approach I tried was fragile in a different way.

Having the model write matplotlib or Chart.js code works until it doesn't. The output changes from run to run, and some of what it produces is embarrassing: nine-slice pies, twelve-line legends, colors you can't read.

ChartRelay takes a deliberately small JSON spec (5 chart types, at most 12 series) and returns:

- deterministic SVG plus durable PNG/SVG URLs
- an alt-text summary of what the chart shows
- a QA report with a suggested fix for each problem it finds: too many pie slices, crowded labels, too many series, low-contrast colors, a missing title

Findings that mean the chart type genuinely cannot represent the data — a pie with several series, a pie with negative values — are not returned as warnings on a successful render. The request is refused with a 422, nothing is stored and the render isn't counted, so there's no URL to paste by accident. There is a per-request flag to override that if you really want the chart, but you have to say so on the call; the default is refusal.

The value axis always includes zero, so it can't produce the truncated-axis chart that makes a 2% change look like a cliff.

The schema is small on purpose, so a model has less to get wrong, and when it does get something wrong, the validation errors tell the agent what to fix.

What it isn't: a general visualization library. If you need maps or 25 chart types, use Vega or AntV. And the QA checks chart *structure*; it can't know whether your data is right — that part still needs a person.

There's an MCP server too, but I'm not going to pretend it's available: it isn't published and the repo is private, so it's going out to beta users one at a time. The HTTP API is the thing you can actually use today.

The playground needs no signup: https://chartrelay.dev/playground?ref=hn
Free tier is 250 renders a month once you confirm your email (none before it's confirmed); paid plans are $19 for 5,000, $59 for 25,000 and $149 for 100,000. Everything is prepaid — if a month runs long you buy a $10 pack of 2,000 renders rather than being billed for an overage you didn't choose.

I'd love feedback on the schema: what's missing that your agents would need?

---

## Product Hunt

**Name:** ChartRelay
**Tagline (60 char max):** Chart API for AI agents, with alt text and chart QA
**Topics:** Developer Tools, Artificial Intelligence, API, Data Visualization

**Description (260 char max):**
Give your AI agent a reliable way to make charts. Send JSON and get back PNG, SVG, alt text, and a quality review — and charts the type can't honestly represent are refused, not returned. Deterministic and free to start.

**Maker's first comment:**
Hey Product Hunt 👋 ChartRelay started because the agents I built kept making charts I was embarrassed to send. Letting the model write plotting code gave different results every run, with no alt text and no sanity check. ChartRelay is the boring, reliable version: a small JSON schema with little for a model to get wrong, the same chart every time, alt text included, and a review that explains what's wrong and how to fix it — or refuses the render outright when the chart type can't represent the data. What it can't do is tell you the numbers are right; that still needs you. It's one HTTP call from any language. An MCP server exists but isn't published yet, so it's going to beta users on request rather than being something you can install today. I'd love to hear what your agents need charts for.

**Gallery (5 images):**
1. Hero: the JSON in, the chart out, and the QA panel beside it
2. A 9-slice pie with a QA warning, then the fixed bar chart
3. Response JSON with the alt text highlighted
4. A refused render: the pie with negative values and the error that comes back instead of a chart
5. Pricing

---

## X / Twitter thread

1/ Your AI agent can write a report. Can it make a chart you'd actually send to a customer?

I built ChartRelay: a chart API designed for agents. JSON in; PNG, SVG, alt text, and a quality review out. 🧵

2/ The usual approach is having the model write matplotlib. It works… until the output changes on every run, the legend has 12 lines, and nobody wrote alt text.

3/ ChartRelay uses a small schema (5 chart types), so there's little for a model to get wrong, and the same input gives the same chart every time.

4/ Every render includes a QA review:
• too many pie slices → "group the rest as Other"
• 9 series → "highlight what matters"
• low-contrast colors, crowded labels, missing title

5/ And some charts don't come back at all. A pie with negative values, or a pie comparing several series, is refused instead of stored — there's no URL for the agent to paste.

6/ The value axis always includes zero. Your agent can't produce the truncated-axis chart that turns +2% into a cliff.

7/ What it does not do: check your data. Structure is enforced, correctness isn't. A chart that passes every rule can still be wrong about the business.

8/ It's one POST from any language. (There's an MCP server as well, but it isn't published yet — beta users get it on request.)

9/ Free to try, no card: chartrelay.dev/playground?ref=x

---

## LinkedIn post

AI agents are writing more reports, and more of those reports have charts nobody checked.

I built ChartRelay to fix that. It's a chart API for agents: send structured data and get back a publish-ready PNG or SVG, an accessible text description, and a structural review that flags unreadable choices before a customer sees them.

A few design choices I'm proud of:
→ The same input always produces the same chart
→ The value axis always starts at zero, so no accidental exaggeration
→ A chart the type can't honestly represent is refused, not returned as a success
→ Alt text comes with every chart, not as an afterthought

And one thing it deliberately doesn't claim: it can't tell you your numbers are right. It checks the shape of the chart, not the truth of the data.

If your team is building agents that report on data, I'd love your feedback: chartrelay.dev?ref=linkedin

---

## Reddit (r/ClaudeAI, r/LocalLLaMA, r/ChatGPTCoding) — BLOCKED until the package is published

The original draft was an MCP-server announcement with an `npx` config block in it. The package is unpublished and the repository is private, so that post would send a subreddit of developers after something none of them can install. It is not a wording problem and there is no honest edit of it. **Do not post this until `@chartrelay/mcp` is on npm.**

The version below leads with the API instead, which is real today. It is a weaker post, and that is the accurate trade.

Tailor the first line to each subreddit. Follow each subreddit's self-promotion rules; some require a flair or a weekly thread.

**Title:** I built a chart API for agents — alt text on every render, and it refuses the charts that can't be read honestly

**Body:**
Every agent I build ends up needing charts, and having the model write plotting code kept producing inconsistent, sometimes misleading results. So I built a small chart API:

- The model fills a small JSON spec (bar, line, area, pie, scatter)
- It gets back a PNG/SVG URL, alt text, and structural findings
- If a finding is a warning (say, a pie with 9 slices), the chart still renders and the model can revise and re-render on its own
- If the chart type genuinely can't represent the data (a pie with negative values), the request is refused and nothing is stored

It's one POST from any language, and there's a free tier. What it does not do is check your data — it reads the chart spec, not your source system.

An MCP wrapper exists but is not published yet, so I'm not linking a config you can't use. If you want it before it ships, the contact address on https://chartrelay.dev/support reaches me.

I'm the builder, and I'm happy to answer questions or take feature requests.

---

## MCP directory listing (PulseMCP, mcpservers.org, Smithery, Glama) — BLOCKED until the package is published

A directory listing's entire purpose is the install line, and there is no install line: `@chartrelay/mcp` is not on npm and the repository is private. Submitting this now means a listing whose one call to action fails for every reader. **Do not submit until publication**, at which point the copy below is accurate as written.

**Name:** ChartRelay
**Short description:** Render publish-ready charts (PNG/SVG) from JSON, with alt text and chart-quality review built in.
**Long description:** ChartRelay gives agents one tool, `render_chart`, that turns a small, validated JSON spec into a deterministic chart. Each result includes durable PNG and SVG URLs, an accessibility summary, and QA findings with suggested fixes, so the agent can improve its own charts. Charts the type cannot honestly represent are refused rather than returned. Supports bar, line, area, pie, and scatter charts. Requires a free ChartRelay API key.
**Category:** Data visualization
**Install:** `npx -y @chartrelay/mcp` with `CHARTRELAY_API_KEY` — valid only once the package is published; today there is nothing for npx to fetch.
