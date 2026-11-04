# Project Plant

**Self-Healing Identity Platform — Master Index**
Last updated: 2026-05-13

---

## What this is

A browser extension engine that identifies UI elements using semantic fingerprinting (the "Genetic Scorer") and applies managed UI skins without ever reading user input content. Delivered as:

- **Door A:** Chrome/Firefox extension for solo users
- **Door B:** Single `<script>` tag injection for B2B clients (primary focus)

---

## Folder Structure

```
project-plant/
├── README.md                  ← You are here
├── docs/
│   ├── DATA_FLOW.md           ← Zero-knowledge architecture (source of truth)
│   ├── LEGAL_NOTES.md         ← ToS exposure, trademark boundaries
│   └── DECISIONS.md           ← Locked architectural decisions
├── extension/
│   ├── content/               ← content.js (Genetic Scorer, CSS writer)
│   ├── background/            ← service worker (MV3)
│   └── assets/                ← manifest.json, icons
├── b2b-injection/             ← Single-line script engine
├── legal/                     ← Attorney consult notes, ToS references
└── whitepaper/                ← IT Admin / enterprise security package
```

---

## Current Status

| Track | Status | Next action |
|---|---|---|
| Data Flow Document | ✅ Complete | Move to whitepaper |
| Genetic Scorer spec | ✅ Architected | Write `content.js` |
| Zero-knowledge audit | ✅ Defined | Third-party review |
| B2B injection engine | 🔲 Not started | Architect after scorer |
| Legal consult | 🔲 Not started | Book before prod code |
| 90s shop POC | 🔲 Not started | First B2B pilot |

---

## Locked Constraints

- Extension reads ONLY: `role`, `tagName`, `contenteditable`, `aria-label`, `getBoundingClientRect()`
- Extension NEVER reads: `value`, `innerText`, `textContent` on any input element
- Remote server returns attributes only — no executable code (MV3 compliant)
- Permissions: `activeTab`, `storage`, host_permissions scoped to selector endpoint only
- No `tabs`, no `history`, no `webNavigation` requested

---

## The Pilot

**Client:** 90s music shop (friend's store)
**Goal:** Prove the B2B injection script skins a third-party site with zero dev involvement after initial `<script>` tag install
**Success metric:** Skin survives a Shopify theme update without manual intervention
