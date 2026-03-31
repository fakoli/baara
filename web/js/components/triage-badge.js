// Baara — Triage Badge Component

import { api } from '../api.js';

let triageCount = 0;
let pollInterval = null;

export function getTriageCount() {
  return triageCount;
}

export function render(container, { onClick }) {
  update(container, onClick);
}

function update(container, onClick) {
  if (triageCount === 0) {
    container.innerHTML = `
      <button class="triage-btn" id="triage-trigger">
        <span class="status-dot gray"></span>
        Triage
      </button>
    `;
  } else {
    container.innerHTML = `
      <button class="triage-btn has-items" id="triage-trigger">
        <span class="status-dot red pulse"></span>
        <span class="triage-count">${triageCount}</span>
        Triage
      </button>
    `;
  }

  container.querySelector('#triage-trigger').addEventListener('click', onClick);
}

export async function poll(container, onClick) {
  try {
    const jobs = await api.getTriageJobs();
    triageCount = Array.isArray(jobs) ? jobs.length : 0;
  } catch {
    // Silently ignore polling errors
  }
  update(container, onClick);
}

export function startPolling(container, onClick) {
  poll(container, onClick);
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(() => poll(container, onClick), 10000);
}

export function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
