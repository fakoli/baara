// Baara — Task Executor
// Runs jobs using the appropriate runtime (Agent SDK, Wasm, raw code)

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Task, Job, JobResult, AgentConfig } from "../types.ts";

export async function executeJob(job: Job, task: Task): Promise<JobResult> {
  const start = Date.now();

  switch (task.executionType) {
    case "agent_sdk":
      if (!task.agentConfig) {
        return { status: "failed", error: "agent_sdk tasks require agentConfig", durationMs: Date.now() - start };
      }
      return executeAgentSdk(task.agentConfig, task.prompt, task.timeoutMs, start);
    case "wasm":
      return { status: "failed", error: "Wasm execution not yet implemented", durationMs: Date.now() - start };
    case "raw_code":
      return executeRawCode(task.prompt, task.timeoutMs, start);
    default:
      return { status: "failed", error: `Unknown execution type: ${task.executionType}`, durationMs: Date.now() - start };
  }
}

async function executeAgentSdk(
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

    for await (const message of query({ prompt, options: options as any })) {
      if (controller.signal.aborted) break;

      // Capture final result
      if ("result" in message && typeof message.result === "string") {
        output = message.result;
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
    return {
      status: "completed",
      output,
      inputTokens,
      outputTokens,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    clearTimeout(timeout);
    if (controller.signal.aborted) {
      return { status: "timed_out", error: `Exceeded timeout of ${timeoutMs}ms`, durationMs: Date.now() - start };
    }
    return { status: "failed", error: String(error), durationMs: Date.now() - start };
  }
}

async function executeRawCode(command: string, timeoutMs: number, start: number): Promise<JobResult> {
  try {
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
      return { status: "completed", output: stdout, durationMs: Date.now() - start };
    }
    return { status: "failed", error: stderr || `Exit code ${exitCode}`, output: stdout, durationMs: Date.now() - start };
  } catch (error) {
    return { status: "failed", error: String(error), durationMs: Date.now() - start };
  }
}
