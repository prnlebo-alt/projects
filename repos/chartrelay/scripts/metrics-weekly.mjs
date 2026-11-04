// Weekly metrics for a ChartRelay deployment: the activation funnel, the survey answers, and the
// numbers that say whether anything is being used.
//
// Usage: node scripts/metrics-weekly.mjs [--days=7] [--json] [--db=<path>]
// Reads the SQLite file directly and writes to stdout. Sends nothing anywhere and reads no secrets:
// this is meant to be run by the owner, on the box or against a copy, and pasted where it is useful.
import DatabaseDriver from "better-sqlite3";
import { pathToFileURL } from "node:url";

const DEFAULT_DAYS = 7;

/** The funnel, in the order a person moves through it. Names match src/lib/metrics/activation.ts. */
export // Every rung of the paid ladder. "scale" is the retired name for Business and stays in the list so a
// row written before the rename is still counted as paying; src/lib/db/index.ts migrates those rows,
// but this script also reads restored backups taken before that migration ran.
const PAYING_PLANS_SQL = "SELECT COUNT(*) AS n FROM workspaces WHERE plan IN ('developer','pro','business','scale')";

const FUNNEL_STEPS = [
  ["signup", "Signed up"],
  ["first_render", "Drew a first chart"],
  ["second_day_render", "Came back another day"],
  ["upgrade_page_view", "Looked at pricing"],
  ["checkout_start", "Started checkout"],
];

export function parseArgs(argv, env = {}) {
  let days = DEFAULT_DAYS;
  let json = false;
  let dbPath = env.DATABASE_PATH ?? "./.data/chartrelay.db";
  for (const arg of argv) {
    if (arg === "--json") json = true;
    else if (arg.startsWith("--days=")) {
      const value = Number(arg.slice(7));
      if (!Number.isInteger(value) || value < 1 || value > 365) return { error: `--days must be a whole number of days between 1 and 365, got "${arg.slice(7)}".` };
      days = value;
    } else if (arg.startsWith("--db=")) dbPath = arg.slice(5);
    else if (arg === "--help" || arg === "-h") return { help: true };
    else return { error: `Unrecognised argument "${arg}".` };
  }
  return { days, json, dbPath };
}

/** A percentage of a base, or null when the base is zero — "0 of 0" is not 0%, it is unknown. */
export const share = (part, whole) => (whole > 0 ? part / whole : null);

/** True when this database has been opened by a version of the app that creates the table. */
export const hasActivationTable = (sqlite) =>
  sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'activation_events'").get() !== undefined;

export function collect(sqlite, days, now = new Date()) {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  // A database created before the instrumentation shipped has no table until the app next opens it.
  // Reporting that plainly beats a stack trace, and beats printing zeros that look like real numbers.
  if (!hasActivationTable(sqlite)) {
    return {
      since, days, funnel: null, answers: [],
      renders: Number(sqlite.prepare("SELECT COUNT(*) AS n FROM renders WHERE created_at >= ?").get(since)?.n ?? 0),
      activeWorkspaces: Number(sqlite.prepare("SELECT COUNT(DISTINCT workspace_id) AS n FROM renders WHERE created_at >= ?").get(since)?.n ?? 0),
      paying: Number(sqlite.prepare(PAYING_PLANS_SQL).get()?.n ?? 0),
      totalWorkspaces: Number(sqlite.prepare("SELECT COUNT(*) AS n FROM workspaces").get()?.n ?? 0),
    };
  }
  const countsRows = sqlite.prepare(
    "SELECT name, COUNT(DISTINCT workspace_id) AS workspaces FROM activation_events WHERE created_at >= ? GROUP BY name",
  ).all(since);
  const counts = new Map(countsRows.map((row) => [row.name, Number(row.workspaces)]));
  const signups = counts.get("signup") ?? 0;

  const funnel = FUNNEL_STEPS.map(([event, label]) => {
    const workspaces = counts.get(event) ?? 0;
    return { event, label, workspaces, ofSignups: share(workspaces, signups) };
  });

  const answers = sqlite.prepare(
    "SELECT detail AS answer, created_at AS at FROM activation_events WHERE name = 'survey_answer' AND created_at >= ? AND detail IS NOT NULL ORDER BY created_at DESC LIMIT 50",
  ).all(since);

  const renders = Number(sqlite.prepare("SELECT COUNT(*) AS n FROM renders WHERE created_at >= ?").get(since)?.n ?? 0);
  const activeWorkspaces = Number(sqlite.prepare("SELECT COUNT(DISTINCT workspace_id) AS n FROM renders WHERE created_at >= ?").get(since)?.n ?? 0);
  const paying = Number(sqlite.prepare(PAYING_PLANS_SQL).get()?.n ?? 0);
  const totalWorkspaces = Number(sqlite.prepare("SELECT COUNT(*) AS n FROM workspaces").get()?.n ?? 0);

  return { since, days, funnel, answers, renders, activeWorkspaces, paying, totalWorkspaces };
}

const pct = (value) => (value === null ? "  —  " : `${(value * 100).toFixed(0).padStart(3)}%`);

export function format(report) {
  const lines = [];
  lines.push(`ChartRelay — last ${report.days} day${report.days === 1 ? "" : "s"} (since ${report.since.slice(0, 10)})`);
  lines.push("");
  if (report.funnel === null) {
    lines.push("No activation table in this database yet — it is created the next time the app opens it.");
  } else {
    lines.push("Activation funnel — workspaces, not events, so one enthusiastic account cannot look like traction:");
    const width = Math.max(...report.funnel.map((row) => row.label.length));
    for (const row of report.funnel) {
      lines.push(`  ${row.label.padEnd(width)}  ${String(row.workspaces).padStart(5)}  ${pct(row.ofSignups)} of signups`);
    }
  }
  lines.push("");
  lines.push(`Renders stored: ${report.renders}   Workspaces that drew anything: ${report.activeWorkspaces}`);
  lines.push(`Workspaces: ${report.totalWorkspaces} total, ${report.paying} paying`);
  if (report.answers.length) {
    lines.push("");
    lines.push(`"What would you use ChartRelay for?" — ${report.answers.length} answer${report.answers.length === 1 ? "" : "s"}:`);
    // Printed in full and unaggregated. While there are few enough to read, reading them is the point.
    for (const row of report.answers) lines.push(`  ${row.at.slice(0, 10)}  ${row.answer}`);
  }
  if (report.funnel !== null && report.funnel[0].workspaces === 0) {
    lines.push("");
    lines.push("No sign-ups in this window, so every ratio above is undefined rather than zero.");
  }
  return lines.join("\n");
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv, env);
  if (args.error) { console.error(args.error); return 1; }
  if (args.help) { console.log("Usage: node scripts/metrics-weekly.mjs [--days=7] [--json] [--db=<path>]"); return 0; }
  let sqlite;
  try {
    sqlite = new DatabaseDriver(args.dbPath, { readonly: true, fileMustExist: true });
  } catch {
    console.error(`Could not open the database at ${args.dbPath}. Pass --db=<path> or set DATABASE_PATH.`);
    return 1;
  }
  try {
    const report = collect(sqlite, args.days);
    console.log(args.json ? JSON.stringify(report, null, 2) : format(report));
    return 0;
  } finally {
    sqlite.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().then((code) => process.exit(code));
}
