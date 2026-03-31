// Baara — Agentic Chat Panel (SSE Streaming)

import { api } from './api.js';
import { escapeHtml } from './utils.js';
import { renderToolCall } from './components/tool-call.js';

let messagesContainer = null;
let inputElement = null;
let sendButton = null;
let inputHint = null;
let onToolCall = null;
let getActiveProjectId = null;
let isStreaming = false;
let sessionId = null;
let lastSentMessage = null;

// Session persistence keys
const SESSION_ID_KEY = 'baara_session_id';
const CHAT_HISTORY_KEY = 'baara_chat_history';

// Multi-session state — caches DOM snapshots keyed by sessionId
const sessionDomCache = new Map();

/**
 * Initialize the chat panel.
 * @param {Object} config
 * @param {HTMLElement} config.messagesEl — DOM element for the message list
 * @param {HTMLElement} config.inputEl — textarea element for user input
 * @param {Function} [config.onToolCallCallback] — called when Claude invokes a tool
 * @param {Function} [config.getActiveProjectId] — returns current active project ID or null
 */
export function init({ messagesEl, inputEl, onToolCallCallback, getActiveProjectId: getProjectId }) {
  messagesContainer = messagesEl;
  inputElement = inputEl;
  sendButton = document.getElementById('send-btn');
  inputHint = document.getElementById('input-hint');
  onToolCall = onToolCallCallback || null;
  getActiveProjectId = getProjectId || null;

  // Restore session from sessionStorage
  restoreSession();

  inputElement.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      triggerSend();
    }
  });

  // Auto-resize textarea as user types
  inputElement.addEventListener('input', () => {
    inputElement.style.height = 'auto';
    inputElement.style.height = Math.min(inputElement.scrollHeight, 120) + 'px';
    updateSendButton();
  });

  // Show/hide input hint on focus
  inputElement.addEventListener('focus', () => {
    if (inputHint) inputHint.classList.add('visible');
  });
  inputElement.addEventListener('blur', () => {
    if (inputHint) inputHint.classList.remove('visible');
  });

  // Send button click
  if (sendButton) {
    sendButton.addEventListener('click', (e) => {
      e.preventDefault();
      triggerSend();
    });
  }

  inputElement.focus();
}

function triggerSend() {
  if (isStreaming) return;
  const text = inputElement.value.trim();
  if (!text) return;
  inputElement.value = '';
  inputElement.style.height = 'auto';
  updateSendButton();
  handleSend(text);
}

function updateSendButton() {
  if (!sendButton) return;
  const hasText = inputElement.value.trim().length > 0;
  if (hasText && !isStreaming) {
    sendButton.classList.add('visible');
  } else {
    sendButton.classList.remove('visible');
  }
}

function showWelcome() {
  messagesContainer.innerHTML = `
    <div class="chat-welcome">
      <div class="welcome-icon">B</div>
      <h3>Hey, welcome to Baara</h3>
      <p class="subtitle">I'm your task manager. Tell me what to automate and I'll handle the rest.</p>
      <div class="suggestions">
        <div class="suggestion" data-msg="Create a task that checks my email every morning at 6am">Schedule an email check every morning at 6am</div>
        <div class="suggestion" data-msg="Show me all my active tasks">Show me all my active tasks</div>
        <div class="suggestion" data-msg="What's the status of my system?">What's the system status?</div>
      </div>
    </div>
  `;

  // Wire up suggestion clicks
  messagesContainer.querySelectorAll('.suggestion').forEach(el => {
    el.addEventListener('click', () => {
      const msg = el.dataset.msg;
      if (msg && !isStreaming) {
        handleSend(msg);
      }
    });
  });
}

