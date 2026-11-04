/**
 * Landing page kit — shared building blocks for the marketing routes.
 *
 * Import from the barrel:
 *   import { LandingHero, Section, SectionHead, FeatureGrid, Steps, ComparisonTable, CodeCard, Callout, FaqList, CtaBand } from "@/components/landing";
 *
 * All of these are server components: do NOT add "use client" to a page just to use them.
 * They render plain markup on top of the .lp-* classes at the end of src/app/globals.css,
 * so they follow the existing tokens (:root), .button, .eyebrow and .code-card styles and
 * work down to 375px. Typical page shape:
 *
 *   <main>
 *     <LandingHero ... />
 *     <Section id="how"><SectionHead title="..." /><Steps items={...} /></Section>
 *     <CtaBand ... />
 *     <Footer />
 *   </main>
 *
 * Headings: LandingHero renders the page's only <h1>. SectionHead and CtaBand render <h2> by
 * default, FeatureGrid / Steps / FaqList render <h3>. Pass `headingLevel` to keep the outline
 * in order when you nest blocks; never skip a level.
 *
 * Props (all `children`/ReactNode props accept strings or JSX; `?` = optional):
 *
 *   LandingHero    { eyebrow?, title, subtitle?, actions?, note?, children? }
 *                  title is the h1 (wrap part in <span> to tint it accent); actions is a CTA row of
 *                  <Link className="button"> / <Link className="button button-ghost">; note is the small
 *                  line under the CTAs; children renders framed media, e.g. <ChartPreview svg={...} />.
 *   Section        { id?, tint?, className?, "aria-label"?, children }  tint = full-bleed grey band.
 *   SectionHead    { eyebrow?, title, body?, center?, headingLevel? = 2, headingId?, children? }
 *   FeatureGrid    { items: { icon?, title, body }[], columns? = 3 (2 | 3), headingLevel? = 3, children? }
 *                  icon is a short glyph or number like "01"; it is aria-hidden.
 *   Steps          { items: { title, body }[], headingLevel? = 3 }  numbers come from a CSS counter.
 *   ComparisonTable{ columns: ReactNode[], rows: { label, cells: ReactNode[] }[], caption, rowHeader?, footnote? }
 *                  caption is visible AND the accessible name; date every competitor claim in it.
 *                  cells.length must match columns.length.
 *   CodeCard       { label, code: string, caption? }  code is rendered verbatim inside <pre><code>.
 *   Callout        { tone? = "accent" | "warn", title?, children }
 *   FaqList        { items: { question, answer }[], headingLevel? = 3 }  answers are always visible, no JS.
 *   CtaBand        { eyebrow?, title, body?, actions?, note?, headingLevel? = 2, id? }
 *                  inside the dark band .button turns white and .button-ghost turns outlined-on-dark.
 *
 * Extra classes you can use directly: .lp-hero-note, .lp-cta-note, .lp-code-caption, .lp-table-note,
 * .lp-card (a bare card), .lp-center (centres a .lp-section-head), .lp-visually-hidden.
 *
 * Content rules still apply: no testimonials, logos, user counts or invented benchmarks, and every
 * competitor line must be conservative, sourced and dated.
 */

export { LandingHero, type LandingHeroProps } from "./landing-hero";
export { Section, SectionHead, type SectionProps, type SectionHeadProps } from "./section";
export { FeatureGrid, type FeatureGridProps, type FeatureItem } from "./feature-grid";
export { Steps, type StepsProps, type StepItem } from "./steps";
export { ComparisonTable, type ComparisonTableProps, type ComparisonRow } from "./comparison-table";
export { CodeCard, type CodeCardProps } from "./code-card";
export { Callout, type CalloutProps } from "./callout";
export { FaqList, type FaqListProps, type FaqItem } from "./faq-list";
export { CtaBand, type CtaBandProps } from "./cta-band";
export { headingTag, type HeadingLevel } from "./heading";
