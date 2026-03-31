// Baara — System API Routes

import { Hono } from "hono";
import type { Store } from "../../db/store.ts";
import { discoverAll } from "../../integrations/claude-code.ts";
import { log } from "../../logger.ts";

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
