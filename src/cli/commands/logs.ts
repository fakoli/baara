// Baara — CLI Logs Command

import { Command } from "commander";
import { readLogs } from "../../logger.ts";
import { formatTable, formatJson } from "../formatter.ts";

export function registerLogsCommand(program: Command): void {
  program
    .command("logs")
    .description("View execution logs")
    .option("--level <level>", "Filter by level (info, warn, error)")
    .option("--job <id>", "Filter by job ID")
    .option("--task <name>", "Filter by task name")
    .option("--limit <n>", "Number of entries (default: 50)")
    .option("--json", "Raw JSON output")
    .action(
      (opts: {
        level?: string;
        job?: string;
        task?: string;
        limit?: string;
        json?: boolean;
      }) => {
        const limit = opts.limit ? parseInt(opts.limit, 10) : 50;
        const entries = readLogs({
          limit,
          level: opts.level,
          jobId: opts.job,
          taskName: opts.task,
        });

        if (entries.length === 0) {
          console.log("  No log entries found.");
          return;
        }

        if (opts.json) {
          console.log(formatJson(entries));
          return;
        }

        // Format as table
        const rows = (entries as Record<string, unknown>[]).map((e) => ({
          ts: formatTimestamp(e.ts as string),
          level: (e.level as string).toUpperCase(),
          task: truncate(e.taskName as string, 20),
          job: (e.jobId as string).substring(0, 8),
          msg: truncate(e.msg as string, 50),
        }));

        console.log(
          formatTable(rows, [
            { key: "ts", header: "Time", width: 20 },
            { key: "level", header: "Level", width: 6 },
            { key: "task", header: "Task", width: 20 },
            { key: "job", header: "Job", width: 10 },
            { key: "msg", header: "Message", width: 50 },
          ]),
        );
      },
    );
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }) + "." + String(d.getMilliseconds()).padStart(3, "0");
  } catch {
    return iso;
  }
}

function truncate(s: string, max: number): string {
  if (!s) return "";
  return s.length > max ? s.substring(0, max - 3) + "..." : s;
}
