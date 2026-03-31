// Baara — REST API Wrapper

async function request(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Tasks
  listTasks() {
    return request('/api/tasks');
  },

  getTask(id) {
    return request(`/api/tasks/${id}`);
  },

  createTask(data) {
    return request('/api/tasks', { method: 'POST', body: JSON.stringify(data) });
  },

  updateTask(id, data) {
    return request(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteTask(id) {
    return request(`/api/tasks/${id}`, { method: 'DELETE' });
  },

  runTask(id) {
    return request(`/api/tasks/${id}/run`, { method: 'POST' });
  },

  submitTask(id) {
    return request(`/api/tasks/${id}/submit`, { method: 'POST' });
  },

  toggleTask(id) {
    return request(`/api/tasks/${id}/toggle`, { method: 'POST' });
  },

  // Jobs
  listTaskJobs(taskId, opts = {}) {
    const params = new URLSearchParams();
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.status) params.set('status', opts.status);
    const qs = params.toString();
    return request(`/api/tasks/${taskId}/jobs${qs ? '?' + qs : ''}`);
  },

  getJob(id) {
    return request(`/api/jobs/${id}`);
  },

  cancelJob(id) {
    return request(`/api/jobs/${id}/cancel`, { method: 'POST' });
  },

  retryJob(id) {
    return request(`/api/jobs/${id}/retry`, { method: 'POST' });
  },

  getTriageJobs() {
    return request('/api/jobs/triage');
  },

  // System
  getHealth() {
    return request('/api/health');
  },

  getUsage() {
    return request('/api/usage');
  },

  getStatus() {
    return request('/api/status');
  },

  getQueues() {
    return request('/api/queues');
  },

  // Templates
  listTemplates() {
    return request('/api/templates');
  },

  createTemplate(data) {
    return request('/api/templates', { method: 'POST', body: JSON.stringify(data) });
  },

  createTaskFromTemplate(templateId, data) {
    return request(`/api/templates/${templateId}/create-task`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
