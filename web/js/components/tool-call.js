// Baara — Tool Call Card Component

import { escapeHtml } from '../utils.js';

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
  const inputStr = JSON.stringify(input, null, 2);

  card.innerHTML = `
    <div class="tool-call-card">
      <div class="tool-call-header">
        <span class="tool-call-icon">\u26A1</span>
        <span class="tool-call-name">${escapeHtml(displayName)}</span>
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
