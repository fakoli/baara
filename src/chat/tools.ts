// Baara — Chat Tool Definitions (MCP Server)

import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { TaskService } from "../services/task-service.ts";
import type { JobService } from "../services/job-service.ts";
import type { TemplateService } from "../services/template-service.ts";
import type { Store } from "../db/store.ts";
import type { Task } from "../types.ts";

// Helper: resolve a task by name or ID, return null if not found
function resolveTask(taskService: TaskService, nameOrId: string): Task | null {
  return taskService.getTaskByName(nameOrId) ?? taskService.getTask(nameOrId);
}

// Helper: standard "not found" error response
function notFound(nameOrId: string) {
  return {
    content: [{ type: "text" as const, text: `Task not found: ${nameOrId}` }],
    isError: true,
  };
}

// Helper: wrap a value as a successful text response
function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createBaaraTools(deps: {
  taskService: TaskService;
  jobService: JobService;
  templateService: TemplateService;
  store: Store;
}) {
  const { taskService, jobService, templateService, store } = deps;

  // 1. list_tasks
  const listTasks = tool(
    "list_tasks",
    "List all scheduled tasks with their status, cron, and mode",
    {},
    async () => {
      const tasks = taskService.listTasks();
      const summary = tasks.map((t) => ({
        name: t.name,
        id: t.id,
        cron: t.cronExpression,
        mode: t.executionMode,
        type: t.executionType,
        enabled: t.enabled,
        priority: t.priority,
      }));
      return ok(summary);
    },
  );

  // 2. get_task
  const getTask = tool(
    "get_task",
    "Get full details of a task by name or ID",
    { nameOrId: z.string().describe("Task name or UUID") },
    async ({ nameOrId }) => {
      const task = resolveTask(taskService, nameOrId);
      if (!task) return notFound(nameOrId);
      return ok(task);
    },
  );

  // 3. create_task
  const createTask = tool(
    "create_task",
    "Create a new scheduled task",
    {
      name: z.string().describe("Unique task name"),
      prompt: z.string().describe("Prompt or command to execute"),
      cronExpression: z.string().optional().describe("Cron schedule (e.g. '0 9 * * *')"),
      executionType: z.enum(["agent_sdk", "raw_code"]).optional().describe("Execution engine"),
      allowedTools: z.array(z.string()).optional().describe("Allowed tools for agent_sdk tasks"),
      priority: z.number().min(0).max(3).optional().describe("Priority 0=critical, 3=low"),
      executionMode: z.enum(["queued", "direct"]).optional().describe("Queue or run directly"),
      description: z.string().optional().describe("Task description"),
    },
    async (args) => {
      try {
        const task = taskService.createTask({
          name: args.name,
          prompt: args.prompt,
          cronExpression: args.cronExpression ?? null,
          executionType: args.executionType,
          priority: (args.priority as 0 | 1 | 2 | 3 | undefined),
          executionMode: args.executionMode,
          description: args.description,
          agentConfig: args.allowedTools
            ? { allowedTools: args.allowedTools }
            : undefined,
        });
        return ok(task);
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to create task: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // 4. update_task
  const updateTask = tool(
    "update_task",
    "Update an existing task by name or ID",
    {
      nameOrId: z.string().describe("Task name or UUID"),
      name: z.string().optional().describe("New task name"),
      prompt: z.string().optional().describe("New prompt"),
      cronExpression: z.string().optional().describe("New cron schedule"),
      executionType: z.enum(["agent_sdk", "raw_code"]).optional().describe("Execution engine"),
      priority: z.number().min(0).max(3).optional().describe("Priority 0-3"),
      executionMode: z.enum(["queued", "direct"]).optional().describe("Execution mode"),
      description: z.string().optional().describe("Task description"),
      enabled: z.boolean().optional().describe("Enable or disable"),
    },
    async (args) => {
      const task = resolveTask(taskService, args.nameOrId);
      if (!task) return notFound(args.nameOrId);
      try {
        const { nameOrId: _, ...updates } = args;
        const updated = taskService.updateTask(task.id, {
          ...updates,
          cronExpression: updates.cronExpression ?? undefined,
          priority: (updates.priority as 0 | 1 | 2 | 3 | undefined),
        });
        return ok(updated);
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to update task: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // 5. delete_task
  const deleteTask = tool(
    "delete_task",
    "Delete a task by name or ID",
    { nameOrId: z.string().describe("Task name or UUID") },
    async ({ nameOrId }) => {
      const task = resolveTask(taskService, nameOrId);
      if (!task) return notFound(nameOrId);
      taskService.deleteTask(task.id);
      return ok({ deleted: true, name: task.name, id: task.id });
    },
  );

  // 6. toggle_task
  const toggleTask = tool(
    "toggle_task",
    "Enable or disable a task by name or ID",
    { nameOrId: z.string().describe("Task name or UUID") },
    async ({ nameOrId }) => {
      const task = resolveTask(taskService, nameOrId);
      if (!task) return notFound(nameOrId);
      const toggled = taskService.toggleTask(task.id);
      return ok({ name: toggled.name, enabled: toggled.enabled });
    },
  );

  // 7. run_task — execute immediately (direct mode), may take 30+ seconds
  const runTask = tool(
    "run_task",
    "Execute a task immediately in direct mode and return the job result. May take 30+ seconds.",
    { nameOrId: z.string().describe("Task name or UUID") },
    async ({ nameOrId }) => {
      const task = resolveTask(taskService, nameOrId);
      if (!task) return notFound(nameOrId);
      try {
        const job = await jobService.runImmediate(task.id);
        return ok(job);
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Execution failed: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // 8. submit_task — dispatch to queue
  const submitTask = tool(
    "submit_task",
    "Submit a task to the execution queue",
    { nameOrId: z.string().describe("Task name or UUID") },
    async ({ nameOrId }) => {
      const task = resolveTask(taskService, nameOrId);
      if (!task) return notFound(nameOrId);
      try {
        const job = await jobService.submitTask(task.id);
        return ok({ submitted: true, jobId: job.id, status: job.status });
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Submit failed: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // 9. list_jobs — job history for a task
  const listJobs = tool(
    "list_jobs",
    "List job history for a task",
    {
      taskNameOrId: z.string().describe("Task name or UUID"),
      limit: z.number().optional().describe("Max jobs to return (default all)"),
    },
    async ({ taskNameOrId, limit }) => {
      const task = resolveTask(taskService, taskNameOrId);
      if (!task) return notFound(taskNameOrId);
      const jobs = jobService.listJobs(task.id, { limit });
      return ok(
        jobs.map((j) => ({
          id: j.id,
          status: j.status,
          attempt: j.attempt,
          durationMs: j.durationMs,
          createdAt: j.createdAt,
          error: j.error,
        })),
      );
    },
  );

  // 10. get_job — full job detail + output
  const getJob = tool(
    "get_job",
    "Get full details of a job including output",
    { jobId: z.string().describe("Job UUID") },
    async ({ jobId }) => {
      const job = jobService.getJob(jobId);
      if (!job) {
        return {
          content: [{ type: "text" as const, text: `Job not found: ${jobId}` }],
          isError: true,
        };
      }
      return ok(job);
    },
  );

  // 11. retry_job — retry a triaged/failed job
  const retryJob = tool(
    "retry_job",
    "Retry a failed or triaged job",
    { jobId: z.string().describe("Job UUID to retry") },
    async ({ jobId }) => {
      try {
        const job = await jobService.retryJob(jobId);
        return ok({ retried: true, newJobId: job.id, status: job.status });
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Retry failed: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // 12. list_triage — jobs needing attention
  const listTriage = tool(
    "list_triage",
    "List jobs that need attention (triage status)",
    {},
    async () => {
      const jobs = jobService.getTriageJobs();
      if (jobs.length === 0) {
        return ok({ message: "No jobs in triage. All clear." });
      }
      return ok(
        jobs.map((j) => ({
          id: j.id,
          taskId: j.taskId,
          status: j.status,
          attempt: j.attempt,
          error: j.error,
          createdAt: j.createdAt,
        })),
      );
    },
  );

  // 13. get_status — system overview
  const getStatus = tool(
    "get_status",
    "Get system status: queues, triage count, and usage statistics",
    {},
    async () => {
      const queues = store.listQueues();
      const triageJobs = store.getTriageJobs();
      const usage = store.getUsageStats();
      const tasks = taskService.listTasks();
      return ok({
        tasks: {
          total: tasks.length,
          enabled: tasks.filter((t) => t.enabled).length,
          withCron: tasks.filter((t) => t.cronExpression).length,
        },
        queues: queues.map((q) => ({
          name: q.name,
          depth: q.depth,
          active: q.activeJobs,
          maxConcurrency: q.maxConcurrency,
        })),
        triage: { count: triageJobs.length },
        usage,
      });
    },
  );

  // 14. list_templates — browse templates
  const listTemplates = tool(
    "list_templates",
    "List available task templates",
    {},
    async () => {
      const templates = templateService.listTemplates();
      if (templates.length === 0) {
        return ok({ message: "No templates available." });
      }
      return ok(
        templates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          createdAt: t.createdAt,
        })),
      );
    },
  );

  return createSdkMcpServer({
    name: "baara",
    tools: [
      listTasks,
      getTask,
      createTask,
      updateTask,
      deleteTask,
      toggleTask,
      runTask,
      submitTask,
      listJobs,
      getJob,
      retryJob,
      listTriage,
      getStatus,
      listTemplates,
    ],
  });
}