async function handleSend(text) {
  // Store for retry
  lastSentMessage = text;

  addMessage(text, 'user');

  isStreaming = true;
  inputElement.disabled = true;
  updateSendButton();

  // Show typing indicator while waiting for first token
  const typingEl = document.createElement('div');
  typingEl.className = 'typing-indicator';
  typingEl.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
  messagesContainer.appendChild(typingEl);
  scrollToBottom();

  // Create assistant message placeholder for streaming
  const assistantMsg = document.createElement('div');
  assistantMsg.className = 'chat-msg assistant';
  assistantMsg.innerHTML = '<div class="msg-content streaming"></div>';

  const contentEl = assistantMsg.querySelector('.msg-content');
  let fullText = '';
  let firstToken = true;

  try {
    await api.chatStream(text, (event) => {
      // Remove typing indicator on first content event
      if (firstToken && (event.type === 'text' || event.type === 'text_delta' || event.type === 'tool_use')) {
        firstToken = false;
        typingEl.remove();
        messagesContainer.appendChild(assistantMsg);
      }

      switch (event.type) {
        case 'system':
          // Capture session ID from the init message
          if (event.sessionId && !sessionId) {
            sessionId = event.sessionId;
            sessionStorage.setItem(SESSION_ID_KEY, sessionId);
          }
          break;

        case 'text':
          fullText += event.content;
          contentEl.textContent = fullText;
          scrollToBottom();
          break;

        case 'text_delta':
          fullText += event.content;
          contentEl.textContent = fullText;
          scrollToBottom();
          break;

        case 'tool_use': {
          // Insert tool call card after the assistant message
          const toolEl = renderToolCall(event.name, event.input);
          messagesContainer.appendChild(toolEl);
          if (onToolCall) onToolCall(event);
          scrollToBottom();
          break;
        }

        case 'tool_result': {
          // Update the last tool call card with the result
          const lastTool = messagesContainer.querySelector('.tool-call-card:last-of-type');
          if (lastTool) {
            const resultEl = lastTool.querySelector('.tool-result');
            if (resultEl) {
              const formatted = formatToolResult(event.output, event.isError);
              resultEl.textContent = formatted;
              if (event.isError) {
                resultEl.classList.add('tool-result-error');
              }
            }
          }
          break;
        }

        case 'result':
          // Final result — update content if it differs from streamed text
          if (event.text && event.text !== fullText) {
            fullText = event.text;
            contentEl.textContent = fullText;
          }
          scrollToBottom();
          break;

        case 'error':
          addErrorMessage(event.message || 'Unknown error', text);
          scrollToBottom();
          break;

        case 'done':
          break;
      }
    }, { sessionId, activeProjectId: getActiveProjectId ? getActiveProjectId() : null });
  } catch (err) {
    typingEl.remove();
    addErrorMessage(err.message, text);
  } finally {
    isStreaming = false;
    inputElement.disabled = false;
    inputElement.focus();
    contentEl.classList.remove('streaming');
    updateSendButton();

    // Remove typing indicator if it's still there
    if (typingEl.parentNode) typingEl.remove();

    // Remove empty assistant bubble if no text was streamed
    if (!fullText && !assistantMsg.parentNode) {
      // assistantMsg was never added, nothing to remove
    } else if (!fullText && assistantMsg.parentNode) {
      assistantMsg.remove();
    }

    // Persist chat history to sessionStorage
    saveChatHistory();
  }
}

/**
 * Format a tool result for display — tries to extract a meaningful summary
 * instead of showing raw JSON.
 * @param {*} output — raw tool output
 * @param {boolean} isError — whether the result is an error
 * @returns {string} — formatted display string
 */
function formatToolResult(output, isError) {
  if (!output) return isError ? 'Failed' : 'Done';

  try {
    // Parse the output if it's a string containing JSON
    let data = output;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { /* not JSON, use as-is */ }
    }

    // Handle MCP tool result content blocks
    if (Array.isArray(data)) {
      const textBlocks = data.filter(b => b.type === 'text');
      if (textBlocks.length > 0) {
        try {
          data = JSON.parse(textBlocks[0].text);
        } catch {
          return textBlocks[0].text.slice(0, 200);
        }
      }
    }

    if (typeof data !== 'object' || data === null) {
      return String(data).slice(0, 200);
    }

    // Simple message responses
    if (data.message) return data.message;

    // Deleted/toggled/submitted responses
    if (data.deleted) return `Deleted: ${data.name || data.id}`;
    if (data.submitted) return `Submitted job ${(data.jobId || '').slice(0, 8)}`;
    if (data.retried) return `Retried -> job ${(data.newJobId || '').slice(0, 8)}`;
    if ('enabled' in data && data.name) return `${data.name}: ${data.enabled ? 'enabled' : 'disabled'}`;

    // Task or job detail — show name + status
    if (data.name && data.id) return `${data.name} (${data.executionMode || data.status || 'ok'})`;

    // Array of items (list results)
    if (Array.isArray(data) && data.length > 0) {
      const count = data.length;
      const label = data[0].name ? 'tasks' : data[0].status ? 'jobs' : 'items';
      return `${count} ${label} found`;
    }

    // Fallback: compact JSON, truncated
    return JSON.stringify(data).slice(0, 200);
  } catch {
    return String(output).slice(0, 200);
  }
}

