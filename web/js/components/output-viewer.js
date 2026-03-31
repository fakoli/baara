// Baara — Output Viewer Component
// Uses @chenglou/pretext for text layout measurement

import { prepareWithSegments, layoutWithLines } from '/vendor/pretext/layout.js';
import { escapeHtml } from '../utils.js';

export function render(container, { output, title }) {
  if (!output) {
    container.innerHTML = '<div class="empty-state">No output</div>';
    return;
  }

  const fontSpec = '13px "JetBrains Mono", monospace';
  const lineHeight = 20;

  container.innerHTML = `
    <div class="output-viewer">
      <div class="output-header">
        <span class="section-title" style="margin:0;border:0">${title || 'Output'}</span>
        <button class="btn sm copy-btn">Copy</button>
      </div>
      <div class="output-body"></div>
      <div class="output-footer">
        <span class="output-stats"></span>
      </div>
    </div>
  `;

  const body = container.querySelector('.output-body');
  const stats = container.querySelector('.output-stats');
  const copyBtn = container.querySelector('.copy-btn');

  // Prepare text once (expensive)
  let prepared;
  try {
    prepared = prepareWithSegments(output, fontSpec, { whiteSpace: 'pre-wrap' });
  } catch (e) {
    // Fallback if Pretext fails (e.g., canvas not available)
    body.innerHTML = `<pre class="output-fallback">${escapeHtml(output)}</pre>`;
    stats.textContent = `${output.length} chars`;
    return;
  }

  function layoutContent() {
    const width = body.clientWidth - 24; // padding
    if (width <= 0) return;

    const { lineCount, lines } = layoutWithLines(prepared, width, lineHeight);

    body.innerHTML = `<pre class="output-text">${lines.map(l => escapeHtml(l.text)).join('\n')}</pre>`;
    stats.textContent = `${lineCount} lines · ${output.length} chars`;
  }

  layoutContent();

  // Re-layout on resize
  const observer = new ResizeObserver(() => layoutContent());
  observer.observe(body);

  // Copy button
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(output);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
  });
}
