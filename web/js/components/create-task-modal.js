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

        <label class="form-label">Cron Expression (optional)</label>
        <input type="text" class="form-input" id="modal-cron" placeholder="0 6 * * *">

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label class="form-label">Type</label>
            <select class="form-input" id="modal-type">
              <option value="agent_sdk">Agent SDK</option>
              <option value="raw_code">Raw Code</option>
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
      </div>
      <div class="modal-footer">
        <button class="btn cancel-btn">Cancel</button>
        <button class="btn primary create-btn">Create Task</button>
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
  overlay.addEventListener('click', (e) => {
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
      const task = await api.createTask({
        name,
        prompt,
        cronExpression: overlay.querySelector('#modal-cron').value.trim() || null,
        executionType: overlay.querySelector('#modal-type').value,
        priority: parseInt(overlay.querySelector('#modal-priority').value),
      });
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

  // Focus the name field
  overlay.querySelector('#modal-name').focus();
}
