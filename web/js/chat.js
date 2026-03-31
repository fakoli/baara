// Baara — Agentic Chat Panel (SSE Streaming)

import { api } from './api.js';
import { escapeHtml } from './utils.js';
import { renderToolCall } from './components/tool-call.js';

let messagesContainer = null;
let inputElement = null;
let onToolCall = null;
let isStreaming = false;
let sessionId = null;

// Session persistence keys
const SESSION_ID_KEY = 'baara_session_id';
const CHAT_HISTORY_KEY = 'baara_chat_history';

/**
 * Initialize the chat panel.
 * @param {Object} config
 * @param {HTMLElement} config.messagesEl — DOM element for the message list
 * @param {HTMLElement} config.inputEl — textarea element for user input
 * @param {Function} [config.onToolCallCallback] — called when Claude invokes a tool
 */
export function init({ messagesEl, inputEl, onToolCallCallback }) {
  messagesContainer = messagesEl;
  inputElement = inputEl;
  onToolCall = onToolCallCallback || null;

  // Restore session from sessionStorage
  restoreSession();

  inputElement.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isStreaming) return;
      const text = inputElement.value.trim();
      if (!text) return;
      inputElement.value = '';
      // Reset textarea height after clearing
      inputElement.style.height = 'auto';
      handleSend(text);
    }
  });

  // Auto-resize textarea as user types
  inputElement.addEventListener('input', () => {
    inputElement.style.height = 'auto';
    inputElement.style.height = Math.min(inputElement.scrollHeight, 120) + 'px';
  });

  inputElement.focus();
}

function showWelcome() {
  messagesContainer.innerHTML = `
    <div class="chat-welcome">
      <h3>Welcome to Baara</h3>
      <p>I can help you schedule and manage tasks.</p>
      <p style="color: var(--text-dim); font-size: 12px; margin-top: 8px;">
        Try: "Create a task that checks my email every morning at 6am"<br>
        or ask me anything about your tasks.
      </p>
    </div>
  `;
}

async function handleSend(text) {
  addMessage(text, 'user');

  isStreaming = true;
  inputElement.disabled = true;

  // Create assistant message placeholder for streaming
  const assistantMsg = document.createElement('div');
  assistantMsg.className = 'chat-msg assistant';
  assistantMsg.innerHTML = '<div class="msg-content streaming"></div>';
  messagesContainer.appendChild(assistantMsg);
  const contentEl = assistantMsg.querySelector('.msg-content');

  let fullText = '';

  try {
    await api.chatStream(text, (event) => {
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
              let display = 'Done';
              if (event.output) {
                try {
                  display = (typeof event.output === 'string'
                    ? event.output
                    : JSON.stringify(event.output, null, 2)
                  ).slice(0, 200);
                } catch {
                  display = String(event.output).slice(0, 200);
                }
              }
              resultEl.textContent = display;
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
          addMessage(`Error: ${escapeHtml(event.message || 'Unknown error')}`, 'error');
          scrollToBottom();
          break;

        case 'done':
          break;
      }
    }, { sessionId });
  } catch (err) {
    addMessage(`Error: ${escapeHtml(err.message)}`, 'error');
  } finally {
    isStreaming = false;
    inputElement.disabled = false;
    inputElement.focus();
    contentEl.classList.remove('streaming');

    // Remove empty assistant bubble if no text was streamed
    if (!fullText && !assistantMsg.nextElementSibling) {
      assistantMsg.remove();
    }

    // Persist chat history to sessionStorage
    saveChatHistory();
  }
}

function addMessage(content, type = 'system') {
  const msg = document.createElement('div');
  msg.className = `chat-msg ${type}`;
  msg.innerHTML = `<div class="msg-content">${escapeHtml(content)}</div>`;
  messagesContainer.appendChild(msg);
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
 * Start a new chat session — clears history and session ID.
 */
export function startNewChat() {
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
 * Inject a system message into the chat.
 * Preserved for external callers (triage badge, etc.).
 */
export function addSystemMessage(content) {
  addMessage(content, 'system');
}
