// Baara — Template API Routes

import { Hono } from "hono";
import type { TemplateService } from "../../services/template-service.ts";

export function templateRoutes(templateService: TemplateService) {
  const app = new Hono();

  app.get("/", (c) => c.json(templateService.listTemplates()));

  app.get("/:id", (c) => {
    const template = templateService.getTemplate(c.req.param("id"));
    if (!template) return c.json({ error: "Template not found" }, 404);
    return c.json(template);
  });

  app.post("/", async (c) => {
    const body = await c.req.json();
    try {
      return c.json(templateService.createTemplate(body), 201);
    } catch (error) {
      return c.json({ error: String(error) }, 400);
    }
  });

  app.delete("/:id", (c) => {
    templateService.deleteTemplate(c.req.param("id"));
    return c.json({ ok: true });
  });

  app.post("/:id/create-task", async (c) => {
    const body = await c.req.json();
    try {
      const task = templateService.createTaskFromTemplate(c.req.param("id"), body);
      return c.json(task, 201);
    } catch (error) {
      return c.json({ error: String(error) }, 400);
    }
  });

  return app;
}
