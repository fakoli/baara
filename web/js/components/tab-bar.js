// Baara — Tab Bar Component

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'queues', label: 'Queues' },
];

export function render(container, { activeTab, onTabChange }) {
  container.innerHTML = TABS.map(tab => `
    <button class="tab-btn ${tab.id === activeTab ? 'active' : ''}" data-tab="${tab.id}">
      ${tab.label}
    </button>
  `).join('');

  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      onTabChange(tabId);
    });
  });
}
