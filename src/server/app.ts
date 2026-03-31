// Baara — Hono Application

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { taskRoutes } from "./routes/tasks.ts";
import { jobRoutes } from "./routes/jobs.ts";
import { templateRoutes } from "./routes/templates.ts";
import { systemRoutes } from "./routes/system.ts";
import { chatRoutes } from "./routes/chat.ts";
import type { TaskService } from "../services/task-service.ts";
import type { JobService } from "../services/job-service.ts";
import type { TemplateService } from "../services/template-service.ts";
import type { Store } from "../db/store.ts";
import type { Scheduler } from "../engine/scheduler.ts";
import type { McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";

export interface AppDeps {
  store: Store;
  taskService: TaskService;
  jobService: JobService;
  templateService: TemplateService;
  scheduler: Scheduler;
  baaraServer: McpSdkServerConfigWithInstance;
  staticDir: string;
  apiKey?: string;
}

// --- Security: CORS exact origin allowlist ---
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://10.0.0.167:3000",
  "http://Fakoli-Mini.local:3000",
  "http://baara.local:3000",
]);

// --- Security: Simple rate limiter ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max 10 run/submit calls per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();

  // Security headers: CSP, X-Frame-Options, X-Content-Type-Options
  app.use("*", async (c, next) => {
    await next();
    c.header("Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self';"
    );
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
  });

  // CORS: exact origin allowlist
  app.use(cors({
    origin: (origin) => ALLOWED_ORIGINS.has(origin) ? origin : "",
  }));

  // Auth middleware: require BAARA_API_KEY on all /api/* routes (if configured)
  app.use("/api/*", async (c, next) => {
    if (deps.apiKey) {
      const provided = c.req.header("X-Api-Key") || c.req.header("Authorization")?.replace("Bearer ", "");
      if (provided !== deps.apiKey) {
        return c.json({ error: "Unauthorized" }, 401);
      }
    }
    await next();
  });

  // Rate limiting on run/submit endpoints
  app.use("/api/tasks/:id/run", async (c, next) => {
    const ip = c.req.header("x-forwarded-for") || "local";
    if (!checkRateLimit(ip)) {
      return c.json({ error: "Rate limit exceeded. Max 10 runs per minute." }, 429);
    }
    await next();
  });
  app.use("/api/tasks/:id/submit", async (c, next) => {
    const ip = c.req.header("x-forwarded-for") || "local";
    if (!checkRateLimit(ip)) {
      return c.json({ error: "Rate limit exceeded. Max 10 submissions per minute." }, 429);
    }
    await next();
  });
  app.use("/api/chat", async (c, next) => {
    const ip = c.req.header("x-forwarded-for") || "local";
    if (!checkRateLimit(ip)) {
      return c.json({ error: "Rate limit exceeded. Max 10 chat calls per minute." }, 429);
    }
    await next();
  });

  // API routes
  app.route("/api/tasks", taskRoutes(deps.taskService, deps.jobService, deps.scheduler));
  app.route("/api/jobs", jobRoutes(deps.jobService));
  app.route("/api/templates", templateRoutes(deps.templateService));
  app.route("/api/chat", chatRoutes(deps.baaraServer));
  app.route("/api", systemRoutes(deps.store));

  // Job list nested under tasks
  app.get("/api/tasks/:id/jobs", (c) => {
    const taskId = c.req.param("id");
    const rawLimit = c.req.query("limit");
    const limit = rawLimit && !isNaN(Number(rawLimit)) ? Math.min(parseInt(rawLimit, 10), 1000) : undefined;
    const rawStatus = c.req.query("status");
    const validStatuses = ["pending", "running", "completed", "failed", "triage", "timed_out", "cancelled"];
    const status = rawStatus && validStatuses.includes(rawStatus) ? rawStatus as any : undefined;
    return c.json(deps.store.listJobs(taskId, { limit, status }));
  });

  // Global error handler — sanitized, no internal details leaked
  app.onError((err, c) => {
    console.error("Server error:", err);
    return c.json({ error: "Internal server error" }, 500);
  });

  // Static files (web UI) — fallback to index.html for SPA routing
  app.use("/*", serveStatic({ root: `./${deps.staticDir}` }));
  app.use("/*", serveStatic({ root: `./${deps.staticDir}`, path: "index.html" }));

  return app;
}
