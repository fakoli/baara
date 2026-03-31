import { test, expect } from '@playwright/test';

test.describe('Settings Panel', () => {
  test('opens when gear button clicked', async ({ page }) => {
    await page.goto('/');
    await page.click('#settings-btn');
    await expect(page.locator('.settings-drawer')).toBeVisible();
  });

  test('dark/light mode toggle works', async ({ page }) => {
    await page.goto('/');
    await page.click('#settings-btn');
    // The toggle switch is #theme-toggle-switch inside .settings-drawer
    const toggle = page.locator('#theme-toggle-switch');
    await expect(toggle).toBeVisible();
    await toggle.click();
    // Check that data-theme attribute changed on <html>
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBeTruthy();
  });

  test('closes on Escape', async ({ page }) => {
    await page.goto('/');
    await page.click('#settings-btn');
    await expect(page.locator('.settings-drawer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.settings-drawer')).not.toBeVisible();
  });
});
