import { expect, test } from '@playwright/test';

test.describe('Form Validation', () => {
  test('tracker form validates required fields', async ({ page }) => {
    await page.goto('/trackers-new');
    await page.click('text=New Tracker');

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator('.text-error').first()).toBeVisible();
  });

  test('goal form validates required fields', async ({ page }) => {
    await page.goto('/goals');
    await page.click('text=New Goal');

    // Clear name field if it has default value
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.fill('');

    // Try to submit
    await page.click('button[type="submit"]');

    // Should show error
    const errors = page.locator('.text-error');
    await expect(errors.first()).toBeVisible();
  });

  test('group form validates required fields', async ({ page }) => {
    await page.goto('/trackers-new');
    await page.click('text=Groups');
    await page.click('text=New Group');

    // Clear name field
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.fill('');

    // Submit form
    await page.click('button[type="submit"]');

    // Should show error
    await expect(page.locator('.text-error').first()).toBeVisible();
  });
});
