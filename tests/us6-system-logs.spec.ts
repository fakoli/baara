import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('US-6: System-Wide Execution Logs', () => {
  test('GET /api/logs returns array', async ({ request }) => {
    const res = await request.get('/api/logs');
    expect(res.ok()).toBeTruthy();
    const logs = await res.json();
    expect(Array.isArray(logs)).toBeTruthy();
  });

  test('GET /api/logs?level=error filters correctly', async ({ request }) => {
    const res = await request.get('/api/logs?level=error');
    expect(res.ok()).toBeTruthy();
    const logs = await res.json();
    // All returned entries should be error level
    for (const log of logs) {
      expect(log.level).toBe('error');
    }
  });

  test('CLI: baara logs returns output', async () => {
    const cwd = '/Users/sdoumbouya/Library/Mobile Documents/com~apple~CloudDocs/ai-cowork/claude-task-executor';
    const output = execSync('bun run src/cli/index.ts logs --limit 5', {
      cwd,
      timeout: 15000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // Should not throw — if we got here, exit code was 0
    expect(typeof output).toBe('string');
  });
});
