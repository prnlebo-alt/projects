import { emailConfigProblem } from "@/lib/email/send";

export const MIN_SESSION_SECRET_LENGTH = 32;

export type StartupReport = { fatal: string[]; warnings: string[] };

/** Production configuration problems. Fatal ones stop the server; warnings are logged prominently. Never includes values. */
export function productionConfigReport(env: Record<string, string | undefined> = process.env): StartupReport {
  const fatal: string[] = [];
  const warnings: string[] = [];
  const sessionSecret = env.SESSION_SECRET ?? "";
  if (!sessionSecret) fatal.push("SESSION_SECRET is missing.");
  else if (sessionSecret.length < MIN_SESSION_SECRET_LENGTH) fatal.push(`SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters.`);
  // Same helper the support page and the password-reset route read, so the log and the copy agree.
  const emailProblem = emailConfigProblem(env);
  if (emailProblem) warnings.push(emailProblem);
  return { fatal, warnings };
}
