// Baara — System API Routes

import { Hono } from "hono";
import type { Store } from "../../db/store.ts";
import {
  discoverAll,
  discoverSkills,
  discoverCommandsDeep,
  discoverAgents,
  getSkillContent,
} from "../../integrations/claude-code.ts";
import type {
  DiscoveredSkill,
  DiscoveredCommand,
  DiscoveredAgent,
} from "../../integrations/claude-code.ts";
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

  // --- Commands / Skills / Agents Discovery API ---

  /**
   * GET /api/commands?type=all|skills|commands|agents&search=<query>
   *
   * Returns discovered skills, commands, and agents with optional filtering.
   */
  app.get("/commands", async (c) => {
    const typeParam = (c.req.query("type") ?? "all") as string;
    const search = (c.req.query("search") ?? "").toLowerCase().trim();

    try {
      let skills: DiscoveredSkill[] = [];
      let commands: DiscoveredCommand[] = [];
      let agents: DiscoveredAgent[] = [];

      // Fetch requested types
      if (typeParam === "all" || typeParam === "skills") {
        skills = await discoverSkills();
      }
      if (typeParam === "all" || typeParam === "commands") {
        commands = await discoverCommandsDeep();
      }
      if (typeParam === "all" || typeParam === "agents") {
        agents = await discoverAgents();
      }

      // Apply search filter if provided
      if (search) {
        skills = skills.filter((s) =>
          s.name.toLowerCase().includes(search) ||
          s.fullName.toLowerCase().includes(search) ||
          s.description.toLowerCase().includes(search) ||
          s.triggers.some((t) => t.toLowerCase().includes(search))
        );
        commands = commands.filter((cmd) =>
          cmd.name.toLowerCase().includes(search) ||
          cmd.fullName.toLowerCase().includes(search) ||
          cmd.description.toLowerCase().includes(search)
        );
        agents = agents.filter((a) =>
          a.name.toLowerCase().includes(search) ||
          a.fullName.toLowerCase().includes(search) ||
          a.description.toLowerCase().includes(search)
        );
      }

      return c.json({
        skills,
        commands,
        agents,
        total: skills.length + commands.length + agents.length,
      });
    } catch (err) {
      log("error", "commands", "Command discovery failed", { error: String(err) });
      return c.json({ error: "Could not discover commands" }, 500);
    }
  });

  /**
   * GET /api/commands/:type/:name/content
   *
   * Returns the raw markdown content of a skill, command, or agent file.
   * :type must be "skills", "commands", or "agents"
   * :name is the fullName (e.g., "gws:gws-drive") or plain name
   */
  app.get("/commands/:type/:name/content", async (c) => {
    const type = c.req.param("type");
    const name = decodeURIComponent(c.req.param("name"));

    try {
      let path: string | undefined;

      if (type === "skills") {
        const skills = await discoverSkills();
        const skill = skills.find((s) => s.fullName === name || s.name === name);
        path = skill?.path;
      } else if (type === "commands") {
        const commands = await discoverCommandsDeep();
        const cmd = commands.find((cmd) => cmd.fullName === name || cmd.name === name);
        path = cmd?.path;
      } else if (type === "agents") {
        const agents = await discoverAgents();
        const agent = agents.find((a) => a.fullName === name || a.name === name);
        path = agent?.path;
      } else {
        return c.json({ error: `Invalid type: ${type}. Must be skills, commands, or agents.` }, 400);
      }

      if (!path) {
        return c.json({ error: `${type.slice(0, -1)} not found: ${name}` }, 404);
      }

      const content = await getSkillContent(path);
      return c.text(content);
    } catch (err) {
      log("error", "commands", "Failed to read content", { type, name, error: String(err) });
      return c.json({ error: "Could not read content" }, 500);
    }
  });

  // --- Settings: System Prompt ---

  app.get("/settings/system-prompt", (c) => {
    return c.json({ prompt: store.getSetting("custom_system_prompt") || "" });
  });

  app.put("/settings/system-prompt", async (c) => {
    const { prompt } = await c.req.json<{ prompt: string }>();
    if (typeof prompt !== "string") return c.json({ error: "prompt must be a string" }, 400);
    if (prompt.length > 10000) return c.json({ error: "prompt too long (max 10000 chars)" }, 400);
    if (prompt.trim()) {
      store.setSetting("custom_system_prompt", prompt.trim());
    } else {
      store.deleteSetting("custom_system_prompt");
    }
    return c.json({ ok: true });
  });

  return app;
}
