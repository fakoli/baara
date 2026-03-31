import { test, expect } from '@playwright/test';

test.describe('Create Task Modal', () => {
  test('opens when Create Task button is clicked', async ({ page }) => {
    await page.goto('/');
    await page.click('#create-task-btn');
    await expect(page.locator('.modal-overlay')).toBeVisible();
  });

  test('Type dropdown allows selection', async ({ page }) => {
    await page.goto('/');
    await page.click('#create-task-btn');
    const select = page.locator('#modal-type');
    await select.selectOption('raw_code');
    await expect(select).toHaveValue('raw_code');
  });

  test('Priority dropdown allows selection', async ({ page }) => {
    await page.goto('/');
    await page.click('#create-task-btn');
    const select = page.locator('#modal-priority');
    await select.selectOption('0');
    await expect(select).toHaveValue('0');
  });

  test('submits form and creates task', async ({ page }) => {
    await page.goto('/');
    await page.click('#create-task-btn');
    await page.fill('#modal-name', `playwright-test-${Date.now()}`);
    await page.fill('#modal-prompt', 'echo hello from playwright');
    await page.click('.create-btn');
    // Modal should close after successful creation
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });
  });

  test('closes on Escape', async ({ page }) => {
    await page.goto('/');
    await page.click('#create-task-btn');
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('closes on overlay click', async ({ page }) => {
    await page.goto('/');
    await page.click('#create-task-btn');
    await expect(page.locator('.modal-overlay')).toBeVisible();
    // Click near the top-left corner of the overlay (outside the modal)
    await page.click('.modal-overlay', { position: { x: 10, y: 10 } });
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });
});
