// Baara — Entry Point

import { mkdirSync } from "fs";
import { join } from "path";
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
import { createBaaraTools } from "./chat/tools.ts";
import { log, initLogger } from "./logger.ts";

const config = loadConfig();

// Create ~/.nexus directory structure
mkdirSync(config.nexusDir, { recursive: true });
mkdirSync(config.logsDir, { recursive: true });
mkdirSync(config.sessionsDir, { recursive: true });
mkdirSync(join(config.nexusDir, "briefings"), { recursive: true });

// Backward compat: create data/ if DB_PATH still points there
if (config.dbPath.startsWith("data/")) {
  mkdirSync("data", { recursive: true });
}

// Initialize JSONL execution logger
initLogger(config.logsDir);

// Database
const db = initDatabase(config.dbPath);
const store = new Store(db);

// --- Crash recovery: reset orphaned jobs stuck in "running" ---
const orphaned = db.query(
  "UPDATE jobs SET status = 'failed', error = 'Server restarted during execution', completed_at = datetime('now') WHERE status = 'running' RETURNING id"
).all() as Array<{ id: string }>;
if (orphaned.length > 0) {
  log("warn", "startup", `Recovered ${orphaned.length} orphaned job(s) stuck in running state`, {
    jobIds: orphaned.map(r => r.id),
  });
}

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

// Chat — MCP server with Baara tools
const baaraServer = createBaaraTools({ taskService, jobService, templateService, store });

// Server
const apiKey = process.env["BAARA_API_KEY"];

const app = createApp({
  store,
  taskService,
  jobService,
  templateService,
  scheduler,
  baaraServer,
  staticDir: config.staticDir,
  apiKey,
});

// Start everything
scheduler.start();
if (config.defaultExecutionMode === "queued") {
  queueManager.start();
  log("info", "startup", "Queue manager started, polling for jobs");
}
healthMonitor.start();

log("info", "startup", "Baara starting", {
  database: config.dbPath,
  executionMode: config.defaultExecutionMode,
  authMode: config.authMode,
  host: config.host,
  port: config.port,
});

if (!apiKey) {
  log("warn", "security", "BAARA_API_KEY is not set - /api/* routes are unauthenticated");
}

log("info", "startup", `Server listening on http://${config.host}:${config.port}`);

// --- Graceful shutdown ---
let shuttingDown = false;

function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("info", "shutdown", `Received ${signal}, shutting down gracefully`);

  scheduler.stop();
  queueManager.stop();
  healthMonitor.stop();

  // WAL checkpoint before closing
  try {
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    log("info", "shutdown", "WAL checkpoint completed");
  } catch (err) {
    log("error", "shutdown", "WAL checkpoint failed", { error: String(err) });
  }

  db.close();
  log("info", "shutdown", "Baara stopped");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// --- Unhandled rejection handler ---
process.on("unhandledRejection", (reason) => {
  log("error", "process", "Unhandled promise rejection", { reason: String(reason) });
});

process.on("uncaughtException", (err) => {
  log("error", "process", "Uncaught exception", { error: String(err), stack: err.stack });
  shutdown("uncaughtException");
});

export default {
  port: config.port,
  hostname: config.host,
  fetch: app.fetch,
};
