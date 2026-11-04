/**
 * The one name the API key's environment variable has.
 *
 * It lives in a module of its own because the surfaces that print it are a mix of server and client
 * components: the dashboard quickstart and /docs read request headers, while the studio runs in the
 * browser. Importing the constant from the server component dragged `next/headers` into the client
 * bundle and broke the build — a single shared constant should not decide where a component may run.
 *
 * Keeping it in one place is not tidiness. The landing page and /compare once exported a different
 * name here, so the two most-visited snippets on the site told people to set a variable nothing reads;
 * tests/docs-consistency.test.ts now fails on any other spelling anywhere under src/.
 */
export const KEY_ENV_VAR = "CHARTRELAY_API_KEY";

/** How the key is written inside a shell snippet. */
export const QUICKSTART_KEY_PLACEHOLDER = `$${KEY_ENV_VAR}`;
