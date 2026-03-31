// Baara — Create Task Modal Component

import { api } from '../api.js';

/**
 * Show a modal overlay for manual task creation.
 * @param {Function} [onCreated] — called with the created task object on success
 */
export function showCreateTaskModal(onCreated) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Create Task');
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 id="modal-title">Create Task</h3>
        <button class="icon-btn modal-close" aria-label="Close dialog">\u2715</button>
      </div>
      <div class="modal-body">
        <label class="form-label">Name</label>
        <input type="text" class="form-input" id="modal-name" placeholder="my-task">

        <label class="form-label">Prompt</label>
        <textarea class="form-textarea" id="modal-prompt" rows="4" placeholder="What should this task do?"></textarea>

        <label class="form-label">Description (optional)</label>
        <input type="text" class="form-input" id="modal-description" placeholder="Brief description of this task">

        <label class="form-label">Cron Expression (optional)</label>
        <input type="text" class="form-input" id="modal-cron" placeholder="0 6 * * * — leave empty for manual-only">

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label class="form-label">Type</label>
            <select class="form-input" id="modal-type">
              <option value="agent_sdk">Agent SDK</option>
              <option value="raw_code">Raw Code (Shell)</option>
            </select>
          </div>
          <div>
            <label class="form-label">Priority</label>
            <select class="form-input" id="modal-priority">
              <option value="0">Critical (P0)</option>
              <option value="1" selected>High (P1)</option>
              <option value="2">Normal (P2)</option>
              <option value="3">Low (P3)</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div>
            <label class="form-label">Queue</label>
            <select class="form-input" id="modal-queue">
              <option value="default">default</option>
            </select>
          </div>
          <div>
            <label class="form-label">Mode</label>
            <select class="form-input" id="modal-mode">
              <option value="direct" selected>Direct</option>
              <option value="queued">Queued</option>
            </select>
          </div>
          <div>
            <label class="form-label">Max Retries</label>
            <input type="number" class="form-input" id="modal-retries" value="0" min="0" max="10">
          </div>
        </div>

        <label class="form-label">Timeout (seconds)</label>
        <input type="number" class="form-input" id="modal-timeout" value="300" min="1" max="3600" placeholder="300">
      </div>
      <div class="modal-footer">
        <button class="btn cancel-btn">Cancel</button>
        <button class="btn create-btn">Create Task</button>
        <button class="btn primary run-now-btn">Create & Run Now</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close handlers
  const previouslyFocused = document.activeElement;
  const close = () => {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    if (previouslyFocused) previouslyFocused.focus();
  };
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.querySelector('.cancel-btn').addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => {
    // Only close if the mousedown originated directly on the overlay backdrop
    // (not on a select dropdown or other element that might bubble)
    if (e.target === overlay) close();
  });

  // Focus trap + Escape key
  const onKeydown = (e) => {
    if (e.key === 'Escape') {
      close();
      return;
    }
    // Focus trapping: Tab cycles within modal
    if (e.key === 'Tab') {
      const modal = overlay.querySelector('.modal');
      const focusable = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };
  document.addEventListener('keydown', onKeydown);

  // Create handler
  overlay.querySelector('.create-btn').addEventListener('click', async () => {
    const name = overlay.querySelector('#modal-name').value.trim();
    const prompt = overlay.querySelector('#modal-prompt').value.trim();
    if (!name || !prompt) return;

    const btn = overlay.querySelector('.create-btn');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      const task = await api.createTask(gatherFormData(overlay));
      close();
      if (onCreated) onCreated(task);
    } catch (err) {
      btn.textContent = 'Error';
      setTimeout(() => {
        btn.textContent = 'Create Task';
        btn.disabled = false;
      }, 2000);
    }
  });

  // "Create & Run Now" handler
  overlay.querySelector('.run-now-btn').addEventListener('click', async () => {
    const name = overlay.querySelector('#modal-name').value.trim();
    const prompt = overlay.querySelector('#modal-prompt').value.trim();
    if (!name || !prompt) return;

    const btn = overlay.querySelector('.run-now-btn');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      const task = await api.createTask(gatherFormData(overlay));

      btn.textContent = 'Running...';
      await api.runTask(task.id);
      close();
      if (onCreated) onCreated(task, { ranNow: true });
    } catch (err) {
      btn.textContent = 'Error';
      setTimeout(() => {
        btn.textContent = 'Create & Run Now';
        btn.disabled = false;
      }, 2000);
    }
  });

  // Populate queue dropdown
  (async () => {
    try {
      const queues = await api.getQueues();
      const select = overlay.querySelector('#modal-queue');
      if (select && Array.isArray(queues)) {
        const existing = new Set([...select.options].map(o => o.value));
        for (const q of queues) {
          const queueName = typeof q === 'string' ? q : (q.name || q.id || '');
          if (queueName && !existing.has(queueName)) {
            const opt = document.createElement('option');
            opt.value = queueName;
            opt.textContent = queueName;
            select.appendChild(opt);
          }
        }
      }
    } catch {
      // Queue fetch failed — keep the default option
    }
  })();

  // Focus the name field
  overlay.querySelector('#modal-name').focus();
}

function gatherFormData(overlay) {
  const timeoutSec = parseInt(overlay.querySelector('#modal-timeout').value) || 300;
  return {
    name: overlay.querySelector('#modal-name').value.trim(),
    prompt: overlay.querySelector('#modal-prompt').value.trim(),
    description: overlay.querySelector('#modal-description').value.trim() || undefined,
    cronExpression: overlay.querySelector('#modal-cron').value.trim() || null,
    executionType: overlay.querySelector('#modal-type').value,
    priority: parseInt(overlay.querySelector('#modal-priority').value),
    targetQueue: overlay.querySelector('#modal-queue').value,
    executionMode: overlay.querySelector('#modal-mode').value,
    maxRetries: parseInt(overlay.querySelector('#modal-retries').value) || 0,
    timeoutMs: timeoutSec * 1000,
  };
}
