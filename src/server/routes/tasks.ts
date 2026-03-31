// Fakoli Mini — Task API Routes

import { Hono } from "hono";
import type { TaskService } from "../../services/task-service.ts";
import type { JobService } from "../../services/job-service.ts";
import type { Scheduler } from "../../engine/scheduler.ts";

export function taskRoutes(taskService: TaskService, jobService: JobService, scheduler: Scheduler) {
  const app = new Hono();

  app.get("/", (c) => c.json(taskService.listTasks()));

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

  app.post("/:id/run", async (c) => {
    try {
      const job = await jobService.runImmediate(c.req.param("id"));
      return c.json(job);
    } catch (error) {
      return c.json({ error: String(error) }, 400);
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
