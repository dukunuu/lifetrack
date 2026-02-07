import { expect, test } from '@playwright/test';

test.describe('Form Consistency', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/trackers-new');
  });

  test('all forms have FormHeader with mode toggle', async ({ page }) => {
    // Open tracker create modal
    await page.click('text=New Tracker');

    // Verify FormHeader exists with Form/JSON toggle
    await expect(page.locator('button:has-text("Form")').first()).toBeVisible();
    await expect(page.locator('button:has-text("JSON")').first()).toBeVisible();

    // Close modal
    await page.click('[aria-label="Close"]');

    // Switch to groups tab
    await page.click('text=Groups');
    await page.click('text=New Group');

    // Verify same structure
    await expect(page.locator('button:has-text("Form")').first()).toBeVisible();
    await expect(page.locator('button:has-text("JSON")').first()).toBeVisible();
  });

  test('form sections have consistent styling', async ({ page }) => {
    await page.click('text=New Tracker');

    // Check section headers have consistent classes
    const sectionHeaders = page.locator('h3.border-b');
    const count = await sectionHeaders.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const header = sectionHeaders.nth(i);
      await expect(header).toHaveClass(/font-bold/);
      await expect(header).toHaveClass(/border-b/);
      await expect(header).toHaveClass(/border-primary/);
    }
  });

  test('FormField components render consistently', async ({ page }) => {
    await page.click('text=New Tracker');

    // Check label styling is consistent
    const labels = page.locator('label span.font-semibold');
    const count = await labels.count();
    expect(count).toBeGreaterThan(0);

    // All labels should have similar structure
    for (let i = 0; i < Math.min(count, 3); i++) {
      const label = labels.nth(i);
      await expect(label).toBeVisible();
    }
  });

  test('JSON mode has AI autocomplete in all forms', async ({ page }) => {
    await page.click('text=New Tracker');

    // Switch to JSON mode
    await page.click('button:has-text("JSON")');

    // Verify AI button exists (may be disabled but should be present)
    const aiButton = page.locator('button:has-text("AI")');
    await expect(aiButton).toBeVisible();

    // Close and check goals
    await page.click('[aria-label="Close"]');
    await page.goto('/goals');
    await page.click('text=New Goal');
    await page.click('button:has-text("JSON")');

    const goalAiButton = page.locator('button:has-text("AI")');
    await expect(goalAiButton).toBeVisible();
  });

  test('FormFooter has consistent structure', async ({ page }) => {
    await page.click('text=New Tracker');

    // Verify footer has sticky positioning
    const footer = page.locator('.sticky.bottom-0').first();
    await expect(footer).toBeVisible();

    // Verify submit button exists
    const submitButton = page.locator('button[type="submit"]').first();
    await expect(submitButton).toBeVisible();

    // Check goals page too
    await page.click('[aria-label="Close"]');
    await page.goto('/goals');
    await page.click('text=New Goal');

    const goalFooter = page.locator('.sticky.bottom-0').first();
    await expect(goalFooter).toBeVisible();
  });
});
