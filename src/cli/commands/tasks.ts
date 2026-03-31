// Fakoli Mini — CLI Tasks Commands

import { Command } from "commander";
import type { TaskService } from "../../services/task-service.ts";
import type { JobService } from "../../services/job-service.ts";
import type { Store } from "../../db/store.ts";
import type { ExecutionType, Priority, ExecutionMode, CreateTaskInput } from "../../types.ts";
import {
  formatTaskTable,
  formatTaskDetail,
  formatJson,
} from "../formatter.ts";

function resolveTask(store: Store, idOrName: string) {
  return store.getTask(idOrName) ?? store.getTaskByName(idOrName);
}

export function registerTasksCommand(
  program: Command,
  store: Store,
  taskService: TaskService,
  jobService: JobService,
): void {
  const tasks = program.command("tasks").description("Manage tasks");

  // --- list ---
  tasks
    .command("list")
    .description("List all tasks")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      const allTasks = taskService.listTasks();
      if (opts.json) {
        console.log(formatJson(allTasks));
      } else {
        console.log(formatTaskTable(allTasks));
      }
    });

  // --- show ---
  tasks
    .command("show <id-or-name>")
    .description("Show task detail")
    .option("--json", "Output as JSON")
    .action((idOrName: string, opts: { json?: boolean }) => {
      const task = resolveTask(store, idOrName);
      if (!task) {
        console.error(`Error: Task not found: ${idOrName}`);
        process.exit(1);
      }
      if (opts.json) {
        console.log(formatJson(task));
      } else {
        console.log(formatTaskDetail(task));
      }
    });

  // --- create ---
  tasks
    .command("create")
    .description("Create a new task")
    .requiredOption("--name <name>", "Task name")
    .requiredOption("--prompt <prompt>", "Task prompt")
    .option("--cron <expression>", "Cron expression")
    .option("--type <type>", "Execution type (agent_sdk, wasm, raw_code)", "agent_sdk")
    .option("--priority <n>", "Priority (0-3)", "1")
    .option("--mode <mode>", "Execution mode (queued, direct)")
    .option("--description <desc>", "Task description")
    .option("--timeout <ms>", "Timeout in ms")
    .option("--max-retries <n>", "Max retries")
    .option("--queue <name>", "Target queue")
    .option("--tools <tools>", "Comma-separated list of allowed tools")
    .option("--model <model>", "Agent model")
    .option("--system-prompt <prompt>", "Agent system prompt")
    .option("--json", "Output as JSON")
    .action(
      (opts: {
        name: string;
        prompt: string;
        cron?: string;
        type: string;
        priority: string;
        mode?: string;
        description?: string;
        timeout?: string;
        maxRetries?: string;
        queue?: string;
        tools?: string;
        model?: string;
        systemPrompt?: string;
        json?: boolean;
      }) => {
        const input: CreateTaskInput = {
          name: opts.name,
          prompt: opts.prompt,
          cronExpression: opts.cron ?? null,
          executionType: opts.type as ExecutionType,
          priority: parseInt(opts.priority, 10) as Priority,
        };
        if (opts.mode) input.executionMode = opts.mode as ExecutionMode;
        if (opts.description) input.description = opts.description;
        if (opts.timeout) input.timeoutMs = parseInt(opts.timeout, 10);
        if (opts.maxRetries) input.maxRetries = parseInt(opts.maxRetries, 10);
        if (opts.queue) input.targetQueue = opts.queue;

        // Build agentConfig if any agent options provided
        if (opts.tools || opts.model || opts.systemPrompt) {
          input.agentConfig = {
            allowedTools: opts.tools ? opts.tools.split(",").map((t) => t.trim()) : [],
            model: opts.model,
            systemPrompt: opts.systemPrompt,
          };
        }

        const task = taskService.createTask(input);
        if (opts.json) {
          console.log(formatJson(task));
        } else {
          console.log(`Created task: ${task.name} (${task.id})`);
        }
      },
    );

  // --- delete ---
  tasks
    .command("delete <id-or-name>")
    .description("Delete a task")
    .action((idOrName: string) => {
      const task = resolveTask(store, idOrName);
      if (!task) {
        console.error(`Error: Task not found: ${idOrName}`);
        process.exit(1);
      }
      taskService.deleteTask(task.id);
      console.log(`Deleted task: ${task.name}`);
    });

  // --- toggle ---
  tasks
    .command("toggle <id-or-name>")
    .description("Enable/disable a task")
    .action((idOrName: string) => {
      const task = resolveTask(store, idOrName);
      if (!task) {
        console.error(`Error: Task not found: ${idOrName}`);
        process.exit(1);
      }
      const updated = taskService.toggleTask(task.id);
      console.log(
        `Task ${updated.name}: ${updated.enabled ? "enabled" : "disabled"}`,
      );
    });

  // --- submit ---
  tasks
    .command("submit <id-or-name>")
    .description("Dispatch a task (respects task executionMode)")
    .option("--json", "Output as JSON")
    .action(async (idOrName: string, opts: { json?: boolean }) => {
      const task = resolveTask(store, idOrName);
      if (!task) {
        console.error(`Error: Task not found: ${idOrName}`);
        process.exit(1);
      }
      try {
        const job = await jobService.submitTask(task.id);
        if (opts.json) {
          console.log(formatJson(job));
        } else {
          console.log(`Dispatched job ${job.id.substring(0, 8)} for task ${task.name} [${job.status}]`);
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  // --- run ---
  tasks
    .command("run <id-or-name>")
    .description("Direct execute a task (always direct mode)")
    .option("--json", "Output as JSON")
    .action(async (idOrName: string, opts: { json?: boolean }) => {
      const task = resolveTask(store, idOrName);
      if (!task) {
        console.error(`Error: Task not found: ${idOrName}`);
        process.exit(1);
      }
      try {
        const job = await jobService.runImmediate(task.id);
        if (opts.json) {
          console.log(formatJson(job));
        } else {
          console.log(`Executed job ${job.id.substring(0, 8)} for task ${task.name} [${job.status}]`);
          if (job.output) {
            console.log(`\nOutput:\n${job.output}`);
          }
          if (job.error) {
            console.log(`\nError:\n${job.error}`);
          }
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
