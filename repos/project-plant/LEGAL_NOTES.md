# Legal Notes — ToS & Trademark Exposure
**Project Plant · Running document — NOT legal advice**

---

## Status
⚠️ Attorney consult not yet completed. Do not submit to any store or pitch to enterprise until this is done.

---

## Known exposure areas

### 1. Chrome Web Store Developer Policy
- Prohibition on extensions that modify third-party sites in ways the site owner hasn't sanctioned
- "Accessibility tool" framing may help but is not a guaranteed shield
- **Action:** Attorney must review whether the Genetic Scorer's CSS-variable-only approach avoids the "materially modifies" threshold

### 2. Firefox Add-ons Policy
- Similar to Chrome but enforcement is historically slower
- **Action:** Review after Chrome posture is clear

### 3. Platform ToS (individual sites)
- Google (Gemini), OpenAI (ChatGPT), Anthropic (Claude) all prohibit third-party modification of their interfaces
- Marketing must describe the engine capability, NOT specific platforms by name
- **Action:** Store listing, website, and all collateral reviewed against this before publication

### 4. Trademark
**Hard lines — zero exceptions:**
- No use of Google, Gemini, OpenAI, ChatGPT, Anthropic, Claude wordmarks in commercial materials
- No platform logos in screenshots, marketing, or store assets
- "Compatible with" language requires attorney sign-off on nominative fair use applicability

---

## Attorney consult checklist
When booking the consult, bring these specific questions:

1. Does a CSS-variable-only injection that never reads user input content cross the "material modification" threshold in Chrome Web Store policy?
2. Does "accessibility and contrast tool" framing provide any meaningful protection against a platform ToS enforcement action?
3. What is the safe nominative fair use boundary for listing platform compatibility?
4. Does the B2B injection script (client pastes into their own site) create any additional liability vs. the extension?
5. What IP do we own in the Genetic Scorer algorithm?

**Budget:** $500–$1,500 for a 60-minute consult with a tech attorney who has handled extension takedowns specifically.

---

## What the legal posture IS (today)
The strongest defensible position is:
- We never read user content (architectural, not policy)
- We only modify CSS custom properties (paint, not data)
- The client controls whether the script is on their site (B2B consent is explicit)
- We don't use any platform's trademarks

That is real. Build the pitch around that, not around "accessibility law protects us."
