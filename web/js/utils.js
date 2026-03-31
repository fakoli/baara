// Baara — Shared Utilities

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function statusDotClass(status) {
  switch (status) {
    case 'completed': return 'green';
    case 'running': return 'green pulse';
    case 'pending': return 'gray';
    case 'failed': return 'red';
    case 'triage': return 'red';
    case 'timed_out': return 'yellow';
    case 'cancelled': return 'gray';
    default: return 'gray';
  }
}

export function statusLabel(status) {
  switch (status) {
    case 'completed': return 'Completed';
    case 'running': return 'Running';
    case 'pending': return 'Pending';
    case 'failed': return 'Failed';
    case 'triage': return 'Triage';
    case 'timed_out': return 'Timed out';
    case 'cancelled': return 'Cancelled';
    default: return status || 'Unknown';
  }
}

export function formatTokens(n) {
  if (!n || n === 0) return '0';
  if (n < 1000) return String(n);
  if (n < 1000000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return (n / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
}

export function formatDuration(ms) {
  if (ms == null) return '--';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function truncate(str, len = 40) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

export function priorityLabel(p) {
  switch (p) {
    case 0: return 'Critical';
    case 1: return 'High';
    case 2: return 'Normal';
    case 3: return 'Low';
    default: return `P${p}`;
  }
}

export function modeLabel(mode) {
  switch (mode) {
    case 'queued': return 'Queued';
    case 'direct': return 'Direct';
    default: return mode || '--';
  }
}

export function typeLabel(type) {
  switch (type) {
    case 'agent_sdk': return 'Agent SDK';
    case 'wasm': return 'WASM';
    case 'raw_code': return 'Raw Code';
    default: return type || '--';
  }
}
