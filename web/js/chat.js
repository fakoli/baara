// Baara — Agentic Chat Panel (SSE Streaming)

import { api } from './api.js';
import { escapeHtml } from './utils.js';
import { renderToolCall } from './components/tool-call.js';

let messagesContainer = null;
let inputElement = null;
let onToolCall = null;
let isStreaming = false;

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

  showWelcome();

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
        case 'text':
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
                  display = JSON.stringify(JSON.parse(event.output), null, 2).slice(0, 200);
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
    });
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
  }
}

function addMessage(content, type = 'system') {
  const msg = document.createElement('div');
  msg.className = `chat-msg ${type}`;
  msg.innerHTML = `<div class="msg-content">${type === 'user' ? escapeHtml(content) : content}</div>`;
  messagesContainer.appendChild(msg);
  scrollToBottom();
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

/**
 * Inject a system message into the chat.
 * Preserved for external callers (triage badge, etc.).
 */
export function addSystemMessage(content) {
  addMessage(content, 'system');
}
