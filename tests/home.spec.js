import { test, expect } from '@playwright/test';

test('REG-001 - home page loads correctly', async ({ page }) => {

  await test.step('Open application', async () => {
    await page.goto('/');
  });

  await test.step('Verify functional behaviour', async () => {
    await expect(
      page.getByRole('heading', { name: 'Get started' })
    ).toBeVisible();

    const counter = page.getByRole('button');

    await expect(counter).toContainText('Count is 0');

    await counter.click();
    await expect(counter).toContainText('Count is 2');

    await counter.click();
    await expect(counter).toContainText('Count is 4');

    await counter.click({ modifiers: ['Shift'] });
    await expect(counter).toContainText('Count is 0');
  });

  await test.step('Verify visual regression', async () => {
    await page.reload();
    await expect(page).toHaveScreenshot('home-page.png', {
      fullPage: true,
    });
  });

});
