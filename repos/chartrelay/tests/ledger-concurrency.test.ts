import { afterEach, describe, expect, it } from "vitest";
import { Worker } from "node:worker_threads";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import DatabaseDriver from "better-sqlite3";

/**
 * The reserve, proven atomic across real OS threads rather than inside one event loop.
 *
 * The in-process test in tests/ledger.test.ts proves the logic: ask a hundred times for one credit and
 * exactly one succeeds. It cannot prove the *locking*, because better-sqlite3 is synchronous and a
 * single-threaded caller serialises itself no matter how the SQL is written — a check-then-act
 * implementation would pass that test and still be wrong in production.
 *
 * This file runs genuine concurrent writers against one database file. It exercises the SQL statement
 * the ledger uses rather than the TypeScript around it, which is deliberate: the claim being tested is
 * that `UPDATE … WHERE remaining >= 1 RETURNING` is indivisible, and that claim belongs to SQLite.
 */

const RESERVE_SQL = "UPDATE balances SET remaining = remaining - 1 WHERE workspace_id = ? AND remaining >= 1 RETURNING remaining";

let directory: string | null = null;

afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = null;
});

function database(credits: number) {
  directory = mkdtempSync(join(tmpdir(), "chartrelay-ledger-"));
  const file = join(directory, "ledger.db");
  const sqlite = new DatabaseDriver(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec("CREATE TABLE balances (workspace_id TEXT PRIMARY KEY, remaining INTEGER NOT NULL CHECK (remaining >= 0), updated_at TEXT NOT NULL)");
  sqlite.prepare("INSERT INTO balances VALUES ('ws', ?, '')").run(credits);
  sqlite.close();
  return file;
}

/** One worker, one attempt, racing every other worker for the same credit. */
const WORKER = `
  const { parentPort, workerData } = require("node:worker_threads");
  const Database = require(workerData.driver);
  const sqlite = new Database(workerData.file, { timeout: 10000 });
  sqlite.pragma("journal_mode = WAL");
  // Every worker waits on the same barrier so the attempts overlap rather than queue politely.
  const waitUntil = workerData.startAt;
  while (Date.now() < waitUntil) { /* spin to the barrier */ }
  try {
    const won = sqlite.prepare(workerData.sql).get(workerData.workspace) !== undefined;
    parentPort.postMessage({ won });
  } catch (error) {
    parentPort.postMessage({ error: String(error && error.message) });
  } finally {
    sqlite.close();
  }
`;

async function race(file: string, workers: number) {
  const driver = require.resolve("better-sqlite3");
  const startAt = Date.now() + 250;
  const results = await Promise.all(Array.from({ length: workers }, () => new Promise<{ won?: boolean; error?: string }>((resolve, reject) => {
    const worker = new Worker(WORKER, { eval: true, workerData: { file, driver, sql: RESERVE_SQL, workspace: "ws", startAt } });
    worker.once("message", resolve);
    worker.once("error", reject);
  })));
  return {
    won: results.filter((result) => result.won).length,
    refused: results.filter((result) => result.won === false).length,
    errors: results.filter((result) => result.error).map((result) => result.error!),
  };
}

describe("a hundred requests racing for one credit", () => {
  it("produces exactly one winner across real threads", { timeout: 60_000 }, async () => {
    const file = database(1);
    const outcome = await race(file, 100);
    expect(outcome.errors).toEqual([]);
    expect(outcome.won).toBe(1);
    expect(outcome.refused).toBe(99);

    const sqlite = new DatabaseDriver(file, { readonly: true });
    expect(sqlite.prepare("SELECT remaining FROM balances WHERE workspace_id = 'ws'").get()).toEqual({ remaining: 0 });
    sqlite.close();
  });

  it("hands out exactly the credit that existed, never one more", { timeout: 60_000 }, async () => {
    // The failure this catches is a reserve that reads then writes: under contention several readers
    // see the same balance and all of them think they may spend it.
    const file = database(25);
    const outcome = await race(file, 100);
    expect(outcome.errors).toEqual([]);
    expect(outcome.won).toBe(25);
    expect(outcome.refused).toBe(75);

    const sqlite = new DatabaseDriver(file, { readonly: true });
    expect(sqlite.prepare("SELECT remaining FROM balances WHERE workspace_id = 'ws'").get()).toEqual({ remaining: 0 });
    sqlite.close();
  });

  it("never drives the balance below zero even when everyone loses", { timeout: 60_000 }, async () => {
    const file = database(0);
    const outcome = await race(file, 40);
    expect(outcome.errors).toEqual([]);
    expect(outcome.won).toBe(0);

    const sqlite = new DatabaseDriver(file, { readonly: true });
    expect(sqlite.prepare("SELECT remaining FROM balances WHERE workspace_id = 'ws'").get()).toEqual({ remaining: 0 });
    sqlite.close();
  });
});
