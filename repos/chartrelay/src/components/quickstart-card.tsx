import Link from "next/link";
import { headers } from "next/headers";
import { CopyButton } from "./quickstart-copy";
import { KEY_ENV_VAR, QUICKSTART_KEY_PLACEHOLDER } from "@/lib/api-key-env";

// Re-exported so the surfaces that already import it from here keep working; the constant itself lives
// in a module with no server-only imports, so a client component can read it too.
export { KEY_ENV_VAR, QUICKSTART_KEY_PLACEHOLDER };

/**
 * Activation card for the dashboard: three steps from "signed up" to "first authenticated render".
 * It is open while the workspace has zero renders and collapses to a done state once one exists.
 * Everything here is server-rendered except the copy button.
 */

/**
 * The environment variable every ChartRelay surface tells a developer to put their key in: the dashboard
 * quickstart, /docs and the MCP server (`mcp/index.js` reads `process.env.CHARTRELAY_API_KEY`). It is
 * exported so there is one spelling to import rather than several to keep in sync by hand;
 * tests/docs-consistency.test.ts fails if a page reintroduces a second name.
 */


/** Never a real key: the example is copied verbatim, so it must carry a shell placeholder. */


/** Anchor on the dashboard's existing API keys section, which owns the one-time reveal flow. */
export const KEYS_ANCHOR = "#api-keys";

/**
 * The one-time-reveal warning, in the words every surface uses. A review of the live product found the
 * full key was returned once by /api/auth/register while the dashboard showed only a prefix, with
 * nothing saying the first response was the only copy — so missing it silently cost you the key. This
 * sentence is the fix, and it has to be the same sentence in the API response, the docs and the dashboard.
 *
 * src/app/api/auth/register/route.ts repeats this string as a literal rather than importing it (a route
 * handler should not pull in a module that reaches client components); tests/docs-consistency.test.ts
 * registers an account and fails if the response's notice is not this exact string.
 */
export const API_KEY_ONE_TIME_NOTICE =
  "This is the only time this API key is shown. ChartRelay stores only a hash of it. If you lose it, create another key from your dashboard — your existing keys keep working until you revoke them.";

/**
 * The exact body POST /api/auth/register accepts. All three fields are required: a review of the live
 * product sent {email, password}, got a 400 and had to retry, because `name` was mandatory and undocumented.
 * tests/docs-consistency.test.ts parses this object with the route's own registrationSchema, so the
 * documented payload cannot drift from the one the route enforces.
 */
export const REGISTRATION_EXAMPLE = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  password: "a long enough password",
};

/** The registration request as a developer would paste it, targeting the origin this deployment answers on. */
export function registrationCurl(origin: string): string {
  const body = JSON.stringify(REGISTRATION_EXAMPLE, null, 2).split("\n").join("\n  ");
  return [
    `curl -X POST ${origin}/api/auth/register \\`,
    `  -H "Content-Type: application/json" \\`,
    `  --data '${body}'`,
  ].join("\n");
}

/** Same default as layout/robots/sitemap: only reached when APP_URL is unset and no Host header arrives. */
const FALLBACK_ORIGIN = "https://chartrelay-production.up.railway.app";

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export type OriginSource = {
  appUrl?: string | null;
  forwardedHost?: string | null;
  host?: string | null;
};

/**
 * The origin the curl example should target, so a copied command works in local dev and in production.
 *
 * APP_URL is the only trusted source. This string is pasted into a shell on the same line as
 * `Authorization: Bearer $CHARTRELAY_API_KEY`, so a host taken from request headers — which any client
 * can set, and a proxy can be made to forward — would be aiming a developer's live key at whatever host
 * an attacker chose. Headers are therefore honoured only for a loopback host, which is the local
 * development case and cannot be an attacker's server; everything else falls back to the known origin.
 */
export function resolveQuickstartOrigin(source: OriginSource): string {
  const configured = source.appUrl?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      // Opaque schemes (javascript:, data:, mailto:) parse without throwing and serialise to the string
      // "null", which would print `curl -X POST null/api/v1/charts`. Only http(s) has a usable origin.
      if (url.protocol === "http:" || url.protocol === "https:") return url.origin;
    } catch {
      // A malformed APP_URL is reported by `npm run check:env`; never fall through to request headers.
    }
  }
  const host = (source.forwardedHost ?? source.host ?? "").split(",")[0]?.trim() ?? "";
  if (!host || !LOCAL_HOST.test(host)) return FALLBACK_ORIGIN;
  try {
    // Loopback only, so the scheme is never in doubt and can never come from a header either.
    return new URL(`http://${host}`).origin;
  } catch {
    return FALLBACK_ORIGIN;
  }
}

/** Valid against chartSpecSchema, and small enough to read inside a dashboard card. */
export const quickstartSpec = {
  type: "bar",
  title: "Weekly signups",
  subtitle: "Last six weeks",
  showValues: true,
  series: [
    {
      name: "Signups",
      color: "#6C5CE7",
      data: [
        { label: "Week 1", value: 42 },
        { label: "Week 2", value: 58 },
        { label: "Week 3", value: 51 },
        { label: "Week 4", value: 74 },
        { label: "Week 5", value: 89 },
        { label: "Week 6", value: 96 },
      ],
    },
  ],
};

