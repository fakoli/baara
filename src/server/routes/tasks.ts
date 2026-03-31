// Baara — Task API Routes

import { Hono } from "hono";
import type { TaskService } from "../../services/task-service.ts";
import type { JobService } from "../../services/job-service.ts";
import type { Scheduler } from "../../engine/scheduler.ts";
import { log } from "../../logger.ts";

export function taskRoutes(taskService: TaskService, jobService: JobService, scheduler: Scheduler) {
  const app = new Hono();

  app.get("/", (c) => {
    const projectId = c.req.query("projectId");
    return c.json(taskService.listTasks(projectId));
  });

  app.get("/:id", (c) => {
    const task = taskService.getTask(c.req.param("id"));
    if (!task) return c.json({ error: "Task not found" }, 404);
    return c.json(task);
  });

  app.post("/", async (c) => {
    const body = await c.req.json();
    try {
      const task = taskService.createTask(body);
      if (task.enabled && task.cronExpression) {
        scheduler.register(task.id, task.cronExpression);
      }
      return c.json(task, 201);
    } catch (error) {
      return c.json({ error: String(error) }, 400);
    }
  });

  app.put("/:id", async (c) => {
    const id = c.req.param("id");
    const existing = taskService.getTask(id);
    if (!existing) return c.json({ error: "Task not found" }, 404);
    const body = await c.req.json();
    const task = taskService.updateTask(id, body);

    // Update scheduler if cron changed
    if (task.enabled && task.cronExpression) {
      scheduler.register(task.id, task.cronExpression);
    } else {
      scheduler.unregister(task.id);
    }
    return c.json(task);
  });

  app.delete("/:id", (c) => {
    const id = c.req.param("id");
    scheduler.unregister(id);
    taskService.deleteTask(id);
    return c.json({ ok: true });
  });

  app.post("/:id/submit", async (c) => {
    try {
      const job = await jobService.submitTask(c.req.param("id"));
      return c.json(job);
    } catch (error) {
      return c.json({ error: String(error) }, 400);
    }
  });

  // ?async=true returns job immediately with status "running", completes in background
  // ?async=false (default) blocks until execution finishes
  app.post("/:id/run", async (c) => {
    const asyncMode = c.req.query("async") === "true";
    try {
      if (asyncMode) {
        // Fire-and-forget: return the job immediately, run in background
        const jobPromise = jobService.runImmediate(c.req.param("id"));
        // Return a pending job snapshot after a brief delay to let it start
        await new Promise(r => setTimeout(r, 100));
        const task = taskService.getTask(c.req.param("id"));
        if (!task) return c.json({ error: "Task not found" }, 404);
        const jobs = jobService.listJobs(task.id, { limit: 1 });
        const latestJob = jobs[0];
        // Don't await the promise — let it complete in background
        jobPromise.catch(err => log("error", "tasks-api", "Background run error", { error: String(err) }));
        return c.json(latestJob || { status: "running", message: "Job started in background" });
      }
      const job = await jobService.runImmediate(c.req.param("id"));
      return c.json(job);
    } catch (error) {
      return c.json({ error: "Execution failed" }, 400);
    }
  });

  app.post("/:id/toggle", (c) => {
    try {
      const task = taskService.toggleTask(c.req.param("id"));
      if (task.enabled && task.cronExpression) {
        scheduler.register(task.id, task.cronExpression);
      } else {
        scheduler.unregister(task.id);
      }
      return c.json(task);
    } catch (error) {
      return c.json({ error: String(error) }, 400);
    }
  });

  return app;
}
