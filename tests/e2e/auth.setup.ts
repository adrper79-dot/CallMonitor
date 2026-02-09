import { test as setup, expect } from '@playwright/test'

/**
 * Authentication Setup
 *
 * Logs in with test credentials and saves the authenticated browser
 * state to `.auth/user.json`. Authenticated test projects in
 * playwright.config.ts load this state via `storageState`.
 *
 * ⚠️  To use this setup:
 *   1. Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD env vars (or .env file)
 *   2. Uncomment the `chromium-authenticated` project in playwright.config.ts
 *   3. Remove `.skip` from settings-webhook.spec.ts
 *
 * @see https://playwright.dev/docs/auth
 */

const AUTH_FILE = '.auth/user.json'

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD

  if (!email || !password) {
    console.warn(
      '⚠️  E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set — skipping auth setup.\n' +
        '   Authenticated tests will be skipped.'
    )
    // Create an empty storage state so dependent projects don't crash
    const fs = await import('fs')
    fs.mkdirSync('.auth', { recursive: true })
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }))
    return
  }

  // Navigate to the sign-in page
  await page.goto('/signin')
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()

  // Fill credentials
  await page.fill('input#email', email)
  await page.fill('input#password', password)

  // Submit
  await page.locator('button[type="submit"]').click()

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })

  // Persist signed-in state
  await page.context().storageState({ path: AUTH_FILE })
})
