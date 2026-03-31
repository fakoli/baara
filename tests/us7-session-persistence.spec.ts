import { test, expect } from '@playwright/test';

test.describe('US-7: Chat Session Persistence', () => {
  test('chat welcome message appears on fresh load', async ({ page }) => {
    // Clear storage to simulate fresh visit
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.removeItem('baara_session_id');
    });
    await page.reload();
    await expect(page.locator('.chat-welcome')).toBeVisible();
  });
});
