# Skyn Library

Curated tier-3 skin development. Each skin gets its own subdirectory with the design rationale, technical blueprint, craft principles, and asset reference.

The library is the asset moat. Skins that ship strengthen it. Skins that fail their success metrics get pulled.

---

## Conventions

Each skin directory contains:

- `DESIGN_BIBLE.md` — product vision, wedge strategy, V1 scope, success metrics, monetization
- `BLUEPRINT.md` — technical architecture: stage layer, actor layer, future rendering pipeline
- `<MATERIAL>_PRINCIPLES.md` — craft document covering the failure modes specific to the material
- `stage.jpg` — the pre-rendered backdrop image referenced by the skin's `customCss`
- Any auxiliary assets (texture maps, mascot SVGs, etc.) live alongside

The canonical source for each skin's `customCss` definition is `~/Projects/skyn/skyn-extension/src/shared/skins.ts`. The library is **documentation and assets**, not duplicate skin code.

---

## Skins

| # | Name | Material | Platforms | Status |
|---|------|----------|-----------|--------|
| 1 | [Claude Clay](claude-clay/) | clay | Claude.ai | In development |

---

## Status definitions

- **In development** — actively iterating. Stage may exist; actor recipes still being tuned. Not yet wired into the shipped extension or wired but behind a feature flag.
- **Shipped** — landed in `skyn-extension/src/shared/skins.ts`, available in the popup, passes both success metrics.
- **Paused** — work suspended. Reason captured in the skin's `DESIGN_BIBLE.md` status section.
- **Pulled** — failed a success metric or replaced by a successor skin. Directory retained for reference; removed from extension. Reason documented.
