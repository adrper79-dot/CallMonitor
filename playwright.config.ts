import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Test Configuration — Word Is Bond Platform
 *
 * Usage:
 *   npm run test:e2e          # headless
 *   npm run test:e2e:headed   # with browser UI
 *   npm run test:e2e:ui       # interactive Playwright UI
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  /* ── Test discovery ──────────────────────────────────────────────────── */
  testDir: './tests/e2e',

  /* ── Timeouts ────────────────────────────────────────────────────────── */
  timeout: 30_000,
  expect: { timeout: 5_000 },

  /* ── Parallelism ─────────────────────────────────────────────────────── */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,

  /* ── Retries: 1 on CI, 0 locally ─────────────────────────────────────── */
  retries: process.env.CI ? 1 : 0,

  /* ── Workers ─────────────────────────────────────────────────────────── */
  workers: process.env.CI ? 1 : undefined,

  /* ── Reporter ────────────────────────────────────────────────────────── */
  reporter: process.env.CI ? 'github' : 'html',

  /* ── Global setup: authentication ────────────────────────────────────── */
  /* Uncomment once real test credentials are configured:
  globalSetup: undefined,
  */

  /* ── Shared settings for all projects ────────────────────────────────── */
  use: {
    /* Base URL for relative page.goto() calls */
    baseURL: 'http://localhost:3000',

    /* Capture traces on first retry for debugging */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* ── Projects ────────────────────────────────────────────────────────── */
  projects: [
    /* Auth setup — runs before authenticated tests */
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    /* Unauthenticated tests (login, navigation, public pages) */
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /auth\.setup\.ts/,
    },

    /* Authenticated tests — depend on setup project
     * Uncomment when auth.setup.ts has real credentials:
     *
     * {
     *   name: 'chromium-authenticated',
     *   use: {
     *     ...devices['Desktop Chrome'],
     *     storageState: '.auth/user.json',
     *   },
     *   dependencies: ['setup'],
     * },
     */
  ],

  /* ── Dev server ──────────────────────────────────────────────────────── */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
