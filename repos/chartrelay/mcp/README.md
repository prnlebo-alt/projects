# @chartrelay/mcp

An MCP server that lets Claude, ChatGPT, and any MCP client make publish-ready charts with [ChartRelay](https://chartrelay.dev).

The main tool, `render_chart`, turns a small JSON spec into a chart and returns:

- durable **PNG and SVG URLs** (PNG for chat, email, and Slack; SVG for the web)
- **alt text** describing what the chart shows
- a **quality review** with suggested fixes (too many pie slices, crowded charts, low contrast, missing title…), so the agent can revise and re-render
- an inline PNG preview, so the model can see its chart

Chart types: bar, line, area, pie, scatter. The value axis always includes zero. Every type places points on a categorical axis by label; scatter has no numeric x-axis.

## When a chart is refused

Findings with severity `error` are contract violations, not advice: a pie of negative values, or a pie holding several series, cannot show the data it was given. ChartRelay refuses to store such a chart (HTTP 422) — nothing is saved and nothing is counted against your quota — and this server returns the whole refusal rather than the status code: every blocking finding with its code, message and suggested fix, any non-blocking findings alongside it, and the two ways forward. The model either applies the fixes and calls `render_chart` again, or keeps the chart as it is by calling `render_chart` again with `allowQualityErrors: true`, which stores it despite the findings and counts as one render. Both are a single tool call.

## Availability

**This package is not published to npm, and the repository it lives in is private.** There is no `npx -y @chartrelay/mcp` that resolves, and nothing to clone. If you are reading this file, you already have the server — it was shared with you directly as a beta user, and the next section is how to run the copy you have.

If you do not have it and want it, ask through the contact address on <https://chartrelay.dev/support>. The address is not written down here so that it cannot go stale; that page reads it from the running deployment.

You do **not** need this server to use ChartRelay. It is a thin wrapper over one HTTP endpoint: a free key from <https://chartrelay.dev/register> and a `POST /api/v1/charts` gets the same render, alt text and findings from any language, today.

## Running the copy you have

1. Create a free API key at <https://chartrelay.dev/register> and copy it — it is shown once.
2. In this directory, install the dependencies: `npm install`. It needs Node 20 or newer.
3. Point your MCP client at `index.js` by absolute path:

```json
{
  "mcpServers": {
    "chartrelay": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/index.js"],
      "env": { "CHARTRELAY_API_KEY": "cr_live_...", "CHARTRELAY_API_URL": "https://chartrelay.dev" }
    }
  }
}
```

Claude Code: `claude mcp add chartrelay -e CHARTRELAY_API_KEY=cr_live_... -e CHARTRELAY_API_URL=https://chartrelay.dev -- node /absolute/path/to/mcp/index.js`

Set `CHARTRELAY_API_URL` to whichever ChartRelay instance you render against; the built-in default is a placeholder domain, so it is always worth setting explicitly.

## What setup will look like after publication

Distribution is the only thing publication changes. The tool, the spec it takes, the text it returns and the three variables below stay as they are.

```json
{
  "mcpServers": {
    "chartrelay": {
      "command": "npx",
      "args": ["-y", "@chartrelay/mcp"],
      "env": { "CHARTRELAY_API_KEY": "cr_live_..." }
    }
  }
}
```

Claude Code: `claude mcp add chartrelay -e CHARTRELAY_API_KEY=cr_live_... -- npx -y @chartrelay/mcp`

Neither line works today. They are here so the configuration surface can be evaluated before asking for access.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `CHARTRELAY_API_KEY` | (required) | Your ChartRelay API key |
| `CHARTRELAY_API_URL` | `https://chartrelay.example` | API base URL (a placeholder default — set it explicitly) |
| `CHARTRELAY_INCLUDE_IMAGE` | `true` | Set to `false` to skip the inline PNG preview |

Each call counts as one render against your plan's monthly quota.

## Credit tools (0.2.0)

| Tool | Needs scope | What it does |
| --- | --- | --- |
| `estimate_cost` | `render` | Units one render would cost and whether the balance covers it. Renders and spends nothing. |
| `get_credit_balance` | `usage:read` | Credits remaining, live credit grants with expiry, this key's monthly budget. |
| `get_usage` | `usage:read` | Last 30 days: the last week by day, plus spend by key and by format. |
| `get_top_up_link` | `usage:read` | A URL for the human to add credit. The agent never pays. |

When credit runs out, `render_chart` answers with the 402 message, tells the agent not to retry, and includes the top-up URL for the person.
Chart links are now the short form, `/c/{id}.png` and `/c/{id}.svg`.
