import { test, expect } from '@playwright/test';

const headers = { origin: 'http://127.0.0.1:4312', 'x-csrf-token': 'test-csrf' };
async function seed(page, input) {
  const response = await page.request.post('/__fixture/seed', { headers, data: input }); expect(response.ok()).toBe(true);
  const result = await response.json(); await page.goto('/factory'); await page.getByRole('button', { name: new RegExp(input.name) }).click();
  return { ...result, card: page.locator('#run-' + result.run.id) };
}

for (const legacy of [false, true]) test('baseline approval appears once and older discoveries stay read-only ' + (legacy ? '(legacy records)' : '(recorded source)'), async ({ page }) => {
  const response = await page.request.post('/__fixture/baselines', { headers, data: { name: legacy ? 'legacy-baselines' : 'recorded-baselines', legacy } });
  expect(response.ok()).toBe(true);
  const { project, attempts } = await response.json();
  await page.goto('/factory');
  const current = page.locator('#run-' + attempts[2].id), earlier = page.locator('#run-' + attempts[1].id);
  await expect(current.getByText(legacy ? 'Latest recorded discovery' : 'Current discovery', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve baseline', exact: true })).toHaveCount(0);
  await expect(earlier).toBeHidden();
  await current.getByRole('button', { name: 'Review current baseline', exact: true }).click();
  const baseline = page.locator('.factory-baseline');
  await expect(baseline).toBeFocused(); await expect(baseline).toContainText(attempts[2].id.slice(0, 8));
  await expect(page.getByRole('button', { name: 'Approve baseline', exact: true })).toHaveCount(1);
  await expect(page.locator('.factory-run-section .factory-run')).toHaveCount(1);
  await page.getByText('Run history · 2 runs', { exact: true }).click();
  await expect(earlier).toContainText('Historical discovery');
  await expect(earlier.getByRole('button', { name: /Approve baseline|Review current baseline|Discover merged baseline/ })).toHaveCount(0);
  await baseline.getByRole('button', { name: 'Approve baseline', exact: true }).click();
  await expect(baseline).toContainText('Accepted baseline');
  await expect(earlier.locator('.factory-step').filter({ hasText: 'Your baseline review' })).toContainText('Not recorded / unconfirmed');
  const dashboard = await (await page.request.get('/api/dashboard')).json();
  expect(dashboard.projects.find(p => p.id === project.id).baseline.approved).toBe(true);
  expect(dashboard.runs.filter(r => r.projectId === project.id)).toHaveLength(3);
});
test('fresh progress has blue motion; pausing leaves state and accounting intact; reduced motion is still', async ({ page }, testInfo) => {
  const { run, card } = await seed(page, { name: 'motion-fixture', pending: true });
  await expect(card.getByText('Actual usage is pending', { exact: false })).toBeVisible();
  const spinner = card.locator('.factory-spin').first();
  await expect(spinner).toBeVisible(); expect(await spinner.evaluate(el => getComputedStyle(el).animationName)).toBe('factory-spin');
  expect(await card.evaluate(el => getComputedStyle(el).borderTopColor)).toBe('rgb(34, 92, 164)');
  await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
  expect(await spinner.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  expect((await (await page.request.get('/api/dashboard')).json()).runs.find(r => r.id === run.id).status).toBe('running');
  await page.getByRole('button', { name: 'Resume motion', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  expect(await spinner.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await page.screenshot({ path: testInfo.outputPath('running-dark-reduced.png'), fullPage: true });
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' });
  await page.request.post('/__fixture/run/' + run.id, { headers, data: { status: 'awaiting_approval', stage: 'plan_ready' } });
  await expect(card.getByRole('button', { name: 'Approve this plan' })).toBeVisible({ timeout: 10000 });
  await expect(card.locator('.factory-motion')).toHaveCount(0);
  expect(await card.evaluate(el => getComputedStyle(el).borderTopColor)).toBe('rgb(132, 81, 19)');
});
test('poll failure retains evidence and makes all activity unconfirmed without replay', async ({ page }) => {
  const { run, card } = await seed(page, { name: 'connection-fixture' });
  await expect(card.locator('.factory-status')).toContainText('Building the approved change');
  let dispatched = 0;
  page.on('request', req => { if (req.url().includes('/dispatch')) dispatched++; });
  await page.route('**/api/dashboard', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Test connection interrupted' }) }));
  await expect(page.getByText('Connection interrupted · Last known state retained')).toBeVisible({ timeout: 10000 });
  await expect(card.locator('[role=status]')).toContainText('Activity unconfirmed');
  await expect(card.locator('.factory-guide')).toContainText('current activity cannot be confirmed');
  await expect(card.locator('.factory-step.working')).toHaveCount(0); await expect(card.locator('.factory-motion')).toHaveCount(0);
  await expect(card.getByRole('heading', { name: 'Add a quick note action' })).toBeVisible(); expect(dispatched).toBe(0);
  expect((await (await page.request.get('/__fixture/run/' + run.id, { headers })).json()).error).toBeUndefined();
});
test('review stop supports clarification, linked revision, fresh approval and original history', async ({ page }, testInfo) => {
  const { run, card } = await seed(page, { name: 'recovery-fixture', status: 'failed', stage: 'release_review' });
  await expect(card.locator('.factory-guide')).toContainText('reviewer did not approve');
  await card.getByText('Evidence and activity', { exact: true }).click();
  await expect(card.getByText('Clarify local-only state.', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('review-stop.png'), fullPage: true });
  await card.getByLabel('Clarify the outcome').fill('Keep state only in this browser and choose clear labels.');
  await card.getByRole('button', { name: 'Create a revised plan' }).click();
  const result = (await (await page.request.get('/api/dashboard')).json()).runs.find(r => r.recoveryOf === run.id);
  expect(result.approvedHash).toBeUndefined();
  await page.request.post('/__fixture/run/' + result.id, { headers, data: { status: 'awaiting_approval', stage: 'plan_ready' } });
  const revised = page.locator('#run-' + result.id);
  await expect(revised.getByRole('button', { name: 'Approve this plan' })).toBeVisible({ timeout: 10000 });
  await revised.getByRole('button', { name: 'Approve this plan' }).click();
  await expect(revised.locator('.factory-status')).toContainText('Waiting for a worker');
  await page.getByText('Run history · 1 runs', { exact: true }).click();
  await expect(card.getByText('Release review stopped publication.', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'recovery-fixture Ready for an enhancement' }).click();
  await page.getByText('Run history · 1 runs', { exact: true }).click();
  await card.getByText('Evidence and activity', { exact: true }).click();
  await expect(card.getByText('Clarify local-only state.', { exact: true })).toBeVisible();
});
test('uncertain usage and stale workers stay still and do not offer replay', async ({ page }) => {
  const uncertain = await seed(page, { name: 'uncertain-fixture', status: 'failed', uncertain: true });
  await expect(uncertain.card.locator('.factory-status')).toContainText('usage needs reconciliation');
  await expect(uncertain.card.getByRole('button', { name: 'Create a revised plan' })).toHaveCount(0);
  await expect(uncertain.card.getByText('200', { exact: true })).toBeVisible();
  const stale = await seed(page, { name: 'stale-fixture', stale: true });
  await expect(stale.card.locator('.factory-status')).toContainText('Worker activity is unconfirmed');
  await expect(stale.card.locator('.factory-motion')).toHaveCount(0);
});
test('exact profile skips model gates and merged/closed outcomes explain the baseline handoff', async ({ page }, testInfo) => {
  const exact = await seed(page, { name: 'exact-fixture', profile: 'FAST_EXACT', stage: 'build_and_playwright' });
  await expect(exact.card.locator('.factory-step.skipped')).toHaveCount(2);
  const merged = await seed(page, { name: 'merged-fixture', status: 'merged', prState: { merged: true, state: 'closed', headSha: 'head' } });
  await expect(merged.card.getByRole('button', { name: 'Discover merged baseline' })).toBeVisible();
  await expect(page.locator('.factory-baseline')).toContainText('prior baseline is outdated');
  await expect(page.locator('.factory-baseline').getByRole('button', { name: 'Approve baseline' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('merged-baseline.png'), fullPage: true });
  const closed = await seed(page, { name: 'closed-fixture', status: 'closed_unmerged', prState: { merged: false, state: 'closed', headSha: 'head' } });
  await expect(closed.card.locator('.factory-status')).toContainText('closed without merge');
  await expect(closed.card.getByRole('button', { name: 'Discover merged baseline' })).toHaveCount(0);
});
test('legacy malformed review evidence remains readable without crashing the workspace', async ({ page }) => {
  const { card } = await seed(page, { name: 'malformed-fixture', status: 'failed', malformed: true });
  await card.getByText('Evidence and activity', { exact: true }).click();
  await expect(card.getByText(/Unstructured recorded diagnostic.*Legacy finding/)).toBeVisible();
  await expect(card.getByRole('button', { name: 'Create a revised plan' })).toBeVisible();
});
test('scoped action feedback keeps navigation usable and modal focus returns to its trigger', async ({ page }) => {
  await seed(page, { name: 'scoped-fixture', status: 'awaiting_approval' });
  let complete;
  const gate = new Promise(resolve => { complete = resolve; });
  await page.route('**/approve', async route => { await gate; await route.continue(); });
  await page.getByRole('button', { name: 'Approve this plan' }).click();
  await expect(page.getByRole('button', { name: 'Approve this plan…' })).toBeDisabled();
  await page.getByRole('button', { name: 'Usage', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Every attempt, accounted for' })).toBeVisible();
  const response = page.waitForResponse(r => r.url().endsWith('/approve'));
  complete(); await response; await page.unroute('**/approve');
  const trigger = page.getByRole('button', { name: '+ New project', exact: true }); await trigger.click();
  await expect(page.getByLabel('Repository name', { exact: true })).toBeFocused(); await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
for (const width of [320, 390, 736, 1024]) test('guided workspace fits ' + width + ' pixels in both themes with keyboard controls', async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const { card } = await seed(page, { name: 'width-' + width, status: 'awaiting_approval' });
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(card.getByRole('button', { name: 'Approve this plan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '+ New project', exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
    await page.screenshot({ path: testInfo.outputPath('approval-' + width + '-' + colorScheme + '.png'), fullPage: true });
  }
});
