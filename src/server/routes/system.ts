// Baara — System API Routes

import { Hono } from "hono";
import type { Store } from "../../db/store.ts";
import { discoverAll } from "../../integrations/claude-code.ts";
import { log, readLogs } from "../../logger.ts";

export function systemRoutes(store: Store) {
  const app = new Hono();

  app.get("/health", (c) => {
    try {
      store.db.query("SELECT 1").get();
      return c.json({ status: "ok", timestamp: new Date().toISOString(), db: "connected" });
    } catch {
      return c.json({ status: "unhealthy", timestamp: new Date().toISOString(), db: "disconnected" }, 503);
    }
  });

  app.get("/usage", (c) => c.json(store.getUsageStats()));

  app.get("/status", (c) => {
    const queues = store.listQueues();
    const triageCount = store.getTriageJobs().length;
    const usage = store.getUsageStats();
    return c.json({ queues, triageCount, usage });
  });

  app.get("/queues", (c) => c.json(store.listQueues()));

  app.get("/queues/:name", (c) => {
    const info = store.getQueueInfo(c.req.param("name"));
    if (!info) return c.json({ error: "Queue not found" }, 404);
    return c.json(info);
  });

  // Execution logs (JSONL)
  app.get("/logs", (c) => {
    const limit = parseInt(c.req.query("limit") ?? "100");
    const level = c.req.query("level") || undefined;
    const jobId = c.req.query("jobId") || undefined;
    const taskName = c.req.query("taskName") || undefined;
    return c.json(readLogs({ limit: Math.min(limit, 500), level, jobId, taskName }));
  });

  // Claude Code integration: discovered plugins and commands
  app.get("/integrations/claude-code", async (c) => {
    try {
      const integration = await discoverAll();
      return c.json(integration);
    } catch (err) {
      log("error", "integrations", "Claude Code discovery failed", { error: String(err) });
      return c.json({ error: "Could not discover Claude Code integrations" }, 500);
    }
  });

  return app;
}
