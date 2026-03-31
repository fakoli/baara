import { test, expect } from '@playwright/test';

test.describe('Side Panel Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Reset panelCollapsed in localStorage so we start with a known state
    await page.evaluate(() => localStorage.removeItem('panelCollapsed'));
    await page.reload();
  });

  test('panel toggle button is visible', async ({ page }) => {
    await expect(page.locator('#panel-toggle')).toBeVisible();
  });

  test('clicking toggle hides the panel', async ({ page }) => {
    await page.click('#panel-toggle');
    await expect(page.locator('#context-panel')).toHaveClass(/collapsed/);
  });

  test('clicking toggle again restores the panel', async ({ page }) => {
    await page.click('#panel-toggle');
    await expect(page.locator('#context-panel')).toHaveClass(/collapsed/);
    await page.click('#panel-toggle');
    await expect(page.locator('#context-panel')).not.toHaveClass(/collapsed/);
  });

  test('toggle 5 times consecutively', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await page.click('#panel-toggle');
      await page.waitForTimeout(200);
    }
    // After 5 toggles (odd number), panel should be collapsed
    await expect(page.locator('#context-panel')).toHaveClass(/collapsed/);
  });
});
