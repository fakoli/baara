// Fakoli Mini — Overview Card Component

import { api } from '../api.js';
import { escapeHtml, timeAgo, statusDotClass, statusLabel, formatTokens, formatDuration } from '../utils.js';

let refreshInterval = null;

export async function render(container) {
  container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  try {
    const [tasks, status, triageJobs] = await Promise.all([
      api.listTasks(),
      api.getStatus(),
      api.getTriageJobs(),
    ]);

    const activeTasks = tasks.filter(t => t.enabled).length;
    const runningJobs = (status.queues || []).reduce((sum, q) => sum + q.activeJobs, 0);
    const triageCount = Array.isArray(triageJobs) ? triageJobs.length : 0;
    const usage = status.usage || { totalInputTokens: 0, totalOutputTokens: 0, totalJobs: 0 };

    // Gather recent jobs across all tasks (fetch last 2 from each task, take 5 most recent)
    let recentJobs = [];
    const taskMap = {};
    for (const t of tasks) {
      taskMap[t.id] = t.name;
    }

    try {
      const jobPromises = tasks.slice(0, 10).map(t =>
        api.listTaskJobs(t.id, { limit: 3 }).then(jobs =>
          jobs.map(j => ({ ...j, taskName: t.name }))
        )
      );
      const allJobArrays = await Promise.all(jobPromises);
      recentJobs = allJobArrays
        .flat()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
    } catch {
      // If jobs fetch fails, just show empty
    }

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card accent-green">
          <div class="stat-number">${activeTasks}</div>
          <div class="stat-label">Active Tasks</div>
        </div>
        <div class="stat-card accent-blue">
          <div class="stat-number">${runningJobs}</div>
          <div class="stat-label">Running Jobs</div>
        </div>
        <div class="stat-card accent-red" style="${triageCount > 0 ? 'border-color: rgba(239, 68, 68, 0.3);' : ''}">
          <div class="stat-number" style="${triageCount > 0 ? 'color: var(--red);' : ''}">${triageCount}</div>
          <div class="stat-label">Triage</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">${formatTokens(usage.totalInputTokens + usage.totalOutputTokens)}</div>
          <div class="stat-label">Total Tokens</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${usage.totalJobs}</div>
          <div class="stat-label">Total Jobs</div>
        </div>
        <div class="stat-card accent-green">
          <div class="stat-number">${tasks.length}</div>
          <div class="stat-label">Total Tasks</div>
        </div>
      </div>

      <div class="section-title">Recent Activity</div>
      ${recentJobs.length === 0
        ? '<div class="empty-state">No recent jobs</div>'
        : recentJobs.map(job => `
          <div class="activity-row">
            <span class="status-dot ${statusDotClass(job.status)}"></span>
            <span class="activity-task-name">${escapeHtml(job.taskName)}</span>
            <span class="activity-detail">${statusLabel(job.status)}${job.durationMs ? ' in ' + formatDuration(job.durationMs) : ''}</span>
            <span class="activity-time">${timeAgo(job.createdAt)}</span>
          </div>
        `).join('')
      }
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Could not load overview</p>
        <p style="color: var(--red); font-size: 12px; margin-top: 8px;">${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

export function startAutoRefresh(container) {
  stopAutoRefresh();
  refreshInterval = setInterval(() => render(container), 10000);
}

export function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

