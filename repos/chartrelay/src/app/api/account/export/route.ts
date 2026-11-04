import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { currentAccount } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiKeys, renders, usageEvents } from "@/lib/db/schema";
import { clientIp, consumeRateLimit, HOUR } from "@/lib/security/rate-limit";
import { rejectCrossSite } from "@/lib/security/request";

/**
 * Rows returned per collection. A busy workspace can hold far more renders than a browser wants to download in
 * one JSON file, so the export stops here and says so in the payload rather than streaming the whole table.
 */
const MAX_ROWS_PER_COLLECTION = 5_000;

/**
 * Serialized-byte budget shared by the three row collections, and the reason the row cap above is not
 * a memory bound on its own. A maximum-size chart spec (12 series x 100 points, 80-character labels)
 * serializes to roughly 126 KB, so 5,000 of them is ~600 MB of JSON — enough to kill the container,
 * from a request a paying customer is entitled to make. 8 MiB is generous for real accounts: a render
 * row serializes to well under a kilobyte in practice, so a full 5,000 rows is a few megabytes and
 * nothing is truncated. Only pathologically large specs reach the budget, and when they do the export
 * stops and says exactly how many rows it wrote and why it stopped.
 */
export const MAX_EXPORT_BYTES = 8 * 1024 * 1024;

/**
 * Rows read from SQLite per page. Peak memory is one page of rows plus the bytes already accepted —
 * never the whole table. Reading with `.all()` and a 5,001-row limit, as this route used to, allocates
 * every row before a single byte can be rejected, which is the allocation the budget exists to prevent.
 */
export const EXPORT_PAGE_SIZE = 50;

/** Building the file reads thousands of rows, so a handful of exports per hour is plenty. */
const EXPORTS_PER_HOUR = 6;

const EXPORT_FORMAT = "chartrelay-account-export/1";

/** Elements are joined with ",\n" so the file stays readable without indenting every nested value. */
const ROW_SEPARATOR = ",\n";

/**
 * Stored user columns deliberately left out of the export. Every other column must appear in the
 * exported user object: tests/account-lifecycle.test.ts asserts exactly that, so a column added later
 * cannot quietly fall out of a file the UI calls "everything we hold".
 */
export const OMITTED_USER_COLUMNS = ["passwordHash", "sessionEpoch"] as const;

const OMITTED = [
  "The account password hash is never exported.",
  "The session epoch (an internal counter that invalidates old sign-ins) is not exported.",
  "API keys are listed by prefix only; neither the key values nor their hashes are stored in a recoverable form.",
  "Rendered SVG and PNG bytes are omitted; each render lists the public URLs they can be downloaded from.",
];

/** Why a collection stopped short of the end of the table, or "complete" when it did not. */
export type StopReason = "complete" | "row-limit" | "byte-budget";

export type Collected = { chunks: string[]; included: number; truncated: boolean; reason: StopReason };

/** Mutable remaining-byte allowance, shared by every collection in one export. */
export type ByteBudget = { remaining: number };

/**
 * Reads rows a page at a time and serializes them one at a time, stopping at the row cap or at the
 * first row that would push the export past its remaining byte budget. Nothing larger than one page
 * is ever materialized from the database, and nothing beyond the budget is ever held in memory, so
 * peak usage is bounded by `pageSize` and `budget` rather than by how much the workspace stored.
 */
export function collectBounded<Row>(
  readPage: (offset: number, limit: number) => Row[],
  serialize: (row: Row) => string,
  budget: ByteBudget,
  options: { maxRows?: number; pageSize?: number } = {},
): Collected {
  const maxRows = options.maxRows ?? MAX_ROWS_PER_COLLECTION;
  const pageSize = Math.max(1, options.pageSize ?? EXPORT_PAGE_SIZE);
  const chunks: string[] = [];
  let offset = 0;

  for (;;) {
    const page = readPage(offset, pageSize);
    for (const row of page) {
      if (chunks.length >= maxRows) return { chunks, included: chunks.length, truncated: true, reason: "row-limit" };
      const json = serialize(row);
      const cost = Buffer.byteLength(json, "utf8") + (chunks.length === 0 ? 0 : ROW_SEPARATOR.length);
      if (cost > budget.remaining) return { chunks, included: chunks.length, truncated: true, reason: "byte-budget" };
      budget.remaining -= cost;
      chunks.push(json);
    }
    // A short page is the end of the table: every row was read and accepted.
    if (page.length < pageSize) return { chunks, included: chunks.length, truncated: false, reason: "complete" };
    offset += page.length;
  }
}

