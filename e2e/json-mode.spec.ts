import { expect, test } from '@playwright/test';

test.describe('JSON Mode', () => {
  test('all forms have working JSON mode toggle', async ({ page }) => {
    // Test tracker form
    await page.goto('/trackers-new');
    await page.click('text=New Tracker');

    // Switch to JSON mode
    await page.click('button:has-text("JSON")');

    // Verify JSON editor is visible
    await expect(page.locator('.monaco-editor, [data-testid="json-editor"]').first()).toBeVisible();

    // Switch back to form mode
    await page.click('button:has-text("Form")');

    // Verify form fields are back
    await expect(page.locator('input[type="text"]').first()).toBeVisible();

    // Close modal
    await page.click('[aria-label="Close"]');

    // Test goal form
    await page.goto('/goals');
    await page.click('text=New Goal');
    await page.click('button:has-text("JSON")');

    // Verify JSON mode works
    await expect(page.locator('.monaco-editor, [data-testid="json-editor"]').first()).toBeVisible();
  });

  test('JSON mode shows info alert consistently', async ({ page }) => {
    await page.goto('/trackers-new');
    await page.click('text=New Tracker');
    await page.click('button:has-text("JSON")');

    // Verify info alert is present
    const infoAlert = page.locator('.alert-info').first();
    await expect(infoAlert).toBeVisible();

    // Should mention autocomplete
    await expect(infoAlert).toContainText('Ctrl+Space');
  });
});
