/**
 * Support contact configuration.
 *
 * No support address is baked into the code or the copy: it is read from SUPPORT_EMAIL at
 * request time. Every helper degrades instead of throwing, because /support has to render
 * honestly when the channel is not configured yet — an explicit "being set up" note is better
 * than a placeholder address or a mailto link that goes nowhere.
 */

type Env = Record<string, string | undefined>;

/**
 * Deliberately stricter than RFC 5322. It exists to answer one question — is this safe to put
 * in front of a customer as a mailto: link — so it rejects anything with URL-significant
 * characters (%, ?, &, #, /) or whitespace rather than trying to accept every legal address.
 */
const ADDRESS_PATTERN = /^[a-z0-9._+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
const MAX_ADDRESS_LENGTH = 254;
const MAX_RESPONSE_LENGTH = 80;
const MAX_SUBJECT_LENGTH = 120;

/** Shown when SUPPORT_RESPONSE_HOURS is unset or unusable. */
export const DEFAULT_SUPPORT_RESPONSE = "2 business days";

/** The configured support address, trimmed and validated, or null when there is no usable one. */
export function supportEmail(env: Env = process.env): string | null {
  const value = (env.SUPPORT_EMAIL ?? "").trim();
  if (!value || value.length > MAX_ADDRESS_LENGTH || !ADDRESS_PATTERN.test(value)) return null;
  return value;
}

/**
 * The response-time expectation to print, e.g. "2 business days" or "24 hours".
 * SUPPORT_RESPONSE_HOURS may be a bare number of hours or a ready-made phrase; anything empty,
 * zero or implausibly long falls back to the default rather than printing nonsense.
 */
export function supportResponseTime(env: Env = process.env): string {
  const raw = (env.SUPPORT_RESPONSE_HOURS ?? "").trim().replace(/\s+/g, " ");
  if (!raw || raw.length > MAX_RESPONSE_LENGTH) return DEFAULT_SUPPORT_RESPONSE;
  if (/^\d+$/.test(raw)) {
    const hours = Number(raw);
    if (hours < 1) return DEFAULT_SUPPORT_RESPONSE;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return raw;
}

/**
 * A mailto: URL for the configured address with the subject pre-filled, or null when there is
 * no configured address — callers must render a non-link fallback for that case.
 */
export function supportMailto(subject: string, env: Env = process.env): string | null {
  const address = supportEmail(env);
  if (!address) return null;
  const cleaned = subject.replace(/\s+/g, " ").trim().slice(0, MAX_SUBJECT_LENGTH).trim();
  return cleaned ? `mailto:${address}?subject=${encodeURIComponent(cleaned)}` : `mailto:${address}`;
}
