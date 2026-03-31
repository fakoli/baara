import { test, expect } from '@playwright/test';

test.describe('US-4: View Error Details for Failed Tasks', () => {
  test('create and run a failing task via API, then verify error visibility', async ({ request }) => {
    // Create a task that will fail
    const taskName = `us4-fail-${Date.now()}`;
    const createRes = await request.post('/api/tasks', {
      data: {
        name: taskName,
        prompt: 'exit 1',
        executionType: 'raw_code',
      }
    });
    expect(createRes.ok()).toBeTruthy();
    const task = await createRes.json();

    // Run it (will fail)
    const runRes = await request.post(`/api/tasks/${task.id}/run`);
    expect(runRes.ok()).toBeTruthy();
    const job = await runRes.json();
    expect(job.status).toBe('failed');

    // Verify job has error field
    const jobDetail = await request.get(`/api/jobs/${job.id}`);
    const jobData = await jobDetail.json();
    expect(jobData.error).toBeTruthy();

    // Verify logs exist for this job
    const logsRes = await request.get(`/api/jobs/${job.id}/logs`);
    expect(logsRes.ok()).toBeTruthy();
    const logs = await logsRes.json();
    expect(logs.length).toBeGreaterThan(0);
  });
});
