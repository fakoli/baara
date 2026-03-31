// Baara — Hono Application

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { taskRoutes } from "./routes/tasks.ts";
import { jobRoutes } from "./routes/jobs.ts";
import { templateRoutes } from "./routes/templates.ts";
import { systemRoutes } from "./routes/system.ts";
import type { TaskService } from "../services/task-service.ts";
import type { JobService } from "../services/job-service.ts";
import type { TemplateService } from "../services/template-service.ts";
import type { Store } from "../db/store.ts";
import type { Scheduler } from "../engine/scheduler.ts";

export interface AppDeps {
  store: Store;
  taskService: TaskService;
  jobService: JobService;
  templateService: TemplateService;
  scheduler: Scheduler;
  staticDir: string;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();

  app.use(cors({ origin: (origin) => origin.includes("localhost") || origin.includes("127.0.0.1") || origin.includes("10.0.0.") || origin.includes("baara") ? origin : "" }));

  // API routes
  app.route("/api/tasks", taskRoutes(deps.taskService, deps.jobService, deps.scheduler));
  app.route("/api/jobs", jobRoutes(deps.jobService));
  app.route("/api/templates", templateRoutes(deps.templateService));
  app.route("/api", systemRoutes(deps.store));

  // Job list nested under tasks
  app.get("/api/tasks/:id/jobs", (c) => {
    const taskId = c.req.param("id");
    const rawLimit = c.req.query("limit");
    const limit = rawLimit && !isNaN(Number(rawLimit)) ? parseInt(rawLimit, 10) : undefined;
    const rawStatus = c.req.query("status");
    const validStatuses = ["pending", "running", "completed", "failed", "triage", "timed_out", "cancelled"];
    const status = rawStatus && validStatuses.includes(rawStatus) ? rawStatus as any : undefined;
    return c.json(deps.store.listJobs(taskId, { limit, status }));
  });

  // Global error handler
  app.onError((err, c) => {
    console.error("Server error:", err);
    return c.json({ error: "Internal server error" }, 500);
  });

  // Static files (web UI) — fallback to index.html for SPA routing
  app.use("/*", serveStatic({ root: `./${deps.staticDir}` }));
  app.use("/*", serveStatic({ root: `./${deps.staticDir}`, path: "index.html" }));

  return app;
}
