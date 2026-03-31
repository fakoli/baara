// Baara — Project API Routes

import { Hono } from "hono";
import type { Store } from "../../db/store.ts";

export function projectRoutes(store: Store) {
  const app = new Hono();

  // List all projects
  app.get("/", (c) => c.json(store.listProjects()));

  // Get single project
  app.get("/:id", (c) => {
    const project = store.getProject(c.req.param("id"));
    if (!project) return c.json({ error: "Project not found" }, 404);
    return c.json(project);
  });

  // Create project
  app.post("/", async (c) => {
    const body = await c.req.json();
    if (!body.name || typeof body.name !== "string") {
      return c.json({ error: "name is required" }, 400);
    }
    try {
      const project = store.createProject(crypto.randomUUID(), {
        name: body.name,
        description: body.description,
        instructions: body.instructions,
        workingDirectory: body.workingDirectory,
      });
      return c.json(project, 201);
    } catch (error) {
      return c.json({ error: String(error) }, 400);
    }
  });

  // Update project
  app.put("/:id", async (c) => {
    const id = c.req.param("id");
    const existing = store.getProject(id);
    if (!existing) return c.json({ error: "Project not found" }, 404);
    const body = await c.req.json();
    try {
      const project = store.updateProject(id, {
        name: body.name,
        description: body.description,
        instructions: body.instructions,
        workingDirectory: body.workingDirectory,
      });
      return c.json(project);
    } catch (error) {
      return c.json({ error: String(error) }, 400);
    }
  });

  // Delete project
  app.delete("/:id", (c) => {
    const id = c.req.param("id");
    const existing = store.getProject(id);
    if (!existing) return c.json({ error: "Project not found" }, 404);
    store.deleteProject(id);
    return c.json({ ok: true });
  });

  return app;
}
