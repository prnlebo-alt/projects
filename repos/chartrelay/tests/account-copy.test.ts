import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";

/** Markup without tags, so an assertion reads the sentence a customer reads. */
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&#x2F;/g, "/").replace(/\s+/g, " ");

async function markup(element: Parameters<typeof import("react-dom/server").renderToStaticMarkup>[0]) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(element);
}

afterEach(() => vi.unstubAllEnvs());

describe("danger zone copy", () => {
  it("does not promise chart URLs stop working immediately, because assets are cached for a year", async () => {
    const { AccountDangerZone } = await import("@/components/account-danger-zone");
    const body = text(await markup(createElement(AccountDangerZone, { email: "owner@example.com" })));
    expect(body).not.toContain("stop working immediately");
    expect(body).toContain("Chart URLs stop being served straight away");
    expect(body).toMatch(/cached by a browser, a proxy or a link-preview service/);
  });
});

describe("post-deletion confirmation", () => {
  it("states what was removed instead of dropping the customer on the marketing home page", async () => {
    const { default: AccountDeletedPage } = await import("@/app/account-deleted/page");
    const html = await markup(AccountDeletedPage());
    const body = text(html);
    expect(html).toContain('role="status"');
    expect(body).toContain("Your account is deleted.");
    expect(body).toContain("have been removed");
    expect(body).toContain("signed out");
    expect(html).toContain('href="/register"');
  });

  it("is the route the delete dialog navigates to on success", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(path.resolve(import.meta.dirname, "../src/components/account-danger-zone.tsx"), "utf8");
    expect(source).toContain('window.location.assign("/account-deleted")');
  });
});

describe("/forgot-password when no email can be sent", () => {
  it("replaces the form with a notice and points at support", async () => {
    const { ForgotPasswordForm, RESET_EMAIL_UNAVAILABLE } = await import("@/components/account-forms");
    const html = await markup(createElement(ForgotPasswordForm, { emailSendable: false }));
    const body = text(html);
    expect(body).toContain(RESET_EMAIL_UNAVAILABLE);
    expect(body).not.toContain("we'll send a link");
    expect(body).not.toContain("Send reset link");
    expect(html).toContain('href="/support"');
    expect(html).toContain('role="status"');
  });

  it("offers the normal form when a link can be sent", async () => {
    const { ForgotPasswordForm } = await import("@/components/account-forms");
    const body = text(await markup(createElement(ForgotPasswordForm, { emailSendable: true })));
    expect(body).toContain("Send reset link");
    expect(body).not.toContain("not available on this deployment");
  });
});

describe("/privacy", () => {
  async function privacy() {
    const { default: PrivacyPage } = await import("@/app/privacy/page");
    return markup(PrivacyPage());
  }

  it("no longer routes data-subject requests to a placeholder address", async () => {
    vi.stubEnv("SUPPORT_EMAIL", "");
    const body = text(await privacy());
    expect(body).not.toContain("[CONTACT EMAIL]");
    expect(body).not.toContain("[NUMBER]");
  });

  it("points at the self-service export and deletion the product now has", async () => {
    vi.stubEnv("SUPPORT_EMAIL", "");
    const html = await privacy();
    expect(text(html)).toContain("Export my data");
    expect(text(html)).toContain("Delete account");
    expect(html).toContain('href="/dashboard"');
  });

  it("states the retention reality, cached chart copies included", async () => {
    const body = text(await privacy());
    expect(body).toContain("removed from our database immediately");
    expect(body).toMatch(/may keep displaying for up to a year/);
  });

  it("degrades like /support when no address is configured, and links one when it is", async () => {
    vi.stubEnv("SUPPORT_EMAIL", "");
    expect(await privacy()).not.toContain("mailto:");
    vi.stubEnv("SUPPORT_EMAIL", "help@chartrelay.example");
    expect(await privacy()).toContain("mailto:help@chartrelay.example");
  });
});
