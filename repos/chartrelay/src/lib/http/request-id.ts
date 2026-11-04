/**
 * An identifier for one request, carried on everything it produces.
 *
 * Honours an inbound `X-Request-Id` when the caller supplies one, so a client that already has a trace
 * id can correlate its logs with ours instead of holding two unrelated identifiers for one event. An
 * inbound value is sanitised rather than trusted: it reaches logs and a response header, and a caller
 * who can put arbitrary bytes in either can forge log lines.
 */
import { randomUUID } from "node:crypto";

/** Long enough to be unique in a log, short enough to paste into a support email. */
const MAX_LENGTH = 64;
/** Deliberately narrow: nothing here can terminate a header or break a log format. */
const ALLOWED = /^[A-Za-z0-9_-]+$/;

export const REQUEST_ID_HEADER = "x-request-id";

export function requestIdFrom(request: Request): string {
  const supplied = request.headers.get(REQUEST_ID_HEADER)?.trim();
  if (supplied && supplied.length <= MAX_LENGTH && ALLOWED.test(supplied)) return supplied;
  return `req_${randomUUID().replace(/-/g, "")}`;
}
