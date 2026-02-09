import { test, expect } from '@playwright/test'

/**
 * Navigation & Public Pages E2E Tests
 *
 * Verifies that key routes load correctly and that protected
 * routes redirect unauthenticated users to /signin.
 */
test.describe('Navigation — Public Pages', () => {
  test('homepage loads with Word Is Bond branding', async ({ page }) => {
    await page.goto('/')
    // The landing page renders the Logo component and brand text
    await expect(page.getByText(/what was said/i)).toBeVisible()
    await expect(page.getByText(/is what matters/i)).toBeVisible()
  })

  test('homepage has "Get Started" CTA', async ({ page }) => {
    await page.goto('/')
    const cta = page.getByRole('link', { name: /get started/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', '/signup')
  })

  test('/signin page loads', async ({ page }) => {
    await page.goto('/signin')
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
  })

  test('/signup page loads', async ({ page }) => {
    await page.goto('/signup')
    // Signup page should have a heading or form
    await expect(page.locator('form')).toBeVisible()
  })
})

test.describe('Navigation — Auth Guards', () => {
  test('/dashboard redirects to signin when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard')
    // Should redirect to signin (may include callbackUrl)
    await expect(page).toHaveURL(/\/signin/, { timeout: 10_000 })
  })

  test('/settings redirects to signin when unauthenticated', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/signin/, { timeout: 10_000 })
  })
})

test.describe('Navigation — 404', () => {
  test('shows 404 page for invalid routes', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist')
    // Next.js static export returns the not-found page
    // Check for 404 status or "not found" content
    const body = await page.textContent('body')
    expect(
      response?.status() === 404 || /not found|404|page.*not.*found/i.test(body ?? '')
    ).toBeTruthy()
  })
})
