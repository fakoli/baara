// Baara — Tool Call Card Component

import { escapeHtml } from '../utils.js';

/** Friendly labels for tool names */
const TOOL_LABELS = {
  'list tasks': 'Listing tasks',
  'get task': 'Fetching task details',
  'create task': 'Creating task',
  'update task': 'Updating task',
  'delete task': 'Deleting task',
  'toggle task': 'Toggling task',
  'run task': 'Running task',
  'submit task': 'Submitting to queue',
  'list jobs': 'Fetching job history',
  'get job': 'Fetching job details',
  'retry job': 'Retrying job',
  'list triage': 'Checking triage',
  'get status': 'Checking system status',
  'list templates': 'Browsing templates',
};

/**
 * Format tool input as a concise human-readable summary instead of raw JSON.
 * @param {string} displayName — cleaned tool name
 * @param {Object} input — tool input parameters
 * @returns {string} — formatted summary
 */
function formatToolInput(displayName, input) {
  if (!input || Object.keys(input).length === 0) return '';

  // For common tools, show a concise summary
  if (input.name && input.prompt) {
    // create_task
    const parts = [`"${input.name}"`];
    if (input.cronExpression) parts.push(`schedule: ${input.cronExpression}`);
    if (input.executionMode) parts.push(`mode: ${input.executionMode}`);
    return parts.join(' | ');
  }
  if (input.nameOrId) return input.nameOrId;
  if (input.taskNameOrId) return input.taskNameOrId;
  if (input.jobId) return `job ${input.jobId.slice(0, 8)}...`;

  // Fallback: compact key=value
  return Object.entries(input)
    .map(([k, v]) => `${k}: ${typeof v === 'string' && v.length > 40 ? v.slice(0, 40) + '...' : v}`)
    .join(' | ');
}

/**
 * Render an inline collapsible card for a tool call.
 * @param {string} toolName — raw tool name (e.g. "mcp__baara__create_task")
 * @param {Object} input — tool input parameters
 * @returns {HTMLElement} — the tool call card element
 */
export function renderToolCall(toolName, input) {
  const card = document.createElement('div');
  card.className = 'chat-msg tool-call';

  const displayName = toolName.replace('mcp__baara__', '').replace(/_/g, ' ');
  const friendlyLabel = TOOL_LABELS[displayName] || displayName;
  const inputSummary = formatToolInput(displayName, input);
  const inputStr = JSON.stringify(input, null, 2);

  card.innerHTML = `
    <div class="tool-call-card">
      <div class="tool-call-header">
        <span class="tool-call-icon">\u26A1</span>
        <span class="tool-call-name">${escapeHtml(friendlyLabel)}</span>
        ${inputSummary ? `<span class="tool-call-summary">${escapeHtml(inputSummary)}</span>` : ''}
        <span class="tool-call-chevron">\u203A</span>
      </div>
      <div class="tool-call-body">
        <pre class="tool-call-input">${escapeHtml(inputStr)}</pre>
        <div class="tool-result"></div>
      </div>
    </div>
  `;

  // Toggle expanded state on header click
  const header = card.querySelector('.tool-call-header');
  header.addEventListener('click', () => {
    card.querySelector('.tool-call-card').classList.toggle('expanded');
  });

  return card;
}
