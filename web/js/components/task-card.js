// Baara — Task Detail Card Component

import { api } from '../api.js';
import {
  escapeHtml, timeAgo, statusDotClass, statusLabel,
  formatDuration, formatTokens, priorityLabel, modeLabel, typeLabel,
} from '../utils.js';
import * as outputViewer from './output-viewer.js';

export async function render(container, { task, onTaskDeleted, onNavigate }) {
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div>Loading...</div>';

  let jobs = [];
  try {
    jobs = await api.listTaskJobs(task.id, { limit: 10 });
  } catch {
    // Jobs may fail, continue rendering task detail
  }

  const tools = task.agentConfig?.allowedTools || [];

  container.innerHTML = `
    <div class="task-detail-header">
      <span class="status-dot ${task.enabled ? 'green' : 'gray'}"></span>
      <span class="task-detail-name">${escapeHtml(task.name)}</span>
      <span class="task-detail-badge ${task.enabled ? 'enabled' : 'disabled'}">
        ${task.enabled ? 'Enabled' : 'Disabled'}
      </span>
    </div>

    ${task.description ? `<div class="description-text">${escapeHtml(task.description)}</div>` : ''}

    <div class="task-meta-grid">
      <div class="task-meta-item">
        <span class="card-label">Cron</span>
        <span class="card-value mono">${task.cronExpression ? escapeHtml(task.cronExpression) : 'None (manual)'}</span>
      </div>
      <div class="task-meta-item">
        <span class="card-label">Mode</span>
        <span class="card-value">${modeLabel(task.executionMode)}</span>
      </div>
      <div class="task-meta-item">
        <span class="card-label">Type</span>
        <span class="card-value">${typeLabel(task.executionType)}</span>
      </div>
      <div class="task-meta-item">
        <span class="card-label">Priority</span>
        <span class="card-value">${priorityLabel(task.priority)}</span>
      </div>
      <div class="task-meta-item">
        <span class="card-label">Queue</span>
        <span class="card-value mono">${escapeHtml(task.targetQueue)}</span>
      </div>
      <div class="task-meta-item">
        <span class="card-label">Timeout</span>
        <span class="card-value mono">${formatDuration(task.timeoutMs)}</span>
      </div>
      <div class="task-meta-item">
        <span class="card-label">Max Retries</span>
        <span class="card-value">${task.maxRetries}</span>
      </div>
      <div class="task-meta-item">
        <span class="card-label">Created</span>
        <span class="card-value">${timeAgo(task.createdAt)}</span>
      </div>
    </div>

    ${tools.length > 0 ? `
      <div style="margin-bottom: 16px;">
        <span class="card-label">Tools</span>
        <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
          ${tools.map(t => `<span class="tool-tag">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>
    ` : ''}

    <div class="task-actions">
      <button class="btn primary" id="task-run-btn">Run Now</button>
      <button class="btn" id="task-toggle-btn">${task.enabled ? 'Disable' : 'Enable'}</button>
      <button class="btn danger" id="task-delete-btn">Delete</button>
    </div>

    <div class="section-title">Recent Jobs</div>
    ${jobs.length === 0
      ? '<div class="empty-state" style="padding: 24px 16px;"><p>No jobs yet. Click <strong>Run Now</strong> to execute this task.</p></div>'
      : `<div>
          ${jobs.map(job => `
            <div class="activity-row job-row" data-job-id="${job.id}" style="cursor: pointer;">
              <span class="status-dot ${statusDotClass(job.status)}"></span>
              <span class="activity-task-name">${statusLabel(job.status)}</span>
              <span class="activity-detail">
                ${job.durationMs ? formatDuration(job.durationMs) : ''}
                ${job.inputTokens || job.outputTokens ? ' / ' + formatTokens((job.inputTokens || 0) + (job.outputTokens || 0)) + ' tokens' : ''}
                ${job.attempt > 1 ? ' (attempt ' + job.attempt + ')' : ''}
              </span>
              <span class="activity-time">${timeAgo(job.createdAt)}</span>
            </div>
          `).join('')}
        </div>`
    }

    <div style="margin-top: 16px;">
      <span class="card-label">Task ID</span>
      <div class="card-value mono" style="font-size: 11px; color: var(--text-dim);">${task.id}</div>
    </div>
  `;

  // Wire up actions
  container.querySelector('#task-run-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Running...';
    try {
      await api.runTask(task.id);
      // Re-render to show new job
      await render(container, { task, onTaskDeleted, onNavigate });
    } catch (err) {
      btn.textContent = 'Error';
      setTimeout(() => { btn.textContent = 'Run Now'; btn.disabled = false; }, 2000);
    }
  });

  container.querySelector('#task-toggle-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const updated = await api.toggleTask(task.id);
      task.enabled = updated.enabled;
      await render(container, { task: updated, onTaskDeleted, onNavigate });
    } catch (err) {
      btn.disabled = false;
    }
  });

  container.querySelector('#task-delete-btn').addEventListener('click', async (e) => {
    if (!confirm(`Delete task "${task.name}"?`)) return;
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await api.deleteTask(task.id);
      if (onTaskDeleted) onTaskDeleted();
    } catch (err) {
      btn.disabled = false;
    }
  });

  // Wire up job row click -> expand/collapse output viewer
  container.querySelectorAll('.job-row').forEach(row => {
    row.addEventListener('click', async () => {
      const jobId = row.dataset.jobId;
      const existingViewer = row.nextElementSibling;

      // Collapse if already expanded
      if (existingViewer && existingViewer.classList.contains('output-viewer-container')) {
        existingViewer.remove();
        return;
      }

      // Remove any other open viewer in this card
      container.querySelectorAll('.output-viewer-container').forEach(el => el.remove());

      // Create container and show loading
      const viewerEl = document.createElement('div');
      viewerEl.className = 'output-viewer-container';
      viewerEl.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
      row.after(viewerEl);

      try {
        const fullJob = await api.getJob(jobId);
        if (fullJob.output) {
          outputViewer.render(viewerEl, {
            output: fullJob.output,
            title: `Job ${statusLabel(fullJob.status)}`,
          });
        } else {
          viewerEl.innerHTML = '<div class="empty-state">No output for this job</div>';
        }
      } catch (err) {
        viewerEl.innerHTML = `<div class="empty-state">Failed to load job output</div>`;
      }
    });
  });
}
