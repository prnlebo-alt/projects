import DatabaseDriver from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const databasePath = process.env.DATABASE_PATH ?? "./.data/chartrelay.db";
const inMemory = databasePath === ":memory:";
const absolutePath = inMemory ? databasePath : path.resolve(/* turbopackIgnore: true */ process.cwd(), databasePath);

type Database = ReturnType<typeof drizzle<typeof schema>>;

function migrate(sqlite: DatabaseDriver.Database) {
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      name TEXT NOT NULL, email_verified_at TEXT, password_changed_at TEXT, session_epoch INTEGER NOT NULL DEFAULT 0,
      source TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'free', stripe_customer_id TEXT,
      stripe_subscription_id TEXT, subscription_status TEXT, current_period_end TEXT, cancel_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE, prefix TEXT NOT NULL,
      last_used_at TEXT, revoked_at TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS renders (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      api_key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL, spec TEXT NOT NULL,
      svg TEXT NOT NULL, alt_text TEXT NOT NULL, warnings TEXT NOT NULL, png BLOB, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS usage_events (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL,
      used_at TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stripe_events (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, processed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS deleted_customers (
      stripe_customer_id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, deleted_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS signing_secrets (
      id TEXT PRIMARY KEY,
      api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
      public_id TEXT NOT NULL UNIQUE,
      secret_hash TEXT NOT NULL,
      retires_at TEXT, revoked_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_signing_secrets_key ON signing_secrets(api_key_id);
    CREATE TABLE IF NOT EXISTS credit_grants (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      renders INTEGER NOT NULL,
      consumed INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT, revoked_at TEXT,
      payment_event_id TEXT UNIQUE,
      created_at TEXT NOT NULL,
      CHECK (renders >= 0), CHECK (consumed >= 0)
    );
    -- The CHECK is the backstop for the reserve: if any path ever tries to spend past zero the
    -- database refuses, rather than the balance quietly going negative and billing stopping silently.
    CREATE TABLE IF NOT EXISTS balances (
      workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
      remaining INTEGER NOT NULL DEFAULT 0 CHECK (remaining >= 0),
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS processed_webhooks (
      event_id TEXT PRIMARY KEY, provider TEXT NOT NULL, processed_at TEXT NOT NULL
    );
    -- No foreign key on purpose: deleting an account must not erase the record that it existed,
    -- bought credit and had keys issued.
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY, workspace_id TEXT, actor TEXT NOT NULL, action TEXT NOT NULL,
      subject TEXT, detail TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_grants_workspace_expiry ON credit_grants(workspace_id, expires_at);
    CREATE INDEX IF NOT EXISTS idx_audit_workspace_created ON audit_log(workspace_id, created_at);
    CREATE TABLE IF NOT EXISTS activation_events (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL, detail TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activation_name_created ON activation_events(name, created_at);
    CREATE INDEX IF NOT EXISTS idx_activation_workspace ON activation_events(workspace_id, name);
    CREATE INDEX IF NOT EXISTS idx_renders_workspace_created ON renders(workspace_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_workspace_created ON usage_events(workspace_id, created_at);
  `);

  // Additive migrations for databases created before these columns existed.
  const workspaceColumns = new Set((sqlite.pragma("table_info(workspaces)") as { name: string }[]).map((column) => column.name));
  for (const column of ["current_period_end", "cancel_at"]) {
    if (!workspaceColumns.has(column)) sqlite.exec(`ALTER TABLE workspaces ADD COLUMN ${column} TEXT`);
  }
  const userColumns = new Set((sqlite.pragma("table_info(users)") as { name: string }[]).map((column) => column.name));
  for (const column of ["email_verified_at", "password_changed_at", "source"]) {
    if (!userColumns.has(column)) sqlite.exec(`ALTER TABLE users ADD COLUMN ${column} TEXT`);
  }
  if (!userColumns.has("session_epoch")) sqlite.exec("ALTER TABLE users ADD COLUMN session_epoch INTEGER NOT NULL DEFAULT 0");
  // Ledger columns on the existing usage_events table, and the key columns the spec adds. Additive so
  // a database written by an older build keeps every row it had.
  const usageColumns = new Set((sqlite.pragma("table_info(usage_events)") as { name: string }[]).map((column) => column.name));
  for (const [column, definition] of [
    ["key_id", "TEXT"], ["request_id", "TEXT"], ["idempotency_key", "TEXT"],
    ["units", "INTEGER NOT NULL DEFAULT 1"], ["status", "TEXT NOT NULL DEFAULT 'charged'"],
    ["format", "TEXT"], ["cache_hit", "INTEGER NOT NULL DEFAULT 0"], ["settled_at", "TEXT"],
    ["idempotency_scope", "TEXT"], ["render_id", "TEXT"],
  ] as const) {
    if (!usageColumns.has(column)) sqlite.exec(`ALTER TABLE usage_events ADD COLUMN ${column} ${definition}`);
  }
  // Partial, so the many rows with no idempotency key do not collide with each other on NULL.
  sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_scope_idempotency ON usage_events(idempotency_scope, idempotency_key) WHERE idempotency_key IS NOT NULL");
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_usage_reserved ON usage_events(status, created_at) WHERE status = 'reserved'");

  const keyColumns = new Set((sqlite.pragma("table_info(api_keys)") as { name: string }[]).map((column) => column.name));
  for (const [column, definition] of [
    ["last4", "TEXT"], ["mode", "TEXT NOT NULL DEFAULT 'live'"], ["scopes", "TEXT NOT NULL DEFAULT 'render'"],
    ["monthly_budget", "INTEGER"], ["ip_allowlist", "TEXT"], ["agent_tag", "TEXT"],
    ["expires_at", "TEXT"], ["rotated_at", "TEXT"], ["superseded_by_key_id", "TEXT"],
  ] as const) {
    if (!keyColumns.has(column)) sqlite.exec(`ALTER TABLE api_keys ADD COLUMN ${column} ${definition}`);
  }

  // The ladder was renamed and renumbered: free/pro/scale became free/developer/pro/business. Rows
  // written before that still say "scale", which no longer parses. Mapped here rather than only in
  // code, so a query against the table and the application agree about what a workspace is on.
  sqlite.exec("UPDATE workspaces SET plan = 'business' WHERE plan = 'scale'");

  const renderColumns = new Set((sqlite.pragma("table_info(renders)") as { name: string }[]).map((column) => column.name));
  if (!renderColumns.has("png")) sqlite.exec("ALTER TABLE renders ADD COLUMN png BLOB");
  // One-time repairs, tracked in the database rather than in the process.
  //
  // SCHEMA_VERSION below is a hot-reload marker and resets with every container, so it cannot say
  // whether a repair has already run against *this* file. PRAGMA user_version can: SQLite stores it in
  // the header, it costs nothing to read, and it survives restarts and redeploys.
  const dataVersion = Number((sqlite.pragma("user_version", { simple: true }) as number) ?? 0);

  // v1: every PNG cached before the runtime image had fonts was rasterised with no font available, so
  // each glyph came out as .notdef — a valid image of tofu boxes. The SVG beside it is fine, so
  // dropping the cache is the whole repair; the next request for one re-rasterises it, legibly.
  if (dataVersion < 1) {
    const cleared = sqlite.prepare("UPDATE renders SET png = NULL WHERE png IS NOT NULL").run();
    if (cleared.changes > 0) console.info(`[migrate] dropped ${cleared.changes} PNG(s) cached before the container had fonts`);
  }

  if (dataVersion < DATA_VERSION) sqlite.pragma(`user_version = ${DATA_VERSION}`);

  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_stripe_customer ON workspaces(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_subscription ON workspaces(stripe_subscription_id);
    CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
    -- Covers the PNG cache budget queries so they never read row bodies (SVG overflow pages) of every render.
    CREATE INDEX IF NOT EXISTS idx_renders_png_bytes ON renders(created_at, length(png)) WHERE png IS NOT NULL;
  `);
}

/**
 * Refuses to start on a database that should already exist but does not.
 *
 * `mkdirSync` followed by opening SQLite will happily create an empty database wherever it is pointed.
 * If the Railway volume is not mounted, that is exactly what happens: the app starts, every table is
 * created empty, and nothing anywhere reports a problem. Every quota check then passes against zero
 * usage rows and every credit check against no balance — a ledger that fails **open**, which is the
 * one direction a ledger must never fail.
 *
 * This is not hypothetical. An account was already lost once this way, to a deploy that ran before the
 * volume existed (docs/STATUS.md).
 *
 * The marker is the directory, not the database file, because a first legitimate boot has no file yet
 * but the mount point is always there when the volume is attached. Set `ALLOW_DB_BOOTSTRAP=1` for the
 * genuine first deployment, a fresh local checkout, or a restore.
 */
function assertVolumeMounted(env: Record<string, string | undefined>) {
  if (inMemory || env.ALLOW_DB_BOOTSTRAP === "1" || env.NODE_ENV !== "production") return;
  const directory = path.dirname(absolutePath);
  if (fs.existsSync(absolutePath) || fs.existsSync(directory)) return;
  throw new Error(
    `Refusing to start: ${directory} does not exist, so opening ${absolutePath} would create an empty database. ` +
    "On Railway this means the volume is not mounted, and starting would serve every customer a blank ledger. " +
    "If this really is a first deployment or a restore, set ALLOW_DB_BOOTSTRAP=1 for that boot only.",
  );
}

function open() {
  assertVolumeMounted(process.env);
  if (!inMemory) fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const sqlite = new DatabaseDriver(absolutePath, { timeout: 5000 });
  // Concurrent first opens (e.g. parallel workers) can briefly contend for the WAL switch; retry before failing.
  for (let attempt = 1; ; attempt++) {
    try {
      migrate(sqlite);
      break;
    } catch (error) {
      if ((error as { code?: string }).code !== "SQLITE_BUSY" || attempt >= 10) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * attempt);
    }
  }
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

/**
 * One-time data repairs already applied to a database file, stored in its own header.
 *
 * Distinct from SCHEMA_VERSION: that one is a per-process hot-reload marker and resets on every
 * restart, which is exactly what a "have we fixed this row yet?" question must not do.
 */
const DATA_VERSION = 1;

// Bump when migrate() changes, so a dev server's cached connection re-runs migrations after hot reload.
const SCHEMA_VERSION = 8;

// Opened lazily on first use so that importing a route (as `next build` does) never touches the database file.
const cache = globalThis as unknown as { chartrelayDatabase?: ReturnType<typeof open>; chartrelaySchemaVersion?: number };
function instance() {
  if (!cache.chartrelayDatabase) cache.chartrelayDatabase = open();
  else if (cache.chartrelaySchemaVersion !== SCHEMA_VERSION) {
    // Reuse the connection but rebuild Drizzle so relational queries see the current schema's columns.
    migrate(cache.chartrelayDatabase.sqlite);
    cache.chartrelayDatabase = { sqlite: cache.chartrelayDatabase.sqlite, db: drizzle(cache.chartrelayDatabase.sqlite, { schema }) };
  }
  cache.chartrelaySchemaVersion = SCHEMA_VERSION;
  return cache.chartrelayDatabase;
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const target = instance().db;
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

export function sqlite() {
  return instance().sqlite;
}
