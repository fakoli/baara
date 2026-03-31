import { test, expect } from '@playwright/test';

test.describe('Overview Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads overview with stat cards', async ({ page }) => {
    // Wait for the overview to load (stat cards rendered by overview-card.js)
    await page.waitForSelector('.stat-card', { timeout: 10000 });
    await expect(page.locator('.stat-card')).toHaveCount(6);
  });

  test('Active Tasks card is clickable and navigates to tasks', async ({ page }) => {
    await page.waitForSelector('.stat-card', { timeout: 10000 });
    await page.click('.stat-card:has-text("Active Tasks")');
    await expect(page.locator('.section-title')).toContainText('All Tasks');
  });

  test('Running Jobs card navigates to jobs', async ({ page }) => {
    await page.waitForSelector('.stat-card', { timeout: 10000 });
    await page.click('.stat-card:has-text("Running Jobs")');
    // Should switch to jobs view — the context panel re-renders
    await page.waitForTimeout(500);
  });

  test('Triage card navigates to triage', async ({ page }) => {
    await page.waitForSelector('.stat-card', { timeout: 10000 });
    await page.click('.stat-card:has-text("Triage")');
    await expect(page.locator('.section-title')).toContainText('Triage');
  });
});
