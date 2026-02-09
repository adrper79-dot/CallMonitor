import { test, expect } from '@playwright/test'

/**
 * Settings — Webhooks Tab E2E Tests
 *
 * These tests exercise the webhook management UI under /settings.
 * They require an authenticated admin session.
 *
 * NOTE: Until auth.setup.ts is configured with real test credentials,
 * these tests are skipped. Remove `.skip` and uncomment the storageState
 * project in playwright.config.ts once test credentials are available.
 */
test.describe.skip('Webhooks (requires auth)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the webhooks tab in settings
    await page.goto('/settings?tab=webhooks')
  })

  test('webhooks tab loads', async ({ page }) => {
    // The tab should show webhook-related content
    await expect(page.getByText(/webhook/i)).toBeVisible()
  })

  test('"Create Webhook" button is visible for admin', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create webhook|add webhook/i })
    await expect(createButton).toBeVisible()
  })

  test('webhook form opens and shows required fields', async ({ page }) => {
    // Open the create webhook form
    const createButton = page.getByRole('button', { name: /create webhook|add webhook/i })
    await createButton.click()

    // The form should display URL and event fields
    await expect(page.getByLabel(/url/i)).toBeVisible()
    await expect(page.getByText(/event/i)).toBeVisible()
  })

  test('webhook form validates URL format', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create webhook|add webhook/i })
    await createButton.click()

    // Enter an invalid URL
    const urlInput = page.getByLabel(/url/i)
    await urlInput.fill('not-a-valid-url')
    // Attempt to submit or blur to trigger validation
    await page.keyboard.press('Tab')

    // Should show a validation error
    await expect(page.getByText(/valid url|invalid url|https/i)).toBeVisible()
  })

  test('webhook form validates event selection', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create webhook|add webhook/i })
    await createButton.click()

    // Fill a valid URL but don't select any events
    await page.getByLabel(/url/i).fill('https://example.com/hook')

    // Try to submit without selecting events
    const submitButton = page.getByRole('button', { name: /save|create|submit/i })
    if (await submitButton.isEnabled()) {
      await submitButton.click()
    }

    // Should show a validation error about events
    await expect(page.getByText(/event|select.*event|at least one/i)).toBeVisible()
  })
})
