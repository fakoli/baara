// Baara — Chat Panel

import { api } from './api.js';
import { escapeHtml } from './utils.js';

let messagesContainer = null;
let inputElement = null;
let onCommand = null;

const COMMANDS = {
  help: 'Available commands: status, triage, tasks, jobs, queues, help, clear, or type a task name to view it.',
  clear: '__clear__',
};

export function init({ messagesEl, inputEl, onCommandCallback }) {
  messagesContainer = messagesEl;
  inputElement = inputEl;
  onCommand = onCommandCallback;

  // Show welcome
  showWelcome();

  // Handle input
  inputElement.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const text = inputElement.value.trim();
      if (!text) return;
      inputElement.value = '';
      handleInput(text);
    }
  });

  // Focus on load
  inputElement.focus();
}

function showWelcome() {
  messagesContainer.innerHTML = `
    <div class="chat-welcome">
      <h3>Welcome to Baara</h3>
      <p>Type a command to get started.</p>
      <code>status</code> system overview<br>
      <code>tasks</code> list all tasks<br>
      <code>jobs</code> recent job history<br>
      <code>queues</code> queue monitor<br>
      <code>triage</code> jobs needing attention<br>
      <code>clear</code> clear chat<br>
      <code>help</code> show this help<br><br>
      Or type a <strong>task name</strong> to view its detail.
    </div>
  `;
}

async function handleInput(text) {
  addMessage(text, 'user');

  const lower = text.toLowerCase().trim();

  // Built-in commands
  if (lower === 'clear') {
    messagesContainer.innerHTML = '';
    showWelcome();
    return;
  }

  if (lower === 'help') {
    addMessage(COMMANDS.help, 'system');
    return;
  }

  if (lower === 'status' || lower === 'overview') {
    addMessage('Showing system overview.', 'system');
    if (onCommand) onCommand({ type: 'navigate', view: 'overview' });
    return;
  }

  if (lower === 'triage') {
    addMessage('Showing triage jobs.', 'system');
    if (onCommand) onCommand({ type: 'navigate', view: 'triage' });
    return;
  }

  if (lower === 'tasks') {
    addMessage('Showing all tasks.', 'system');
    if (onCommand) onCommand({ type: 'navigate', view: 'tasks' });
    return;
  }

  if (lower === 'jobs') {
    addMessage('Showing recent jobs.', 'system');
    if (onCommand) onCommand({ type: 'navigate', view: 'jobs' });
    return;
  }

  if (lower === 'queues') {
    addMessage('Showing queue monitor.', 'system');
    if (onCommand) onCommand({ type: 'navigate', view: 'queues' });
    return;
  }

  // Try to find a task by name
  try {
    const tasks = await api.listTasks();
    const match = tasks.find(t =>
      t.name.toLowerCase() === lower ||
      t.name.toLowerCase().includes(lower) ||
      t.id === text
    );

    if (match) {
      addMessage(
        `Found task: <a class="task-link" data-task-id="${match.id}"><span class="mono">${escapeHtml(match.name)}</span></a>`,
        'system'
      );
      if (onCommand) onCommand({ type: 'select-task', task: match });

      // Make the link clickable
      const links = messagesContainer.querySelectorAll('.task-link');
      const lastLink = links[links.length - 1];
      if (lastLink) {
        lastLink.addEventListener('click', () => {
          if (onCommand) onCommand({ type: 'select-task', task: match });
        });
      }
      return;
    }

    // No match
    addMessage(
      `No task found matching "${escapeHtml(text)}". Type <strong>help</strong> for available commands.`,
      'system'
    );
  } catch (err) {
    addMessage(`Error: ${escapeHtml(err.message)}`, 'error');
  }
}

function addMessage(content, type = 'system') {
  const msg = document.createElement('div');
  msg.className = `chat-msg ${type}`;
  msg.innerHTML = `<div class="msg-content">${content}</div>`;
  messagesContainer.appendChild(msg);
  scrollToBottom();
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

export function addSystemMessage(content) {
  addMessage(content, 'system');
}
