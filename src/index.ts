// Fakoli Mini — Entry Point

import { loadConfig } from "./config.ts";
import { initDatabase } from "./db/schema.ts";
import { Store } from "./db/store.ts";
import { Dispatcher } from "./engine/dispatcher.ts";
import { QueueManager } from "./engine/queue-manager.ts";
import { Scheduler } from "./engine/scheduler.ts";
import { HealthMonitor } from "./engine/health-monitor.ts";
import { TaskService } from "./services/task-service.ts";
import { JobService } from "./services/job-service.ts";
import { TemplateService } from "./services/template-service.ts";
import { createApp } from "./server/app.ts";

const config = loadConfig();

// Database
const db = initDatabase(config.dbPath);
const store = new Store(db);

// Engine
const dispatcher = new Dispatcher(store);
const queueManager = new QueueManager(store);
const healthMonitor = new HealthMonitor(store);

// Services
const taskService = new TaskService(store, config.defaultExecutionMode);
const jobService = new JobService(store, dispatcher);
const templateService = new TemplateService(store, taskService);

// Scheduler
const scheduler = new Scheduler(store, dispatcher);

// Server
const app = createApp({
  store,
  taskService,
  jobService,
  templateService,
  scheduler,
  staticDir: config.staticDir,
});

// Start everything
scheduler.start();
if (config.defaultExecutionMode === "queued") {
  queueManager.start();
  console.log("  Queue manager: polling for jobs");
}
healthMonitor.start();

console.log(`Fakoli Mini starting...`);
console.log(`  Database: ${config.dbPath}`);
console.log(`  Execution mode: ${config.defaultExecutionMode}`);
console.log(`  Server: http://${config.host}:${config.port}`);

export default {
  port: config.port,
  hostname: config.host,
  fetch: app.fetch,
};
