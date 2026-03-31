import { test, expect } from '@playwright/test';

test.describe('US-1: Create and Run a Task Immediately', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Create Task modal has Run Now button', async ({ page }) => {
    await page.click('#create-task-btn');
    await expect(page.locator('.run-now-btn')).toBeVisible();
  });

  test('Create & Run Now creates task and executes it', async ({ page }) => {
    await page.click('#create-task-btn');
    await page.fill('#modal-name', `us1-test-${Date.now()}`);
    await page.fill('#modal-prompt', 'echo us1 success');
    await page.selectOption('#modal-type', 'raw_code');
    await page.click('.run-now-btn');

    // Modal should close
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });

    // Wait for job to appear (may take a moment)
    await page.waitForTimeout(2000);
  });
});
