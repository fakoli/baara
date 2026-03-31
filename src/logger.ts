// Baara — Structured Logger
// JSON-formatted log entries with timestamp, level, component, and optional data

export type LogLevel = "info" | "warn" | "error";

export function log(
  level: LogLevel,
  component: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    component,
    msg: message,
  };
  if (data) {
    Object.assign(entry, data);
  }
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
