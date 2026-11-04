import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The password-reset path was fixed once already: when outbound email cannot leave this deployment, no surface
 * may promise a message or ask the customer to retry something that cannot succeed. The confirmation path still
 * did both — an unconditional "Confirm your email" banner with a Resend button, an endpoint that answered 502
 * "try again later", and pricing and sign-up copy that sold the higher free limit as a step anyone can take.
 *
 * Every state below is decided by emailDeliverable()/emailConfigured() in src/lib/email/send.ts, the single
 * authority /support and /forgot-password already read, and every number comes from src/lib/usage/limits.ts.
 */

// AuthForm is a client component that calls useRouter; rendering it here needs a stub for that hook only.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {}, back: () => {}, forward: () => {}, prefetch: () => {} }),
}));

const account = vi.hoisted(() => ({ currentAccount: vi.fn() }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  currentAccount: account.currentAccount,
}));

const mail = vi.hoisted(() => ({ sendVerificationEmail: vi.fn() }));
vi.mock("@/lib/auth/account", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/account")>()),
  sendVerificationEmail: mail.sendVerificationEmail,
}));

const { db } = await import("@/lib/db");
const { rateLimits } = await import("@/lib/db/schema");
const { planLimits, UNVERIFIED_FREE_LIMIT } = await import("@/lib/usage/limits");
const { VERIFY_EMAIL_UNAVAILABLE, VerifyEmailBanner } = await import("@/components/account-forms");
const resend = await import("@/app/api/auth/verify/resend/route");

const CONFIRMED = planLimits.free.toLocaleString("en-US");
const ROOT = path.resolve(import.meta.dirname, "..");
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), "utf8");

/** Markup without tags or entities, so an assertion sees the sentence a customer sees. */
const text = (html: string) =>
  html.replace(/<[^>]*>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x2F;/g, "/").replace(/\s+/g, " ").trim();

async function markup(element: Parameters<typeof import("react-dom/server").renderToStaticMarkup>[0]) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(element);
}

/** The live deployment's documented state: a production build with no email provider configured. */
function withoutEmail() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("EMAIL_PROVIDER", "");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("EMAIL_FROM", "");
}

function withEmail() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("EMAIL_PROVIDER", "resend");
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("EMAIL_FROM", "ChartRelay <no-reply@chartrelay.example>");
}

const unverifiedAccount = {
  user: { id: "u1", email: "owner@example.com", name: "Owner Person", emailVerifiedAt: null },
  workspace: { id: "w1", plan: "free" },
};

beforeEach(() => {
  vi.clearAllMocks();
  db.delete(rateLimits).run();
  account.currentAccount.mockResolvedValue(null);
});

afterEach(() => vi.unstubAllEnvs());

describe("the dashboard banner for an unconfirmed email", () => {
  const banner = (emailSendable: boolean) =>
    markup(createElement(VerifyEmailBanner, { email: "owner@example.com", emailSendable, currentLimit: UNVERIFIED_FREE_LIMIT, confirmedLimit: planLimits.free }));

  it("asks for a confirmation and offers the resend button when email can be sent", async () => {
    const html = await banner(true);
    expect(text(html)).toContain(`Confirm your email (owner@example.com) to raise your free limit from ${UNVERIFIED_FREE_LIMIT} to ${CONFIRMED} renders a month.`);
    expect(text(html)).toContain("Resend email");
  });

  it("offers no resend button when email cannot be sent, because that button can only fail", async () => {
    const html = await banner(false);
    expect(text(html)).not.toContain("Resend email");
    expect(html).not.toContain("<button");
  });

  it("explains the outage, states the limit it is actually enforcing, and points at support", async () => {
    const body = text(await banner(false));
    expect(body).toContain(VERIFY_EMAIL_UNAVAILABLE);
    expect(body).toContain(`${UNVERIFIED_FREE_LIMIT} a month instead of ${CONFIRMED}`);
    expect(body).toMatch(/support/i);
    expect(await banner(false)).toContain('href="/support"');
    // No instruction the reader cannot carry out, and no claim that a message is coming.
    expect(body).not.toMatch(/confirm your email/i);
    expect(body).not.toMatch(/spam folder/i);
  });

  it("is the only thing the dashboard renders for this, and it reads the delivery state from the shared helper", () => {
    const page = read("src/app/dashboard/page.tsx");
    expect(page).toContain("emailDeliverable()");
    expect(page).toContain('from "@/lib/email/send"');
    expect(page).toContain("<VerifyEmailBanner");
    // The unconditional banner with its bare button is gone.
    expect(page).not.toContain("<ResendVerificationButton />");
  });
});

