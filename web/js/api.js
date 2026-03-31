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
  listTasks(opts = {}) {
    const params = new URLSearchParams();
    if (opts.projectId) params.set('projectId', opts.projectId);
    const qs = params.toString();
    return request(`/api/tasks${qs ? '?' + qs : ''}`);
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

  // Logs
  getLogs(opts = {}) {
    const params = new URLSearchParams();
    if (opts.limit) params.set('limit', opts.limit);
    if (opts.level) params.set('level', opts.level);
    if (opts.jobId) params.set('jobId', opts.jobId);
    const qs = params.toString();
    return request(`/api/logs${qs ? '?' + qs : ''}`);
  },

  getJobLogs(jobId) {
    return request(`/api/jobs/${jobId}/logs`);
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

  // Projects
  listProjects() {
    return request('/api/projects');
  },

  createProject(data) {
    return request('/api/projects', { method: 'POST', body: JSON.stringify(data) });
  },

  updateProject(id, data) {
    return request(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteProject(id) {
    return request(`/api/projects/${id}`, { method: 'DELETE' });
  },

  // Integrations
  getClaudeCodeIntegration() {
    return request('/api/integrations/claude-code');
  },

  // Chat Sessions
  listChatSessions() {
    return request('/api/chat/sessions');
  },

  getChatSession(id) {
    return request(`/api/chat/sessions/${id}`);
  },

  renameChatSession(id, title) {
    return request(`/api/chat/sessions/${id}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    });
  },

  // Chat (SSE streaming)
  async chatStream(message, onEvent, { sessionId, activeProjectId } = {}) {
    const body = { message };
    if (sessionId) body.sessionId = sessionId;
    if (activeProjectId) body.activeProjectId = activeProjectId;

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errBody.error || `Chat failed: ${response.status}`);
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        if (!event.trim()) continue;
        let data = '';
        for (const line of event.split('\n')) {
          if (line.startsWith('data: ')) data += line.slice(6);
        }
        if (data) {
          try { onEvent(JSON.parse(data)); } catch {}
        }
      }
    }
  },
};
