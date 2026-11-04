import { afterEach, describe, expect, it, vi } from "vitest";

const ADDRESS = "help@chartrelay.example";

/** The page reads process.env on every render (it is force-dynamic), so stubbing is enough. */
async function render() {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: SupportPage } = await import("@/app/support/page");
  return renderToStaticMarkup(SupportPage());
}

/** Markup without tags, so an assertion sees the sentence a reader sees. */
const text = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

afterEach(() => vi.unstubAllEnvs());

describe("/support and the email-delivery state", () => {
  it("tells customers to check their spam folder only when email is genuinely configured", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "ChartRelay <no-reply@chartrelay.example>");
    expect(text(await render())).toContain("Check the spam folder");
  });

  it("does not claim email works when EMAIL_PROVIDER holds some other value", async () => {
    // The bug: a truthiness test made a typo'd Railway variable look like working email.
    for (const provider of ["sendgrid", "Resend", "true", "1"]) {
      vi.stubEnv("EMAIL_PROVIDER", provider);
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("EMAIL_FROM", "ChartRelay <no-reply@chartrelay.example>");
      const body = text(await render());
      expect(body).not.toContain("Check the spam folder");
      expect(body).toContain("Outbound email is not configured on this deployment");
    }
  });

  it("does not claim email works when the provider is set to resend but its credentials are missing", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    expect(text(await render())).not.toContain("Check the spam folder");
  });
});

describe("/support with no contact address configured", () => {
  it("never splices a clause into the middle of another sentence", async () => {
    vi.stubEnv("SUPPORT_EMAIL", "");
    const body = text(await render());
    expect(body).not.toContain("once the contact channel is live");
    // The four sentences that embedded the fallback mid-clause must now read as English.
    expect(body).toContain("tell us the date and the plan you expected");
    expect(body).toContain("write to us from the address the account uses");
    expect(body).toContain("ask us if the count looks wrong for what you sent");
    expect(body).toContain("Send a bug report with the details below");
  });

  it("still says plainly that the channel is being set up, and publishes no address", async () => {
    vi.stubEnv("SUPPORT_EMAIL", "");
    const html = await render();
    expect(text(html)).toContain("The contact channel is being set up");
    expect(html).not.toContain("mailto:");
  });

  it("links the same sentences to mailto once an address exists", async () => {
    vi.stubEnv("SUPPORT_EMAIL", ADDRESS);
    const html = await render();
    expect(html).toContain(`mailto:${ADDRESS}?subject=ChartRelay%20billing%20question`);
    expect(text(html)).toContain("tell us the date and the plan you expected");
  });
});

describe("/support billing guidance", () => {
  it("describes both dashboard states rather than sending free users after a button they cannot see", async () => {
    const body = text(await render());
    expect(body).toContain("If you have ever been through checkout");
    expect(body).toContain("On a free plan there is nothing to manage and no such button");
  });
});
