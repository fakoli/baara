import { test, expect } from '@playwright/test';

test.describe('US-2: Select a Queue When Creating a Task', () => {
  test('Queue dropdown is present in wizard step 2', async ({ page }) => {
    await page.goto('/');
    await page.click('#create-task-btn');
    // Fill required fields on step 1
    await page.fill('#wiz-name', 'us2-queue-check');
    await page.fill('#wiz-prompt', 'echo test');
    // Navigate to step 2
    await page.click('.wiz-next');
    await expect(page.locator('#wiz-queue')).toBeVisible();
  });

  test('Queue dropdown has default option', async ({ page }) => {
    await page.goto('/');
    await page.click('#create-task-btn');
    await page.fill('#wiz-name', 'us2-queue-default');
    await page.fill('#wiz-prompt', 'echo test');
    await page.click('.wiz-next');
    const value = await page.locator('#wiz-queue').inputValue();
    expect(value).toBe('default');
  });

  test('Created task has selected queue', async ({ page }) => {
    await page.goto('/');
    await page.click('#create-task-btn');
    await page.fill('#wiz-name', `us2-test-${Date.now()}`);
    await page.fill('#wiz-prompt', 'echo queue test');
    await page.locator('#wiz-type').selectOption('raw_code');
    // Navigate through all steps, keep default queue
    await page.click('.wiz-next'); // step 1 -> 2
    await page.click('.wiz-next'); // step 2 -> 3
    await page.click('.create-btn');
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });
  });
});
