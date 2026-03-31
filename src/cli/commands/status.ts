// Fakoli Mini — CLI Status Command

import { Command } from "commander";
import type { Store } from "../../db/store.ts";
import { formatStatus, formatJson } from "../formatter.ts";

export function registerStatusCommand(
  program: Command,
  store: Store,
): void {
  program
    .command("status")
    .description("Full system status: queues, triage count, usage")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      const queues = store.listQueues();
      const triageJobs = store.getTriageJobs();
      const usage = store.getUsageStats();

      if (opts.json) {
        console.log(
          formatJson({
            queues,
            triageCount: triageJobs.length,
            usage,
          }),
        );
      } else {
        console.log(formatStatus(queues, triageJobs.length, usage));
      }
    });
}
