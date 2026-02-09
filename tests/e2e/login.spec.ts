import { test, expect } from '@playwright/test'

/**
 * Sign-In Page E2E Tests
 *
 * Tests the /signin page UI, validation, and navigation links.
 * These tests do NOT require authentication — they exercise the
 * public sign-in form in isolation.
 */
test.describe('Sign-In Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signin')
  })

  test('page loads with welcome heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
  })

  test('displays email and password fields', async ({ page }) => {
    await expect(page.locator('input#email')).toBeVisible()
    await expect(page.locator('input#password')).toBeVisible()
  })

  test('submit button is disabled when form is empty', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeVisible()
    await expect(submitButton).toBeDisabled()
  })

  test('submit button is disabled with only email filled', async ({ page }) => {
    await page.fill('input#email', 'user@example.com')
    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeDisabled()
  })

  test('submit button enables when email and password are filled', async ({ page }) => {
    await page.fill('input#email', 'user@example.com')
    await page.fill('input#password', 'somepassword')
    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeEnabled()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.fill('input#email', 'fake@nonexistent.com')
    await page.fill('input#password', 'wrongpassword123')
    await page.locator('button[type="submit"]').click()

    // Error message should appear (the exact text depends on the API response)
    const errorBanner = page.locator('.bg-red-50')
    await expect(errorBanner).toBeVisible({ timeout: 10_000 })
    await expect(errorBanner).toContainText(/invalid|failed|wrong|error/i)
  })

  test('has link to sign-up page', async ({ page }) => {
    const signupLink = page.getByRole('link', { name: /create one|create account|sign up/i })
    await expect(signupLink).toBeVisible()
    await expect(signupLink).toHaveAttribute('href', '/signup')
  })

  test('has link to forgot password', async ({ page }) => {
    const forgotLink = page.getByRole('link', { name: /forgot password/i })
    await expect(forgotLink).toBeVisible()
    await expect(forgotLink).toHaveAttribute('href', '/forgot-password')
  })

  test('shows email validation feedback for malformed email', async ({ page }) => {
    await page.fill('input#email', 'not-an-email')
    // Trigger blur / move focus to password
    await page.locator('input#password').focus()
    // The EmailInput component shows a validation message
    await expect(page.getByText(/valid email/i)).toBeVisible()
  })
})
