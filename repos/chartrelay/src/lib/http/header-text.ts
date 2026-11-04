/**
 * Putting caller-supplied text into a response header without breaking the response.
 *
 * An HTTP header value is a ByteString: every character has to fit in one byte. `new Headers()` throws
 * a TypeError on anything above U+00FF, and a throw inside a route handler is a 500 with an empty body
 * — which, for a product whose whole premise is an `<img src>`, is a broken-image icon. Every chart
 * whose title, labels or series names contained a single character above U+00FF failed exactly this
 * way: Japanese, Korean, Arabic, Cyrillic, Greek, emoji, an em dash, a euro sign, or the ó in Łódź.
 *
 * Carriage returns and newlines are the other half of the same problem. They are inside the byte range
 * but they terminate a header, so a value carrying one is either rejected or — on a naive writer —
 * splits the response.
 *
 * A value that fits in Latin-1 is sent untouched. One that does not is omitted and re-sent in its RFC 8187
 * extended form under the same name with a star, which is the mechanism the web already has for this.
 */

/** Latin-1. Every codepoint here fits in one byte, which is what an HTTP header value may carry. */
const LATIN1 = /^[\x20-\x7E\xA0-\xFF]*$/;

/** True when the value can be sent as it is, encoded as Latin-1. CR and LF are excluded: they end a header. */
export const isSendable = (value: string): boolean => LATIN1.test(value);

/**
 * RFC 8187 extended value: `UTF-8''` followed by percent-encoded UTF-8.
 *
 * The standard already solved this, and the first attempt here reinvented it badly — percent-encoding the
 * ordinary header in place, which turned "200.0%" into "200.0%25" and "Café" into "Caf%C3%A9" for callers
 * who had been reading both correctly. Those failures are the dangerous kind: they look close enough to
 * right to ship.
 */
export function encodeExtended(value: string): string {
  const encoder = new TextEncoder();
  let out = "";
  for (const character of value) {
    // attr-char from RFC 8187. Iterating the string rather than its code units keeps an emoji whole, so it
    // encodes to its real four bytes instead of two lone surrogates.
    if (/^[A-Za-z0-9!#$&+^_`|~.-]$/.test(character)) {
      out += character;
      continue;
    }
    for (const byte of encoder.encode(character)) {
      out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
    }
  }
  return `UTF-8''${out}`;
}

/**
 * Makes a set of headers safe to send.
 *
 * A value that fits in Latin-1 goes out untouched, so every caller reading these today keeps reading them.
 * A value that does not is **omitted** rather than mangled, and its RFC 8187 form is sent under the same
 * name with a star — `x-chartrelay-alt*`. Absence is actionable; plausible corruption is not, and a caller
 * who sees no `x-chartrelay-alt` at all knows to look for the extended form.
 *
 * Applied to every header the route sets rather than to the one known to carry user text, because the next
 * header that carries some would otherwise reintroduce the 500 this exists to prevent.
 */
export function safeHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    // A newline ends a header wherever it appears, so it is stripped before anything else looks at the value.
    const flat = value.replace(/[\r\n]+/g, " ");
    if (isSendable(flat)) {
      out[name] = flat;
      continue;
    }
    out[`${name}*`] = encodeExtended(flat);
  }
  return out;
}
