import { beforeEach, describe, expect, it } from "vitest";
import { ACTIVATION_EVENTS, funnel, hasEvent, recordActivation, recordRender, SURVEY_MAX_LENGTH, surveyAnswers } from "@/lib/metrics/activation";
import { db } from "@/lib/db";
import { activationEvents, users, workspaces } from "@/lib/db/schema";

const WS = "ws-activation";
const OTHER = "ws-other";

const seed = (id: string) => {
  const now = new Date().toISOString();
  db.insert(users).values({ id: `user_${id}`, email: `${id}@example.com`, passwordHash: "x", name: "T", createdAt: now }).run();
  db.insert(workspaces).values({ id, ownerId: `user_${id}`, name: "W", createdAt: now }).run();
};

beforeEach(() => {
  db.delete(activationEvents).run();
  db.delete(users).run();
  db.delete(workspaces).run();
  seed(WS);
  seed(OTHER);
});

const rowsFor = (name: string) => db.select().from(activationEvents).all().filter((row) => row.name === name);

describe("milestones are facts, not counters", () => {
  it("records a signup once even if asked twice", () => {
    // A second "signup" would make every ratio in the funnel wrong in the direction that flatters us.
    recordActivation(WS, "signup");
    recordActivation(WS, "signup");
    expect(rowsFor("signup")).toHaveLength(1);
  });

  it("records the first render once, however many charts follow", () => {
    recordRender(WS);
    recordRender(WS);
    recordRender(WS);
    expect(rowsFor("first_render")).toHaveLength(1);
  });

  it("counts a repeatable event every time", () => {
    recordActivation(WS, "upgrade_page_view");
    recordActivation(WS, "upgrade_page_view");
    expect(rowsFor("upgrade_page_view")).toHaveLength(2);
  });
});

describe("coming back another day", () => {
  it("is not recorded for two renders in one sitting", () => {
    // "Two renders" is something a single sitting produces, and measuring it would say nothing about
    // whether anyone returned.
    const morning = new Date("2026-03-01T09:00:00.000Z");
    recordRender(WS, morning);
    recordRender(WS, new Date("2026-03-01T17:30:00.000Z"));
    expect(rowsFor("second_day_render")).toHaveLength(0);
  });

  it("is recorded on a render the following day", () => {
    recordRender(WS, new Date("2026-03-01T09:00:00.000Z"));
    recordRender(WS, new Date("2026-03-02T09:00:00.000Z"));
    expect(rowsFor("second_day_render")).toHaveLength(1);
  });

  it("is recorded only once however many days follow", () => {
    recordRender(WS, new Date("2026-03-01T09:00:00.000Z"));
    recordRender(WS, new Date("2026-03-02T09:00:00.000Z"));
    recordRender(WS, new Date("2026-03-05T09:00:00.000Z"));
    expect(rowsFor("second_day_render")).toHaveLength(1);
  });
});

describe("instrumentation never breaks what it measures", () => {
  it("swallows a write against a workspace that does not exist", () => {
    // A foreign key violation here must not turn a successful render into an error for the person who
    // just drew one.
    expect(() => recordActivation("ws-does-not-exist", "first_render")).not.toThrow();
    expect(() => recordRender("ws-does-not-exist")).not.toThrow();
  });
});

describe("the funnel counts workspaces, not events", () => {
  it("counts one workspace once however many times it did the thing", () => {
    recordActivation(WS, "upgrade_page_view");
    recordActivation(WS, "upgrade_page_view");
    recordActivation(OTHER, "upgrade_page_view");
    const row = funnel("2000-01-01T00:00:00.000Z").find((r) => r.event === "upgrade_page_view")!;
    expect(row.workspaces).toBe(2);
  });

  it("reports an undefined rather than zero share when nobody signed up", () => {
    // "0 of 0" is not 0%, it is unknown, and printing 0% would read as a failed funnel rather than an
    // empty one.
    recordActivation(WS, "upgrade_page_view");
    for (const row of funnel("2000-01-01T00:00:00.000Z")) expect(row.ofSignups).toBeNull();
  });

  it("divides by the signups in the window", () => {
    recordActivation(WS, "signup");
    recordActivation(OTHER, "signup");
    recordRender(WS);
    const row = funnel("2000-01-01T00:00:00.000Z").find((r) => r.event === "first_render")!;
    expect(row.ofSignups).toBeCloseTo(0.5);
  });

  it("reports every event, including the ones nobody reached", () => {
    const events = funnel("2000-01-01T00:00:00.000Z").map((row) => row.event);
    expect(events).toEqual([...ACTIVATION_EVENTS]);
  });

  it("ignores events outside the window", () => {
    recordActivation(WS, "signup");
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    expect(funnel(tomorrow).every((row) => row.workspaces === 0)).toBe(true);
  });
});

describe("the survey answer", () => {
  it("is stored and read back", () => {
    recordActivation(WS, "survey_answer", "Weekly revenue charts in our Slack digest");
    expect(surveyAnswers("2000-01-01T00:00:00.000Z")[0].answer).toContain("Slack digest");
  });

  it("is capped so a row cannot become a payload", () => {
    recordActivation(WS, "survey_answer", "x".repeat(5000));
    expect(surveyAnswers("2000-01-01T00:00:00.000Z")[0].answer).toHaveLength(SURVEY_MAX_LENGTH);
  });

  it("is answerable more than once at the storage layer, and gated above it", () => {
    // The route refuses a second answer; the storage layer does not, so the gate has to be visible.
    expect(hasEvent(WS, "survey_answer")).toBe(false);
    recordActivation(WS, "survey_answer", "one");
    expect(hasEvent(WS, "survey_answer")).toBe(true);
  });
});

describe("what is not collected", () => {
  it("stores no IP address, user agent or third-party identifier", () => {
    // The privacy page names three subprocessors. Quietly becoming a fourth kind of data collector is
    // exactly what it exists to prevent.
    recordActivation(WS, "signup");
    const columns = Object.keys(db.select().from(activationEvents).all()[0]);
    expect(columns.sort()).toEqual(["createdAt", "detail", "id", "name", "workspaceId"]);
  });
});