describe("POST /api/auth/verify/resend", () => {
  it("answers 503 with the truth instead of 502 'try again later' when email is not configured", async () => {
    withoutEmail();
    account.currentAccount.mockResolvedValue(unverifiedAccount);
    const response = await resend.POST();
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.error).not.toMatch(/try again later/i);
    expect(body.error).toMatch(/temporarily unavailable on this deployment/i);
    expect(body.error).toMatch(/support/i);
    expect(body.emailUnavailable).toBe(true);
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("spends none of the hourly allowance on an attempt that cannot send anything", async () => {
    withoutEmail();
    account.currentAccount.mockResolvedValue(unverifiedAccount);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await resend.POST();
      expect(response.status).toBe(503);
    }
    expect(db.select().from(rateLimits).all()).toHaveLength(0);
  });

  it("still sends, and still reports success, when a provider is configured", async () => {
    withEmail();
    account.currentAccount.mockResolvedValue(unverifiedAccount);
    const response = await resend.POST();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mail.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it("keeps answering 401 to a signed-out caller in both states", async () => {
    for (const state of [withoutEmail, withEmail]) {
      state();
      account.currentAccount.mockResolvedValue(null);
      expect((await resend.POST()).status).toBe(401);
      vi.unstubAllEnvs();
    }
  });
});

describe("/pricing", () => {
  async function render() {
    const { default: PricingPage } = await import("@/app/pricing/page");
    return text(await markup(await PricingPage({ searchParams: Promise.resolve({}) })));
  }

  it("names both free limits, so the free tier is described truthfully in either state", async () => {
    for (const state of [withEmail, withoutEmail]) {
      state();
      const body = await render();
      expect(body).toContain(`${UNVERIFIED_FREE_LIMIT} stored renders monthly, ${CONFIRMED} with a confirmed email`);
      // The flat claim the verifier found: the larger number as the free tier, full stop.
      expect(body).not.toMatch(new RegExp(`${CONFIRMED} stored renders monthly with a confirmed email`));
      vi.unstubAllEnvs();
    }
  });

  it("says plainly that confirmation is unavailable, when it is", async () => {
    withoutEmail();
    const body = await render();
    expect(body).toContain("Confirmation email is switched off on this deployment right now");
    expect(body).toContain(`stays at ${UNVERIFIED_FREE_LIMIT} a month`);
    expect(body).toContain("Confirmation email is not being delivered on this deployment at the moment");
    expect(body).toMatch(/support raises the limit by hand/i);
  });

  it("does not warn about an outage that is not happening", async () => {
    withEmail();
    const body = await render();
    expect(body).not.toMatch(/switched off on this deployment/i);
    expect(body).not.toMatch(/not being delivered/i);
    expect(body).toContain(`Confirming it raises the limit to ${CONFIRMED} immediately`);
  });

  it("takes every render count from src/lib/usage/limits.ts rather than repeating a literal", () => {
    const source = read("src/app/pricing/page.tsx");
    expect(source).toContain('from "@/lib/usage/limits"');
    for (const literal of ["1,000", "10,000", "100,000", "100 renders", "100 before"]) {
      expect(source, `${literal} is hardcoded in pricing copy`).not.toContain(literal);
    }
  });
});

describe("the register subtitle", () => {
  /**
   * auth-form.tsx is a client component, so it cannot import limits.ts — that module opens the SQLite
   * database and would follow it into the browser bundle. The figures come from src/lib/usage/plans.ts,
   * which holds the same constants with no database import, and the register page passes the delivery
   * state in. These tests render the component rather than pinning a literal sentence, so the copy can
   * change without going stale, but a wrong NUMBER or a promise of an unsendable email still fails.
   */
  const subtitle = async (emailSendable: boolean) => {
    const { AuthForm } = await import("@/components/auth-form");
    const { planLimits, UNVERIFIED_FREE_LIMIT } = await import("@/lib/usage/plans");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const markup = renderToStaticMarkup(
      createElement(AuthForm, { mode: "register" as const, freeLimit: planLimits.free, unverifiedLimit: UNVERIFIED_FREE_LIMIT, emailSendable }),
    );
    const match = markup.match(/<p>(No card\.[^<]*)<\/p>/);
    expect(match, "the register subtitle is no longer a <p> starting with 'No card.'").not.toBeNull();
    return match![1];
  };

  it("names both free limits from the plan constants, in both states", async () => {
    for (const sendable of [true, false]) {
      const copy = await subtitle(sendable);
      expect(copy).toContain(UNVERIFIED_FREE_LIMIT.toLocaleString("en-US"));
      expect(copy).toContain(CONFIRMED);
    }
  });

  it("follows the constants rather than hardcoding the figures", () => {
    const source = read("src/components/auth-form.tsx");
    expect(source, "auth-form.tsx hardcodes a quota figure instead of using the plan constants").not.toMatch(/\b1,000\b|\b100 free\b/);
  });

  it("offers confirmation as a step only when a confirmation email can actually be sent", async () => {
    expect(await subtitle(true)).toMatch(/confirm your email/i);
    const degraded = await subtitle(false);
    expect(degraded).toMatch(/temporarily unavailable/i);
    expect(degraded).not.toMatch(/once you confirm/i);
    expect(degraded).not.toMatch(/we'll send|check your inbox/i);
  });
});
