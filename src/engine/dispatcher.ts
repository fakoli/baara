// Fakoli Mini — Dispatcher
// Creates Jobs from Tasks and routes by execution mode (queued vs direct)

import type { Store } from "../db/store.ts";
import type { Task, Job, JobResult } from "../types.ts";
import { executeJob } from "./executor.ts";

export class Dispatcher {
  private cancelledJobs = new Set<string>();

  constructor(private store: Store) {}

  async dispatch(task: Task): Promise<Job> {
    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();

    if (task.executionMode === "direct") {
      return this.executeDirect(jobId, task, now);
    }
    return this.enqueue(jobId, task, now);
  }

  // Direct mode: create job → execute immediately → return completed job
  private async executeDirect(jobId: string, task: Task, scheduledAt: string): Promise<Job> {
    // Create job as "running" immediately
    this.store.createJob(jobId, task.id, task.targetQueue, task.priority, scheduledAt);
    this.store.updateJobStatus(jobId, "running", { startedAt: new Date().toISOString() });

    const result = await executeJob(
      this.store.getJob(jobId)!,
      task,
    );

    // If cancelled while running, don't overwrite the cancelled status
    if (this.cancelledJobs.has(jobId)) {
      this.cancelledJobs.delete(jobId);
      return this.store.getJob(jobId)!;
    }

    this.store.updateJobStatus(jobId, result.status, {
      completedAt: new Date().toISOString(),
      durationMs: result.durationMs,
      output: result.output,
      error: result.error,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });

    // Handle retry on failure or timeout
    const isFailure = result.status === "failed" || result.status === "timed_out";
    if (isFailure) {
      return this.handleFailure(jobId, task);
    }

    return this.store.getJob(jobId)!;
  }

  // Queued mode: create job as pending → return immediately
  private enqueue(jobId: string, task: Task, scheduledAt: string): Job {
    return this.store.createJob(jobId, task.id, task.targetQueue, task.priority, scheduledAt);
  }

  // Handle retry logic: re-dispatch or move to triage
  private handleFailure(jobId: string, task: Task): Job {
    const job = this.store.getJob(jobId)!;
    if (job.attempt < task.maxRetries) {
      // Create a new job with incremented attempt
      const retryId = crypto.randomUUID();
      this.store.createJob(retryId, task.id, task.targetQueue, task.priority, new Date().toISOString(), job.attempt + 1);
      return this.store.getJob(retryId)!;
    }
    // Max retries exhausted — triage
    if (task.maxRetries > 0) {
      this.store.updateJobStatus(jobId, "triage");
    }
    return this.store.getJob(jobId)!;
  }

  cancelJob(jobId: string): void {
    const job = this.store.getJob(jobId);
    if (job && (job.status === "pending" || job.status === "running")) {
      this.cancelledJobs.add(jobId);
      this.store.updateJobStatus(jobId, "cancelled");
    }
  }
}
