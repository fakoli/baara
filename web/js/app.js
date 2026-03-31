// Fakoli Mini — App Entry Point

import * as chat from './chat.js';
import * as contextPanel from './components/context-panel.js';
import * as tabBar from './components/tab-bar.js';
import * as triageBadge from './components/triage-badge.js';

// --- State ---
const state = {
  selectedTask: null,
  activeTab: 'overview',
  contextView: 'overview', // overview | task-detail | tasks | jobs | queues | triage

  onStateChange: null,
  onNavigate: null,
};

// --- DOM References ---
const contextContent = document.getElementById('context-content');
const tabBarEl = document.getElementById('tab-bar');
const triageBadgeEl = document.getElementById('triage-badge');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');

// --- Render Loop ---

function renderAll() {
  // Tab bar
  tabBar.render(tabBarEl, {
    activeTab: state.activeTab,
    onTabChange: handleTabChange,
  });

  // Context panel
  contextPanel.render(contextContent, state);
}

function handleTabChange(tabId) {
  state.activeTab = tabId;

  if (tabId === 'overview') {
    state.contextView = 'overview';
    state.selectedTask = null;
  } else if (tabId === 'tasks') {
    state.contextView = 'tasks';
    state.selectedTask = null;
  } else if (tabId === 'jobs') {
    state.contextView = 'jobs';
    state.selectedTask = null;
  } else if (tabId === 'queues') {
    state.contextView = 'queues';
    state.selectedTask = null;
  }

  renderAll();
}

function handleChatCommand(cmd) {
  switch (cmd.type) {
    case 'navigate':
      state.contextView = cmd.view;
      state.selectedTask = null;

      // Sync tab bar (triage has no tab, falls through to overview highlight)
      if (['overview', 'tasks', 'jobs', 'queues'].includes(cmd.view)) {
        state.activeTab = cmd.view;
      }
      renderAll();
      break;

    case 'select-task':
      state.selectedTask = cmd.task;
      state.contextView = 'task-detail';
      // Don't change activeTab -- leave it wherever it was
      renderAll();
      break;
  }
}

// --- State Change Callback ---
state.onStateChange = () => {
  renderAll();
};

// --- Init ---
function init() {
  // Chat
  chat.init({
    messagesEl: chatMessages,
    inputEl: chatInput,
    onCommandCallback: handleChatCommand,
  });

  // Triage badge polling
  triageBadge.startPolling(triageBadgeEl, () => {
    state.contextView = 'triage';
    state.activeTab = 'overview'; // No triage tab, highlight overview
    renderAll();
  });

  // Initial render
  renderAll();

  // Re-focus chat input when clicking outside interactive areas
  document.addEventListener('click', (e) => {
    if (!e.target.closest('button') && !e.target.closest('a') && !e.target.closest('input')) {
      chatInput.focus();
    }
  });
}

init();
