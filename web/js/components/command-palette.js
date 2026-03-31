// Baara — Command Palette (Slash Command Autocomplete)
import { api } from '../api.js';
import { escapeHtml } from '../utils.js';

let paletteEl = null;
let items = [];
let filteredItems = [];
let selectedIndex = 0;
let onSelect = null;
let cachedCommands = null;

export function init({ containerEl, onSelectCallback }) {
  onSelect = onSelectCallback;

  // Create the palette element (hidden by default)
  paletteEl = document.createElement('div');
  paletteEl.className = 'command-palette';
  paletteEl.style.display = 'none';
  containerEl.appendChild(paletteEl);
}

export async function show(query) {
  // Fetch commands if not cached
  if (!cachedCommands) {
    try {
      cachedCommands = await api.getCommands();
    } catch {
      cachedCommands = { skills: [], commands: [], agents: [] };
    }
  }

  // Flatten all items into a single list
  items = [
    ...(cachedCommands.commands || []).map(c => ({
      type: 'command',
      name: c.name,
      fullName: c.fullName || c.name,
      description: c.description || '',
      icon: '/',
    })),
    ...(cachedCommands.skills || []).map(s => ({
      type: 'skill',
      name: s.name,
      fullName: s.fullName || s.name,
      description: s.description || '',
      icon: '\u26A1',
    })),
    ...(cachedCommands.agents || []).map(a => ({
      type: 'agent',
      name: a.name,
      fullName: a.fullName || a.name,
      description: a.description || '',
      icon: '\uD83E\uDD16',
    })),
  ];

  filter(query);
}

export function filter(query) {
  const q = (query || '').toLowerCase();
  filteredItems = q
    ? items.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.fullName.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      )
    : items;

  // Limit to 10 results
  filteredItems = filteredItems.slice(0, 10);
  selectedIndex = 0;
  render();
}

export function hide() {
  if (paletteEl) paletteEl.style.display = 'none';
}

export function isVisible() {
  return paletteEl && paletteEl.style.display !== 'none';
}

// Handle keyboard navigation
export function handleKey(e) {
  if (!isVisible()) return false;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex = Math.min(selectedIndex + 1, filteredItems.length - 1);
    render();
    return true;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex = Math.max(selectedIndex - 1, 0);
    render();
    return true;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    selectCurrent();
    return true;
  }
  if (e.key === 'Enter' && filteredItems.length > 0) {
    // If palette is visible and has items, select instead of send
    e.preventDefault();
    selectCurrent();
    return true;
  }
  if (e.key === 'Escape') {
    hide();
    return true;
  }
  return false;
}

function selectCurrent() {
  const item = filteredItems[selectedIndex];
  if (item && onSelect) {
    onSelect(item);
  }
  hide();
}

function render() {
  if (filteredItems.length === 0) {
    paletteEl.style.display = 'none';
    return;
  }

  paletteEl.style.display = 'block';
  paletteEl.innerHTML = filteredItems.map((item, i) => `
    <div class="palette-item ${i === selectedIndex ? 'selected' : ''}" data-index="${i}">
      <span class="palette-icon">${item.icon}</span>
      <div class="palette-info">
        <span class="palette-name">${escapeHtml(item.fullName)}</span>
        <span class="palette-desc">${escapeHtml(item.description).slice(0, 60)}</span>
      </div>
      <span class="palette-type">${escapeHtml(item.type)}</span>
    </div>
  `).join('');

  // Add tab hint on selected item
  const selectedEl = paletteEl.querySelector('.palette-item.selected');
  if (selectedEl) {
    selectedEl.innerHTML += '<span class="palette-hint">Tab \u21B9</span>';
  }

  // Click handlers
  paletteEl.querySelectorAll('.palette-item').forEach(el => {
    el.addEventListener('click', () => {
      selectedIndex = parseInt(el.dataset.index);
      selectCurrent();
    });
    el.addEventListener('mouseenter', () => {
      selectedIndex = parseInt(el.dataset.index);
      render();
    });
  });
}

// Invalidate cache (called when navigating away or after a while)
export function clearCache() {
  cachedCommands = null;
}
