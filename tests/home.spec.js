import { test, expect } from '@playwright/test';

test('REG-001 - home page loads correctly', async ({ page }) => {

  await test.step('Open application', async () => {
    await page.goto('/');
  });

  await test.step('Verify functional behaviour', async () => {
    await expect(
      page.getByRole('heading', { name: 'Get started' })
    ).toBeVisible();

    await expect(
      page.getByRole('button')
    ).toContainText('Count is 0');
  });

  await test.step('Verify visual regression', async () => {
    await expect(page).toHaveScreenshot('home-page.png', {
      fullPage: true,
    });
  });

});