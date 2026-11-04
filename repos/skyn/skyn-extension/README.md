# Skyn

Skyn is a Manifest V3 Chrome extension that applies CSS-only skins to supported AI assistant websites.

Supported v1 target:

- `claude.ai`

ChatGPT (`chat.openai.com`, `chatgpt.com`) and Gemini (`gemini.google.com`) are V2 scope. Selector accuracy on those platforms is unverified and out of scope until v1 ships. See `docs/skyn-session-state.md` for details.

Skyn does not read conversations, inspect input values, listen for keyboard events, or access cookies/site storage on target domains.

## Build

```bash
npm install
npm run build
npm run lint
```

The built extension lives in `dist/`.

## Manual Test

Open `chrome://extensions`, enable Developer Mode, choose Load unpacked, and select `dist/`.

Then test on Claude.ai:

- The extension popup opens.
- Free skins apply.
- Skin changes update the active page.
- Unsupported tabs show an unsupported-page message.
- Background uploads stay local.
- Locked skins open checkout through the service worker.

For the Mecha-specific verification walkthrough, see `docs/MECHA-V1-VERIFICATION.md`. For the full v1 manual test sweep, see `docs/MANUAL_TEST_CHECKLIST.md`.

## Security Guardrail

`npm run lint` also runs `scripts/check-content-security.mjs`.

That script fails if content scripts attempt to read page text, input values, selected text, cookies, localStorage, sessionStorage, keyboard events, clipboard events, or input events.
