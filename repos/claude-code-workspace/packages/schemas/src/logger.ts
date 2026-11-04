/**
 * Minimal structured logger. Emits newline-delimited JSON to stdout/stderr so
 * logs are greppable and machine-parseable without pulling in a logging
 * framework. Every log line carries the current run ID when available.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  runId?: string;
  agentRole?: string;
  workerKind?: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, fields: LogFields = {}): void {
  const line = {
    ts: new Date().toISOString(),
    level,
    message,
    ...fields
  };
  const target = level === "error" ? console.error : console.log;
  target(JSON.stringify(line));
}

export const logger = {
  debug: (message: string, fields?: LogFields) => emit("debug", message, fields),
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields)
};

/** Creates a logger pre-bound to a run ID so every call site doesn't repeat it. */
export function loggerForRun(runId: string): typeof logger {
  return {
    debug: (message, fields) => emit("debug", message, { ...fields, runId }),
    info: (message, fields) => emit("info", message, { ...fields, runId }),
    warn: (message, fields) => emit("warn", message, { ...fields, runId }),
    error: (message, fields) => emit("error", message, { ...fields, runId })
  };
}
