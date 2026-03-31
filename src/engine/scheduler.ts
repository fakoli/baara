// Fakoli Mini — Cron Scheduler
// Registers recurring tasks with Croner, dispatches on each tick

import { Cron } from "croner";
import type { Store } from "../db/store.ts";
import type { Dispatcher } from "./dispatcher.ts";

export class Scheduler {
  private jobs = new Map<string, Cron>();

  constructor(private store: Store, private dispatcher: Dispatcher) {}

  start(): void {
    const tasks = this.store.listTasks().filter(t => t.enabled && t.cronExpression);
    for (const task of tasks) {
      this.register(task.id, task.cronExpression!);
    }
    if (tasks.length > 0) {
      console.log(`  Scheduler: loaded ${tasks.length} recurring task(s)`);
    }
  }

  register(taskId: string, cronExpression: string): void {
    this.unregister(taskId);
    const job = new Cron(cronExpression, async () => {
      const task = this.store.getTask(taskId);
      if (!task || !task.enabled) return;
      try {
        await this.dispatcher.dispatch(task);
      } catch (error) {
        console.error(`Scheduler: failed to dispatch task ${taskId}:`, error);
      }
    });
    this.jobs.set(taskId, job);
  }

  unregister(taskId: string): void {
    const existing = this.jobs.get(taskId);
    if (existing) {
      existing.stop();
      this.jobs.delete(taskId);
    }
  }

  stop(): void {
    for (const job of this.jobs.values()) {
      job.stop();
    }
    this.jobs.clear();
  }
}