export function quickstartCurl(origin: string): string {
  const body = JSON.stringify(quickstartSpec, null, 2).split("\n").join("\n  ");
  return [
    `curl -X POST ${origin}/api/v1/charts \\`,
    `  -H "Authorization: Bearer ${QUICKSTART_KEY_PLACEHOLDER}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  --data '${body}'`,
  ].join("\n");
}

export type QuickstartState = {
  /** True once the workspace has at least one authenticated render. */
  done: boolean;
  hasKey: boolean;
  statusLabel: string;
  tone: "good" | "warning";
};

export function quickstartState(renderCount: number, activeKeyCount: number): QuickstartState {
  const done = renderCount > 0;
  const hasKey = activeKeyCount > 0;
  return {
    done,
    hasKey,
    statusLabel: done ? "First render done" : hasKey ? "1 of 3 done" : "Not started",
    tone: done ? "good" : "warning",
  };
}

export type QuickstartCardProps = {
  /** Number of authenticated renders already recorded for the workspace (0 keeps the card open). */
  renderCount: number;
  activeKeyCount: number;
  /** Non-secret prefix of the newest active key. Stored keys are hashed and are never re-displayed. */
  keyPrefix: string | null;
};

export async function QuickstartCard({ renderCount, activeKeyCount, keyPrefix }: QuickstartCardProps) {
  const requestHeaders = await headers();
  const origin = resolveQuickstartOrigin({
    appUrl: process.env.APP_URL,
    forwardedHost: requestHeaders.get("x-forwarded-host"),
    host: requestHeaders.get("host"),
  });
  const state = quickstartState(renderCount, activeKeyCount);
  const curl = quickstartCurl(origin);
  return <section className="dashboard-card" aria-labelledby="quickstart-heading" style={{ marginBottom: 18 }}>
    <details open={!state.done}>
      <summary style={{ marginBottom: state.done ? 0 : 18 }}>
        <h2 id="quickstart-heading" style={{ display: "inline", margin: 0, fontSize: 18 }}>Quickstart</h2>
        {" "}
        <span className={`status-pill status-${state.tone}`}>{state.statusLabel}</span>
      </summary>
      <p className="empty-copy" style={{ margin: "0 0 20px" }}>
        {state.done
          ? "Your workspace has already rendered through the authenticated API. Reopen these steps any time you need the request shape again."
          : "Three steps to your first chart from the authenticated API. The example below runs as-is once you paste in a key."}
      </p>
      <ol className="lp-steps">
        <li className="lp-step" style={{ minWidth: 0 }}>
          <h3>Get an API key</h3>
          {keyPrefix
            ? <>
                {/* A key already exists — on a fresh sign-up it was created with the account and its full
                    value is being revealed in the API keys card further down this same page. Telling the
                    reader here that it "cannot be displayed again" sends them off to make a second key
                    they do not need, so point down at the reveal instead. */}
                <p>You already have a key: the newest one starts with <code>{keyPrefix}</code>. Its full value appears once, in the <strong>API keys</strong> section further down this page, immediately after the key is created — copy it from there before you leave.</p>
                <aside className="lp-note lp-note-warn" style={{ margin: "12px 0 0" }}><strong>Shown once</strong><p>{API_KEY_ONE_TIME_NOTICE}</p></aside>
                <p style={{ marginTop: 10 }}><a className="button button-small" href={KEYS_ANCHOR}>Go to your API keys</a></p>
              </>
            : <>
                <p>You do not have an active API key yet. Create one below and copy it the moment it appears.</p>
                <aside className="lp-note lp-note-warn" style={{ margin: "12px 0 0" }}><strong>Shown once</strong><p>{API_KEY_ONE_TIME_NOTICE}</p></aside>
                <p style={{ marginTop: 10 }}><a className="button button-small" href={KEYS_ANCHOR}>Create your API key</a></p>
              </>}
        </li>
        <li className="lp-step" style={{ minWidth: 0 }}>
          <h3>Render a chart</h3>
          <p>Export your key as <code>{KEY_ENV_VAR}</code> — the same variable <Link href="/docs">the docs</Link> and the MCP server use — then send one chart specification. Replace nothing else: this command targets <code>{origin}</code>.</p>
          <div className="code-card lp-code-card" style={{ marginTop: 14 }}>
            <header>Terminal</header>
            <pre><code>{curl}</code></pre>
          </div>
          <CopyButton value={curl} label="Copy request" describedAs="the quickstart curl command" />
        </li>
        <li className="lp-step" style={{ minWidth: 0 }}>
          <h3>Read the response</h3>
          <p>A successful call returns <code>201</code> with the raw <code>svg</code>, durable <code>urls.svg</code> and <code>urls.png</code> asset links, an <code>altText</code> string for screen readers and alt attributes, and a <code>warnings</code> array of QA findings — each with a severity, a code and a concrete correction. Your render count on this page updates on the next refresh.</p>
          <p style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link className="button button-small" href="/docs">Full API documentation</Link>
            <Link className="button button-ghost button-small" href="/mcp">Use it from an MCP client</Link>
          </p>
        </li>
      </ol>
    </details>
  </section>;
}
