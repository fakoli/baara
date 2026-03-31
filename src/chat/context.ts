// Baara — Live Context Builder for Chat System Prompt

import type { Store } from "../db/store.ts";
import type { ChatContext } from "./system-prompt.ts";

/**
 * Gather live system state to inject into the chat system prompt.
 * Queries are lightweight (counts + recent failures) so this is safe
 * to call on every chat message.
 */
export function gatherChatContext(store: Store): ChatContext {
  const tasks = store.listTasks();
  const triageJobs = store.getTriageJobs();
  const queues = store.listQueues();

  // Count active and pending jobs across all queues
  let activeJobs = 0;
  let pendingJobs = 0;
  for (const q of queues) {
    activeJobs += q.activeJobs;
    pendingJobs += q.depth;
  }

  // Recent failures: triage jobs with their task names (up to 5)
  const recentFailures: ChatContext["recentFailures"] = [];
  for (const job of triageJobs.slice(0, 5)) {
    const task = store.getTask(job.taskId);
    const taskName = task?.name ?? job.taskId;
    const error = job.error ?? "Unknown error";
    const when = formatRelativeTime(job.createdAt);
    recentFailures.push({ taskName, error, when });
  }

  return {
    taskCount: tasks.length,
    enabledTaskCount: tasks.filter((t) => t.enabled).length,
    scheduledTaskCount: tasks.filter((t) => t.cronExpression).length,
    triageCount: triageJobs.length,
    recentFailures,
    activeJobs,
    pendingJobs,
  };
}

/** Format an ISO timestamp as a relative time string (e.g. "2 hours ago") */
function formatRelativeTime(isoDate: string): string {
  try {
    const then = new Date(isoDate).getTime();
    const now = Date.now();
    const diffMs = now - then;

    if (diffMs < 0) return "just now";

    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    return isoDate.split("T")[0] ?? isoDate;
  } catch {
    return isoDate;
  }
}
