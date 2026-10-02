import { test, expect } from '@playwright/test';

test('dashboard renders real API state, usage and durable project decisions', async ({ page }, testInfo) => {
  await page.goto('/factory');
  await expect(page.getByRole('heading', { name: 'What will you build next?' })).toBeVisible();
  await expect(page.getByText('1,800', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
  await page.getByRole('button', { name: /Orbital Notes/ }).click();
  await page.getByRole('button', { name: 'Knowledge', exact: true }).click();
  await page.getByText('docs/DECISIONS.md', { exact: true }).click();
  await expect(page.getByText('Keep notes local until sync is approved.')).toBeVisible();
  await page.getByRole('button', { name: 'Usage', exact: true }).click();
  await expect(page.getByRole('cell', { name: '1,400' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Unknown' })).toBeVisible();
});
test('existing-project onboarding and new-project creation use distinct flows', async ({ page }) => {
  await page.goto('/factory');
  await page.getByRole('button', { name: 'Connect repository', exact: true }).click();
  await page.getByLabel('GitHub repository').fill('factory-test-owner/imported-app');
  await page.getByLabel('Required CI check names').fill('playwright');
  await page.getByRole('button', { name: 'Discover baseline', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'imported-app', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Plan enhancement →' })).toBeDisabled();
  await page.getByRole('button', { name: '+ New project', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill('new-notes');
  await page.getByLabel('Describe the app').fill('A private notes application');
  await page.getByRole('button', { name: 'Create a plan' }).click();
  await expect(page.getByRole('heading', { name: 'new-notes', exact: true })).toBeVisible();
});
test('approval transitions persisted run and cancellation survives reload', async ({ page }) => {
  await page.goto('/factory');
  await page.getByRole('button', { name: /Orbital Notes/ }).click();
  await page.getByRole('button', { name: 'Approve this plan' }).click();
  await expect(page.getByRole('button', { name: 'Retry dispatch' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel run' }).click();
  await page.reload();
  await expect(page.getByText('cancelled', { exact: true })).toBeVisible();
});
test('verified new-project release-review failure can retry the approved run', async ({ page }) => {
  await page.goto('/factory');
  await page.getByRole('button', { name: /Launch App/ }).click();
  await expect(page.getByText('Release review did not approve the exact file set.')).toBeVisible();
  await page.getByRole('button', { name: 'Retry approved run' }).click();
  await expect(page.getByText('retry queued · STANDARD', { exact: true })).toBeVisible();
});
test('preview cannot reach the parent control application', async ({ page }) => {
  await page.goto('/factory');
  await page.getByRole('button', { name: /Orbital Notes/ }).click();
  await page.getByRole('button', { name: 'Open preview' }).click();
  const frame = page.frameLocator('iframe');
  await expect(frame.getByRole('heading', { name: 'Working preview' })).toBeVisible();
  await expect(frame.locator('body')).toHaveAttribute('data-isolated', 'true');
  await expect(page.getByRole('heading', { name: 'Orbital Notes', exact: true })).toBeVisible();
});
test('unauthenticated API access and forged CSRF are rejected', async ({ request }) => {
  expect((await request.get('/api/dashboard', { headers: { 'x-test-deny': 'true' } })).status()).toBe(401);
  expect((await request.post('/api/projects/create', { data: { name: 'denied', request: 'app', visibility: 'private' } })).status()).toBe(403);
});
test('dashboard works at mobile width without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/factory');
  await expect(page.getByRole('heading', { name: 'What will you build next?' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
