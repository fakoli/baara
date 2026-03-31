// Fakoli Mini — CLI Output Formatter

import type { Task, Job, QueueInfo, Template } from "../types.ts";

// --- Generic Table ---

export function formatTable(
  rows: Record<string, string>[],
  columns: { key: string; header: string; width?: number }[],
): string {
  if (rows.length === 0) return "  (none)";

  // Compute column widths
  const widths = columns.map((col) => {
    const maxData = rows.reduce(
      (max, row) => Math.max(max, (row[col.key] ?? "").length),
      0,
    );
    return col.width ?? Math.max(col.header.length, maxData);
  });

  // Header
  const header = columns
    .map((col, i) => col.header.padEnd(widths[i]!))
    .join("  ");
  const lines = [`  ${header}`];

  // Rows
  for (const row of rows) {
    const line = columns
      .map((col, i) => (row[col.key] ?? "").padEnd(widths[i]!))
      .join("  ");
    lines.push(`  ${line}`);
  }

  return lines.join("\n");
}

// --- JSON ---

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

// --- Helpers ---

function formatDuration(ms: number | null): string {
  if (ms === null) return "--";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(input: number | null, output: number | null): string {
  if (input === null && output === null) return "--";
  const fmt = (n: number | null): string => {
    if (n === null) return "0";
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };
  return `${fmt(input)}/${fmt(output)}`;
}

function timeAgo(isoDate: string | null): string {
  if (!isoDate) return "--";
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

function shortId(id: string): string {
  return id.substring(0, 8);
}

// --- Task Formatting ---

const taskColumns = [
  { key: "name", header: "Name", width: 20 },
  { key: "cron", header: "Cron", width: 16 },
  { key: "mode", header: "Mode", width: 8 },
  { key: "priority", header: "Priority", width: 10 },
  { key: "enabled", header: "Enabled", width: 7 },
];

export function formatTaskTable(tasks: Task[]): string {
  const rows = tasks.map((t) => ({
    name: t.name,
    cron: t.cronExpression ?? "--",
    mode: t.executionMode,
    priority: String(t.priority),
    enabled: t.enabled ? "\u25CF" : "\u25CB",
  }));
  return formatTable(rows, taskColumns);
}

export function formatTaskDetail(task: Task): string {
  const lines = [
    `  Task: ${task.name}`,
    `  ID:   ${task.id}`,
    ``,
    `  Description:    ${task.description || "(none)"}`,
    `  Prompt:         ${task.prompt.length > 80 ? task.prompt.substring(0, 77) + "..." : task.prompt}`,
    `  Cron:           ${task.cronExpression ?? "(none)"}`,
    `  Scheduled At:   ${task.scheduledAt ?? "(none)"}`,
    `  Execution Type: ${task.executionType}`,
    `  Execution Mode: ${task.executionMode}`,
    `  Priority:       ${task.priority}`,
    `  Queue:          ${task.targetQueue}`,
    `  Timeout:        ${formatDuration(task.timeoutMs)}`,
    `  Max Retries:    ${task.maxRetries}`,
    `  Enabled:        ${task.enabled ? "yes" : "no"}`,
    `  Created:        ${task.createdAt}`,
    `  Updated:        ${task.updatedAt}`,
  ];
  if (task.agentConfig) {
    lines.push(`  Agent Config:`);
    lines.push(`    Model:       ${task.agentConfig.model ?? "(default)"}`);
    lines.push(`    Tools:       ${task.agentConfig.allowedTools.join(", ") || "(none)"}`);
    if (task.agentConfig.systemPrompt) {
      lines.push(`    System:      ${task.agentConfig.systemPrompt.substring(0, 60)}...`);
    }
  }
  return lines.join("\n");
}

// --- Job Formatting ---

const jobColumns = [
  { key: "id", header: "ID (short)", width: 10 },
  { key: "status", header: "Status", width: 10 },
  { key: "attempt", header: "Attempt", width: 8 },
  { key: "duration", header: "Duration", width: 10 },
  { key: "tokens", header: "Tokens", width: 12 },
  { key: "started", header: "Started", width: 12 },
];

export function formatJobTable(jobs: Job[]): string {
  const rows = jobs.map((j) => ({
    id: shortId(j.id),
    status: j.status,
    attempt: String(j.attempt),
    duration: formatDuration(j.durationMs),
    tokens: formatTokens(j.inputTokens, j.outputTokens),
    started: timeAgo(j.startedAt),
  }));
  return formatTable(rows, jobColumns);
}

export function formatJobDetail(job: Job): string {
  const lines = [
    `  Job: ${job.id}`,
    `  Task: ${job.taskId}`,
    ``,
    `  Status:     ${job.status}`,
    `  Attempt:    ${job.attempt}`,
    `  Queue:      ${job.queueName}`,
    `  Priority:   ${job.priority}`,
    `  Duration:   ${formatDuration(job.durationMs)}`,
    `  Tokens:     ${formatTokens(job.inputTokens, job.outputTokens)}`,
    `  Health:     ${job.healthStatus}`,
    `  Scheduled:  ${job.scheduledAt}`,
    `  Started:    ${job.startedAt ?? "(not started)"}`,
    `  Completed:  ${job.completedAt ?? "(not completed)"}`,
    `  Created:    ${job.createdAt}`,
  ];
  if (job.output) {
    lines.push(``, `  Output:`);
    for (const line of job.output.split("\n")) {
      lines.push(`    ${line}`);
    }
  }
  if (job.error) {
    lines.push(``, `  Error:`);
    for (const line of job.error.split("\n")) {
      lines.push(`    ${line}`);
    }
  }
  return lines.join("\n");
}

// --- Queue Formatting ---

const queueColumns = [
  { key: "name", header: "Name", width: 14 },
  { key: "depth", header: "Depth", width: 8 },
  { key: "active", header: "Active", width: 8 },
  { key: "max", header: "Max", width: 6 },
];

export function formatQueueTable(queues: QueueInfo[]): string {
  const rows = queues.map((q) => ({
    name: q.name,
    depth: String(q.depth),
    active: String(q.activeJobs),
    max: String(q.maxConcurrency),
  }));
  return formatTable(rows, queueColumns);
}

export function formatQueueDetail(queue: QueueInfo): string {
  return [
    `  Queue: ${queue.name}`,
    `  Depth:           ${queue.depth}`,
    `  Active Jobs:     ${queue.activeJobs}`,
    `  Max Concurrency: ${queue.maxConcurrency}`,
  ].join("\n");
}

// --- Template Formatting ---

const templateColumns = [
  { key: "name", header: "Name", width: 20 },
  { key: "model", header: "Model", width: 20 },
  { key: "tools", header: "Tools", width: 30 },
  { key: "created", header: "Created", width: 12 },
];

export function formatTemplateTable(templates: Template[]): string {
  const rows = templates.map((t) => ({
    name: t.name,
    model: t.agentConfig.model ?? "(default)",
    tools: t.agentConfig.allowedTools.join(", ") || "(none)",
    created: timeAgo(t.createdAt),
  }));
  return formatTable(rows, templateColumns);
}

// --- Status Formatting ---

export function formatStatus(
  queues: QueueInfo[],
  triageCount: number,
  usage: { totalJobs: number; totalInputTokens: number; totalOutputTokens: number },
): string {
  const lines = [
    `  Fakoli Mini Status`,
    ``,
    `  Queues:`,
  ];
  for (const q of queues) {
    lines.push(
      `    ${q.name.padEnd(12)} depth: ${String(q.depth).padEnd(4)} active: ${String(q.activeJobs).padEnd(4)} max: ${q.maxConcurrency}`,
    );
  }
  if (queues.length === 0) {
    lines.push(`    (none)`);
  }
  lines.push(``);
  lines.push(`  Triage: ${triageCount} job${triageCount !== 1 ? "s" : ""} need attention`);
  lines.push(``);
  lines.push(`  Usage:`);
  lines.push(`    Total jobs:    ${usage.totalJobs.toLocaleString()}`);
  lines.push(`    Input tokens:  ${usage.totalInputTokens.toLocaleString()}`);
  lines.push(`    Output tokens: ${usage.totalOutputTokens.toLocaleString()}`);

  return lines.join("\n");
}
