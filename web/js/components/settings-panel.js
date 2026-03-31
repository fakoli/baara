// Baara — Settings Panel Component

import { api } from '../api.js';
import { escapeHtml } from '../utils.js';

/**
 * Show the settings panel as a slide-in drawer from the right.
 */
export function showSettingsPanel() {
  // Prevent duplicate panels
  if (document.querySelector('.settings-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'settings-overlay';

  const drawer = document.createElement('div');
  drawer.className = 'settings-drawer';

  const currentTheme = document.documentElement.dataset.theme || 'dark';
  const isLight = currentTheme === 'light';

  drawer.innerHTML = `
    <div class="settings-header">
      <h3>Settings</h3>
      <button class="icon-btn settings-close" aria-label="Close settings">\u2715</button>
    </div>
    <div class="settings-body">
      <div class="settings-section">
        <div class="settings-section-title">Theme</div>
        <div class="settings-row">
          <span class="settings-row-label">Light Mode</span>
          <div class="theme-toggle">
            <span class="toggle-label">${isLight ? 'On' : 'Off'}</span>
            <button class="toggle-switch ${isLight ? 'active' : ''}" id="theme-toggle-switch" aria-label="Toggle light mode"></button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Queue Management</div>
        <div id="settings-queues">
          <div class="loading-state"><div class="spinner"></div>Loading queues...</div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">System Info</div>
        <div id="settings-system-info">
          <div class="loading-state"><div class="spinner"></div>Loading...</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  // Close handlers
  const close = () => {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    drawer.remove();
  };

  drawer.querySelector('.settings-close').addEventListener('click', close);
  overlay.addEventListener('click', close);

  const onKeydown = (e) => {
    if (e.key === 'Escape') {
      close();
    }
  };
  document.addEventListener('keydown', onKeydown);

  // Theme toggle
  const toggleSwitch = drawer.querySelector('#theme-toggle-switch');
  const toggleLabel = toggleSwitch.previousElementSibling;

  toggleSwitch.addEventListener('click', () => {
    const newTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = newTheme;
    localStorage.setItem('baara-theme', newTheme);

    const nowLight = newTheme === 'light';
    toggleSwitch.classList.toggle('active', nowLight);
    toggleLabel.textContent = nowLight ? 'On' : 'Off';
  });

  // Load queue data
  loadQueues(drawer.querySelector('#settings-queues'));

  // Load system info
  loadSystemInfo(drawer.querySelector('#settings-system-info'));
}

async function loadQueues(container) {
  try {
    const status = await api.getStatus();
    const queues = status.queues || [];

    if (queues.length === 0) {
      container.innerHTML = `
        <div style="color: var(--text-dim); font-size: 13px; padding: 8px 0;">
          No queues configured.
        </div>
      `;
      return;
    }

    container.innerHTML = queues.map(q => `
      <div class="settings-queue-item">
        <div class="settings-queue-name">${escapeHtml(q.name || 'default')}</div>
        <div class="settings-queue-stats">
          <span>Depth: <strong>${q.waitingJobs || 0}</strong></span>
          <span>Active: <strong>${q.activeJobs || 0}</strong></span>
          <span>Concurrency: <strong>${q.concurrency || 1}</strong></span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `
      <div style="color: var(--red); font-size: 12px;">
        Could not load queues: ${escapeHtml(err.message)}
      </div>
    `;
  }
}

async function loadSystemInfo(container) {
  try {
    const [health, status] = await Promise.all([
      api.getHealth(),
      api.getStatus(),
    ]);

    const uptime = health.uptime || status.uptime || '--';
    const dbPath = health.dbPath || status.dbPath || 'baara.db';
    const authMode = health.authMode || status.authMode || 'subscription';

    container.innerHTML = `
      <div class="system-info-row">
        <span class="info-label">Version</span>
        <span class="info-value">1.0.0</span>
      </div>
      <div class="system-info-row">
        <span class="info-label">Database</span>
        <span class="info-value">${escapeHtml(String(dbPath))}</span>
      </div>
      <div class="system-info-row">
        <span class="info-label">Auth Mode</span>
        <span class="info-value">${escapeHtml(String(authMode))}</span>
      </div>
      <div class="system-info-row">
        <span class="info-label">Uptime</span>
        <span class="info-value">${escapeHtml(formatUptime(uptime))}</span>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="system-info-row">
        <span class="info-label">Version</span>
        <span class="info-value">1.0.0</span>
      </div>
      <div style="color: var(--text-dim); font-size: 12px; padding: 8px 0;">
        Could not load system info.
      </div>
    `;
  }
}

function formatUptime(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds)) return String(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
