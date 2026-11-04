import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { db } = await import("@/lib/db");
const { rateLimits, users, workspaces } = await import("@/lib/db/schema");
const { adminTokenConfigured, authorizeAdmin, MIN_ADMIN_TOKEN_LENGTH } = await import("@/lib/admin/auth");
const backup = await import("@/app/api/admin/backup/route");

const TOKEN = "backup-token-that-is-long-enough-0123456789";
const SQLITE_HEADER = "SQLite format 3\0";

const request = (headers: Record<string, string> = {}) => new Request("http://localhost:3000/api/admin/backup", { headers });
const authorized = () => request({ authorization: `Bearer ${TOKEN}` });

const scratch: string[] = [];
function writeScratch(bytes: ArrayBuffer) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "chartrelay-backup-test-"));
  scratch.push(directory);
  const file = path.join(directory, "restored.sqlite");
  fs.writeFileSync(file, Buffer.from(bytes));
  return file;
}

beforeEach(() => {
  process.env.ADMIN_TOKEN = TOKEN;
  // Opens the lazy connection and runs migrations, and clears the shared rate-limit bucket between tests.
  db.delete(rateLimits).run();
  db.delete(users).run();
  const now = new Date().toISOString();
  db.insert(users).values({ id: "backup-u1", email: "backup@example.com", name: "Backup", passwordHash: "x", createdAt: now }).run();
  db.insert(workspaces).values({ id: "backup-ws1", ownerId: "backup-u1", name: "Backup workspace", createdAt: now }).run();
});

afterEach(() => {
  delete process.env.ADMIN_TOKEN;
  vi.restoreAllMocks();
});

afterAll(() => {
  for (const directory of scratch) fs.rmSync(directory, { recursive: true, force: true });
});

describe("authorizeAdmin", () => {
  it("fails closed when ADMIN_TOKEN is unset", () => {
    expect(adminTokenConfigured({})).toBe(false);
    expect(authorizeAdmin(authorized(), {})).toBe(false);
  });

  it("fails closed when ADMIN_TOKEN is shorter than the minimum", () => {
    const short = "a".repeat(MIN_ADMIN_TOKEN_LENGTH - 1);
    expect(adminTokenConfigured({ ADMIN_TOKEN: short })).toBe(false);
    // Even presenting exactly the configured (too short) token is refused.
    expect(authorizeAdmin(request({ authorization: `Bearer ${short}` }), { ADMIN_TOKEN: short })).toBe(false);
  });

  it("accepts the exact token and rejects near misses", () => {
    const env = { ADMIN_TOKEN: TOKEN };
    expect(authorizeAdmin(authorized(), env)).toBe(true);
    expect(authorizeAdmin(request({ authorization: `Bearer ${TOKEN}x` }), env)).toBe(false);
    expect(authorizeAdmin(request({ authorization: `Bearer ${TOKEN.slice(0, -1)}` }), env)).toBe(false);
    // A long shared prefix must not be enough: the comparison is over digests, not the raw strings.
    expect(authorizeAdmin(request({ authorization: `Bearer ${TOKEN.slice(0, -1)}Z` }), env)).toBe(false);
  });

  it("requires a well-formed Bearer header", () => {
    const env = { ADMIN_TOKEN: TOKEN };
    expect(authorizeAdmin(request(), env)).toBe(false);
    expect(authorizeAdmin(request({ authorization: TOKEN }), env)).toBe(false);
    expect(authorizeAdmin(request({ authorization: `Basic ${TOKEN}` }), env)).toBe(false);
    expect(authorizeAdmin(request({ authorization: "Bearer" }), env)).toBe(false);
    expect(authorizeAdmin(request({ authorization: "Bearer " }), env)).toBe(false);
    // The scheme is case-insensitive per RFC 7235, but the credential is not.
    expect(authorizeAdmin(request({ authorization: `bEaReR ${TOKEN}` }), env)).toBe(true);
    expect(authorizeAdmin(request({ authorization: `Bearer ${TOKEN.toUpperCase()}` }), env)).toBe(false);
  });
});

