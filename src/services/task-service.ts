// Baara — Task Service

import type { Store } from "../db/store.ts";
import type { Task, CreateTaskInput, UpdateTaskInput } from "../types.ts";

export class TaskService {
  constructor(private store: Store, private defaultMode: string) {}

  listTasks(): Task[] { return this.store.listTasks(); }
  getTask(id: string): Task | null { return this.store.getTask(id); }
  getTaskByName(name: string): Task | null { return this.store.getTaskByName(name); }

  createTask(input: CreateTaskInput): Task {
    return this.store.createTask(crypto.randomUUID(), input, this.defaultMode);
  }

  updateTask(id: string, input: UpdateTaskInput): Task {
    return this.store.updateTask(id, input);
  }

  deleteTask(id: string): void { this.store.deleteTask(id); }

  toggleTask(id: string): Task {
    const task = this.store.getTask(id);
    if (!task) throw new Error(`Task not found: ${id}`);
    return this.store.updateTask(id, { enabled: !task.enabled });
  }
}
