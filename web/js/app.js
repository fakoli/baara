// Baara — App Entry Point

import * as chat from './chat.js';
import * as contextPanel from './components/context-panel.js';
import * as tabBar from './components/tab-bar.js';
import * as triageBadge from './components/triage-badge.js';
import { showCreateTaskModal } from './components/create-task-modal.js';

// --- State ---
const state = {
  selectedTask: null,
  activeTab: 'overview',
  contextView: 'overview', // overview | task-detail | tasks | jobs | queues | triage
  panelCollapsed: localStorage.getItem('panelCollapsed') === 'true',

  onStateChange: null,
  onNavigate: null,
};

// --- DOM References ---
const contextContent = document.getElementById('context-content');
const tabBarEl = document.getElementById('tab-bar');
const triageBadgeEl = document.getElementById('triage-badge');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const panelToggleBtn = document.getElementById('panel-toggle');
const contextPanelEl = document.getElementById('context-panel');
const resizeHandle = document.getElementById('resize-handle');
const createTaskBtn = document.getElementById('create-task-btn');
const newChatBtn = document.getElementById('new-chat-btn');

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

// --- Tool Call Event Handler ---

function handleToolCallEvent(event) {
  const toolName = (event.name || '').replace('mcp__baara__', '');
  switch (toolName) {
    case 'create_task':
    case 'update_task':
    case 'get_task':
    case 'toggle_task':
      refreshAndShowTask(event);
      break;
    case 'list_tasks':
      state.contextView = 'tasks';
      state.activeTab = 'tasks';
      renderAll();
      break;
    case 'list_jobs':
    case 'run_task':
    case 'submit_task':
      state.contextView = 'jobs';
      state.activeTab = 'jobs';
      renderAll();
      break;
    case 'list_triage':
    case 'retry_job':
      state.contextView = 'triage';
      renderAll();
      break;
    case 'get_status':
      state.contextView = 'overview';
      state.activeTab = 'overview';
      renderAll();
      break;
  }
}

function refreshAndShowTask(event) {
  // Navigate to the tasks view; the context panel will re-fetch
  state.contextView = 'tasks';
  state.activeTab = 'tasks';
  renderAll();
}

// --- Panel Toggle ---

function togglePanel() {
  state.panelCollapsed = !state.panelCollapsed;
  localStorage.setItem('panelCollapsed', String(state.panelCollapsed));
  applyPanelState();
}

function applyPanelState() {
  const toggleIcon = panelToggleBtn.querySelector('svg');
  if (state.panelCollapsed) {
    contextPanelEl.classList.add('collapsed');
    resizeHandle.style.display = 'none';
    if (toggleIcon) toggleIcon.style.transform = 'rotate(180deg)';
  } else {
    contextPanelEl.classList.remove('collapsed');
    resizeHandle.style.display = '';
    if (toggleIcon) toggleIcon.style.transform = 'rotate(0deg)';
  }
}

// --- Resize Handle ---

function initResize() {
  let isResizing = false;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizeHandle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const mainEl = document.getElementById('main');
    const mainRect = mainEl.getBoundingClientRect();
    const newContextWidth = mainRect.right - e.clientX;
    const clampedWidth = Math.max(200, Math.min(newContextWidth, mainRect.width - 400));
    contextPanelEl.style.width = clampedWidth + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    resizeHandle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}

// --- Create Task Button ---

function handleCreateTask() {
  showCreateTaskModal((task) => {
    // On created, navigate to tasks view and refresh
    state.contextView = 'tasks';
    state.activeTab = 'tasks';
    renderAll();
  });
}

// --- State Change Callback ---
state.onStateChange = () => {
  renderAll();
};

// --- Init ---
function init() {
  // Chat — use new onToolCallCallback contract
  chat.init({
    messagesEl: chatMessages,
    inputEl: chatInput,
    onToolCallCallback: (event) => {
      handleToolCallEvent(event);
    },
  });

  // Panel toggle
  panelToggleBtn.addEventListener('click', togglePanel);
  applyPanelState();

  // Resize handle
  initResize();

  // Create Task button
  createTaskBtn.addEventListener('click', handleCreateTask);

  // New Chat button
  newChatBtn.addEventListener('click', () => {
    chat.startNewChat();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Cmd+Shift+N — new chat
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      chat.startNewChat();
    }
    // Cmd+Shift+O — toggle panel
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'O') {
      e.preventDefault();
      togglePanel();
    }
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
    if (!e.target.closest('button') && !e.target.closest('a') && !e.target.closest('input') && !e.target.closest('textarea')) {
      chatInput.focus();
    }
  });
}

init();
