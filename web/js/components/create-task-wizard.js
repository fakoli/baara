// Baara — 3-Step Task Creation Wizard

import { api } from '../api.js';

/**
 * Show a 3-step wizard for creating tasks.
 * Replaces the single-modal flow with Basics -> Execution -> Schedule & Tools.
 * @param {Function} [onCreated] — called with the created task object on success
 */
export function showCreateTaskWizard(onCreated) {
  let currentStep = 1;
  const totalSteps = 3;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Create Task');
  overlay.innerHTML = `
    <div class="modal wizard-modal">
      <div class="modal-header">
        <h3 id="modal-title">Create Task</h3>
        <button class="icon-btn modal-close" aria-label="Close dialog">\u2715</button>
      </div>
      <div class="modal-body">

        <!-- Step 1: Basics -->
        <div class="wizard-step" data-step="1">
          <div class="wizard-progress">
            <span class="step active current">1. Basics</span>
            <span class="step">2. Execution</span>
            <span class="step">3. Schedule &amp; Tools</span>
          </div>

          <label class="form-label">Name *</label>
          <input type="text" class="form-input" id="wiz-name" placeholder="my-task">

          <label class="form-label">Prompt *</label>
          <textarea class="form-textarea" id="wiz-prompt" rows="6" placeholder="What should this task do?"></textarea>

          <label class="form-label">Description</label>
          <input type="text" class="form-input" id="wiz-description" placeholder="Brief description">

          <label class="form-label">Type</label>
          <select class="form-input" id="wiz-type">
            <option value="agent_sdk">Agent SDK — AI-powered with tools</option>
            <option value="raw_code">Raw Code — Shell command</option>
          </select>
        </div>

        <!-- Step 2: Execution -->
        <div class="wizard-step" data-step="2" style="display:none">
          <div class="wizard-progress">
            <span class="step active">1. Basics</span>
            <span class="step active current">2. Execution</span>
            <span class="step">3. Schedule &amp; Tools</span>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px">
            <div>
              <label class="form-label">Mode</label>
              <select class="form-input" id="wiz-mode">
                <option value="direct">Direct — run immediately</option>
                <option value="queued">Queued — wait in priority queue</option>
              </select>
            </div>
            <div>
              <label class="form-label">Priority</label>
              <select class="form-input" id="wiz-priority">
                <option value="0">P0 — Critical</option>
                <option value="1" selected>P1 — High</option>
                <option value="2">P2 — Normal</option>
                <option value="3">P3 — Low</option>
              </select>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px">
            <div>
              <label class="form-label">Queue</label>
              <select class="form-input" id="wiz-queue"><option value="default">default</option></select>
            </div>
            <div>
              <label class="form-label">Timeout (sec)</label>
              <input type="number" class="form-input" id="wiz-timeout" value="300" min="1" max="3600">
            </div>
            <div>
              <label class="form-label">Max Retries</label>
              <input type="number" class="form-input" id="wiz-retries" value="0" min="0" max="10">
            </div>
          </div>

          <label class="form-label">Isolation Level</label>
          <select class="form-input" id="wiz-isolation">
            <option value="none" selected>None — runs in current environment</option>
            <option value="docker" disabled>Docker container (coming soon)</option>
            <option value="wasm" disabled>WASM sandbox (coming soon)</option>
          </select>
        </div>

        <!-- Step 3: Schedule & Tools -->
        <div class="wizard-step" data-step="3" style="display:none">
          <div class="wizard-progress">
            <span class="step active">1. Basics</span>
            <span class="step active">2. Execution</span>
            <span class="step active current">3. Schedule &amp; Tools</span>
          </div>

          <label class="form-label">Schedule</label>
          <select class="form-input" id="wiz-cron-preset">
            <option value="">No schedule (manual only)</option>
            <option value="* * * * *">Every minute</option>
            <option value="0 * * * *">Every hour</option>
            <option value="0 6 * * *">Daily at 6am</option>
            <option value="0 9 * * 1-5">Weekdays at 9am</option>
            <option value="custom">Custom cron expression</option>
          </select>
          <input type="text" class="form-input" id="wiz-cron-custom" style="display:none" placeholder="0 6 * * *">
          <div class="form-hint" id="wiz-cron-preview" style="display:none"></div>

          <!-- Tool Selection (only shown for agent_sdk type) -->
          <div id="wiz-tools-section">
            <label class="form-label">Allowed Tools</label>
            <div class="tool-select-controls">
              <button type="button" class="btn sm" id="wiz-tools-all">Select All</button>
              <button type="button" class="btn sm" id="wiz-tools-none">Select None</button>
            </div>

            <div class="tool-category">
              <div class="tool-category-label">Built-in</div>
              <label class="tool-checkbox"><input type="checkbox" value="WebSearch" checked> WebSearch</label>
              <label class="tool-checkbox"><input type="checkbox" value="WebFetch" checked> WebFetch</label>
              <label class="tool-checkbox"><input type="checkbox" value="Bash" checked> Bash</label>
              <label class="tool-checkbox"><input type="checkbox" value="Read" checked> Read</label>
              <label class="tool-checkbox"><input type="checkbox" value="Write" checked> Write</label>
            </div>
          </div>

          <!-- Agent Config extras -->
          <div id="wiz-agent-extras" style="margin-top:12px">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px">
              <div>
                <label class="form-label">Max Turns</label>
                <input type="number" class="form-input" id="wiz-max-turns" value="20" min="1" max="50">
              </div>
              <div>
                <label class="form-label">Budget (USD)</label>
                <input type="number" class="form-input" id="wiz-budget" value="2" min="0.10" max="10" step="0.10">
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation Footer -->
      <div class="wizard-footer">
        <button class="btn cancel-btn">Cancel</button>
        <div class="wizard-nav">
          <button class="btn wiz-back" style="display:none">Back</button>
          <button class="btn wiz-next">Next</button>
          <button class="btn create-btn" style="display:none">Create Task</button>
          <button class="btn primary run-now-btn" style="display:none">Create &amp; Run Now</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // --- Step Navigation ---

  function goToStep(step) {
    currentStep = step;
    overlay.querySelectorAll('.wizard-step').forEach(s => s.style.display = 'none');
    overlay.querySelector(`[data-step="${step}"]`).style.display = '';

    // Update progress indicators on the visible step
    const activeStep = overlay.querySelector(`[data-step="${step}"]`);
    activeStep.querySelectorAll('.wizard-progress .step').forEach((s, i) => {
      s.classList.toggle('active', i + 1 <= step);
      s.classList.toggle('current', i + 1 === step);
    });

    // Show/hide nav buttons
    overlay.querySelector('.wiz-back').style.display = step > 1 ? '' : 'none';
    overlay.querySelector('.wiz-next').style.display = step < totalSteps ? '' : 'none';
    overlay.querySelector('.create-btn').style.display = step === totalSteps ? '' : 'none';
    overlay.querySelector('.run-now-btn').style.display = step === totalSteps ? '' : 'none';
  }

  // Validate before proceeding
  function validateStep(step) {
    if (step === 1) {
      const name = overlay.querySelector('#wiz-name').value.trim();
      const prompt = overlay.querySelector('#wiz-prompt').value.trim();
      if (!name) { alert('Name is required'); return false; }
      if (!prompt) { alert('Prompt is required'); return false; }
    }
    return true;
  }

  // Next button
  overlay.querySelector('.wiz-next').addEventListener('click', () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < totalSteps) goToStep(currentStep + 1);
  });

  // Back button
  overlay.querySelector('.wiz-back').addEventListener('click', () => {
    if (currentStep > 1) goToStep(currentStep - 1);
  });

  // --- Close Handlers ---

  const previouslyFocused = document.activeElement;
  const close = () => {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    if (previouslyFocused) previouslyFocused.focus();
  };

  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.querySelector('.cancel-btn').addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });

  // Focus trap + Escape key
  const onKeydown = (e) => {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'Tab') {
      const modal = overlay.querySelector('.modal');
      const focusable = modal.querySelectorAll(
        'button:not([style*="display:none"]):not(:disabled), [href], input:not([style*="display:none"]), select:not(:disabled), textarea, [tabindex]:not([tabindex="-1"])'
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

  // --- Cron Preset Handler ---

  overlay.querySelector('#wiz-cron-preset').addEventListener('change', (e) => {
    const custom = overlay.querySelector('#wiz-cron-custom');
    const preview = overlay.querySelector('#wiz-cron-preview');
    custom.style.display = e.target.value === 'custom' ? '' : 'none';
    if (e.target.value !== 'custom' && e.target.value) {
      custom.value = e.target.value;
      preview.textContent = describeCron(e.target.value);
      preview.style.display = '';
    } else if (e.target.value === 'custom') {
      preview.style.display = 'none';
    } else {
      custom.value = '';
      preview.style.display = 'none';
    }
  });

  // Update preview when custom cron is typed
  overlay.querySelector('#wiz-cron-custom').addEventListener('input', (e) => {
    const preview = overlay.querySelector('#wiz-cron-preview');
    const val = e.target.value.trim();
    if (val) {
      preview.textContent = describeCron(val);
      preview.style.display = '';
    } else {
      preview.style.display = 'none';
    }
  });

  // --- Type Change: Show/Hide Tools Section ---

  overlay.querySelector('#wiz-type').addEventListener('change', (e) => {
    const isAgent = e.target.value === 'agent_sdk';
    overlay.querySelector('#wiz-tools-section').style.display = isAgent ? '' : 'none';
    overlay.querySelector('#wiz-agent-extras').style.display = isAgent ? '' : 'none';
  });

  // --- Select All / None for Tools ---

  overlay.querySelector('#wiz-tools-all').addEventListener('click', () => {
    overlay.querySelectorAll('.tool-checkbox input').forEach(cb => cb.checked = true);
  });
  overlay.querySelector('#wiz-tools-none').addEventListener('click', () => {
    overlay.querySelectorAll('.tool-checkbox input').forEach(cb => cb.checked = false);
  });

  // --- Gather Form Data ---

  function gatherWizardData() {
    const type = overlay.querySelector('#wiz-type').value;
    const cronPreset = overlay.querySelector('#wiz-cron-preset').value;
    const cronValue = cronPreset === 'custom'
      ? overlay.querySelector('#wiz-cron-custom').value.trim()
      : cronPreset || null;

    const data = {
      name: overlay.querySelector('#wiz-name').value.trim(),
      prompt: overlay.querySelector('#wiz-prompt').value.trim(),
      description: overlay.querySelector('#wiz-description').value.trim() || undefined,
      executionType: type,
      executionMode: overlay.querySelector('#wiz-mode').value,
      priority: parseInt(overlay.querySelector('#wiz-priority').value),
      targetQueue: overlay.querySelector('#wiz-queue').value,
      timeoutMs: parseInt(overlay.querySelector('#wiz-timeout').value) * 1000,
      maxRetries: parseInt(overlay.querySelector('#wiz-retries').value) || 0,
      cronExpression: cronValue,
    };

    if (type === 'agent_sdk') {
      const selectedTools = Array.from(overlay.querySelectorAll('.tool-checkbox input:checked'))
        .map(cb => cb.value);
      data.agentConfig = {
        allowedTools: selectedTools,
        maxTurns: parseInt(overlay.querySelector('#wiz-max-turns').value) || 20,
        maxBudgetUsd: parseFloat(overlay.querySelector('#wiz-budget').value) || 2,
        permissionMode: 'bypassPermissions',
      };
    }

    return data;
  }

  // --- Create Handlers ---

  overlay.querySelector('.create-btn').addEventListener('click', async () => {
    const btn = overlay.querySelector('.create-btn');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      const task = await api.createTask(gatherWizardData());
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

  overlay.querySelector('.run-now-btn').addEventListener('click', async () => {
    const btn = overlay.querySelector('.run-now-btn');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      const task = await api.createTask(gatherWizardData());
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

  // --- Populate Queue Dropdown ---

  (async () => {
    try {
      const queues = await api.getQueues();
      const select = overlay.querySelector('#wiz-queue');
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
  overlay.querySelector('#wiz-name').focus();
}

/**
 * Simple cron expression describer for the preview hint.
 */
function describeCron(expr) {
  const presets = {
    '* * * * *': 'Runs every minute',
    '0 * * * *': 'Runs every hour at :00',
    '0 6 * * *': 'Runs daily at 6:00 AM',
    '0 9 * * 1-5': 'Runs weekdays at 9:00 AM',
  };
  return presets[expr] || `Cron: ${expr}`;
}
