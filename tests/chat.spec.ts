import { test, expect } from '@playwright/test';

test.describe('Chat Panel', () => {
  test('shows welcome message on first load', async ({ page }) => {
    // Clear sessionStorage to ensure fresh state
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.removeItem('baara_session_id');
      sessionStorage.removeItem('baara_chat_history');
    });
    await page.reload();
    await expect(page.locator('.chat-welcome')).toBeVisible();
  });

  test('textarea accepts input', async ({ page }) => {
    await page.goto('/');
    await page.fill('#chat-input', 'hello');
    await expect(page.locator('#chat-input')).toHaveValue('hello');
  });

  test('send button appears when text is entered', async ({ page }) => {
    await page.goto('/');
    await page.fill('#chat-input', 'hello');
    // The send button gets a 'visible' class when text is present
    await expect(page.locator('#send-btn')).toHaveClass(/visible/);
  });
});
