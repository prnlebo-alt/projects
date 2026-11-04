# Skyn dev setup

## Chrome DevTools MCP (browser inspection from Claude Code)

Lets a Claude Code session navigate Chrome, inspect DOM, run JS in the page
console, and capture screenshots — instead of asking the human to manually
paste console output, drag files, or take screenshots. Used during Skyn skin
development to verify Mecha (and future skins) against live Claude.ai DOM.

### What's installed

- **Server:** `chrome-devtools-mcp` — official Google Chrome team MCP, npm
  package `chrome-devtools-mcp`.
- **Scope:** local (this project only). Recorded in
  `~/.claude.json` under `project: /Users/jessicasalgado/Projects/skyn/skyn-extension`.
- **Install date:** 2026-05-10.

### Install command (verified)

Run from the Skyn project directory:

```bash
cd ~/Projects/skyn/skyn-extension
claude mcp add chrome-devtools npx chrome-devtools-mcp@latest
```

Default scope (local) means the MCP is only available when working in this
project directory. To switch to user-wide later, re-add with `--scope user`.
To check it into the repo so other contributors get it on clone, re-add with
`--scope project` (writes to `.mcp.json`).

### Verify install

```bash
claude mcp list
```

Expected output includes `chrome-devtools: npx chrome-devtools-mcp@latest - ✓ Connected`.

### IMPORTANT: tools are not callable until Claude Code restart

Adding an MCP via `claude mcp add` registers the server with the daemon, but
its tools (`navigate_page`, `evaluate_script`, `take_screenshot`, etc.) are
not loaded into already-running Claude Code sessions. After install, **restart
Claude Code** before attempting to use the MCP from a session.

In the new session, the tools surface under the namespace exposed by the MCP
(typically discoverable via `ToolSearch` or by listing available tools).

### Smoke test

In a freshly-restarted Claude Code session inside this project:

```
Open https://claude.ai/chat/<some-existing-thread-id> via the MCP. Read
document.documentElement.dataset.mode and
document.documentElement.dataset.theme. Report both values.
```

Pass: returns `mode: dark` (or light) and `theme: claude`. Confirms
navigation + DOM query both work.

Fail and what it means:

- **"Tool not found"** — restart didn't load the MCP. Check `claude mcp list`
  is still ✓ Connected; if not, reinstall.
- **`Target closed` / Chrome fails to start** — existing Chrome instance is
  blocking debug port 9222. Close all Chrome windows and retry.
- **`Permission denied`** on macOS — Seatbelt sandboxing. Grant the MCP
  permission via System Settings → Privacy & Security, OR launch your own
  Chrome with `--remote-debugging-port=9222` and tell the MCP to attach
  via `--browser-url http://127.0.0.1:9222`.
- **`ERR_MODULE_NOT_FOUND`** — Node < 20.19. Current machine is on Node
  24.15.0 (verified at install), so this should not occur unless the user
  downgrades Node.

### URL allowlisting / domain scoping

`chrome-devtools-mcp` **does not currently support built-in URL allowlisting**
(tracking: [Issue #239](https://github.com/ChromeDevTools/chrome-devtools-mcp/issues/239)).
The MCP can navigate Chrome to any URL it's instructed to.

**Current discipline:** Skyn-related sessions should constrain the MCP to
`claude.ai` via prompt instruction. Example: "Only navigate to claude.ai
URLs. Do not navigate to other origins."

### Extending to other platforms (V2)

When Skyn adds support for ChatGPT and Gemini (V2 ambition, not V1):

1. No reinstall needed — `chrome-devtools-mcp` already navigates to any
   URL.
2. Update prompt templates / session state docs to allow:
   - `chatgpt.com`
   - `chat.openai.com`
   - `gemini.google.com`
3. If/when Issue #239 ships URL allowlisting, switch from prompt discipline
   to a config flag for hard enforcement. Re-document here.

### Uninstall (if needed)

```bash
claude mcp remove chrome-devtools
```

Removes from local config. Verify with `claude mcp list`.

## Environment baseline (recorded 2026-05-10)

| Tool | Version |
|---|---|
| Claude Code | 2.1.126 |
| Node | 24.15.0 |
| npm | 11.13.0 |
| Platform | macOS (Darwin 25.2.0) |

If the MCP starts misbehaving and these have drifted significantly, that's
the first thing to check.
