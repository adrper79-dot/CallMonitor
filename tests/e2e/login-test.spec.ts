import { test, expect } from '@playwright/test'

test('verify login credentials', async ({ page }) => {
  // Navigate to sign-in page
  await page.goto('/signin')
  console.log('Navigated to sign-in page')

  // Wait for the page to load
  await page.waitForLoadState('networkidle')
  console.log('Page loaded')

  // Check if we're on the right page
  const heading = page.locator('h1:has-text("Welcome back")')
  await expect(heading).toBeVisible({ timeout: 10000 })
  console.log('Welcome back heading found')

  // Fill credentials
  const emailInput = page.locator('input#email')
  const passwordInput = page.locator('input#password')

  await expect(emailInput).toBeVisible()
  await expect(passwordInput).toBeVisible()

  await emailInput.fill('adrper79@gmail.com')
  await passwordInput.fill('123qweASD')
  console.log('Credentials filled')

  // Submit
  const submitButton = page.locator('button[type="submit"]:has-text("Sign In")')
  await expect(submitButton).toBeVisible()
  await submitButton.click()
  console.log('Submit button clicked')

  // Wait for redirect to dashboard or error
  try {
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
    console.log('✅ Login successful! Redirected to dashboard')
  } catch (error) {
    console.log('Login failed or redirect timeout. Current URL:', page.url())

    // Check for error message
    const errorElement = page.locator('.text-red-600, [class*="error"], [class*="Error"]')
    if (await errorElement.isVisible()) {
      const errorText = await errorElement.textContent()
      console.log('Error message:', errorText)
      throw new Error(`Login failed with error: ${errorText}`)
    }

    throw error
  }
})