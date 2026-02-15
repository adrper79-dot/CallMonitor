import { test, expect } from '@playwright/test'
import { faker } from '@faker-js/faker'

/**
 * Authentication Flow E2E Tests
 *
 * Comprehensive testing of authentication flows:
 * - Sign up (new user registration)
 * - Sign in (existing user login)
 * - Password reset flow
 * - Form validation
 * - Error handling
 */

test.describe('Authentication Flows', () => {
  test.describe('Sign Up Flow', () => {
    test('signup page loads with required form fields', async ({ page }) => {
      await page.goto('/signup')

      // Check page title
      await expect(page.getByRole('heading', { name: /sign up|create account|join/i })).toBeVisible()

      // Check required form fields
      await expect(page.getByLabel(/first name/i)).toBeVisible()
      await expect(page.getByLabel(/last name/i)).toBeVisible()
      await expect(page.getByLabel(/email/i)).toBeVisible()
      await expect(page.getByLabel(/password/i)).toBeVisible()

      // Check submit button
      await expect(page.getByRole('button', { name: /sign up|create account|register/i })).toBeVisible()

      // Check link to sign in
      await expect(page.getByRole('link', { name: /sign in|log in|already have an account/i })).toBeVisible()
    })

    test('signup form validation shows appropriate errors', async ({ page }) => {
      await page.goto('/signup')

      // Try to submit empty form
      const submitButton = page.getByRole('button', { name: /sign up|create account|register/i })
      await submitButton.click()

      // Should show validation errors
      await expect(page.getByText(/first name is required|first name cannot be empty/i)).toBeVisible()
      await expect(page.getByText(/last name is required|last name cannot be empty/i)).toBeVisible()
      await expect(page.getByText(/email is required|email cannot be empty/i)).toBeVisible()
      await expect(page.getByText(/password is required|password cannot be empty/i)).toBeVisible()
    })

    test('signup form validates email format', async ({ page }) => {
      await page.goto('/signup')

      // Fill form with invalid email
      await page.getByLabel(/first name/i).fill('Test')
      await page.getByLabel(/last name/i).fill('User')
      await page.getByLabel(/email/i).fill('invalid-email')
      await page.getByLabel(/password/i).fill('ValidPassword123!')

      const submitButton = page.getByRole('button', { name: /sign up|create account|register/i })
      await submitButton.click()

      // Should show email validation error
      await expect(page.getByText(/invalid email|email format|valid email/i)).toBeVisible()
    })

    test('signup form validates password strength', async ({ page }) => {
      await page.goto('/signup')

      // Fill form with weak password
      await page.getByLabel(/first name/i).fill('Test')
      await page.getByLabel(/last name/i).fill('User')
      await page.getByLabel(/email/i).fill('test@example.com')
      await page.getByLabel(/password/i).fill('weak')

      const submitButton = page.getByRole('button', { name: /sign up|create account|register/i })
      await submitButton.click()

      // Should show password strength error
      await expect(page.getByText(/password.*strong|password.*length|password.*requirements/i)).toBeVisible()
    })

    test('signup redirects to signin after successful registration', async ({ page }) => {
      await page.goto('/signup')

      // Generate unique test data
      const firstName = faker.person.firstName()
      const lastName = faker.person.lastName()
      const email = `test-${Date.now()}@example.com`
      const password = 'TestPassword123!'

      // Fill form with valid data
      await page.getByLabel(/first name/i).fill(firstName)
      await page.getByLabel(/last name/i).fill(lastName)
      await page.getByLabel(/email/i).fill(email)
      await page.getByLabel(/password/i).fill(password)

      // Check for additional required fields (company, phone, etc.)
      const companyInput = page.getByLabel(/company|organization/i)
      if (await companyInput.isVisible()) {
        await companyInput.fill(faker.company.name())
      }

      const phoneInput = page.getByLabel(/phone|mobile/i)
      if (await phoneInput.isVisible()) {
        await phoneInput.fill('+15551234567')
      }

      const submitButton = page.getByRole('button', { name: /sign up|create account|register/i })
      await submitButton.click()

      // Should redirect to signin or show success message
      await expect(page).toHaveURL(/\/signin|\/verify-email|\/onboarding/, { timeout: 10000 })
    })
  })

  test.describe('Sign In Flow', () => {
    test('signin page loads with form fields', async ({ page }) => {
      await page.goto('/signin')

      // Check page title
      await expect(page.getByRole('heading', { name: /sign in|log in|welcome back/i })).toBeVisible()

      // Check form fields
      await expect(page.getByLabel(/email/i)).toBeVisible()
      await expect(page.getByLabel(/password/i)).toBeVisible()

      // Check submit button
      await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible()

      // Check links
      await expect(page.getByRole('link', { name: /sign up|create account/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /forgot password|reset password/i })).toBeVisible()
    })

    test('signin form validation', async ({ page }) => {
      await page.goto('/signin')

      // Try to submit empty form
      const submitButton = page.getByRole('button', { name: /sign in|log in/i })
      await submitButton.click()

      // Should show validation errors
      await expect(page.getByText(/email is required|email cannot be empty/i)).toBeVisible()
      await expect(page.getByText(/password is required|password cannot be empty/i)).toBeVisible()
    })

    test('signin with invalid credentials shows error', async ({ page }) => {
      await page.goto('/signin')

      // Fill with invalid credentials
      await page.getByLabel(/email/i).fill('invalid@example.com')
      await page.getByLabel(/password/i).fill('wrongpassword')

      const submitButton = page.getByRole('button', { name: /sign in|log in/i })
      await submitButton.click()

      // Should show error message
      await expect(page.getByText(/invalid credentials|wrong email|wrong password|login failed/i)).toBeVisible()
    })

    test('signin with valid credentials redirects to dashboard', async ({ page }) => {
      await page.goto('/signin')

      // Use test credentials from environment
      const email = process.env.E2E_TEST_EMAIL || 'test@example.com'
      const password = process.env.E2E_TEST_PASSWORD || 'TestPassword123!'

      await page.getByLabel(/email/i).fill(email)
      await page.getByLabel(/password/i).fill(password)

      const submitButton = page.getByRole('button', { name: /sign in|log in/i })
      await submitButton.click()

      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
    })
  })

  test.describe('Password Reset Flow', () => {
    test('forgot password page loads', async ({ page }) => {
      await page.goto('/forgot-password')

      // Check page title
      await expect(page.getByRole('heading', { name: /forgot password|reset password/i })).toBeVisible()

      // Check email input
      await expect(page.getByLabel(/email/i)).toBeVisible()

      // Check submit button
      await expect(page.getByRole('button', { name: /send reset|reset password/i })).toBeVisible()

      // Check back to signin link
      await expect(page.getByRole('link', { name: /back to sign in|sign in/i })).toBeVisible()
    })

    test('forgot password form validation', async ({ page }) => {
      await page.goto('/forgot-password')

      // Try to submit empty form
      const submitButton = page.getByRole('button', { name: /send reset|reset password/i })
      await submitButton.click()

      // Should show validation error
      await expect(page.getByText(/email is required|email cannot be empty/i)).toBeVisible()
    })

    test('forgot password with invalid email shows error', async ({ page }) => {
      await page.goto('/forgot-password')

      await page.getByLabel(/email/i).fill('invalid-email')
      const submitButton = page.getByRole('button', { name: /send reset|reset password/i })
      await submitButton.click()

      // Should show email validation error
      await expect(page.getByText(/invalid email|email format/i)).toBeVisible()
    })

    test('forgot password with valid email shows success message', async ({ page }) => {
      await page.goto('/forgot-password')

      await page.getByLabel(/email/i).fill('test@example.com')
      const submitButton = page.getByRole('button', { name: /send reset|reset password/i })
      await submitButton.click()

      // Should show success message
      await expect(page.getByText(/check your email|reset link sent|email sent/i)).toBeVisible()
    })

    test('reset password page loads with token', async ({ page }) => {
      // Navigate to reset password page with a mock token
      await page.goto('/reset-password?token=mock-reset-token')

      // Check page title
      await expect(page.getByRole('heading', { name: /reset password|new password/i })).toBeVisible()

      // Check password inputs
      await expect(page.getByLabel(/new password|password/i)).toBeVisible()
      await expect(page.getByLabel(/confirm password|confirm/i)).toBeVisible()

      // Check submit button
      await expect(page.getByRole('button', { name: /reset password|update password/i })).toBeVisible()
    })

    test('reset password form validation', async ({ page }) => {
      await page.goto('/reset-password?token=mock-reset-token')

      // Try to submit empty form
      const submitButton = page.getByRole('button', { name: /reset password|update password/i })
      await submitButton.click()

      // Should show validation errors
      await expect(page.getByText(/password is required|password cannot be empty/i)).toBeVisible()
    })

    test('reset password validates password confirmation', async ({ page }) => {
      await page.goto('/reset-password?token=mock-reset-token')

      await page.getByLabel(/new password|password/i).fill('NewPassword123!')
      await page.getByLabel(/confirm password|confirm/i).fill('DifferentPassword123!')

      const submitButton = page.getByRole('button', { name: /reset password|update password/i })
      await submitButton.click()

      // Should show password mismatch error
      await expect(page.getByText(/passwords.*match|confirmation.*match/i)).toBeVisible()
    })
  })

  test.describe('Navigation Between Auth Pages', () => {
    test('can navigate from signin to signup', async ({ page }) => {
      await page.goto('/signin')

      const signupLink = page.getByRole('link', { name: /sign up|create account/i })
      await signupLink.click()

      await expect(page).toHaveURL(/\/signup/)
      await expect(page.getByRole('heading', { name: /sign up|create account/i })).toBeVisible()
    })

    test('can navigate from signup to signin', async ({ page }) => {
      await page.goto('/signup')

      const signinLink = page.getByRole('link', { name: /sign in|log in|already have an account/i })
      await signinLink.click()

      await expect(page).toHaveURL(/\/signin/)
      await expect(page.getByRole('heading', { name: /sign in|log in/i })).toBeVisible()
    })

    test('can navigate from signin to forgot password', async ({ page }) => {
      await page.goto('/signin')

      const forgotLink = page.getByRole('link', { name: /forgot password|reset password/i })
      await forgotLink.click()

      await expect(page).toHaveURL(/\/forgot-password/)
      await expect(page.getByRole('heading', { name: /forgot password|reset password/i })).toBeVisible()
    })

    test('can navigate from forgot password back to signin', async ({ page }) => {
      await page.goto('/forgot-password')

      const signinLink = page.getByRole('link', { name: /back to sign in|sign in/i })
      await signinLink.click()

      await expect(page).toHaveURL(/\/signin/)
      await expect(page.getByRole('heading', { name: /sign in|log in/i })).toBeVisible()
    })
  })
})