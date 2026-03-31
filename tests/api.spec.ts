import { test, expect } from '@playwright/test';

test.describe('API', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(json.status).toBe('ok');
  });

  test('tasks endpoint returns array', async ({ request }) => {
    const response = await request.get('/api/tasks');
    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(Array.isArray(json)).toBeTruthy();
  });

  test('chat endpoint exists', async ({ request }) => {
    const response = await request.post('/api/chat', {
      data: { message: 'hello' },
    });
    // Should return 200 (streaming) or 429 (rate-limited) — not 404
    expect(response.status()).not.toBe(404);
  });

  test('projects endpoint returns array', async ({ request }) => {
    const response = await request.get('/api/projects');
    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(Array.isArray(json)).toBeTruthy();
  });
});
