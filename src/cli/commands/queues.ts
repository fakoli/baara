// Baara — CLI Queues Commands

import { Command } from "commander";
import type { Store } from "../../db/store.ts";
import {
  formatQueueTable,
  formatQueueDetail,
  formatJson,
} from "../formatter.ts";

export function registerQueuesCommand(
  program: Command,
  store: Store,
): void {
  const queues = program.command("queues").description("Manage queues");

  // --- list ---
  queues
    .command("list")
    .description("Show all queues with depths")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      const allQueues = store.listQueues();
      if (opts.json) {
        console.log(formatJson(allQueues));
      } else {
        console.log(formatQueueTable(allQueues));
      }
    });

  // --- show ---
  queues
    .command("show <name>")
    .description("Queue detail")
    .option("--json", "Output as JSON")
    .action((name: string, opts: { json?: boolean }) => {
      const queue = store.getQueueInfo(name);
      if (!queue) {
        console.error(`Error: Queue not found: ${name}`);
        process.exit(1);
      }
      if (opts.json) {
        console.log(formatJson(queue));
      } else {
        console.log(formatQueueDetail(queue));
      }
    });
}
