// Downloads a consistent snapshot of the production database from /api/admin/backup and keeps the last
// 14 days of them in ./backups. No dependencies: Node 22+ only.
//
// Usage: node scripts/backup.mjs [https://target] — or set BACKUP_URL / APP_URL. ADMIN_TOKEN must match the server.
// Both values may instead live in .env.local, which is read but never echoed.
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const ENV_FILE = ".env.local";
const OUT_DIR = "backups";
const RETENTION_DAYS = 14;
const SQLITE_HEADER = "SQLite format 3\0";
const NAME_PATTERN = /^chartrelay-\d{4}-\d{2}-\d{2}-\d{4}\.sqlite$/;

function fail(message) {
  console.error(`backup: ${message}`);
  process.exit(1);
}

/**
 * Reads KEY=value pairs from .env.local into an object. Values are never printed — not on success, not in
 * an error — and the real environment always wins, so a stale file cannot silently redirect the download.
 */
function readEnvFile(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

/** `2026-09-22-1731` in local time: sorts chronologically and is unique per minute. */
function stamp(now = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function prune(directory, now = Date.now()) {
  const cutoff = now - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const name of fs.readdirSync(directory)) {
    if (!NAME_PATTERN.test(name)) continue; // Never touch files this script did not write.
    const file = path.join(directory, name);
    if (fs.statSync(file).mtimeMs >= cutoff) continue;
    fs.rmSync(file, { force: true });
    removed++;
  }
  return removed;
}

const fileEnv = readEnvFile(ENV_FILE);
const token = process.env.ADMIN_TOKEN ?? fileEnv.ADMIN_TOKEN;
// Target precedence: an explicit argument, then BACKUP_URL, then APP_URL. The argument matters because a
// developer's .env.local usually points APP_URL at localhost, which is not the database worth backing up.
const urlArgument = process.argv.slice(2).find((value) => !value.startsWith("-"));
const appUrl = urlArgument ?? process.env.BACKUP_URL ?? fileEnv.BACKUP_URL ?? process.env.APP_URL ?? fileEnv.APP_URL;

if (!token) fail(`ADMIN_TOKEN is not set. Export it, or add ADMIN_TOKEN=<token> to ${ENV_FILE}. It must match the ADMIN_TOKEN set on the server.`);
if (appUrl && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(appUrl) && !process.env.BACKUP_ALLOW_LOCAL) {
  fail(`Refusing to back up ${appUrl}: that is a local server, not production. Pass the production URL (npm run backup -- https://your-app.example.com), or set BACKUP_ALLOW_LOCAL=1 if you really mean it.`);
}
if (!appUrl) fail(`No target URL. Pass one (npm run backup -- https://your-app.example.com), or set BACKUP_URL or APP_URL in ${ENV_FILE}.`);

let endpoint;
try {
  endpoint = new URL("/api/admin/backup", appUrl);
} catch {
  fail("APP_URL is not a valid URL (expected something like https://your-app.example.com).");
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const destination = path.join(OUT_DIR, `chartrelay-${stamp()}.sqlite`);
// Download to a .part file so an interrupted or invalid transfer never leaves something that looks like a backup.
const partial = `${destination}.part`;

let response;
try {
  response = await fetch(endpoint, { headers: { authorization: `Bearer ${token}` }, redirect: "error" });
} catch (error) {
  fail(`could not reach ${endpoint.origin} — ${error instanceof Error ? error.message : error}`);
}

if (response.status === 404) fail("the server returned 404. The endpoint stays hidden until ADMIN_TOKEN is set on the server and is at least 24 characters. Set it there and redeploy.");
if (response.status === 401) fail("the server rejected the token (401). The local ADMIN_TOKEN does not match the server's.");
if (response.status === 429) fail("rate limited by the server (429). Wait a few minutes and try again.");
if (!response.ok) fail(`the server returned HTTP ${response.status}.`);
if (!response.body) fail("the server returned an empty response.");

try {
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(partial));
} catch (error) {
  fs.rmSync(partial, { force: true });
  fail(`the download failed — ${error instanceof Error ? error.message : error}`);
}

const size = fs.statSync(partial).size;
if (size === 0) {
  fs.rmSync(partial, { force: true });
  fail("the downloaded file is empty.");
}

// Verify this is really a SQLite database and not an error page or a truncated transfer.
const header = Buffer.alloc(SQLITE_HEADER.length);
const handle = fs.openSync(partial, "r");
try {
  fs.readSync(handle, header, 0, header.length, 0);
} finally {
  fs.closeSync(handle);
}
if (header.toString("latin1") !== SQLITE_HEADER) {
  fs.rmSync(partial, { force: true });
  fail("the downloaded file is not a SQLite database (bad header). Nothing was saved.");
}

fs.renameSync(partial, destination);
const removed = prune(OUT_DIR);

console.log(`${path.resolve(destination)} (${size} bytes)`);
if (removed > 0) console.log(`pruned ${removed} backup(s) older than ${RETENTION_DAYS} days`);
