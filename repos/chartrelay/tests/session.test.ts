import { beforeEach, describe, expect, it, vi } from "vitest";

// A minimal cookie jar standing in for next/headers, so the real session code runs outside a request.
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => { jar.set(name, value); },
    delete: (name: string) => { jar.delete(name); },
  }),
}));

const { db } = await import("@/lib/db");
const { users, workspaces } = await import("@/lib/db/schema");
const { createSession, clearSession, currentAccount } = await import("@/lib/auth/session");

beforeEach(() => {
  jar.clear();
  db.delete(users).run();
  const now = new Date().toISOString();
  db.insert(users).values({ id: "u1", email: "owner@example.com", name: "Owner", passwordHash: "x", createdAt: now }).run();
  db.insert(workspaces).values({ id: "ws1", ownerId: "u1", name: "Owner's workspace", createdAt: now }).run();
});

describe("sessions", () => {
  it("signing out revokes a copied session token", async () => {
    await createSession("u1");
    const stolen = jar.get("chartrelay_session")!;
    expect((await currentAccount())?.user.id).toBe("u1");
    await clearSession();
    expect(await currentAccount()).toBeNull();
    // Replaying the copied cookie no longer works.
    jar.set("chartrelay_session", stolen);
    expect(await currentAccount()).toBeNull();
    // A fresh sign-in works again.
    await createSession("u1");
    expect((await currentAccount())?.user.id).toBe("u1");
  });
});