/** Stored spec/warnings columns are JSON text. Anything unparseable is exported verbatim rather than dropped. */
function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function GET(request: Request) {
  // A GET with no body, so the plain guard rather than the JSON one. Without it a foreign page can make
  // the victim's browser download their whole account file and burn their export budget.
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const limit = consumeRateLimit(`account-export:${account.user.id}:${clientIp(request)}`, EXPORTS_PER_HOUR, HOUR);
  if (!limit.allowed) {
    return NextResponse.json({ error: "You have requested several exports recently. Try again shortly." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
  }

  const { user, workspace } = account;
  const origin = process.env.APP_URL?.replace(/\/+$/, "") ?? new URL(request.url).origin;
  const budget: ByteBudget = { remaining: MAX_EXPORT_BYTES };

  // created_at ties are common (a burst of renders shares a timestamp), so the id breaks them: without a
  // total order, paging by offset could repeat one row and skip another.
  const keys = collectBounded(
    (offset, take) => db.select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, lastUsedAt: apiKeys.lastUsedAt, revokedAt: apiKeys.revokedAt, createdAt: apiKeys.createdAt })
      .from(apiKeys).where(eq(apiKeys.workspaceId, workspace.id)).orderBy(desc(apiKeys.createdAt), desc(apiKeys.id)).limit(take).offset(offset).all(),
    (row) => JSON.stringify(row),
    budget,
  );

  // Collected before the renders, although it is written after them: usage rows are tiny and renders are
  // the collection that can be enormous, so spending the budget on renders first would starve a list that
  // costs almost nothing to include. The big list absorbs the truncation.
  const usage = collectBounded(
    (offset, take) => db.select({ id: usageEvents.id, kind: usageEvents.kind, quantity: usageEvents.quantity, createdAt: usageEvents.createdAt })
      .from(usageEvents).where(eq(usageEvents.workspaceId, workspace.id)).orderBy(desc(usageEvents.createdAt), desc(usageEvents.id)).limit(take).offset(offset).all(),
    (row) => JSON.stringify(row),
    budget,
  );

  // Explicit columns: the svg text and png blob must never be selected into this response.
  const renderPage = collectBounded(
    (offset, take) => db.select({ id: renders.id, apiKeyId: renders.apiKeyId, spec: renders.spec, altText: renders.altText, warnings: renders.warnings, createdAt: renders.createdAt })
      .from(renders).where(eq(renders.workspaceId, workspace.id)).orderBy(desc(renders.createdAt), desc(renders.id)).limit(take).offset(offset).all(),
    (row) => JSON.stringify({
      id: row.id,
      apiKeyId: row.apiKeyId,
      spec: parseJson(row.spec),
      altText: row.altText,
      warnings: parseJson(row.warnings),
      createdAt: row.createdAt,
      urls: { svg: `${origin}/api/v1/charts/${row.id}?format=svg`, png: `${origin}/api/v1/charts/${row.id}?format=png` },
    }),
    budget,
  );

  const megabytes = `${Math.round(MAX_EXPORT_BYTES / (1024 * 1024))} MiB`;
  const header = {
    format: EXPORT_FORMAT,
    exportedAt: new Date().toISOString(),
    rowLimitPerCollection: MAX_ROWS_PER_COLLECTION,
    byteBudgetForRowsInBytes: MAX_EXPORT_BYTES,
    // Exactly how many rows of each list this file contains, so "what was included" needs no counting.
    included: { apiKeys: keys.included, renders: renderPage.included, usageEvents: usage.included },
    truncated: { apiKeys: keys.truncated, renders: renderPage.truncated, usageEvents: usage.truncated },
    stoppedBecause: { apiKeys: keys.reason, renders: renderPage.reason, usageEvents: usage.reason },
    truncationNote: `Each list holds at most ${MAX_ROWS_PER_COLLECTION.toLocaleString("en-US")} of the most recent rows, and the three lists together hold at most ${megabytes} of JSON — whichever limit is reached first, so that building this file can never exhaust the server's memory. "included" is the exact number of rows written for each list and "stoppedBecause" says why each list ended: "complete" means every row is here, "row-limit" means the ${MAX_ROWS_PER_COLLECTION.toLocaleString("en-US")}-row cap was reached, and "byte-budget" means the ${megabytes} limit was reached. Where "truncated" is true, older rows exist and are available on request.`,
    omitted: OMITTED,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerifiedAt: user.emailVerifiedAt,
      passwordChangedAt: user.passwordChangedAt,
      // The ?ref= channel slug captured at sign-up. Sanitized to [a-z0-9_-]{1,40} and never identifying,
      // so it belongs in a subject-access export rather than in the omitted list.
      source: user.source,
      createdAt: user.createdAt,
    },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      plan: workspace.plan,
      stripeCustomerId: workspace.stripeCustomerId,
      stripeSubscriptionId: workspace.stripeSubscriptionId,
      subscriptionStatus: workspace.subscriptionStatus,
      currentPeriodEnd: workspace.currentPeriodEnd,
      cancelAt: workspace.cancelAt,
      createdAt: workspace.createdAt,
    },
  };

  // The header is small, so it is stringified normally; the three row lists are appended as already
  // serialized text. Pretty-printing was the other half of the problem — JSON.stringify(payload, null, 2)
  // builds a second copy of the whole document, indented, and roughly doubles it.
  const list = (collected: Collected) => `[${collected.chunks.length === 0 ? "" : `\n${collected.chunks.join(ROW_SEPARATOR)}\n`}]`;
  const body = `${JSON.stringify(header).slice(0, -1)},\n"apiKeys":${list(keys)},\n"renders":${list(renderPage)},\n"usageEvents":${list(usage)}\n}`;

  const filename = `chartrelay-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
