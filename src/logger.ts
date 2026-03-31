// Baara — Structured Logger
// JSON-formatted log entries with timestamp, level, component, and optional data

import { appendFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

export type LogLevel = "info" | "warn" | "error";

let logsDir: string = "";

export function initLogger(dir: string): void {
  logsDir = dir;
}

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

// --- JSONL Execution Logger ---

export function jobLog(
  jobId: string,
  taskName: string,
  level: LogLevel,
  msg: string,
  data?: Record<string, unknown>,
): void {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    jobId,
    taskName,
    level,
    msg,
    ...(data || {}),
  };

  // Also log to stdout via existing log()
  log(level, "executor", `[${taskName}] ${msg}`, { jobId, ...(data || {}) });

  // Append to JSONL file
  if (logsDir) {
    try {
      appendFileSync(join(logsDir, "execution.jsonl"), JSON.stringify(entry) + "\n");
    } catch {
      // Silently fail if file write fails — don't crash the executor
    }
  }
}

// --- JSONL Log Reader ---

export function readLogs(opts?: {
  limit?: number;
  level?: string;
  jobId?: string;
  taskName?: string;
}): object[] {
  const filePath = join(logsDir, "execution.jsonl");
  if (!logsDir || !existsSync(filePath)) return [];

  const lines = readFileSync(filePath, "utf-8").trim().split("\n").filter(Boolean);
  let entries = lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  // Filter
  if (opts?.level) entries = entries.filter((e: Record<string, unknown>) => e.level === opts.level);
  if (opts?.jobId) entries = entries.filter((e: Record<string, unknown>) => e.jobId === opts.jobId);
  if (opts?.taskName) entries = entries.filter((e: Record<string, unknown>) => e.taskName === opts.taskName);

  // Most recent first, limit
  entries.reverse();
  if (opts?.limit) entries = entries.slice(0, opts.limit);

  return entries;
}
