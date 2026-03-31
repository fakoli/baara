import { test, expect } from '@playwright/test';

test.describe('US-3: View Logs for Successful Tasks', () => {
  test('LOGS tab exists in tab bar', async ({ page }) => {
    await page.goto('/');
    // Find the LOGS tab
    await expect(page.locator('button:has-text("Logs"), [role="tab"]:has-text("Logs")')).toBeVisible();
  });

  test('LOGS tab shows log entries or empty state', async ({ page }) => {
    await page.goto('/');
    // Click the LOGS tab
    await page.click('button:has-text("Logs"), [role="tab"]:has-text("Logs")');
    // Should show either log entries or "No logs yet" message
    await expect(page.locator('.log-entries, .empty-state')).toBeVisible({ timeout: 5000 });
  });

  test('Log filter buttons exist when logs are present', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Logs"), [role="tab"]:has-text("Logs")');
    await page.waitForTimeout(1000);
    // Check for filter buttons if logs exist
    const hasLogs = await page.locator('.log-entries').isVisible().catch(() => false);
    if (hasLogs) {
      await expect(page.locator('.log-filter:has-text("All")')).toBeVisible();
      await expect(page.locator('.log-filter:has-text("Error")')).toBeVisible();
    }
  });
});
