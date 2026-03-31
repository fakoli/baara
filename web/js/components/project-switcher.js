// Baara — Project Switcher Component

import { api } from '../api.js';
import { escapeHtml } from '../utils.js';

let containerEl = null;
let onProjectChange = null;
let projects = [];
let isOpen = false;

/**
 * Initialize the project switcher.
 * @param {HTMLElement} el - Container element for the switcher
 * @param {Object} opts
 * @param {Function} opts.onProjectChange - Called with project object or null when changed
 * @param {string|null} opts.activeProjectId - Currently active project ID
 */
export function init(el, { onProjectChange: callback, activeProjectId }) {
  containerEl = el;
  onProjectChange = callback;
  render(activeProjectId);
  loadProjects(activeProjectId);
}

async function loadProjects(activeProjectId) {
  try {
    projects = await api.listProjects();
  } catch {
    projects = [];
  }
  render(activeProjectId);
}

/**
 * Re-render with a new active project ID.
 * @param {string|null} activeProjectId
 */
export function update(activeProjectId) {
  render(activeProjectId);
  // Refresh project list in background
  loadProjects(activeProjectId);
}

function render(activeProjectId) {
  if (!containerEl) return;

  const activeProject = activeProjectId
    ? projects.find((p) => p.id === activeProjectId)
    : null;

  const label = activeProject ? escapeHtml(activeProject.name) : 'All Projects';

  containerEl.innerHTML = `
    <button class="project-switcher-btn" aria-haspopup="listbox" aria-expanded="${isOpen}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="project-name">${label}</span>
      <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
    ${isOpen ? renderDropdown(activeProjectId) : ''}
  `;

  // Wire up toggle
  const btn = containerEl.querySelector('.project-switcher-btn');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      isOpen = !isOpen;
      render(activeProjectId);
    });
  }

  // Wire up dropdown items
  if (isOpen) {
    containerEl.querySelectorAll('.project-item').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const projectId = el.dataset.projectId || null;
        isOpen = false;
        if (onProjectChange) onProjectChange(projectId ? projects.find((p) => p.id === projectId) : null);
      });
    });

    const newBtn = containerEl.querySelector('.project-new-btn');
    if (newBtn) {
      newBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isOpen = false;
        showNewProjectModal(activeProjectId);
      });
    }

    // Close dropdown on outside click
    const closeHandler = (e) => {
      if (!containerEl.contains(e.target)) {
        isOpen = false;
        render(activeProjectId);
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
  }
}

function renderDropdown(activeProjectId) {
  const items = [
    `<div class="project-item${!activeProjectId ? ' active' : ''}" data-project-id="" role="option" aria-selected="${!activeProjectId}">
      <span class="project-item-name">All Projects</span>
    </div>`
  ];

  for (const p of projects) {
    const isActive = p.id === activeProjectId;
    const desc = p.description ? `<span class="project-item-desc">${escapeHtml(p.description)}</span>` : '';
    items.push(`
      <div class="project-item${isActive ? ' active' : ''}" data-project-id="${escapeHtml(p.id)}" role="option" aria-selected="${isActive}">
        <span class="project-item-name">${escapeHtml(p.name)}</span>
        ${desc}
      </div>
    `);
  }

  return `
    <div class="project-dropdown" role="listbox">
      ${items.join('')}
      <div class="project-dropdown-divider"></div>
      <button class="project-new-btn">+ New Project</button>
    </div>
  `;
}

function showNewProjectModal(activeProjectId) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>New Project</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <label class="field-label">Name *</label>
        <input type="text" class="field-input" id="project-name-input" placeholder="My Project" autofocus>

        <label class="field-label">Description</label>
        <input type="text" class="field-input" id="project-desc-input" placeholder="What this project is about...">

        <label class="field-label">Instructions</label>
        <textarea class="field-input" id="project-instructions-input" rows="3" placeholder="Per-project system prompt additions..."></textarea>

        <label class="field-label">Working Directory</label>
        <input type="text" class="field-input" id="project-dir-input" placeholder="/path/to/project">
      </div>
      <div class="modal-footer">
        <button class="btn sm cancel-btn">Cancel</button>
        <button class="btn sm primary create-btn">Create Project</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.querySelector('.cancel-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const createBtn = overlay.querySelector('.create-btn');
  createBtn.addEventListener('click', async () => {
    const name = overlay.querySelector('#project-name-input').value.trim();
    if (!name) return;

    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';

    try {
      const project = await api.createProject({
        name,
        description: overlay.querySelector('#project-desc-input').value.trim(),
        instructions: overlay.querySelector('#project-instructions-input').value.trim(),
        workingDirectory: overlay.querySelector('#project-dir-input').value.trim(),
      });
      close();
      // Reload projects and switch to new one
      projects = await api.listProjects();
      if (onProjectChange) onProjectChange(project);
    } catch (err) {
      createBtn.disabled = false;
      createBtn.textContent = 'Create Project';
      alert('Failed to create project: ' + err.message);
    }
  });
}
