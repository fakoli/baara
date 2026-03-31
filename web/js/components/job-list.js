// Baara — Job List Component

import { api } from '../api.js';
import {
  escapeHtml, timeAgo, statusDotClass, statusLabel,
  formatDuration, formatTokens,
} from '../utils.js';

export async function render(container, { onTaskSelect }) {
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div>Loading...</div>';

  try {
    const tasks = await api.listTasks();
    const taskMap = {};
    for (const t of tasks) {
      taskMap[t.id] = t;
    }

    // Fetch recent jobs from each task
    const jobPromises = tasks.slice(0, 20).map(t =>
      api.listTaskJobs(t.id, { limit: 5 })
        .then(jobs => jobs.map(j => ({ ...j, taskName: t.name })))
        .catch(() => [])
    );
    const allJobArrays = await Promise.all(jobPromises);
    const allJobs = allJobArrays
      .flat()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50);

    if (allJobs.length === 0) {
      container.innerHTML = `
        <div class="section-title">Recent Jobs</div>
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <h4>No jobs yet</h4>
          <p>Jobs appear here when tasks run. Try running a task to see results.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="section-title">Recent Jobs</div>
      <div class="list-header job-list-grid">
        <span></span>
        <span>Status</span>
        <span>Preview</span>
        <span>Task</span>
        <span>Duration</span>
        <span>Time</span>
      </div>
      ${allJobs.map(job => {
        const preview = job.status === 'completed'
          ? (job.output ? escapeHtml(job.output.slice(0, 60)) : '')
          : job.status === 'failed' || job.status === 'triage'
            ? (job.error ? escapeHtml(job.error.slice(0, 60)) : '')
            : job.status === 'timed_out'
              ? 'Exceeded timeout'
              : '';
        const previewClass = (job.status === 'failed' || job.status === 'triage') ? 'preview-error' : 'preview-output';
        return `
        <div class="list-row job-list-grid" data-task-id="${job.taskId}">
          <span class="status-dot ${statusDotClass(job.status)}" title="${statusLabel(job.status)}"></span>
          <span class="list-cell">${statusLabel(job.status)}</span>
          <span class="list-cell preview-text ${previewClass}" title="${escapeHtml(preview)}">${preview || '--'}</span>
          <span class="list-cell">${escapeHtml(job.taskName)}</span>
          <span class="list-cell mono">${formatDuration(job.durationMs)}</span>
          <span class="list-cell mono secondary">${timeAgo(job.createdAt)}</span>
        </div>
      `}).join('')}
    `;

    // Click job row to select its task
    container.querySelectorAll('.list-row[data-task-id]').forEach(row => {
      row.addEventListener('click', () => {
        const taskId = row.dataset.taskId;
        const task = taskMap[taskId];
        if (task && onTaskSelect) {
          onTaskSelect(task);
        }
      });
    });
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Could not load jobs</p>
        <p style="color: var(--red); font-size: 12px; margin-top: 8px;">${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}
