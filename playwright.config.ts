import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests drive the real stack: Django API + admin app + public site.
 * Defaults target local dev servers; override with E2E_* variables to test a deployed environment.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure', screenshot: 'only-on-failure', acceptDownloads: true },
})
