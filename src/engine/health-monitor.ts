// Fakoli Mini — Health Monitor
// Detects stalled/unresponsive jobs by comparing elapsed time to task timeout

import type { Store } from "../db/store.ts";

export class HealthMonitor {
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private store: Store,
    private checkIntervalMs = 10000,
  ) {}

  start(): void {
    this.interval = setInterval(() => {
      try { this.check(); } catch (err) { console.error("HealthMonitor error:", err); }
    }, this.checkIntervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private check(): void {
    // Join jobs with tasks to get per-job timeout awareness
    const runningJobs = this.store.db.query(`
      SELECT j.id, j.started_at, j.health_status, t.timeout_ms
      FROM jobs j JOIN tasks t ON j.task_id = t.id
      WHERE j.status = 'running'
    `).all() as Array<{ id: string; started_at: string; health_status: string; timeout_ms: number }>;

    const now = Date.now();
    for (const job of runningJobs) {
      if (!job.started_at) continue;
      const elapsed = now - new Date(job.started_at).getTime();
      const threshold = job.timeout_ms * 0.5; // slow at 50% of timeout

      if (elapsed > job.timeout_ms && job.health_status !== "unresponsive") {
        this.store.updateJobStatus(job.id, "running", { healthStatus: "unresponsive" });
      } else if (elapsed > threshold && job.health_status === "healthy") {
        this.store.updateJobStatus(job.id, "running", { healthStatus: "slow" });
      }
    }
  }
}
