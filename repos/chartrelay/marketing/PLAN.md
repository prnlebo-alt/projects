# ChartRelay go-to-market plan (first 60 days)

Constraints: $0 budget, owner time 1–3 hours/week. Claude drafts and builds; the owner reviews, posts, and replies.

**Do not launch publicly until:** local test-mode billing passes, the app is deployed with a real domain, and a full test-mode Checkout has succeeded on the deployed site. Everything in Weeks 0–2 can be prepared now.

## 1. Who it's for

**First paying customer:** a developer building an AI agent or LLM feature whose output includes charts: weekly report bots, analytics copilots, "summarize this CSV" features, and internal agents that post into Slack or email.

Their problems, in their words:
- "The model writes chart code and it breaks half the time." (Matplotlib and Chart.js code generation is flaky, and each run looks different.)
- "I need a PNG I can drop into Slack or email, not a React component."
- "I can't review every chart the agent makes, and some of them are embarrassing." (Nine-slice pies, twelve-line spaghetti charts, unreadable colors.)
- "Accessibility review flags every chart image for missing alt text."

**Not the first customer:** analysts wanting a charting UI (use Datawrapper), anyone needing 25+ chart types or maps (use AntV or Vega), or high-volume teams optimizing only for price (QuickChart is cheaper at volume).

## 2. Positioning

**Category:** a chart API for AI agents.

**One-liner:** ChartRelay turns agent-generated JSON into a finished chart, with PNG, SVG, alt text, and a quality check, in one call.

**Why us, not the alternatives:**

| | ChartRelay | QuickChart | AntV MCP server | Model writes plotting code |
|---|---|---|---|---|
| Input an LLM gets right reliably | Small, strict JSON schema with validation errors that say what to fix | Full Chart.js config (large surface) | AntV spec | Arbitrary code |
| Same input → same image | Yes | Yes | Yes | No |
| Alt text in every response | Yes | No | No | No |
| Flags bad chart choices before publishing | Yes (7 structural checks) | No | No | No |
| Value axis always includes zero | Yes, by design | Configurable per chart | Configurable per chart | Depends on the generated code |
| Durable PNG/SVG URLs | Yes | Yes (short URLs) | Varies | No |
| Free tier | 250 renders/mo (0 until email confirmed) | 10,000 images/mo | Free (self-host) | Free |
| Paid | $19 Developer (5k), $59 Pro (25k), $149 Business (100k), $10 pack (2k, one-time) | $40 unlimited | — | — |

**Honest framing:** we don't win on chart variety or price per render. We win when a chart goes out without a human looking at it first. The QA check flags *structural* problems; it does not verify that the data is true, so never claim it does.

**Messaging pillars:**
1. **Reliable for agents:** a schema small enough that models fill it correctly, validation errors the agent can act on, and deterministic output.
2. **Publish-ready:** PNG for Slack and email, SVG for the web, alt text included.
3. **A second pair of eyes:** every render comes with QA findings and a suggested fix, so your agent can self-correct before a human sees the chart.
4. **Honest by construction:** the value axis always includes zero, so an agent can't produce the classic truncated-axis chart that exaggerates a change.

## 3. Pricing risk to decide on

**Superseded 2026-10-08 by `docs/BILLING_SPEC.md`: free is 250 renders/month, and 0 until the email is confirmed.** The earlier decision (2026-09-22: free is 1,000/month, up from 100, because agent builders test in loops) was made when renders were treated as nearly free and the free tier was the acquisition lever. The spec reverses that: a free tier of 250 with verification required is the abuse control, and the acquisition lever is now the playground, which needs no account at all.

This is a real cut to what the site promised, so the copy has to carry it rather than bury it: the pricing page no longer advertises unlimited charts by URL on every tier, and `/pricing`, `/integrations`, `/docs` and `/studio` now say that a URL render is not metered *as the endpoint stands today* instead of promising it never will be. Whether `GET /chart` itself gets metered is still the owner's open decision.

Watch after launch: whether 250 is enough to let a builder finish a first integration, and whether $10/2,000 packs are being bought repeatedly instead of converting to the $19 plan (that is the signal the pack is priced wrong, not that the plan is).

## 4. Channels (zero budget, ranked by expected return)

1. **MCP server + directories:** publish `@chartrelay/mcp` to npm and list it on the official MCP Registry, PulseMCP, mcpservers.org, Smithery, and Glama. Agent builders browse these when adding tools. One-time effort, then it keeps bringing people in.
2. **Show HN:** one post, on a weekday morning US time, with a live playground link (no signup). Owner must be available about 2 hours afterward to reply.
3. **Agent-builder communities:** r/LocalLLaMA, r/ClaudeAI, r/ChatGPTCoding, and relevant Discords (LangChain, Vercel AI SDK, MCP). One genuine post per community, framed as "I built this, here's what I learned." No spam.
4. **Product Hunt:** secondary. Schedule it two weeks after Show HN and reuse the assets.
5. **Content that keeps pulling in search traffic** (Claude drafts, owner approves):
   - "Why your AI agent's charts look bad (and 7 checks that fix it)." Uses the real QA rules.
   - "Give Claude/ChatGPT the ability to make charts in 5 minutes (MCP)."
   - "ChartRelay vs QuickChart vs AntV for AI agents": a fair comparison page on the site.
6. **Integrations as distribution (later):** example repos for the Vercel AI SDK, LangChain, and OpenAI and Anthropic tool use. Each one is a landing page and a GitHub search result.

Skip for now: paid ads, cold email, and newsletter sponsorships, since there's no budget and no conversion data yet.

## 5. 60-day calendar (owner time in brackets)

| Week | Claude | Owner |
|---|---|---|
| 0 (now) | Plan, launch copy, MCP server; Free raised to 1,000 | Review this plan [30 min] |
| 1 | Finish billing test; deploy; homepage copy refresh; comparison page | Add Stripe key; approve the deploy [30 min] |
| 2 | Publish MCP package; directory submissions drafted | Create npm account/org if needed; submit listings [1 h] |
| 3 | Show HN post final; demo GIF | Post Show HN; reply to comments [2–3 h] |
| 4 | First article; community posts drafted per subreddit | Post 2 community threads [1 h] |
| 5–6 | Product Hunt assets; second article; integration example repo | Launch on PH; reply [2 h] |
| 7–8 | Review metrics; iterate on onboarding based on what signups did | Review numbers with Claude [30 min] |

## 6. What to measure

Set up before launch (no paid tools needed; start with SQL on the SQLite DB):
- Signups per week, and signups by source (add `?ref=` on each channel link).
- **Activation:** the share of signups who make 1+ authenticated render within 24 hours. This is the most important early number.
- Week-2 retention: workspaces rendering in their second week.
- Free→paid conversions and MRR.
- MCP package weekly downloads (npm).

Targets for day 60 (rough, for a solo zero-budget launch): 150 signups, 40% activation, 5 paying workspaces. If activation is under 20%, fix onboarding before spending more time on promotion.

## 7. Product gaps that would help marketing

- An `/api/v1/charts/check` endpoint that runs QA without rendering or counting usage. It would power a free public "chart checker" tool (search traffic and shareable) and a `check_chart` MCP tool.
- Share links for playground charts, so posts can link to a live example.
