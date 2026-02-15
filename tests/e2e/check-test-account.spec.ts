import { test, expect } from '@playwright/test'

test('check test account signup', async ({ page }) => {
  // Try to sign up with the test account
  await page.goto('/signup')
  console.log('Signup page loaded')

  // Check if the email is already taken
  const emailInput = page.locator('input#email')
  await emailInput.fill('e2e-test@wordis-bond.com')

  const passwordInput = page.locator('input#password')
  await passwordInput.fill('SecureTestPass123!')

  // Try to submit
  const submitButton = page.locator('button[type="submit"]')
  await submitButton.click()

  // Wait and see what happens
  await page.waitForTimeout(3000)

  console.log('Current URL:', page.url())
  console.log('Page title:', await page.title())

  // Check for error messages
  const errorMessages = page.locator('.error, [data-error], .text-red-500')
  const errorCount = await errorMessages.count()
  console.log('Error messages found:', errorCount)

  for (let i = 0; i < errorCount; i++) {
    const errorText = await errorMessages.nth(i).textContent()
    console.log(`Error ${i + 1}:`, errorText)
  }
})