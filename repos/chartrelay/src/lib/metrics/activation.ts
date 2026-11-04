/**
 * The activation funnel: did a new account reach the point of getting value, and then come back.
 *
 * Five events, chosen because each is a step a person either takes or does not, and because the gaps
 * between them are the only questions worth asking before there is any revenue. Signed up, drew
 * something, came back another day, looked at the price, started paying.
 *
 * Not analytics, and kept deliberately thin. No third party, no cross-site identifier, no IP address
 * and no user agent: the privacy page names three subprocessors, and quietly becoming a fourth kind of
 * data collector is precisely what it exists to prevent. A row is a workspace, an event name and a
 * timestamp.
 */
import { randomUUID } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { activationEvents } from "@/lib/db/schema";

export const ACTIVATION_EVENTS = [
  "signup",
  "first_render",
  "second_day_render",
  "upgrade_page_view",
  "checkout_start",
  "survey_answer",
] as const;

export type ActivationEvent = (typeof ACTIVATION_EVENTS)[number];

/** The one free-text answer the upgrade page collects, capped so a row cannot become a payload. */
export const SURVEY_QUESTION = "What would you use ChartRelay for?";
export const SURVEY_MAX_LENGTH = 280;

/**
 * Milestones that describe an account's history rather than counting activity.
 *
 * Recording a second "first render" would make every ratio below wrong in the direction that flatters
 * us, which is the failure mode of most funnels.
 */
const ONCE_PER_WORKSPACE = new Set<ActivationEvent>(["signup", "first_render", "second_day_render"]);

export const hasEvent = (workspaceId: string, name: ActivationEvent): boolean =>
  db.select({ id: activationEvents.id }).from(activationEvents)
    .where(and(eq(activationEvents.workspaceId, workspaceId), eq(activationEvents.name, name))).limit(1).get() !== undefined;

export function recordActivation(workspaceId: string, name: ActivationEvent, detail?: string, at = new Date()): void {
  try {
    if (ONCE_PER_WORKSPACE.has(name) && hasEvent(workspaceId, name)) return;
    db.insert(activationEvents).values({
      id: randomUUID(),
      workspaceId,
      name,
      detail: detail ? detail.slice(0, SURVEY_MAX_LENGTH) : null,
      // Takes the caller's clock rather than reading its own: recordRender compares against the time it
      // was given, and a write stamped from a different clock than the comparison is a bug waiting for
      // the day the two disagree.
      createdAt: at.toISOString(),
    }).run();
  } catch {
    // Instrumentation never breaks the thing it measures. A failed insert — a workspace deleted
    // mid-request, a full disk — must not turn a successful render or signup into an error for the
    // person who just did it.
  }
}

/**
 * Records a render, and the milestone it may also represent.
 *
 * The second-day render is the one number here that says anything about retention, and it is defined
 * as a render on a different calendar day from the first — not "two renders", which a single sitting
 * produces and which would measure nothing.
 */
export function recordRender(workspaceId: string, now = new Date()): void {
  try {
    const first = db.select({ createdAt: activationEvents.createdAt }).from(activationEvents)
      .where(and(eq(activationEvents.workspaceId, workspaceId), eq(activationEvents.name, "first_render")))
      .limit(1).get();
    if (!first) {
      recordActivation(workspaceId, "first_render", undefined, now);
      return;
    }
    if (first.createdAt.slice(0, 10) !== now.toISOString().slice(0, 10)) {
      recordActivation(workspaceId, "second_day_render", undefined, now);
    }
  } catch {
    // As above: a render that drew correctly is not a failure because we could not write a row about it.
  }
}

export interface FunnelRow {
  event: ActivationEvent;
  workspaces: number;
  /** Share of the workspaces that signed up in the window, or null when none did. */
  ofSignups: number | null;
}

/**
 * The funnel over a window, counted in workspaces rather than events.
 *
 * Counting events would let one enthusiastic account look like traction. The question every row
 * answers is "how many accounts got this far", which is the only version of the number worth acting on.
 */
export function funnel(sinceIso: string): FunnelRow[] {
  const counts = new Map<string, number>();
  const rows = db.select({ name: activationEvents.name, workspaces: sql<number>`count(distinct ${activationEvents.workspaceId})` })
    .from(activationEvents).where(gte(activationEvents.createdAt, sinceIso)).groupBy(activationEvents.name).all();
  for (const row of rows) counts.set(row.name, Number(row.workspaces));
  const signups = counts.get("signup") ?? 0;
  return ACTIVATION_EVENTS.map((event) => {
    const workspaces = counts.get(event) ?? 0;
    return { event, workspaces, ofSignups: signups > 0 ? workspaces / signups : null };
  });
}

/** The survey answers in a window, newest first. Free text, so it is read rather than counted. */
export function surveyAnswers(sinceIso: string, limit = 50): Array<{ answer: string; at: string }> {
  return db.select({ answer: activationEvents.detail, at: activationEvents.createdAt })
    .from(activationEvents)
    .where(and(eq(activationEvents.name, "survey_answer"), gte(activationEvents.createdAt, sinceIso)))
    .orderBy(sql`${activationEvents.createdAt} desc`).limit(limit).all()
    .flatMap((row) => (row.answer ? [{ answer: row.answer, at: row.at }] : []));
}
