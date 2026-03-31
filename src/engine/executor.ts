// Baara — Task Executor
// Runs jobs using the appropriate runtime (Agent SDK, Wasm, raw code)

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Task, Job, JobResult, AgentConfig } from "../types.ts";
import { jobLog } from "../logger.ts";

export async function executeJob(job: Job, task: Task): Promise<JobResult> {
  const start = Date.now();
  const taskName = task.name;

  switch (task.executionType) {
    case "agent_sdk":
      if (!task.agentConfig) {
        jobLog(job.id, taskName, "error", "agent_sdk tasks require agentConfig");
        return { status: "failed", error: "agent_sdk tasks require agentConfig", durationMs: Date.now() - start };
      }
      return executeAgentSdk(job.id, taskName, task.agentConfig, task.prompt, task.timeoutMs, start);
    case "wasm":
      jobLog(job.id, taskName, "error", "Wasm execution not yet implemented");
      return { status: "failed", error: "Wasm execution not yet implemented", durationMs: Date.now() - start };
    case "raw_code":
      return executeRawCode(job.id, taskName, task.prompt, task.timeoutMs, start);
    default:
      jobLog(job.id, taskName, "error", `Unknown execution type: ${task.executionType}`);
      return { status: "failed", error: `Unknown execution type: ${task.executionType}`, durationMs: Date.now() - start };
  }
}

async function executeAgentSdk(
  jobId: string,
  taskName: string,
  config: AgentConfig,
  prompt: string,
  timeoutMs: number,
  start: number,
): Promise<JobResult> {
  let output = "";
  let inputTokens = 0;
  let outputTokens = 0;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const options: Record<string, unknown> = {
      allowedTools: config.allowedTools,
      permissionMode: config.permissionMode ?? "bypassPermissions",
      abortSignal: controller.signal,
    };
    if (config.model) options["model"] = config.model;
    if (config.systemPrompt) options["systemPrompt"] = config.systemPrompt;
    if (config.maxTurns) options["maxTurns"] = config.maxTurns;
    if (config.maxBudgetUsd) options["maxBudgetUsd"] = config.maxBudgetUsd;
    if (config.mcpServers) options["mcpServers"] = config.mcpServers;

    jobLog(jobId, taskName, "info", "Execution started", { model: config.model, tools: config.allowedTools });

    for await (const message of query({ prompt, options: options as any })) {
      if (controller.signal.aborted) break;

      // Capture final result
      if ("result" in message && typeof message.result === "string") {
        output = message.result;
      }

      // Log tool calls from assistant messages
      if (
        "message" in message &&
        typeof message.message === "object" &&
        message.message !== null &&
        "content" in (message.message as any)
      ) {
        const content = (message.message as any).content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "tool_use") {
              jobLog(jobId, taskName, "info", "Tool call", { tool: block.name });
            }
          }
        }
      }

      // Track usage per assistant turn
      if (
        "message" in message &&
        typeof message.message === "object" &&
        message.message !== null &&
        "usage" in message.message
      ) {
        const usage = (message.message as any).usage;
        if (usage) {
          inputTokens += usage.input_tokens ?? 0;
          outputTokens += usage.output_tokens ?? 0;
        }
      }

      // Also check top-level usage on result messages
      if ("usage" in message && typeof message.usage === "object" && message.usage !== null) {
        const usage = message.usage as Record<string, number>;
        if (usage["input_tokens"]) inputTokens = usage["input_tokens"];
        if (usage["output_tokens"]) outputTokens = usage["output_tokens"];
      }
    }

    clearTimeout(timeout);
    const durationMs = Date.now() - start;
    jobLog(jobId, taskName, "info", "Execution completed", {
      status: "completed",
      durationMs,
      inputTokens,
      outputTokens,
    });
    return {
      status: "completed",
      output,
      inputTokens,
      outputTokens,
      durationMs,
    };
  } catch (error) {
    clearTimeout(timeout);
    if (controller.signal.aborted) {
      const durationMs = Date.now() - start;
      jobLog(jobId, taskName, "warn", "Execution timed out", { timeoutMs });
      return { status: "timed_out", error: `Exceeded timeout of ${timeoutMs}ms`, durationMs };
    }
    const durationMs = Date.now() - start;
    jobLog(jobId, taskName, "error", "Execution failed", { error: String(error) });
    return { status: "failed", error: String(error), durationMs };
  }
}

async function executeRawCode(
  jobId: string,
  taskName: string,
  command: string,
  timeoutMs: number,
  start: number,
): Promise<JobResult> {
  try {
    jobLog(jobId, taskName, "info", "Raw code execution started", { command: command.slice(0, 100) });

    const proc = Bun.spawn(["sh", "-c", command], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const timeout = setTimeout(() => proc.kill(), timeoutMs);
    const exitCode = await proc.exited;
    clearTimeout(timeout);

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (exitCode === 0) {
      const durationMs = Date.now() - start;
      jobLog(jobId, taskName, "info", "Raw code completed", { exitCode: 0, durationMs });
      return { status: "completed", output: stdout, durationMs };
    }
    const durationMs = Date.now() - start;
    jobLog(jobId, taskName, "error", "Raw code failed", { exitCode, stderr: stderr.slice(0, 200) });
    return { status: "failed", error: stderr || `Exit code ${exitCode}`, output: stdout, durationMs };
  } catch (error) {
    const durationMs = Date.now() - start;
    jobLog(jobId, taskName, "error", "Raw code failed", { error: String(error) });
    return { status: "failed", error: String(error), durationMs };
  }
}
