// Baara — Job Service

import type { Store } from "../db/store.ts";
import type { Dispatcher } from "../engine/dispatcher.ts";
import type { Job, JobStatus } from "../types.ts";

export class JobService {
  constructor(private store: Store, private dispatcher: Dispatcher) {}

  async submitTask(taskId: string): Promise<Job> {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    return this.dispatcher.dispatch(task);
  }

  async runImmediate(taskId: string): Promise<Job> {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    // Force direct mode regardless of task setting
    const directTask = { ...task, executionMode: "direct" as const };
    return this.dispatcher.dispatch(directTask);
  }

  cancelJob(jobId: string): void {
    this.dispatcher.cancelJob(jobId);
  }

  getJob(id: string): Job | null { return this.store.getJob(id); }

  listJobs(taskId: string, opts?: { limit?: number; status?: JobStatus }): Job[] {
    return this.store.listJobs(taskId, opts);
  }

  getTriageJobs(): Job[] { return this.store.getTriageJobs(); }

  async retryJob(jobId: string): Promise<Job> {
    const job = this.store.getJob(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    if (job.status !== "triage" && job.status !== "failed") {
      throw new Error(`Can only retry failed/triaged jobs, got: ${job.status}`);
    }
    const task = this.store.getTask(job.taskId);
    if (!task) throw new Error(`Task not found: ${job.taskId}`);
    return this.dispatcher.dispatch(task);
  }
}
