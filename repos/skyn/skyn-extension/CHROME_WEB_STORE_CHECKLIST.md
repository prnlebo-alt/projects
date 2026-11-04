# Chrome Web Store Checklist

Before submission:

- Run `npm run build`.
- Run `npm run lint`.
- Load `dist/` unpacked in Chrome.
- Test Claude, ChatGPT, and Gemini.
- Replace placeholder icons with final production icons.
- Capture store screenshots from the popup and supported sites.
- Confirm `https://skyn.app/api` endpoints are live.
- Confirm checkout redirect and purchase verification work in production mode.
- Publish privacy policy at the public Skyn domain.

Current permissions:

- `storage`
- `activeTab`
- `scripting`

Current host permissions:

- `https://claude.ai/*`
- `https://chat.openai.com/*`
- `https://gemini.google.com/*`
- `https://skyn.app/*`

Do not add broad host permissions. Chrome reviewers will punish that.
