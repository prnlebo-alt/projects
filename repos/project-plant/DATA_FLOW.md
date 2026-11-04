# Data Flow Document — Zero-Knowledge Architecture
**Project Plant · v1.0 · 2026-05-13**

---

## What the extension reads

| Property | API call | Returns | Contains user input? |
|---|---|---|---|
| Role | `el.getAttribute('role')` | String: "textbox", "main" etc. | No |
| Tag | `el.tagName` | String: "TEXTAREA", "DIV" etc. | No |
| State | `el.hasAttribute('contenteditable')` | Boolean | No |
| Aria label | `el.getAttribute('aria-label')` | String: label text only | No |
| Geometry | `el.getBoundingClientRect()` | DOMRect: x, y, width, height | No |

---

## What the extension never reads

The following properties have **no code path** in the extension:

- `element.value`
- `element.innerText`
- `element.textContent`
- `element.innerHTML`
- Any descendant text node content

This is an architectural guarantee, not a policy promise.

---

## Genetic Scorer algorithm

```js
function scoreElement(el) {
  let score = 0;

  // Role (40 points max)
  const role = el.getAttribute('role')?.toLowerCase();
  const tag = el.tagName?.toLowerCase();
  if (role === 'textbox' || role === 'main') score += 40;
  else if (tag === 'textarea') score += 40;
  else if (role === 'searchbox' || role === 'combobox') score += 25;

  // State (30 points max)
  if (el.getAttribute('contenteditable') === 'true') score += 30;
  else if (tag === 'textarea') score += 30;

  // Aria label (20 points max)
  const label = el.getAttribute('aria-label')?.toLowerCase() ?? '';
  if (['message', 'prompt', 'chat'].some(k => label.includes(k))) score += 20;

  // Geometry (10 points max)
  const rect = el.getBoundingClientRect();
  const inBottomThird = rect.top > window.innerHeight * 0.7;
  if (rect.width > 300 && inBottomThird) score += 10;

  return score; // max 100
}
```

Threshold: score ≥ 70 → apply skin. Score < 70 → trigger Healer loop.

---

## Healer loop

Fires only when best-match score falls below 70%.

1. GET request to `/selectors.json` endpoint (no body, no user identifiers)
2. Verify payload signature before applying
3. Payload contains attributes only — no executable code (MV3 compliant)
4. Cache result in `chrome.storage.local` with TTL

**What the GET request transmits:** Nothing beyond standard browser headers (User-Agent, Accept). No cookies scoped to user content. No session data.

---

## Local storage

`chrome.storage.local` only. Never `chrome.storage.sync`.

| Key | Value | Contains user data? |
|---|---|---|
| `selectors_cache` | Parsed selectors.json + TTL timestamp | No |
| `theme_preference` | Skin ID string + color token map | No |

---

## Manifest V3 permissions

```json
{
  "permissions": ["activeTab", "storage"],
  "host_permissions": ["https://your-selector-endpoint.com/*"]
}
```

Not requested: `tabs`, `history`, `webNavigation`, `cookies`, `scripting` (broad).

---

## IT whitepaper summary statement

> The Genetic Scorer identifies elements by their structural role and geometry only.
> No code path in the extension reads, stores, or transmits the content of any
> user-facing input field. This is enforced architecturally, not by policy.
> The extension is a paint layer. It does not see what is being typed.
