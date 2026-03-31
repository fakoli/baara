import { test, expect } from '@playwright/test';

test.describe('Create Task Wizard', () => {
  test('opens when Create Task button is clicked', async ({ page }) => {
    await page.goto('/');
    await page.click('#create-task-btn');
    await expect(page.locator('.modal-overlay')).toBeVisible();
  });

  test('Type dropdown allows selection', async ({ page }) => {
    await page.goto('/');
    await page.click('#create-task-btn');
    const select = page.locator('#wiz-type');
    await select.selectOption('raw_code');
    await expect(select).toHaveValue('raw_code');
  });

  test('Priority dropdown allows selection on step 2', async ({ page }) => {
    await page.goto('/');
    await page.click('#create-task-btn');
    // Fill required fields on step 1
    await page.fill('#wiz-name', 'test-priority');
    await page.fill('#wiz-prompt', 'echo test');
    // Go to step 2
    await page.click('.wiz-next');
    const select = page.locator('#wiz-priority');
    await select.selectOption('0');
    await expect(select).toHaveValue('0');
  });

  test('submits form and creates task', async ({ page }) => {
    await page.goto('/');
    await page.click('#create-task-btn');
    await page.fill('#wiz-name', `playwright-test-${Date.now()}`);
    await page.fill('#wiz-prompt', 'echo hello from playwright');
    // Navigate through all steps
    await page.click('.wiz-next'); // step 1 -> 2
    await page.click('.wiz-next'); // step 2 -> 3
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
