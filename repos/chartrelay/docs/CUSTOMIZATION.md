# Customization

Brand tokens and responsive layout live in `src/app/globals.css`. Change the `:root` colors first; the public site, playground, dashboard, docs, and pricing inherit them.

Chart colors and validation rules live in `src/lib/charts/schema.ts`. Rendering geometry lives in `src/lib/charts/render.ts`. Quality rules are intentionally separate in `src/lib/charts/qa.ts`, so new rules can be tested without touching rendering.

Plan quotas live in `src/lib/usage/limits.ts`. Displayed prices live in `src/app/pricing/page.tsx` and the Free-plan copy in `src/lib/billing/status.ts`. Stripe price identifiers come from environment variables, and webhooks map a subscription's price back to a plan in `src/lib/billing/stripe.ts`. Keep all of these synchronized.

The API contract is documented in `src/app/docs/page.tsx`. When the schema changes, update validation, tests, and docs in the same change.
