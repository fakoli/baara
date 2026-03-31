// Baara — Database Store

import type { Database, SQLQueryBindings } from "bun:sqlite";
import type {
  Task, CreateTaskInput, UpdateTaskInput,
  Job, JobStatus, HealthStatus, Priority,
  Template, CreateTemplateInput,
  QueueInfo,
} from "../types.ts";

export class Store {
  constructor(public db: Database) {}

  // --- Tasks ---

  listTasks(): Task[] {
    return this.db.query("SELECT * FROM tasks ORDER BY created_at DESC").all().map(rowToTask);
  }

  getTask(id: string): Task | null {
    const row = this.db.query("SELECT * FROM tasks WHERE id = ?").get(id);
    return row ? rowToTask(row) : null;
  }

  getTaskByName(name: string): Task | null {
    const row = this.db.query("SELECT * FROM tasks WHERE name = ?").get(name);
    return row ? rowToTask(row) : null;
  }

  createTask(id: string, input: CreateTaskInput, defaultMode: string): Task {
    this.db.query(`
      INSERT INTO tasks (id, name, description, prompt, scheduled_at, cron_expression,
        timeout_ms, execution_type, agent_config, priority, target_queue,
        max_retries, execution_mode, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.name,
      input.description ?? "",
      input.prompt,
      input.scheduledAt ?? null,
      input.cronExpression ?? null,
      input.timeoutMs ?? 300000,
      input.executionType ?? "agent_sdk",
      input.agentConfig ? JSON.stringify(input.agentConfig) : null,
      input.priority ?? 1,
      input.targetQueue ?? "default",
      input.maxRetries ?? 0,
      input.executionMode ?? defaultMode,
      input.enabled !== false ? 1 : 0,
    );
    return this.getTask(id)!;
  }

  updateTask(id: string, input: UpdateTaskInput): Task {
    const fields: string[] = [];
    const values: SQLQueryBindings[] = [];

    if (input.name !== undefined) { fields.push("name = ?"); values.push(input.name); }
    if (input.description !== undefined) { fields.push("description = ?"); values.push(input.description); }
    if (input.prompt !== undefined) { fields.push("prompt = ?"); values.push(input.prompt); }
    if (input.scheduledAt !== undefined) { fields.push("scheduled_at = ?"); values.push(input.scheduledAt ?? null); }
    if (input.cronExpression !== undefined) { fields.push("cron_expression = ?"); values.push(input.cronExpression ?? null); }
    if (input.timeoutMs !== undefined) { fields.push("timeout_ms = ?"); values.push(input.timeoutMs); }
    if (input.executionType !== undefined) { fields.push("execution_type = ?"); values.push(input.executionType); }
    if (input.agentConfig !== undefined) {
      fields.push("agent_config = ?");
      values.push(input.agentConfig ? JSON.stringify(input.agentConfig) : null);
    }
    if (input.priority !== undefined) { fields.push("priority = ?"); values.push(input.priority); }
    if (input.targetQueue !== undefined) { fields.push("target_queue = ?"); values.push(input.targetQueue); }
    if (input.maxRetries !== undefined) { fields.push("max_retries = ?"); values.push(input.maxRetries); }
    if (input.executionMode !== undefined) { fields.push("execution_mode = ?"); values.push(input.executionMode); }
    if (input.enabled !== undefined) { fields.push("enabled = ?"); values.push(input.enabled ? 1 : 0); }

    if (fields.length === 0) return this.getTask(id)!;

    fields.push("updated_at = datetime('now')");
    values.push(id);

    this.db.query(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    return this.getTask(id)!;
  }

  deleteTask(id: string): void {
    this.db.query("DELETE FROM tasks WHERE id = ?").run(id);
  }

  // --- Jobs ---

  createJob(id: string, taskId: string, queueName: string, priority: Priority, scheduledAt: string, attempt: number = 1): Job {
    this.db.query(`
      INSERT INTO jobs (id, task_id, queue_name, priority, status, attempt, scheduled_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, taskId, queueName, priority, attempt, scheduledAt);
    return this.getJob(id)!;
  }

  getJob(id: string): Job | null {
    const row = this.db.query("SELECT * FROM jobs WHERE id = ?").get(id);
    return row ? rowToJob(row) : null;
  }

  listJobs(taskId: string, opts?: { limit?: number; status?: JobStatus }): Job[] {
    let sql = "SELECT * FROM jobs WHERE task_id = ?";
    const params: SQLQueryBindings[] = [taskId];

    if (opts?.status) {
      sql += " AND status = ?";
      params.push(opts.status);
    }
    sql += " ORDER BY created_at DESC";
    if (opts?.limit) {
      sql += " LIMIT ?";
      params.push(opts.limit);
    }

    return this.db.query(sql).all(...params).map(rowToJob);
  }

  getTriageJobs(): Job[] {
    return this.db.query(
      "SELECT * FROM jobs WHERE status = 'triage' ORDER BY created_at DESC"
    ).all().map(rowToJob);
  }

  updateJobStatus(id: string, status: JobStatus, updates?: {
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
    output?: string;
    error?: string;
    inputTokens?: number;
    outputTokens?: number;
    healthStatus?: HealthStatus;
  }): void {
    const fields = ["status = ?"];
    const values: SQLQueryBindings[] = [status];

    if (updates?.startedAt) { fields.push("started_at = ?"); values.push(updates.startedAt); }
    if (updates?.completedAt) { fields.push("completed_at = ?"); values.push(updates.completedAt); }
    if (updates?.durationMs !== undefined) { fields.push("duration_ms = ?"); values.push(updates.durationMs); }
    if (updates?.output !== undefined) { fields.push("output = ?"); values.push(updates.output); }
    if (updates?.error !== undefined) { fields.push("error = ?"); values.push(updates.error); }
    if (updates?.inputTokens !== undefined) { fields.push("input_tokens = ?"); values.push(updates.inputTokens); }
    if (updates?.outputTokens !== undefined) { fields.push("output_tokens = ?"); values.push(updates.outputTokens); }
    if (updates?.healthStatus) { fields.push("health_status = ?"); values.push(updates.healthStatus); }

    values.push(id);
    this.db.query(`UPDATE jobs SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  // Atomic dequeue: claim highest priority, oldest pending job
  dequeueJob(queueName: string): Job | null {
    const row = this.db.query(`
      UPDATE jobs SET status = 'running', started_at = datetime('now')
      WHERE id = (
        SELECT id FROM jobs
        WHERE queue_name = ? AND status = 'pending'
        ORDER BY priority ASC, created_at ASC
        LIMIT 1
      )
      RETURNING *
    `).get(queueName);
    return row ? rowToJob(row) : null;
  }

  // --- Queues ---

  listQueues(): QueueInfo[] {
    const queues = this.db.query("SELECT * FROM queues").all() as Array<{ name: string; max_concurrency: number }>;
    return queues.map(q => {
      const depth = this.db.query(
        "SELECT COUNT(*) as count FROM jobs WHERE queue_name = ? AND status = 'pending'"
      ).get(q.name) as { count: number };
      const active = this.db.query(
        "SELECT COUNT(*) as count FROM jobs WHERE queue_name = ? AND status = 'running'"
      ).get(q.name) as { count: number };
      return {
        name: q.name,
        depth: depth.count,
        activeJobs: active.count,
        maxConcurrency: q.max_concurrency,
      };
    });
  }

  getQueueInfo(name: string): QueueInfo | null {
    const q = this.db.query("SELECT * FROM queues WHERE name = ?").get(name) as { name: string; max_concurrency: number } | null;
    if (!q) return null;
    const depth = this.db.query(
      "SELECT COUNT(*) as count FROM jobs WHERE queue_name = ? AND status = 'pending'"
    ).get(q.name) as { count: number };
    const active = this.db.query(
      "SELECT COUNT(*) as count FROM jobs WHERE queue_name = ? AND status = 'running'"
    ).get(q.name) as { count: number };
    return { name: q.name, depth: depth.count, activeJobs: active.count, maxConcurrency: q.max_concurrency };
  }

  // --- Templates ---

  listTemplates(): Template[] {
    return this.db.query("SELECT * FROM templates ORDER BY created_at DESC").all().map(rowToTemplate);
  }

  getTemplate(id: string): Template | null {
    const row = this.db.query("SELECT * FROM templates WHERE id = ?").get(id);
    return row ? rowToTemplate(row) : null;
  }

  createTemplate(id: string, input: CreateTemplateInput): Template {
    this.db.query(`
      INSERT INTO templates (id, name, description, agent_config)
      VALUES (?, ?, ?, ?)
    `).run(id, input.name, input.description ?? "", JSON.stringify(input.agentConfig));
    return this.getTemplate(id)!;
  }

  deleteTemplate(id: string): void {
    this.db.query("DELETE FROM templates WHERE id = ?").run(id);
  }

  // --- Usage ---

  getUsageStats(): { totalInputTokens: number; totalOutputTokens: number; totalJobs: number } {
    const row = this.db.query(`
      SELECT
        COALESCE(SUM(input_tokens), 0) as total_input,
        COALESCE(SUM(output_tokens), 0) as total_output,
        COUNT(*) as total_jobs
      FROM jobs WHERE status IN ('completed', 'failed', 'triage', 'timed_out')
    `).get() as { total_input: number; total_output: number; total_jobs: number };
    return {
      totalInputTokens: row.total_input,
      totalOutputTokens: row.total_output,
      totalJobs: row.total_jobs,
    };
  }
}

// --- Row Mappers ---

function rowToTask(row: unknown): Task {
  const r = row as Record<string, unknown>;
  return {
    id: r["id"] as string,
    name: r["name"] as string,
    description: r["description"] as string,
    prompt: r["prompt"] as string,
    scheduledAt: r["scheduled_at"] as string | null,
    cronExpression: r["cron_expression"] as string | null,
    timeoutMs: r["timeout_ms"] as number,
    executionType: r["execution_type"] as Task["executionType"],
    agentConfig: r["agent_config"] ? JSON.parse(r["agent_config"] as string) : null,
    priority: r["priority"] as Priority,
    targetQueue: r["target_queue"] as string,
    maxRetries: r["max_retries"] as number,
    executionMode: r["execution_mode"] as Task["executionMode"],
    enabled: (r["enabled"] as number) === 1,
    createdAt: r["created_at"] as string,
    updatedAt: r["updated_at"] as string,
  };
}

function rowToJob(row: unknown): Job {
  const r = row as Record<string, unknown>;
  return {
    id: r["id"] as string,
    taskId: r["task_id"] as string,
    queueName: r["queue_name"] as string,
    priority: r["priority"] as Priority,
    status: r["status"] as JobStatus,
    attempt: r["attempt"] as number,
    scheduledAt: r["scheduled_at"] as string,
    startedAt: r["started_at"] as string | null,
    completedAt: r["completed_at"] as string | null,
    durationMs: r["duration_ms"] as number | null,
    output: r["output"] as string | null,
    error: r["error"] as string | null,
    inputTokens: r["input_tokens"] as number | null,
    outputTokens: r["output_tokens"] as number | null,
    healthStatus: r["health_status"] as HealthStatus,
    createdAt: r["created_at"] as string,
  };
}

function rowToTemplate(row: unknown): Template {
  const r = row as Record<string, unknown>;
  return {
    id: r["id"] as string,
    name: r["name"] as string,
    description: r["description"] as string,
    agentConfig: JSON.parse(r["agent_config"] as string),
    createdAt: r["created_at"] as string,
    updatedAt: r["updated_at"] as string,
  };
}
