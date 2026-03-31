// Baara — Job API Routes

import { Hono } from "hono";
import type { JobService } from "../../services/job-service.ts";

export function jobRoutes(jobService: JobService) {
  const app = new Hono();

  app.get("/triage", (c) => c.json(jobService.getTriageJobs()));

  app.get("/:id", (c) => {
    const job = jobService.getJob(c.req.param("id"));
    if (!job) return c.json({ error: "Job not found" }, 404);
    return c.json(job);
  });

  app.post("/:id/cancel", (c) => {
    try {
      jobService.cancelJob(c.req.param("id"));
      return c.json({ ok: true });
    } catch (error) {
      return c.json({ error: String(error) }, 400);
    }
  });

  app.post("/:id/retry", async (c) => {
    try {
      const job = await jobService.retryJob(c.req.param("id"));
      return c.json(job);
    } catch (error) {
      return c.json({ error: String(error) }, 400);
    }
  });

  return app;
}
