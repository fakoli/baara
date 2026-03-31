// Baara — Output Viewer Component
// Shows both output (green) and error (red) sections

import { escapeHtml } from '../utils.js';

export function render(container, { output, error, title }) {
  if (!output && !error) {
    container.innerHTML = '<div class="empty-state">No output</div>';
    return;
  }

  let html = '<div class="output-viewer">';

  if (output) {
    html += `
      <div class="output-section output-success">
        <div class="output-header">
          <span class="section-title" style="margin:0;border:0;color:var(--green)">Output</span>
          <button class="btn sm copy-btn" data-copy="output">Copy</button>
        </div>
        <div class="output-body"><pre class="output-text">${escapeHtml(output)}</pre></div>
      </div>
    `;
  }

  if (error) {
    html += `
      <div class="output-section output-error">
        <div class="output-header">
          <span class="section-title" style="margin:0;border:0;color:var(--red)">Error</span>
          <button class="btn sm copy-btn" data-copy="error">Copy</button>
        </div>
        <div class="output-body"><pre class="output-text" style="color:var(--red)">${escapeHtml(error)}</pre></div>
      </div>
    `;
  }

  html += '</div>';
  container.innerHTML = html;

  // Wire copy buttons
  container.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.copy === 'output' ? output : error;
      navigator.clipboard.writeText(text || '');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  });
}
