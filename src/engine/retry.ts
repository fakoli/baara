// Baara — Shared Retry Logic

import type { Store } from "../db/store.ts";
import type { Job, Task } from "../types.ts";
import { log } from "../logger.ts";

export function handleJobFailure(store: Store, job: Job, task: Task): void {
  const isFailure = job.status === "failed" || job.status === "timed_out";
  if (!isFailure) return;

  if (job.attempt < task.maxRetries) {
    const retryId = crypto.randomUUID();
    store.createJob(retryId, task.id, job.queueName, job.priority, new Date().toISOString(), job.attempt + 1);
    log("info", "retry", `Retrying job (attempt ${job.attempt + 1}/${task.maxRetries})`, { jobId: job.id, taskId: task.id });
  } else if (task.maxRetries > 0) {
    store.updateJobStatus(job.id, "triage");
    log("warn", "retry", `Job moved to triage after ${job.attempt} attempts`, { jobId: job.id, taskId: task.id });
  }
}
