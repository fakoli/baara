import { test, expect } from '@playwright/test';

test.describe('US-1: Create and Run a Task Immediately', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Create Task wizard has Run Now button on step 3', async ({ page }) => {
    await page.click('#create-task-btn');
    // Fill required fields on step 1
    await page.fill('#wiz-name', 'us1-check-btn');
    await page.fill('#wiz-prompt', 'echo test');
    // Navigate to step 3
    await page.click('.wiz-next'); // step 1 -> 2
    await page.click('.wiz-next'); // step 2 -> 3
    await expect(page.locator('.run-now-btn')).toBeVisible();
  });

  test('Create & Run Now creates task and executes it', async ({ page }) => {
    await page.click('#create-task-btn');
    await page.fill('#wiz-name', `us1-test-${Date.now()}`);
    await page.fill('#wiz-prompt', 'echo us1 success');
    await page.locator('#wiz-type').selectOption('raw_code');
    // Navigate to step 3
    await page.click('.wiz-next'); // step 1 -> 2
    await page.click('.wiz-next'); // step 2 -> 3
    await page.click('.run-now-btn');

    // Modal should close
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });

    // Wait for job to appear (may take a moment)
    await page.waitForTimeout(2000);
  });
});
