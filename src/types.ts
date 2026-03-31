// Fakoli Mini — Shared Types

// --- Execution & Priority ---

export type ExecutionType = "agent_sdk" | "wasm" | "raw_code";
export type ExecutionMode = "queued" | "direct";
export type Priority = 0 | 1 | 2 | 3;

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "triage"
  | "timed_out"
  | "cancelled";

export type HealthStatus = "healthy" | "slow" | "unresponsive" | "error";

// --- Agent SDK Config ---

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface AgentConfig {
  model?: string;
  systemPrompt?: string;
  allowedTools: string[];
  mcpServers?: Record<string, McpServerConfig>;
  maxTurns?: number;
  maxBudgetUsd?: number;
  permissionMode?: string;
}

// --- Task ---

export interface Task {
  id: string;
  name: string;
  description: string;
  prompt: string;
  scheduledAt: string | null;
  cronExpression: string | null;
  timeoutMs: number;
  executionType: ExecutionType;
  agentConfig: AgentConfig | null;
  priority: Priority;
  targetQueue: string;
  maxRetries: number;
  executionMode: ExecutionMode;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  name: string;
  description?: string;
  prompt: string;
  scheduledAt?: string | null;
  cronExpression?: string | null;
  timeoutMs?: number;
  executionType?: ExecutionType;
  agentConfig?: AgentConfig | null;
  priority?: Priority;
  targetQueue?: string;
  maxRetries?: number;
  executionMode?: ExecutionMode;
  enabled?: boolean;
}

export interface UpdateTaskInput {
  name?: string;
  description?: string;
  prompt?: string;
  scheduledAt?: string | null;
  cronExpression?: string | null;
  timeoutMs?: number;
  executionType?: ExecutionType;
  agentConfig?: AgentConfig | null;
  priority?: Priority;
  targetQueue?: string;
  maxRetries?: number;
  executionMode?: ExecutionMode;
  enabled?: boolean;
}

// --- Job ---

export interface Job {
  id: string;
  taskId: string;
  queueName: string;
  priority: Priority;
  status: JobStatus;
  attempt: number;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  output: string | null;
  error: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  healthStatus: HealthStatus;
  createdAt: string;
}

export interface JobResult {
  status: "completed" | "failed" | "timed_out";
  output?: string;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
}

// --- Queue ---

export interface QueueInfo {
  name: string;
  depth: number;
  activeJobs: number;
  maxConcurrency: number;
}

// --- Template ---

export interface Template {
  id: string;
  name: string;
  description: string;
  agentConfig: AgentConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  agentConfig: AgentConfig;
}
