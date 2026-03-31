// Baara — CLI Entry Point

import { Command } from "commander";
import { loadConfig } from "../config.ts";
import { initDatabase } from "../db/schema.ts";
import { Store } from "../db/store.ts";
import { Dispatcher } from "../engine/dispatcher.ts";
import { TaskService } from "../services/task-service.ts";
import { JobService } from "../services/job-service.ts";
import { TemplateService } from "../services/template-service.ts";
import { initLogger } from "../logger.ts";

import { registerTasksCommand } from "./commands/tasks.ts";
import { registerJobsCommand } from "./commands/jobs.ts";
import { registerQueuesCommand } from "./commands/queues.ts";
import { registerTemplatesCommand } from "./commands/templates.ts";
import { registerStatusCommand } from "./commands/status.ts";
import { registerLogsCommand } from "./commands/logs.ts";

// --- Initialize ---

const config = loadConfig();
initLogger(config.logsDir);
const db = initDatabase(config.dbPath);
const store = new Store(db);
const dispatcher = new Dispatcher(store);
const taskService = new TaskService(store, config.defaultExecutionMode);
const jobService = new JobService(store, dispatcher);
const templateService = new TemplateService(store, taskService);

// --- CLI Program ---

const program = new Command();
program
  .name("baara")
  .description("Baara — delayed task execution CLI")
  .version("0.1.0");

// Register commands
registerTasksCommand(program, store, taskService, jobService);
registerJobsCommand(program, store, jobService);
registerQueuesCommand(program, store);
registerTemplatesCommand(program, store, templateService);
registerStatusCommand(program, store);
registerLogsCommand(program);

// --- Run ---

async function main() {
  try {
    await program.parseAsync(process.argv);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err);
  db.close();
  process.exit(1);
});
