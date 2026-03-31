// Baara — Job List Component

import { api } from '../api.js';
import {
  escapeHtml, timeAgo, statusDotClass, statusLabel,
  formatDuration, formatTokens,
} from '../utils.js';

export async function render(container, { onTaskSelect }) {
  container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

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
      container.innerHTML = '<div class="empty-state">No jobs found</div>';
      return;
    }

    container.innerHTML = `
      <div class="section-title">Recent Jobs</div>
      <div class="list-header job-list-grid">
        <span></span>
        <span>Status</span>
        <span>Task</span>
        <span>Duration</span>
        <span>Time</span>
      </div>
      ${allJobs.map(job => `
        <div class="list-row job-list-grid" data-task-id="${job.taskId}">
          <span class="status-dot ${statusDotClass(job.status)}"></span>
          <span class="list-cell">${statusLabel(job.status)}</span>
          <span class="list-cell">${escapeHtml(job.taskName)}</span>
          <span class="list-cell mono">${formatDuration(job.durationMs)}</span>
          <span class="list-cell mono secondary">${timeAgo(job.createdAt)}</span>
        </div>
      `).join('')}
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
