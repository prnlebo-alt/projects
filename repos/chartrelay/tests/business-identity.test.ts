import { afterEach, describe, expect, it, vi } from "vitest";
import { businessIdentity, contractingParty, DISPLAY_NAME, effectiveDate, governingLawState, hasPostalAddress, LEGAL_NAME, postalAddress, registeredDba, SUBPROCESSORS, supportEmail } from "@/lib/business";
import { emailAllowed, emailFooter, LifecycleEmailBlockedError, sendEmail } from "@/lib/email/send";

const ADDRESS = "PO Box 1234, Somewhere FL 33101";

afterEach(() => vi.unstubAllEnvs());

describe("the published postal address", () => {
  it("is absent until one is configured, and has no default", () => {
    // A default here would be a placeholder that eventually ships, which is the whole failure mode
    // this module exists to prevent.
    expect(postalAddress({})).toBeNull();
    expect(postalAddress({ BUSINESS_POSTAL_ADDRESS: "   " })).toBeNull();
    expect(hasPostalAddress({})).toBe(false);
  });

  it("is used once it is configured", () => {
    expect(postalAddress({ BUSINESS_POSTAL_ADDRESS: ADDRESS })).toBe(ADDRESS);
    expect(hasPostalAddress({ BUSINESS_POSTAL_ADDRESS: ADDRESS })).toBe(true);
  });

  it("leaves the address line out of the identity block rather than printing an empty one", () => {
    expect(businessIdentity({}).lines).toEqual([LEGAL_NAME, "support@chartrelay.dev"]);
    expect(businessIdentity({ BUSINESS_POSTAL_ADDRESS: ADDRESS }).lines).toEqual([LEGAL_NAME, ADDRESS, "support@chartrelay.dev"]);
  });

  it("falls back to the domain's own support address rather than going blank", () => {
    expect(supportEmail({})).toBe("support@chartrelay.dev");
    expect(supportEmail({ SUPPORT_EMAIL: "help@example.com" })).toBe("help@example.com");
  });
});

describe("legal facts that are not decided yet", () => {
  it("reports no effective date and no governing-law state until they are set", () => {
    expect(effectiveDate({})).toBeNull();
    expect(governingLawState({})).toBeNull();
    expect(effectiveDate({ LEGAL_EFFECTIVE_DATE: "2026-10-01" })).toBe("2026-10-01");
    expect(governingLawState({ LEGAL_GOVERNING_STATE: "Florida" })).toBe("Florida");
  });

  it("names every subprocessor that receives a visitor's data", () => {
    const names = SUBPROCESSORS.map((sub) => sub.name);
    expect(names).toContain("Railway");
    expect(names).toContain("Resend");
    expect(names).toContain("Stripe");
    for (const sub of SUBPROCESSORS) expect(sub.purpose.length).toBeGreaterThan(10);
  });
});

describe("the lifecycle email guard", () => {
  it("always allows transactional mail, address or not", () => {
    // Withholding a password reset strands a customer mid-task, and no anti-spam law asks for a
    // postal address on one.
    expect(emailAllowed("transactional", {})).toBe(true);
    expect(emailAllowed("transactional", { BUSINESS_POSTAL_ADDRESS: ADDRESS })).toBe(true);
  });

  it("blocks lifecycle mail until an address exists", () => {
    expect(emailAllowed("lifecycle", {})).toBe(false);
    expect(emailAllowed("lifecycle", { BUSINESS_POSTAL_ADDRESS: ADDRESS })).toBe(true);
  });

  it("refuses to send a lifecycle message, loudly, and never reaches the provider", async () => {
    vi.stubEnv("BUSINESS_POSTAL_ADDRESS", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(sendEmail({ to: "a@example.com", subject: "Try Pro", text: "hi", kind: "lifecycle" }))
      .rejects.toBeInstanceOf(LifecycleEmailBlockedError);
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0][0])).toContain("BUSINESS_POSTAL_ADDRESS");
    // A send that vanishes without trace is how a company learns months later that a campaign
    // never went out — the refusal is logged and nothing is handed to the provider.
    expect(fetchSpy).not.toHaveBeenCalled();
    warn.mockRestore();
    fetchSpy.mockRestore();
  });
});

