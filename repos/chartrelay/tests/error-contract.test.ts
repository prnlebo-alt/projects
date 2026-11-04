import { describe, expect, it } from "vitest";
import { ApiError, ERROR_CODES, type ErrorCode, errorBody, rateLimitHeaders, responseHeaders, topUpUrl } from "@/lib/http/errors";
import { requestIdFrom, REQUEST_ID_HEADER } from "@/lib/http/request-id";

const REQUEST_ID = "req_test";

describe("the error contract a program can act on", () => {
  it("gives every code a status and a type", () => {
    for (const [code, spec] of Object.entries(ERROR_CODES)) {
      expect(spec.status, code).toBeGreaterThanOrEqual(400);
      expect(spec.type, code).toBeTruthy();
    }
  });

  it("uses the statuses the spec names", () => {
    // These pairs are the published contract. Changing one silently breaks every client branching on it.
    const expected: Array<[ErrorCode, number]> = [
      ["invalid_chart_spec", 400],
      ["remote_fetch_blocked", 400],
      ["invalid_api_key", 401],
      ["signature_required", 401],
      ["signature_invalid", 401],
      ["credits_exhausted", 402],
      ["key_budget_exhausted", 402],
      ["scope_denied", 403],
      ["ip_not_allowed", 403],
      ["region_blocked", 403],
      ["payload_too_large", 413],
      ["rate_limited", 429],
      ["render_failed", 500],
    ];
    for (const [code, status] of expected) expect(ERROR_CODES[code].status, code).toBe(status);
  });

  it("carries a top-up link on the codes whose remedy is to pay, and only those", () => {
    // An agent cannot buy credit. The link is what it hands to its human, so it has to be on the
    // response that stopped it — and nowhere else, or it reads as "pay to fix" for a validation bug.
    for (const code of Object.keys(ERROR_CODES) as ErrorCode[]) {
      const body = errorBody(new ApiError(code, "m"), REQUEST_ID, { APP_URL: "https://chartrelay.dev" });
      const expected = code === "credits_exhausted" || code === "key_budget_exhausted";
      expect(Boolean(body.error.top_up_url), code).toBe(expected);
    }
  });

  it("points at documentation for the specific code, not a generic page", () => {
    const body = errorBody(new ApiError("credits_exhausted", "m"), REQUEST_ID);
    expect(body.error.doc_url).toBe("https://chartrelay.dev/docs/errors#credits_exhausted");
  });

  it("puts the request id on the body as well as the header", () => {
    expect(errorBody(new ApiError("render_failed", "m"), REQUEST_ID).request_id).toBe(REQUEST_ID);
    expect(responseHeaders(REQUEST_ID)["x-request-id"]).toBe(REQUEST_ID);
  });

  it("reports the balance even on the failure caused by not having one", () => {
    const headers = responseHeaders(REQUEST_ID, { creditsRemaining: 0 });
    expect(headers["x-chartrelay-credits-remaining"]).toBe("0");
  });

  it("rounds Retry-After up, never down", () => {
    // Rounding down tells a client to retry while it is still rate limited, which produces a second
    // 429 and a client that trusts the header less.
    expect(responseHeaders(REQUEST_ID, { retryAfterSeconds: 0.2 })["retry-after"]).toBe("1");
    expect(responseHeaders(REQUEST_ID, { retryAfterSeconds: 30 })["retry-after"]).toBe("30");
  });

  it("never emits a negative remaining or reset", () => {
    expect(rateLimitHeaders(100, -5, -2)).toEqual({ "ratelimit-limit": "100", "ratelimit-remaining": "0", "ratelimit-reset": "0" });
  });

  it("keeps status and body in agreement because they come from one object", () => {
    const error = new ApiError("payload_too_large", "too big");
    expect(error.status).toBe(413);
    expect(errorBody(error, REQUEST_ID).error.code).toBe("payload_too_large");
  });

  it("builds the top-up link from the deployment's own origin", () => {
    expect(topUpUrl({ APP_URL: "https://staging.example.com/" })).toBe("https://staging.example.com/dashboard/billing");
  });
});

describe("the request id", () => {
  const withHeader = (value: string) => new Request("http://localhost/x", { headers: { [REQUEST_ID_HEADER]: value } });

  it("honours a caller's own id so two logs describe one event", () => {
    expect(requestIdFrom(withHeader("abc-123_XYZ"))).toBe("abc-123_XYZ");
  });

  it("generates one when the caller supplies none", () => {
    expect(requestIdFrom(new Request("http://localhost/x"))).toMatch(/^req_[0-9a-f]{32}$/);
  });

  it("refuses an id that could forge a log line or a header", () => {
    // This value reaches both a log and a response header. A caller controlling either can fabricate
    // evidence, so anything outside the narrow alphabet is replaced rather than sanitised in place.
    for (const hostile of ["a b", "../../etc", "x".repeat(65), "a;b", "<script>", "", "   "]) {
      expect(requestIdFrom(withHeader(hostile)), hostile).toMatch(/^req_[0-9a-f]{32}$/);
    }
  });

  it("refuses a newline even when one reaches it by some other route", () => {
    // The Request constructor rejects these outright, so they cannot be built through it — which is
    // exactly why the check does not lean on that. A proxy, a test double or a future framework that
    // hands over raw headers would otherwise walk a CRLF straight into a response header.
    const stub = (value: string) => ({ headers: { get: () => value } }) as unknown as Request;
    for (const hostile of ["a\nINFO: fake", "a\r\nX-Injected: yes", "a\u0000b"]) {
      expect(requestIdFrom(stub(hostile)), JSON.stringify(hostile)).toMatch(/^req_[0-9a-f]{32}$/);
    }
  });

  it("is unique across requests", () => {
    const ids = new Set(Array.from({ length: 200 }, () => requestIdFrom(new Request("http://localhost/x"))));
    expect(ids.size).toBe(200);
  });
});