function addMessage(content, type = 'system') {
  const msg = document.createElement('div');
  msg.className = `chat-msg ${type}`;
  msg.innerHTML = `<div class="msg-content">${escapeHtml(content)}</div>`;
  messagesContainer.appendChild(msg);
  scrollToBottom();
}

function addErrorMessage(errorText, originalMessage) {
  const msg = document.createElement('div');
  msg.className = 'chat-msg error';
  const safeError = escapeHtml(errorText);
  msg.innerHTML = `
    <div class="msg-content">
      <span>Error: ${safeError}</span>
      ${originalMessage ? '<button class="retry-btn-chat">Retry</button>' : ''}
    </div>
  `;
  messagesContainer.appendChild(msg);

  if (originalMessage) {
    const retryBtn = msg.querySelector('.retry-btn-chat');
    retryBtn.addEventListener('click', () => {
      msg.remove();
      handleSend(originalMessage);
    });
  }

  scrollToBottom();
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

// --- Session Persistence ---

function saveChatHistory() {
  try {
    sessionStorage.setItem(CHAT_HISTORY_KEY, messagesContainer.innerHTML);
  } catch {
    // sessionStorage quota exceeded — silently ignore
  }
}

function restoreSession() {
  const savedSessionId = sessionStorage.getItem(SESSION_ID_KEY);
  const savedHistory = sessionStorage.getItem(CHAT_HISTORY_KEY);

  if (savedSessionId && savedHistory) {
    sessionId = savedSessionId;
    messagesContainer.innerHTML = savedHistory;
    scrollToBottom();
  } else {
    showWelcome();
  }
}

/**
 * Start a new chat session — saves current session to cache and starts fresh.
 */
export function startNewChat() {
  // Save current session DOM before clearing
  if (sessionId && messagesContainer) {
    sessionDomCache.set(sessionId, messagesContainer.innerHTML);
  }

  sessionId = null;
  sessionStorage.removeItem(SESSION_ID_KEY);
  sessionStorage.removeItem(CHAT_HISTORY_KEY);
  showWelcome();
  if (inputElement) {
    inputElement.value = '';
    inputElement.style.height = 'auto';
    inputElement.focus();
  }
}

/**
 * Switch to a different session.
 * @param {string} newSessionId — session ID to switch to
 */
export function switchSession(newSessionId) {
  if (newSessionId === sessionId) return;

  // Save current session DOM
  if (sessionId && messagesContainer) {
    sessionDomCache.set(sessionId, messagesContainer.innerHTML);
  }

  // Load the target session DOM (from cache or show empty)
  const cached = sessionDomCache.get(newSessionId);
  if (cached) {
    messagesContainer.innerHTML = cached;
    scrollToBottom();
  } else {
    // No cached DOM — show a placeholder indicating we resumed a past session
    messagesContainer.innerHTML = `
      <div class="chat-welcome">
        <div class="welcome-icon">B</div>
        <h3>Session resumed</h3>
        <p class="subtitle">Send a message to continue this conversation.</p>
      </div>
    `;
  }

  sessionId = newSessionId;
  sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  saveChatHistory();

  if (inputElement) {
    inputElement.value = '';
    inputElement.style.height = 'auto';
    inputElement.focus();
  }
}

/**
 * Get the current session ID.
 * @returns {string|null}
 */
export function getSessionId() {
  return sessionId;
}

/**
 * Inject a system message into the chat.
 * Preserved for external callers (triage badge, etc.).
 */
export function addSystemMessage(content) {
  addMessage(content, 'system');
}
