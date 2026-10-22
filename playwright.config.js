import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './web/tests',
  testMatch: 'browser.spec.js',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/value-tuner/',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    headless: true,
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/serve-dist.mjs',
    url: 'http://127.0.0.1:4173/value-tuner/',
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
});
