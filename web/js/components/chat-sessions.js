// Baara — Chat Sessions Drawer Component

import { api } from '../api.js';
import { escapeHtml, timeAgo } from '../utils.js';

let drawerEl = null;
let overlayEl = null;
let isOpen = false;
let sessions = [];
let currentSessionId = null;
let onSwitchSession = null;
let onNewChat = null;

/**
 * Initialize the sessions drawer.
 * @param {Object} config
 * @param {Function} config.onSwitchSession — called with sessionId when user picks a session
 * @param {Function} config.onNewChat — called when user clicks New Chat
 * @param {Function} config.getCurrentSessionId — returns current sessionId
 */
export function init({ onSwitchSession: switchCb, onNewChat: newCb, getCurrentSessionId }) {
  onSwitchSession = switchCb;
  onNewChat = newCb;

  // Build drawer DOM (left slide-out)
  overlayEl = document.createElement('div');
  overlayEl.className = 'chat-sessions-overlay';
  overlayEl.addEventListener('click', close);

  drawerEl = document.createElement('div');
  drawerEl.className = 'chat-sessions-drawer';
  drawerEl.innerHTML = `
    <div class="sessions-header">
      <h3>Chat Sessions</h3>
      <button class="icon-btn sessions-close" aria-label="Close sessions drawer">\u2715</button>
    </div>
    <div class="sessions-list" role="list" aria-label="Chat sessions"></div>
    <div class="sessions-footer">
      <button class="btn sessions-new-chat-btn" aria-label="Start new chat">+ New Chat</button>
    </div>
  `;

  document.body.appendChild(overlayEl);
  document.body.appendChild(drawerEl);

  // Close button
  drawerEl.querySelector('.sessions-close').addEventListener('click', close);

  // New Chat button in drawer
  drawerEl.querySelector('.sessions-new-chat-btn').addEventListener('click', () => {
    if (onNewChat) onNewChat();
    close();
  });

  // Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      close();
    }
  });
}

/**
 * Open the sessions drawer — loads sessions from the server.
 */
export async function open(activeSessionId) {
  if (isOpen) return;
  isOpen = true;
  currentSessionId = activeSessionId;

  overlayEl.classList.add('visible');
  drawerEl.classList.add('visible');

  // Show loading state
  const listEl = drawerEl.querySelector('.sessions-list');
  listEl.innerHTML = '<div class="loading-state"><div class="spinner"></div>Loading sessions...</div>';

  try {
    sessions = await api.listChatSessions();
    renderSessionList(listEl);
  } catch (err) {
    listEl.innerHTML = `<div class="sessions-empty">Could not load sessions.</div>`;
  }
}

/**
 * Close the sessions drawer.
 */
export function close() {
  if (!isOpen) return;
  isOpen = false;
  overlayEl.classList.remove('visible');
  drawerEl.classList.remove('visible');
}

/**
 * Toggle the sessions drawer.
 */
export function toggle(activeSessionId) {
  if (isOpen) {
    close();
  } else {
    open(activeSessionId);
  }
}

/**
 * Update the active session indicator (call after switching sessions).
 */
export function setActiveSession(sessionId) {
  currentSessionId = sessionId;
  if (isOpen) {
    const listEl = drawerEl.querySelector('.sessions-list');
    renderSessionList(listEl);
  }
}

function renderSessionList(listEl) {
  if (!sessions || sessions.length === 0) {
    listEl.innerHTML = `
      <div class="sessions-empty">
        <p>No past sessions found.</p>
        <p class="sessions-empty-hint">Start a chat and it will appear here.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = sessions.map((session) => {
    const isActive = session.sessionId === currentSessionId;
    const title = escapeHtml(session.title || session.summary || session.firstPrompt || 'Untitled session');
    const truncatedTitle = title.length > 60 ? title.slice(0, 57) + '...' : title;
    const time = session.lastActiveAt ? timeAgo(session.lastActiveAt) : (session.ctime ? timeAgo(session.ctime) : '');

    return `
      <div class="session-row ${isActive ? 'active' : ''}"
           role="listitem"
           data-session-id="${escapeHtml(session.sessionId)}"
           tabindex="0"
           aria-label="${isActive ? 'Current session: ' : ''}${truncatedTitle}">
        <div class="session-row-content">
          <div class="session-row-indicator">${isActive ? '<span class="status-dot green pulse"></span>' : ''}</div>
          <div class="session-row-info">
            <div class="session-row-title">${truncatedTitle}</div>
            ${time ? `<div class="session-row-time">${escapeHtml(time)}</div>` : ''}
          </div>
          <button class="session-row-menu icon-btn" aria-label="Session options" title="Options">&middot;&middot;&middot;</button>
        </div>
      </div>
    `;
  }).join('');

  // Wire click to switch session
  listEl.querySelectorAll('.session-row').forEach((rowEl) => {
    const sessionId = rowEl.dataset.sessionId;

    // Click row to switch
    rowEl.addEventListener('click', (e) => {
      if (e.target.closest('.session-row-menu')) return; // skip if clicking menu
      if (sessionId !== currentSessionId && onSwitchSession) {
        onSwitchSession(sessionId);
        currentSessionId = sessionId;
        renderSessionList(listEl);
      }
    });

    // Enter key to switch
    rowEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (sessionId !== currentSessionId && onSwitchSession) {
          onSwitchSession(sessionId);
          currentSessionId = sessionId;
          renderSessionList(listEl);
        }
      }
    });

    // Menu button — rename/delete
    const menuBtn = rowEl.querySelector('.session-row-menu');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showSessionMenu(sessionId, menuBtn, listEl);
    });
  });
}

function showSessionMenu(sessionId, anchorEl, listEl) {
  // Remove any existing menu
  const existing = document.querySelector('.session-context-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.className = 'session-context-menu';
  menu.innerHTML = `
    <button class="session-menu-item" data-action="rename">Rename</button>
  `;

  // Position relative to anchor
  const rect = anchorEl.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = (rect.bottom + 4) + 'px';
  menu.style.left = (rect.left - 80) + 'px';
  menu.style.zIndex = '303';

  document.body.appendChild(menu);

  // Rename action
  menu.querySelector('[data-action="rename"]').addEventListener('click', () => {
    menu.remove();
    promptRename(sessionId, listEl);
  });

  // Close menu on outside click
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu, true);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu, true), 0);
}

async function promptRename(sessionId, listEl) {
  const session = sessions.find(s => s.sessionId === sessionId);
  const currentTitle = session?.title || session?.summary || session?.firstPrompt || '';
  const newTitle = prompt('Rename session:', currentTitle);
  if (!newTitle || newTitle === currentTitle) return;

  try {
    await api.renameChatSession(sessionId, newTitle);
    // Update local state
    if (session) {
      session.title = newTitle;
    }
    renderSessionList(listEl);
  } catch (err) {
    // Silent fail — title not critical
  }
}