describe("the footer on outgoing mail", () => {
  it("puts the address on lifecycle mail, which legally needs one", () => {
    expect(emailFooter("lifecycle", { BUSINESS_POSTAL_ADDRESS: ADDRESS })).toContain(ADDRESS);
  });

  it("keeps the address off transactional mail, which does not", () => {
    const footer = emailFooter("transactional", { BUSINESS_POSTAL_ADDRESS: ADDRESS });
    expect(footer).not.toContain(ADDRESS);
    // A receipt signs off with the brand the customer recognises, and still says how to reply —
    // which is what tells a real receipt from a phishing attempt.
    expect(footer).toContain(DISPLAY_NAME);
    expect(footer).toContain("support@chartrelay.dev");
  });

  it("names the registered entity on lifecycle mail, not the brand", () => {
    // The regulated one. A brand name beside a postal address does not identify a sender.
    const footer = emailFooter("lifecycle", { BUSINESS_POSTAL_ADDRESS: ADDRESS });
    expect(footer).toContain(LEGAL_NAME);
    expect(footer).toContain(ADDRESS);
  });

  it("never prints an empty line where an address would go", () => {
    for (const kind of ["transactional", "lifecycle"] as const) {
      expect(emailFooter(kind, {}).split("\n").every((line) => line.trim().length > 0)).toBe(true);
    }
  });
});

describe("the address is never written down", () => {
  const SKIP = /\.(png|jpg|jpeg|webp|ico|woff2?|sqlite)$/;

  it("appears in no source file, so it can only ever come from the environment", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    const walk = async (dir: string): Promise<string[]> => {
      const entries = await readdir(dir, { withFileTypes: true });
      const out: string[] = [];
      for (const entry of entries) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) out.push(...await walk(full));
        else if (!SKIP.test(entry.name)) out.push(full);
      }
      return out;
    };

    // Street lines, PO boxes and "CITY, ST 00000" tails. A home address published on a terms page is
    // scraped and archived within days and no later edit takes it back, so the ratchet is the code
    // itself: there must be nowhere for one to live except an environment variable.
    const shapes = [
      /\b\d{1,6}\s+(?:[NSEW]\.?\s+)?[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir|Terrace|Ter|Place|Pl|Way|Highway|Hwy|Parkway|Pkwy)\b/,
      /\bP\.?\s?O\.?\s?Box\s+\d+/i,
      /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)[,.]?\s+\d{5}\b/,
    ];

    const offenders: string[] = [];
    for (const file of await walk("src")) {
      const text = await readFile(file, "utf8");
      if (shapes.some((shape) => shape.test(text))) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

describe("the brand and the legal entity", () => {
  it("keeps them separate", () => {
    expect(DISPLAY_NAME).toBe("MPE Labs");
    expect(LEGAL_NAME).toBe("MadPugExperiment LLC");
    expect(DISPLAY_NAME).not.toBe(LEGAL_NAME);
  });

  it("names only the LLC in a contract until a fictitious name is registered", () => {
    // Florida requires a Fictitious Name Registration (§865.09) before trading under another name.
    // Asserting an unregistered "doing business as" on a legal page is a claim the state has not agreed to.
    expect(registeredDba({})).toBeNull();
    expect(contractingParty({})).toBe(LEGAL_NAME);
    expect(contractingParty({})).not.toContain(DISPLAY_NAME);
  });

  it("adds the fictitious name once it is registered", () => {
    expect(contractingParty({ LEGAL_DBA: "MPE Labs" })).toBe("MadPugExperiment LLC, doing business as MPE Labs");
  });
});
