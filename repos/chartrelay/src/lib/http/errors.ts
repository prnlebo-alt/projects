/**
 * One error shape, for callers that are programs.
 *
 * Most of this API's traffic is an agent or a script, not a person reading a page, and the difference
 * matters: a human can tell "Monthly render limit reached" means stop and buy more, while a program can
 * only act on something it can branch on. So every failure carries a stable `code`, a machine-readable
 * `type`, a URL to the documentation for that exact code, and — when the fix is to pay — the link its
 * human needs. The prose message is for the log line a person eventually reads.
 *
 * `request_id` is on every error and every success. Without one, a support conversation is two parties
 * guessing at which of thousands of requests went wrong.
 */

/** The broad category, for a client that wants to branch before it knows the specific code. */
export type ErrorType =
  | "invalid_request_error"
  | "authentication_error"
  | "billing_error"
  | "permission_error"
  | "rate_limit_error"
  | "api_error";

/**
 * Every failure this API can return.
 *
 * Closed on purpose. A new failure mode has to be added here, which forces the question "what should a
 * caller do about this?" at the moment it is introduced rather than months later when someone finds an
 * undocumented string in their logs.
 */
export const ERROR_CODES = {
  invalid_chart_spec: { status: 400, type: "invalid_request_error" },
  remote_fetch_blocked: { status: 400, type: "invalid_request_error" },
  invalid_api_key: { status: 401, type: "authentication_error" },
  signature_required: { status: 401, type: "authentication_error" },
  signature_invalid: { status: 401, type: "authentication_error" },
  credits_exhausted: { status: 402, type: "billing_error" },
  key_budget_exhausted: { status: 402, type: "billing_error" },
  scope_denied: { status: 403, type: "permission_error" },
  ip_not_allowed: { status: 403, type: "permission_error" },
  region_blocked: { status: 403, type: "permission_error" },
  request_in_progress: { status: 409, type: "invalid_request_error" },
  payload_too_large: { status: 413, type: "invalid_request_error" },
  rate_limited: { status: 429, type: "rate_limit_error" },
  render_failed: { status: 500, type: "api_error" },
  service_unavailable: { status: 503, type: "api_error" },
} as const satisfies Record<string, { status: number; type: ErrorType }>;

export type ErrorCode = keyof typeof ERROR_CODES;

/** Codes whose remedy is to buy credit. These, and only these, carry a `top_up_url`. */
const BILLING_CODES = new Set<ErrorCode>(["credits_exhausted", "key_budget_exhausted"]);

export const DOCS_BASE = "https://chartrelay.dev/docs/errors";
export const TOP_UP_PATH = "/dashboard/billing";

export interface ApiErrorBody {
  error: {
    type: ErrorType;
    code: ErrorCode;
    message: string;
    doc_url: string;
    /** Present only on 402. The agent cannot pay; it hands this to its human. */
    top_up_url?: string;
  };
  request_id: string;
}

export interface ApiErrorOptions {
  /** Extra machine-readable context, such as the field path that failed validation. */
  details?: Record<string, unknown>;
  /** Seconds, for 429 and 503. Emitted as `Retry-After`. */
  retryAfterSeconds?: number;
  /** Credits left, so a client learns its balance even from a failure. */
  creditsRemaining?: number;
}

/**
 * A failure with everything a caller needs to act on it.
 *
 * Thrown rather than returned so the status and the body cannot drift apart in a handler that forgets
 * one of them — which is how an API ends up answering 200 with an error body.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly type: ErrorType;
  readonly options: ApiErrorOptions;

  constructor(code: ErrorCode, message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = ERROR_CODES[code].status;
    this.type = ERROR_CODES[code].type;
    this.options = options;
  }
}

/** Absolute URL for the top-up page, so an agent can hand its human something clickable. */
export const topUpUrl = (env: Record<string, string | undefined> = process.env): string =>
  `${(env.APP_URL ?? "https://chartrelay.dev").replace(/\/$/, "")}${TOP_UP_PATH}`;

export function errorBody(error: ApiError, requestId: string, env: Record<string, string | undefined> = process.env): ApiErrorBody {
  return {
    error: {
      type: error.type,
      code: error.code,
      message: error.message,
      doc_url: `${DOCS_BASE}#${error.code}`,
      ...(BILLING_CODES.has(error.code) ? { top_up_url: topUpUrl(env) } : {}),
      ...(error.options.details ? { details: error.options.details } : {}),
    },
    request_id: requestId,
  } as ApiErrorBody;
}

/**
 * Headers that travel with every response, successful or not.
 *
 * The credit balance is here rather than only in the success body because the response a caller most
 * needs it on is the one that just failed for lack of it.
 */
export function responseHeaders(requestId: string, options: ApiErrorOptions = {}): Record<string, string> {
  return {
    "x-request-id": requestId,
    ...(options.creditsRemaining === undefined ? {} : { "x-chartrelay-credits-remaining": String(options.creditsRemaining) }),
    // Seconds, per RFC 9110 — a date is also legal there and is harder for a client to use.
    ...(options.retryAfterSeconds === undefined ? {} : { "retry-after": String(Math.max(0, Math.ceil(options.retryAfterSeconds))) }),
  };
}

/** IETF draft `RateLimit-*` headers, so a client can pace itself before it is told to stop. */
export function rateLimitHeaders(limit: number, remaining: number, resetSeconds: number): Record<string, string> {
  return {
    "ratelimit-limit": String(limit),
    "ratelimit-remaining": String(Math.max(0, remaining)),
    "ratelimit-reset": String(Math.max(0, Math.ceil(resetSeconds))),
  };
}
