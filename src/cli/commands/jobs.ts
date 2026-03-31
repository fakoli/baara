// Baara — CLI Jobs Commands

import { Command } from "commander";
import type { JobService } from "../../services/job-service.ts";
import type { Store } from "../../db/store.ts";
import type { JobStatus } from "../../types.ts";
import {
  formatJobTable,
  formatJobDetail,
  formatJson,
} from "../formatter.ts";

const VALID_JOB_STATUSES: JobStatus[] = [
  "pending", "running", "completed", "failed", "triage", "timed_out", "cancelled",
];

function resolveTask(store: Store, idOrName: string) {
  return store.getTask(idOrName) ?? store.getTaskByName(idOrName);
}

export function registerJobsCommand(
  program: Command,
  store: Store,
  jobService: JobService,
): void {
  const jobs = program.command("jobs").description("Manage jobs");

  // --- list ---
  jobs
    .command("list <task-id-or-name>")
    .description("List jobs for a task")
    .option("--json", "Output as JSON")
    .option("--limit <n>", "Limit results")
    .option("--status <status>", "Filter by status")
    .action(
      (
        taskIdOrName: string,
        opts: { json?: boolean; limit?: string; status?: string },
      ) => {
        const task = resolveTask(store, taskIdOrName);
        if (!task) {
          console.error(`Error: Task not found: ${taskIdOrName}`);
          process.exit(1);
        }
        const listOpts: { limit?: number; status?: JobStatus } = {};
        if (opts.limit) listOpts.limit = parseInt(opts.limit, 10);
        if (opts.status && VALID_JOB_STATUSES.includes(opts.status as JobStatus)) {
          listOpts.status = opts.status as JobStatus;
        }
        const taskJobs = jobService.listJobs(task.id, listOpts);
        if (opts.json) {
          console.log(formatJson(taskJobs));
        } else {
          console.log(formatJobTable(taskJobs));
        }
      },
    );

  // --- show ---
  jobs
    .command("show <job-id>")
    .description("Show job detail + output")
    .option("--json", "Output as JSON")
    .action((jobId: string, opts: { json?: boolean }) => {
      const job = jobService.getJob(jobId);
      if (!job) {
        console.error(`Error: Job not found: ${jobId}`);
        process.exit(1);
      }
      if (opts.json) {
        console.log(formatJson(job));
      } else {
        console.log(formatJobDetail(job));
      }
    });

  // --- cancel ---
  jobs
    .command("cancel <job-id>")
    .description("Cancel a pending/running job")
    .action((jobId: string) => {
      const job = jobService.getJob(jobId);
      if (!job) {
        console.error(`Error: Job not found: ${jobId}`);
        process.exit(1);
      }
      jobService.cancelJob(jobId);
      console.log(`Cancelled job ${jobId.substring(0, 8)}`);
    });

  // --- retry ---
  jobs
    .command("retry <job-id>")
    .description("Re-dispatch a triaged/failed job")
    .option("--json", "Output as JSON")
    .action(async (jobId: string, opts: { json?: boolean }) => {
      try {
        const newJob = await jobService.retryJob(jobId);
        if (opts.json) {
          console.log(formatJson(newJob));
        } else {
          console.log(
            `Retried job ${jobId.substring(0, 8)} -> new job ${newJob.id.substring(0, 8)} [${newJob.status}]`,
          );
        }
      } catch (err) {
        console.error(
          `Error: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }
    });

  // --- triage ---
  jobs
    .command("triage")
    .description("Show all triaged jobs")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      const triageJobs = jobService.getTriageJobs();
      if (opts.json) {
        console.log(formatJson(triageJobs));
      } else {
        if (triageJobs.length === 0) {
          console.log("  No triaged jobs.");
        } else {
          console.log(formatJobTable(triageJobs));
        }
      }
    });
}
