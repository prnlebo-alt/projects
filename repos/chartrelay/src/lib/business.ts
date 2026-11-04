/**
 * Who this business is, in public.
 *
 * The postal address lives in an environment variable and nowhere else — not in the repository, not in
 * a page, not in a commit. The owner runs this company from home, and a home address published on a
 * terms page is permanent: it is scraped, mirrored and archived within days, and no later edit takes
 * it back. The variable is meant to hold a virtual-mailbox address, and until one exists the pages
 * render without an address line rather than with the wrong one.
 *
 * Deliberately not a default. A fallback string here would be a placeholder that eventually ships,
 * which is the failure this whole file exists to prevent.
 */

type Env = Record<string, string | undefined>;

/** The registered name. Not configurable: a legal entity's name is not a deployment setting. */
export const LEGAL_NAME = "MadPugExperiment LLC";

/**
 * The name the business goes by in public.
 *
 * Separate from LEGAL_NAME on purpose. A brand belongs on a receipt, a footer and an about line; the
 * registered entity belongs anywhere a reader is being told who they are contracting with, because a
 * brand name in a terms page is what a dispute gets argued over later.
 */
export const DISPLAY_NAME = "MPE Labs";

/**
 * The registered fictitious name, once there is one.
 *
 * Florida requires a Fictitious Name Registration (§865.09) before a business trades under anything
 * other than its registered name. Until that filing exists this stays unset and the legal pages name
 * the LLC alone — asserting an unregistered "doing business as" on a legal page is a claim the state
 * has not agreed to, which is exactly the sort of thing those pages must not do.
 */
export function registeredDba(env: Env = process.env): string | null {
  return env.LEGAL_DBA?.trim() || null;
}

/** How the entity is named in a contract: the LLC, plus its fictitious name only once registered. */
export function contractingParty(env: Env = process.env): string {
  const dba = registeredDba(env);
  return dba ? `${LEGAL_NAME}, doing business as ${dba}` : LEGAL_NAME;
}

/** Where a person reaches a human. Falls back to the domain's own address rather than going blank. */
export function supportEmail(env: Env = process.env): string {
  return env.SUPPORT_EMAIL?.trim() || "support@chartrelay.dev";
}

/**
 * The published postal address, or null when none is configured.
 *
 * Callers must handle null by omitting the address entirely. Rendering "Address: not set", or a
 * placeholder in brackets, is worse than rendering nothing: it reads as an unfinished site to a
 * customer and as an unanswered question to a procurement reviewer.
 */
export function postalAddress(env: Env = process.env): string | null {
  const value = env.BUSINESS_POSTAL_ADDRESS?.trim();
  return value ? value : null;
}

/** True once there is an address that a marketing email is legally allowed to carry. */
export const hasPostalAddress = (env: Env = process.env): boolean => postalAddress(env) !== null;

/**
 * The identity block a legal page or an email footer prints.
 *
 * One function so the two surfaces cannot disagree about what this company is called or how it is
 * reached — a terms page naming one entity and a receipt naming another is the kind of mismatch a
 * chargeback dispute is decided on.
 */
export function businessIdentity(env: Env = process.env): { legalName: string; email: string; address: string | null; lines: string[] } {
  const address = postalAddress(env);
  return {
    legalName: LEGAL_NAME,
    email: supportEmail(env),
    address,
    lines: [LEGAL_NAME, ...(address ? [address] : []), supportEmail(env)],
  };
}

/**
 * Named subprocessors, listed because a privacy policy that omits one is wrong rather than brief.
 *
 * Kept in code rather than prose so the privacy page and any future DPA read the same list. Anything
 * that receives a visitor's IP address belongs here, including a font or asset host — this deployment
 * serves its own fonts from the container, which is why none is listed.
 */
export const SUBPROCESSORS = [
  { name: "Railway", purpose: "hosts the application servers and the database" },
  { name: "Resend", purpose: "delivers account email such as confirmations and password resets" },
  { name: "Stripe", purpose: "processes payments and stores billing details" },
] as const;

/**
 * The date the published terms took effect, or null before there is one.
 *
 * Unset until launch, and the line is omitted rather than printed with a placeholder in it: a legal
 * document displaying "[EFFECTIVE DATE]" tells a reader it was never finished, which is worse than a
 * document that simply does not claim a date yet.
 */
export function effectiveDate(env: Env = process.env): string | null {
  return env.LEGAL_EFFECTIVE_DATE?.trim() || null;
}

/**
 * The state whose law governs the terms, or null when it has not been decided.
 *
 * A governing-law clause naming no state is unenforceable as written, so the clause is left out
 * entirely until there is an answer. That is a weaker contract, and it is an honest one.
 */
export function governingLawState(env: Env = process.env): string | null {
  return env.LEGAL_GOVERNING_STATE?.trim() || null;
}
