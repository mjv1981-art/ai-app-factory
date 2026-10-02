import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/factory', testMatch: '**/*.pw.mjs', fullyParallel: false, workers: 1,
  outputDir: 'factory-test-results', reporter: [['list'], ['html', { outputFolder: 'factory-playwright-report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4312', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'node tests/factory/fixture-server.mjs', url: 'http://127.0.0.1:4312/health', reuseExistingServer: false, timeout: 60000 },
});
