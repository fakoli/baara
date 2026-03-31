// Fakoli Mini — Queue Manager
// Processes pending jobs from queues by priority (SQLite-backed)

import type { Store } from "../db/store.ts";
import type { Job } from "../types.ts";
import { executeJob } from "./executor.ts";

export class QueueManager {
  private running = false;
  private polling = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private store: Store, private pollMs = 1000) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.pollInterval = setInterval(() => {
      this.processQueues().catch(err => console.error("QueueManager poll error:", err));
    }, this.pollMs);
  }

  stop(): void {
    this.running = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // Guard against re-entrant polls
  private async processQueues(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const queues = this.store.listQueues();
      for (const queue of queues) {
        if (queue.activeJobs >= queue.maxConcurrency) continue;
        const job = this.store.dequeueJob(queue.name);
        if (!job) continue;
        this.executeInBackground(job);
      }
    } finally {
      this.polling = false;
    }
  }

  private async executeInBackground(job: Job): Promise<void> {
    const task = this.store.getTask(job.taskId);
    if (!task) {
      this.store.updateJobStatus(job.id, "failed", { error: "Task not found" });
      return;
    }

    try {
      const result = await executeJob(job, task);
      this.store.updateJobStatus(job.id, result.status, {
        completedAt: new Date().toISOString(),
        durationMs: result.durationMs,
        output: result.output,
        error: result.error,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });

      // Retry on failure or timeout
      const isFailure = result.status === "failed" || result.status === "timed_out";
      if (isFailure && job.attempt < task.maxRetries) {
        const retryId = crypto.randomUUID();
        this.store.createJob(retryId, task.id, job.queueName, job.priority, new Date().toISOString(), job.attempt + 1);
      } else if (isFailure && task.maxRetries > 0) {
        this.store.updateJobStatus(job.id, "triage");
      }
    } catch (error) {
      this.store.updateJobStatus(job.id, "failed", {
        completedAt: new Date().toISOString(),
        error: String(error),
      });
    }
  }
}
