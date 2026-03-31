// Baara — Context Panel Controller

import * as overviewCard from './overview-card.js';
import * as taskCard from './task-card.js';
import * as jobList from './job-list.js';
import * as queueMonitor from './queue-monitor.js';
import { api } from '../api.js';
import { escapeHtml, timeAgo } from '../utils.js';

export async function render(container, state) {
  overviewCard.stopAutoRefresh();

  const view = state.contextView;

  switch (view) {
    case 'task-detail':
      await renderTaskDetail(container, state);
      break;

    case 'tasks':
      await renderTaskList(container, state);
      break;

    case 'jobs':
      await renderJobList(container, state);
      break;

    case 'queues':
      await renderQueues(container, state);
      break;

    case 'triage':
      await renderTriage(container, state);
      break;

    case 'overview':
    default:
      await renderOverview(container, state);
      break;
  }
}

async function renderOverview(container, state) {
  await overviewCard.render(container);
  overviewCard.startAutoRefresh(container);
}

async function renderTaskDetail(container, state) {
  if (!state.selectedTask) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        </div>
        <h4>No task selected</h4>
        <p>Select a task from the Tasks tab to view details.</p>
      </div>
    `;
    return;
  }

  // Fetch fresh task data
  let task;
  try {
    task = await api.getTask(state.selectedTask.id);
    if (!task) throw new Error('Task not found');
  } catch {
    task = state.selectedTask;
  }

  await taskCard.render(container, {
    task,
    onTaskDeleted: () => {
      state.selectedTask = null;
      state.contextView = 'overview';
      state.activeTab = 'overview';
      if (state.onStateChange) state.onStateChange();
    },
    onNavigate: state.onNavigate,
  });
}

async function renderTaskList(container, state) {
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div>Loading...</div>';

  try {
    const tasks = await api.listTasks();

    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="section-title">All Tasks</div>
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="12" y1="18" x2="12" y2="12"></line>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
          </div>
          <h4>No tasks yet</h4>
          <p>Create your first task to start automating work.</p>
          <div class="hint">Use the <code>+ Create Task</code> button or ask in the chat.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="section-title">All Tasks</div>
      <div class="list-header task-list-grid">
        <span></span>
        <span>Name</span>
        <span>Cron</span>
        <span>Mode</span>
        <span>Updated</span>
      </div>
      ${tasks.map(t => `
        <div class="list-row task-list-grid" data-task-id="${t.id}">
          <span class="status-dot ${t.enabled ? 'green' : 'gray'}" title="${t.enabled ? 'Enabled' : 'Disabled'}"></span>
          <span class="list-cell">${escapeHtml(t.name)}</span>
          <span class="list-cell mono">${escapeHtml(t.cronExpression || '--')}</span>
          <span class="list-cell secondary">${escapeHtml(t.executionMode)}</span>
          <span class="list-cell mono secondary">${timeAgo(t.updatedAt)}</span>
        </div>
      `).join('')}
    `;

    // Click task row to show detail
    container.querySelectorAll('.list-row[data-task-id]').forEach(row => {
      row.addEventListener('click', () => {
        const taskId = row.dataset.taskId;
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          state.selectedTask = task;
          state.contextView = 'task-detail';
          if (state.onStateChange) state.onStateChange();
        }
      });
    });
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Could not load tasks</p>
        <p style="color: var(--red); font-size: 12px; margin-top: 8px;">${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

async function renderJobList(container, state) {
  await jobList.render(container, {
    onTaskSelect: (task) => {
      state.selectedTask = task;
      state.contextView = 'task-detail';
      if (state.onStateChange) state.onStateChange();
    },
  });
}

async function renderQueues(container, state) {
  await queueMonitor.render(container);
}

async function renderTriage(container, state) {
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div>Loading...</div>';

  try {
    const triageJobs = await api.getTriageJobs();
    const tasks = await api.listTasks();
    const taskMap = {};
    for (const t of tasks) {
      taskMap[t.id] = t.name;
    }

    if (triageJobs.length === 0) {
      container.innerHTML = `
        <div class="section-title">Triage Jobs</div>
        <div class="empty-state">
          <div class="empty-state-icon" style="border-color: rgba(34, 197, 94, 0.2); background: rgba(34, 197, 94, 0.04);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <h4>All clear</h4>
          <p>No jobs need attention right now. Everything is running smoothly.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="section-title">Triage Jobs (${triageJobs.length})</div>
      ${triageJobs.map(job => `
        <div class="triage-job-card" data-job-id="${escapeHtml(job.id)}">
          <div class="triage-job-header">
            <span style="display: flex; align-items: center; gap: 8px;">
              <span class="status-dot red"></span>
              <strong style="font-size: 13px;">${escapeHtml(taskMap[job.taskId] || 'Unknown Task')}</strong>
            </span>
            <span class="triage-job-id">${escapeHtml(job.id.slice(0, 8))}</span>
          </div>
          ${job.error ? `<div class="triage-job-error">${escapeHtml(job.error)}</div>` : ''}
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span class="relative-time">${timeAgo(job.createdAt)} / attempt ${parseInt(job.attempt, 10) || 0}</span>
            <div class="triage-job-actions">
              <button class="btn sm primary retry-btn" data-job-id="${job.id}">Retry</button>
              <button class="btn sm cancel-btn" data-job-id="${job.id}">Dismiss</button>
            </div>
          </div>
        </div>
      `).join('')}
    `;

    // Wire up retry buttons
    container.querySelectorAll('.retry-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const jobId = btn.dataset.jobId;
        btn.disabled = true;
        btn.textContent = '...';
        try {
          await api.retryJob(jobId);
          await renderTriage(container, state);
        } catch (err) {
          btn.textContent = 'Error';
          setTimeout(() => { btn.textContent = 'Retry'; btn.disabled = false; }, 2000);
        }
      });
    });

    // Wire up dismiss/cancel buttons
    container.querySelectorAll('.cancel-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const jobId = btn.dataset.jobId;
        btn.disabled = true;
        btn.textContent = '...';
        try {
          await api.cancelJob(jobId);
          await renderTriage(container, state);
        } catch (err) {
          btn.textContent = 'Error';
          setTimeout(() => { btn.textContent = 'Dismiss'; btn.disabled = false; }, 2000);
        }
      });
    });
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Could not load triage jobs</p>
        <p style="color: var(--red); font-size: 12px; margin-top: 8px;">${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}
