// Baara — Task Service

import type { Store } from "../db/store.ts";
import type { Task, CreateTaskInput, UpdateTaskInput, ExecutionType } from "../types.ts";

const MAX_TIMEOUT_MS = 3_600_000; // 1 hour
const MAX_RETRIES = 10;
const VALID_EXECUTION_TYPES: ExecutionType[] = ["agent_sdk", "wasm", "raw_code"];
const VALID_PERMISSION_MODES = ["default", "acceptEdits", "bypassPermissions"];

function sanitizeInput(input: CreateTaskInput | UpdateTaskInput): void {
  if ("timeoutMs" in input && input.timeoutMs !== undefined) {
    input.timeoutMs = Math.min(Math.max(input.timeoutMs, 1000), MAX_TIMEOUT_MS);
  }
  if ("maxRetries" in input && input.maxRetries !== undefined) {
    input.maxRetries = Math.min(Math.max(input.maxRetries, 0), MAX_RETRIES);
  }
  if ("executionType" in input && input.executionType !== undefined) {
    if (!VALID_EXECUTION_TYPES.includes(input.executionType)) {
      throw new Error(`Invalid executionType: ${input.executionType}. Must be one of: ${VALID_EXECUTION_TYPES.join(", ")}`);
    }
  }
  if ("executionType" in input && input.executionType === "agent_sdk") {
    if (!("agentConfig" in input) || !input.agentConfig) {
      throw new Error("agent_sdk tasks require agentConfig with at least allowedTools");
    }
  }
  if ("agentConfig" in input && input.agentConfig) {
    const ac = input.agentConfig;
    // Validate permissionMode if provided
    if (ac.permissionMode && !VALID_PERMISSION_MODES.includes(ac.permissionMode)) {
      throw new Error(`Invalid permissionMode: ${ac.permissionMode}`);
    }
    // Enforce maxBudgetUsd ceiling
    if (ac.maxBudgetUsd !== undefined) {
      ac.maxBudgetUsd = Math.min(ac.maxBudgetUsd, 10.00);
    } else {
      ac.maxBudgetUsd = 2.00; // server-enforced default
    }
    // Clamp maxTurns
    if (ac.maxTurns !== undefined) {
      ac.maxTurns = Math.min(Math.max(ac.maxTurns, 1), 50);
    }
  }
}

export class TaskService {
  constructor(private store: Store, private defaultMode: string) {}

  listTasks(projectId?: string): Task[] { return this.store.listTasks(projectId); }
  getTask(id: string): Task | null { return this.store.getTask(id); }
  getTaskByName(name: string): Task | null { return this.store.getTaskByName(name); }

  createTask(input: CreateTaskInput): Task {
    sanitizeInput(input);
    return this.store.createTask(crypto.randomUUID(), input, this.defaultMode);
  }

  updateTask(id: string, input: UpdateTaskInput): Task {
    sanitizeInput(input);
    return this.store.updateTask(id, input);
  }

  deleteTask(id: string): void { this.store.deleteTask(id); }

  toggleTask(id: string): Task {
    const task = this.store.getTask(id);
    if (!task) throw new Error(`Task not found: ${id}`);
    return this.store.updateTask(id, { enabled: !task.enabled });
  }
}
