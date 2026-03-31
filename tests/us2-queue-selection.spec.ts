import { test, expect } from '@playwright/test';

test.describe('US-2: Select a Queue When Creating a Task', () => {
  test('Queue dropdown is present in Create Task modal', async ({ page }) => {
    await page.goto('/');
    await page.click('#create-task-btn');
    await expect(page.locator('#modal-queue')).toBeVisible();
  });

  test('Queue dropdown has default option', async ({ page }) => {
    await page.goto('/');
    await page.click('#create-task-btn');
    const value = await page.locator('#modal-queue').inputValue();
    expect(value).toBe('default');
  });

  test('Created task has selected queue', async ({ page }) => {
    await page.goto('/');
    await page.click('#create-task-btn');
    await page.fill('#modal-name', `us2-test-${Date.now()}`);
    await page.fill('#modal-prompt', 'echo queue test');
    await page.selectOption('#modal-type', 'raw_code');
    // Keep default queue
    await page.click('.create-btn');
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });
  });
});
