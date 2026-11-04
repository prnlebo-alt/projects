import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { adminTokenConfigured, authorizeAdmin } from "@/lib/admin/auth";
import { sqlite } from "@/lib/db";
import { clientIp, consumeRateLimit, MINUTE } from "@/lib/security/rate-limit";

// Always evaluated per request; never prerendered at build time (which would also open the database).
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" } as const;

/** A whole-database download is expensive and should be rare; this also caps token guessing per client. */
const RATE_LIMIT = { attempts: 5, windowMs: 10 * MINUTE };
const CHUNK_BYTES = 64 * 1024;

/** Identical body for "not configured" and "no such route", so the endpoint cannot be probed for existence. */
const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });

export async function GET(request: Request) {
  // Unset ADMIN_TOKEN means this install never opted into admin backups: behave as if the route does not
  // exist, and return before touching the database at all.
  if (!adminTokenConfigured()) return notFound();

  // Rate limit before authorizing, so a wrong token cannot be retried quickly.
  const limit = consumeRateLimit(`admin-backup:${clientIp(request)}`, RATE_LIMIT.attempts, RATE_LIMIT.windowMs);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { ...noStore, "retry-after": String(limit.retryAfterSeconds) } });
  }

  // Constant body and headers regardless of how the token was wrong (absent, malformed, or incorrect).
  if (!authorizeAdmin(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: noStore });

  let directory: string | null = null;
  let handle: fs.FileHandle | null = null;
  try {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "chartrelay-backup-"));
    const snapshot = path.join(directory, "snapshot.sqlite");

    // `VACUUM INTO` writes a consistent, fully checkpointed copy of the database from inside a read
    // transaction. Verified against better-sqlite3 13 / SQLite 3.53: the bound parameter form works (so the
    // path is never string-interpolated into SQL), concurrent readers keep working throughout, the result
    // carries the plain "SQLite format 3\0" header with journal_mode=delete and no side WAL file, and it
    // refuses to overwrite an existing file — hence the fresh mkdtemp directory. It must not run inside a
    // transaction, so it is issued directly on the shared handle.
    sqlite().prepare("VACUUM INTO ?").run(snapshot);

    handle = await fs.open(snapshot, "r");
    const { size } = await handle.stat();

    // Unlink now: on POSIX the data stays readable through the open descriptor, so the temp file cannot
    // outlive this request even if the client disconnects mid-download or the process is killed.
    await fs.rm(directory, { recursive: true, force: true }).catch(() => {});

    // Only the event and the byte size. Never the token, never any row of data, never the temp path.
    console.info(`backup served ${size} bytes`);

    const source = handle;
    const cleanup = cleanupOnce(source, directory);
    directory = null;
    handle = null;

    let position = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const buffer = Buffer.allocUnsafe(CHUNK_BYTES);
          const { bytesRead } = await source.read(buffer, 0, CHUNK_BYTES, position);
          if (bytesRead === 0) {
            await cleanup();
            controller.close();
            return;
          }
          position += bytesRead;
          controller.enqueue(new Uint8Array(buffer.subarray(0, bytesRead)));
        } catch (error) {
          await cleanup();
          controller.error(error);
        }
      },
      cancel: cleanup,
    });

    const day = new Date().toISOString().slice(0, 10);
    return new NextResponse(body, {
      status: 200,
      headers: {
        ...noStore,
        "content-type": "application/octet-stream",
        "content-length": String(size),
        "content-disposition": `attachment; filename="chartrelay-backup-${day}.sqlite"`,
      },
    });
  } catch (error) {
    // Generic body: a SQLite error message would disclose the database path and disk state.
    console.error("Backup failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Backup failed." }, { status: 500, headers: noStore });
  } finally {
    // Only reached with a live handle/directory when the snapshot failed before streaming began.
    await handle?.close().catch(() => {});
    if (directory) await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

/** Closes the descriptor and removes the temp directory exactly once, whether the stream finished or was cancelled. */
function cleanupOnce(handle: fs.FileHandle, directory: string) {
  let done = false;
  return async () => {
    if (done) return;
    done = true;
    await handle.close().catch(() => {});
    await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
  };
}
