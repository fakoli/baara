// Baara — Log Viewer Component
import { api } from '../api.js';
import { escapeHtml, timeAgo } from '../utils.js';

let refreshInterval = null;

export async function render(container, { jobId, onNavigate } = {}) {
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div>Loading logs...</div>';

  try {
    const logs = jobId
      ? await api.getJobLogs(jobId)
      : await api.getLogs({ limit: 100 });

    if (logs.length === 0) {
      container.innerHTML = `
        <div class="section-title">Execution Logs</div>
        <div class="empty-state">
          <h4>No logs yet</h4>
          <p>Run a task to see execution logs here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="log-header">
        <span class="section-title" style="margin:0;border:0">Execution Logs</span>
        <div class="log-filters">
          <button class="btn sm log-filter active" data-level="all">All</button>
          <button class="btn sm log-filter" data-level="info">Info</button>
          <button class="btn sm log-filter" data-level="warn">Warn</button>
          <button class="btn sm log-filter" data-level="error">Error</button>
        </div>
      </div>
      <div class="log-entries" id="log-entries">
        ${logs.map(entry => renderLogEntry(entry)).join('')}
      </div>
    `;

    // Wire filter buttons
    container.querySelectorAll('.log-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.log-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const level = btn.dataset.level;
        container.querySelectorAll('.log-entry').forEach(entry => {
          if (level === 'all' || entry.dataset.level === level) {
            entry.style.display = '';
          } else {
            entry.style.display = 'none';
          }
        });
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Could not load logs</p></div>`;
  }
}

function renderLogEntry(entry) {
  const levelColors = { info: 'var(--accent)', warn: 'var(--yellow)', error: 'var(--red)' };
  const color = levelColors[entry.level] || 'var(--text-dim)';
  const time = entry.ts ? new Date(entry.ts).toLocaleTimeString() : '';

  return `
    <div class="log-entry" data-level="${escapeHtml(entry.level)}">
      <span class="log-time">${escapeHtml(time)}</span>
      <span class="log-level" style="color:${color}">${escapeHtml(entry.level.toUpperCase().padEnd(5))}</span>
      <span class="log-task">${escapeHtml(entry.taskName || '')}</span>
      <span class="log-msg">${escapeHtml(entry.msg)}</span>
    </div>
  `;
}

export function startAutoRefresh(container, opts) {
  stopAutoRefresh();
  refreshInterval = setInterval(() => render(container, opts), 5000);
}

export function stopAutoRefresh() {
  if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
}