describe("GET /api/admin/backup", () => {
  it("returns 404, not 401, when ADMIN_TOKEN is unset so the endpoint stays invisible", async () => {
    delete process.env.ADMIN_TOKEN;
    const response = await backup.GET(authorized());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found." });
  });

  it("stays hidden behind a 404 when ADMIN_TOKEN is set but too short to trust", async () => {
    const short = "a".repeat(MIN_ADMIN_TOKEN_LENGTH - 1);
    process.env.ADMIN_TOKEN = short;
    const response = await backup.GET(request({ authorization: `Bearer ${short}` }));
    expect(response.status).toBe(404);
  });

  it("returns 401 with a constant body for a wrong, missing or malformed token", async () => {
    const bodies: string[] = [];
    const attempts: Record<string, string>[] = [{ authorization: "Bearer wrong-token-that-is-also-long-enough-123" }, {}, { authorization: "Basic xyz" }];
    for (const headers of attempts) {
      const response = await backup.GET(request(headers));
      expect(response.status).toBe(401);
      const text = await response.text();
      expect(text).not.toContain(TOKEN);
      bodies.push(text);
    }
    expect(new Set(bodies).size).toBe(1);
  });

  it("returns 200 with a restorable SQLite snapshot for the correct token", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const response = await backup.GET(authorized());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="chartrelay-backup-\d{4}-\d{2}-\d{2}\.sqlite"$/);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const bytes = await response.arrayBuffer();
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(Buffer.from(bytes).subarray(0, SQLITE_HEADER.length).toString("latin1")).toBe(SQLITE_HEADER);
    expect(Number(response.headers.get("content-length"))).toBe(bytes.byteLength);

    // The snapshot must be a real database a restore could use, not just bytes with the right header.
    const restored = new Database(writeScratch(bytes), { readonly: true });
    try {
      expect(restored.prepare("select name from sqlite_master where type = 'table' and name = 'users'").get()).toBeTruthy();
      expect(restored.prepare("select name from sqlite_master where type = 'table' and name = 'workspaces'").get()).toBeTruthy();
      expect(restored.prepare("select count(*) as count from users").get()).toEqual({ count: 1 });
      expect(restored.prepare("select email from users where id = ?").get("backup-u1")).toEqual({ email: "backup@example.com" });
    } finally {
      restored.close();
    }

    // Logs the event and the size only — never the token, never any row of data.
    expect(info).toHaveBeenCalledTimes(1);
    const logged = info.mock.calls[0].join(" ");
    expect(logged).toMatch(/^backup served \d+ bytes$/);
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain("backup@example.com");
  });

  it("leaves no temporary snapshot behind", async () => {
    const before = fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith("chartrelay-backup-")).length;
    await (await backup.GET(authorized())).arrayBuffer();
    const after = fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith("chartrelay-backup-")).length;
    expect(after).toBe(before);
  });

  it("rate limits repeated attempts instead of allowing unlimited token guesses", async () => {
    const wrong = request({ authorization: "Bearer wrong-token-that-is-also-long-enough-123" });
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 7; attempt++) statuses.push((await backup.GET(wrong)).status);
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses.slice(5)).toEqual([429, 429]);
    // A correct token is refused too while the window is open, so guessing cannot be parallelised past it.
    const limited = await backup.GET(authorized());
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("admin backup discoverability", () => {
  it("is absent from the sitemap and excluded by robots.txt", async () => {
    const sitemap = (await import("@/app/sitemap")).default();
    expect(JSON.stringify(sitemap)).not.toContain("admin");
    const robots = (await import("@/app/robots")).default();
    const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
    expect(rules.some((rule) => [rule.disallow ?? []].flat().includes("/api/"))).toBe(true);
  });

  it("is never referenced by any other route, page or component", () => {
    const root = path.resolve(import.meta.dirname, "../src");
    const owned = path.join(root, "app/api/admin/backup/route.ts");
    const offenders: string[] = [];
    const walk = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (/\.tsx?$/.test(entry.name) && file !== owned && fs.readFileSync(file, "utf8").includes("api/admin")) offenders.push(file);
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});

describe("the snapshot mechanism", () => {
  it("uses VACUUM INTO rather than copying the file", async () => {
    // The database runs in WAL mode, and on a live instance the main file can be nearly empty while
    // the data sits in the -wal beside it. A file copy restores an empty database that opens cleanly
    // and passes an integrity check — verified in the restore drill. VACUUM INTO writes a fully
    // checkpointed, self-contained copy from inside a read transaction.
    const { readFile } = await import("node:fs/promises");
    const source = await readFile("src/app/api/admin/backup/route.ts", "utf8");
    expect(source).toContain("VACUUM INTO");
    expect(source).not.toMatch(/copyFile|createReadStream\(.*\.db/);
  });
});
