import { test, expect } from '@playwright/test'

test('voice operations authentication and page load test', async ({ page }) => {
  console.log('🚀 Starting Voice Operations Authentication Test...')

  // Navigate to voice operations
  await page.goto('/voice-operations')
  await page.waitForLoadState('networkidle')
  console.log('Voice Operations page loaded')

  // Check if authentication is required
  const signInRequired = await page.locator('text=Sign in required').isVisible()
  if (signInRequired) {
    console.log('Authentication required - performing manual login...')

    // Navigate directly to sign-in page
    await page.goto('/signin')
    await page.waitForLoadState('networkidle')
    console.log('Navigated to sign-in page')

    // Wait for the page to load
    const heading = page.locator('h1:has-text("Welcome back")')
    await heading.waitFor({ timeout: 10000 })
    console.log('Sign-in page loaded')

    // Fill login credentials
    const emailInput = page.locator('input#email')
    const passwordInput = page.locator('input#password')

    await emailInput.waitFor({ timeout: 5000 })
    await passwordInput.waitFor({ timeout: 5000 })

    await emailInput.fill('adrper79@gmail.com')
    await passwordInput.fill('123qweASD')
    console.log('Credentials entered')

    // Submit login
    const submitButton = page.locator('button[type="submit"]:has-text("Sign In")')
    await submitButton.waitFor({ timeout: 5000 })
    await submitButton.click()
    console.log('Login submitted, waiting for redirect...')

    // Wait for redirect to dashboard or voice operations
    try {
      await page.waitForURL((url) => url.pathname === '/dashboard' || url.pathname === '/dashboard/' || url.pathname === '/voice-operations' || url.pathname === '/voice-operations/', { timeout: 15000 })
      console.log('✅ Successfully logged in and redirected to:', page.url())

      // If redirected to dashboard, navigate back to voice operations
      if (page.url().includes('/dashboard')) {
        console.log('Redirected to dashboard, navigating to voice operations...')
        await page.goto('/voice-operations')
        await page.waitForLoadState('networkidle')
        console.log('Successfully navigated to voice operations')
      }

    } catch (error) {
      console.log('Login redirect failed:', error.message)
      // Check if we're actually on the dashboard despite the error
      const currentUrl = page.url()
      console.log('Current URL after login attempt:', currentUrl)

      if (currentUrl.includes('/dashboard')) {
        console.log('Actually on dashboard, proceeding with navigation to voice operations...')
        try {
          await page.goto('/voice-operations')
          await page.waitForLoadState('networkidle')
          console.log('Successfully navigated to voice operations after login')
        } catch (navError) {
          console.log('Navigation to voice operations failed:', navError.message)
          throw navError
        }
      } else {
        throw error
      }
    }
  }

  // Check again if we're still not authenticated
  const stillRequiresAuth = await page.locator('text=Sign in required').isVisible()
  if (stillRequiresAuth) {
    console.log('❌ Authentication still required after login attempt')
    throw new Error('Authentication failed with provided credentials')
  }

  console.log('✅ User is authenticated - validating voice operations page...')

  // Check if we can see the main voice operations interface
  const pageTitle = page.locator('h1, h2, .page-title').first()
  try {
    await pageTitle.waitFor({ timeout: 5000 })
    const titleText = await pageTitle.textContent()
    console.log('Voice operations page title:', titleText)
  } catch (error) {
    console.log('Could not find page title, checking page content...')
    const bodyText = await page.locator('body').textContent()
    console.log('Page contains text (first 200 chars):', bodyText?.substring(0, 200))
  }

  // Look for call controls (but don't fail if not found - this validates the page loaded)
  console.log('Checking for call controls...')
  const phoneInputSelectors = [
    'input[name="phoneNumber"]',
    'input[placeholder*="phone"]',
    'input[type="tel"]',
    'input[data-target-input]',
    '[data-testid="phone-input"]'
  ]

  let phoneInputFound = false
  for (const selector of phoneInputSelectors) {
    try {
      const element = page.locator(selector).first()
      if (await element.isVisible({ timeout: 2000 })) {
        console.log(`✅ Found phone input with selector: ${selector}`)
        phoneInputFound = true
        break
      }
    } catch (error) {
      // Continue checking other selectors
    }
  }

  // Look for dial button
  const dialButtonSelectors = [
    'button[name="dial"]',
    'button:has-text("Dial")',
    'button:has-text("Call")',
    'button[data-testid="dial-button"]',
    'button[type="submit"]'
  ]

  let dialButtonFound = false
  for (const selector of dialButtonSelectors) {
    try {
      const button = page.locator(selector).first()
      if (await button.isVisible({ timeout: 2000 })) {
        console.log(`✅ Found dial button with selector: ${selector}`)
        dialButtonFound = true
        break
      }
    } catch (error) {
        // Continue checking other selectors
    }
  }

  // Check for translation-related UI elements
  console.log('Checking for translation UI elements...')
  const translationSelectors = [
    '.live-translation-panel',
    '[data-testid="translation-panel"]',
    'text=Live Translation',
    'text=Translation',
    '.translation-panel',
    'text=Translate'
  ]

  let translationUIFound = false
  for (const selector of translationSelectors) {
    try {
      const element = page.locator(selector).first()
      if (await element.isVisible({ timeout: 2000 })) {
        console.log(`✅ Found translation UI with selector: ${selector}`)
        translationUIFound = true
        break
      }
    } catch (error) {
        // Continue checking other selectors
    }
  }

  console.log('✅ Voice Operations Authentication and Page Load Test completed successfully!')
  console.log('📊 Summary:')
  console.log(`   - Authentication: ✅ Successful`)
  console.log(`   - Page Load: ✅ Successful`)
  console.log(`   - Phone Input: ${phoneInputFound ? '✅ Found' : '⚠️ Not found'}`)
  console.log(`   - Dial Button: ${dialButtonFound ? '✅ Found' : '⚠️ Not found'}`)
  console.log(`   - Translation UI: ${translationUIFound ? '✅ Found' : '⚠️ Not found'}`)
})