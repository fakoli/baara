import { test, expect } from '@playwright/test';

test.describe('Projects', () => {
  test('project switcher is visible in header', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#project-switcher')).toBeVisible();
  });
});
