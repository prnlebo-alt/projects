import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }));
const sessionMock = vi.hoisted(() => ({ createSession: vi.fn() }));
// Only sendEmail is replaced: the config helpers in that module drive real behaviour under test.
vi.mock("@/lib/email/send", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/email/send")>()), sendEmail: mail.sendEmail }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/auth/session")>()), createSession: sessionMock.createSession }));

const { db } = await import("@/lib/db");
const { rateLimits, users } = await import("@/lib/db/schema");
const { normalizeSource, registrationSchema } = await import("@/lib/auth/credentials");
const registerRoute = await import("@/app/api/auth/register/route");

let ip = 0;
/** `source: undefined` omits the key entirely, which is how a form on a link without `?ref=` posts. */
function registerRequest(email: string, source?: unknown) {
  ip += 1;
  return new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: "New Person", email, password: "a long enough password", source }),
    headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${ip}` },
  });
}
const storedSource = (email: string) => db.select().from(users).where(eq(users.email, email)).get()?.source;

beforeEach(() => {
  vi.clearAllMocks();
  db.delete(rateLimits).run();
  db.delete(users).run();
});

describe("normalizeSource", () => {
  it("keeps a short channel slug, lowercased and trimmed", () => {
    expect(normalizeSource("launch-hn")).toBe("launch-hn");
    expect(normalizeSource("  Launch_HN  ")).toBe("launch_hn");
    expect(normalizeSource("a".repeat(40))).toBe("a".repeat(40));
  });

  it("drops anything that is not a slug, so no URL or user-identifying value can be stored", () => {
    for (const value of [
      "a".repeat(41),
      "https://news.example.com/item?id=1&utm_source=x",
      "reader@example.com",
      "hn launch",
      "hn/launch",
      "<script>alert(1)</script>",
      "réf",
      "",
      "   ",
      undefined,
      null,
      42,
      { ref: "hn" },
      ["hn"],
    ]) expect(normalizeSource(value)).toBeNull();
  });
});

describe("registration schema", () => {
  const base = { name: "New Person", email: "Person@Example.com", password: "a long enough password" };

  it("normalizes the source and never rejects a sign-up over it", () => {
    expect(registrationSchema.safeParse({ ...base, source: "launch-hn" }).data?.source).toBe("launch-hn");
    expect(registrationSchema.safeParse({ ...base, source: "x".repeat(400) }).data?.source).toBeNull();
    const absent = registrationSchema.safeParse(base);
    expect(absent.success).toBe(true);
    expect(absent.data?.source).toBeNull();
  });
});

describe("POST /api/auth/register", () => {
  it("stores a valid ref from the sign-up link", async () => {
    const response = await registerRoute.POST(registerRequest("ref@example.com", "Launch-HN"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, apiKey: expect.any(String) });
    expect(storedSource("ref@example.com")).toBe("launch-hn");
  });

  it("stores null for a junk, oversized, or non-string ref without failing the sign-up", async () => {
    for (const [index, value] of ["https://example.com/?ref=hn", "x".repeat(41), "hn launch", 7].entries()) {
      const email = `junk${index}@example.com`;
      const response = await registerRoute.POST(registerRequest(email, value));
      expect(response.status).toBe(200);
      expect(storedSource(email)).toBeNull();
    }
  });

  it("still registers when no ref is present", async () => {
    const response = await registerRoute.POST(registerRequest("plain@example.com"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, apiKey: expect.any(String) });
    expect(storedSource("plain@example.com")).toBeNull();
  });
});
