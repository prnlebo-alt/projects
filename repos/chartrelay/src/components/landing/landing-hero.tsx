import type { ReactNode } from "react";

export type LandingHeroProps = {
  /** Small uppercase kicker above the headline. */
  eyebrow?: ReactNode;
  /** The page's only <h1>. Wrap part of it in <span> to tint it with the accent color. */
  title: ReactNode;
  /** One or two sentences under the headline. */
  subtitle?: ReactNode;
  /** CTA row: pass <Link className="button"> / <Link className="button button-ghost"> elements. */
  actions?: ReactNode;
  /** Small print under the CTAs (quota, "no card", and so on). Keep every claim verifiable. */
  note?: ReactNode;
  /** Optional media framed below the copy, e.g. <ChartPreview svg={...} />. */
  children?: ReactNode;
};

/** Page hero: eyebrow, h1, sub, CTA row, note, and optional framed media. Server component. */
export function LandingHero({ eyebrow, title, subtitle, actions, note, children }: LandingHeroProps) {
  return (
    <section className="lp-hero">
      <div className="lp-hero-copy">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {subtitle ? <p className="lp-hero-sub">{subtitle}</p> : null}
        {actions ? <div className="lp-hero-actions">{actions}</div> : null}
        {note ? <p className="lp-hero-note">{note}</p> : null}
      </div>
      {children ? <div className="lp-hero-media">{children}</div> : null}
    </section>
  );
}
