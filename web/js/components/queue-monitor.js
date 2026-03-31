// Baara — Queue Monitor Component

import { api } from '../api.js';
import { escapeHtml } from '../utils.js';

export async function render(container) {
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div>Loading...</div>';

  try {
    const queues = await api.getQueues();

    if (!queues || queues.length === 0) {
      container.innerHTML = `
        <div class="section-title">Queues</div>
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
          </div>
          <h4>No queues</h4>
          <p>Queues are created when tasks use queued execution mode.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="section-title">Queues</div>
      <div class="queue-grid">
        ${queues.map(q => {
          const load = q.maxConcurrency > 0
            ? Math.round((q.activeJobs / q.maxConcurrency) * 100)
            : 0;
          const loadColor = load >= 80 ? 'var(--red)' : load >= 50 ? 'var(--yellow)' : 'var(--green)';

          return `
            <div class="queue-card">
              <div class="queue-name">${escapeHtml(q.name)}</div>
              <div class="queue-stats">
                <div class="queue-stat">
                  <span class="queue-stat-value">${q.depth}</span>
                  <span class="queue-stat-label">Pending</span>
                </div>
                <div class="queue-stat">
                  <span class="queue-stat-value" style="color: ${q.activeJobs > 0 ? 'var(--green)' : 'var(--text)'}">${q.activeJobs}</span>
                  <span class="queue-stat-label">Active</span>
                </div>
                <div class="queue-stat">
                  <span class="queue-stat-value">${q.maxConcurrency}</span>
                  <span class="queue-stat-label">Max</span>
                </div>
                <div class="queue-stat">
                  <span class="queue-stat-value" style="color: ${loadColor}">${load}%</span>
                  <span class="queue-stat-label">Load</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Could not load queues</p>
        <p style="color: var(--red); font-size: 12px; margin-top: 8px;">${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}
