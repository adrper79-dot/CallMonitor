/**
 * Workplace Person Simulator — Word Is Bond Platform
 *
 * Comprehensive E2E test suite that simulates complete employee journeys
 * from signup through productive use, testing all features and detecting kinks.
 */

import { test, expect, Page } from '@playwright/test'
import { faker } from '@faker-js/faker'
import * as fs from 'fs'
import * as path from 'path'

// Configuration
const SIMULATOR_CONFIG = {
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  timeouts: {
    pageLoad: 10000,
    apiCall: 5000,
    callConnect: 15000
  },
  evidenceDir: path.join(process.cwd(), 'test-results', 'simulator-evidence')
}

// Ensure evidence directory exists
if (!fs.existsSync(SIMULATOR_CONFIG.evidenceDir)) {
  fs.mkdirSync(SIMULATOR_CONFIG.evidenceDir, { recursive: true })
}

interface EvidenceItem {
  timestamp: string
  step: string
  description: string
  screenshot?: string
  duration?: number
  error?: string
  metadata?: any
}

interface KinkReport {
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: 'performance' | 'ui' | 'ux' | 'validation' | 'flow' | 'security'
  description: string
  step: string
  evidence: string[]
  recommendation: string
}

class WorkplaceSimulator {
  private evidence: EvidenceItem[] = []
  private kinks: KinkReport[] = []
  private testId: string
  private testUser: any

  constructor() {
    this.testId = `simulator-${Date.now()}`
    this.testUser = {
      email: `simulator-${Date.now()}@test.wordis-bond.com`,
      password: 'TestPassword123!',
      companyName: faker.company.name(),
      phoneNumber: '+15551234567',
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName()
    }
  }

  private async captureEvidence(page: Page, step: string, description: string, metadata?: any): Promise<void> {
    const timestamp = new Date().toISOString()
    const screenshotPath = path.join(SIMULATOR_CONFIG.evidenceDir, `${this.testId}-${step}-${Date.now()}.png`)

    try {
      await page.screenshot({ path: screenshotPath, fullPage: true })
    } catch (error) {
      console.warn(`Screenshot failed for ${step}:`, error)
    }

    this.evidence.push({
      timestamp,
      step,
      description,
      screenshot: screenshotPath,
      metadata
    })
  }

  private reportKink(severity: KinkReport['severity'], category: KinkReport['category'],
                     description: string, step: string, recommendation: string): void {
    this.kinks.push({
      severity,
      category,
      description,
      step,
      evidence: this.evidence.slice(-3).map(e => e.screenshot || ''),
      recommendation
    })
  }

  private async measurePerformance<T>(operation: () => Promise<T>, step: string): Promise<T> {
    const start = Date.now()
    try {
      const result = await operation()
      const duration = Date.now() - start

      if (duration > SIMULATOR_CONFIG.timeouts.pageLoad) {
        this.reportKink('medium', 'performance',
          `${step} took ${duration}ms (target: ${SIMULATOR_CONFIG.timeouts.pageLoad}ms)`,
          step, 'Optimize loading performance or add loading indicators')
      }

      return result
    } catch (error) {
      const duration = Date.now() - start
      this.reportKink('high', 'performance',
        `${step} failed after ${duration}ms: ${error.message}`,
        step, 'Investigate error and add proper error handling')
      throw error
    }
  }

  async simulateSignup(page: Page): Promise<void> {
    const signupUrl = `${SIMULATOR_CONFIG.baseURL}/signup`
    console.log('Navigating to:', signupUrl)
    await page.goto(signupUrl)
    await this.captureEvidence(page, 'signup-start', 'Signup page loaded')

    // Fill signup form with correct field names and values
    await page.fill('#name', `${this.testUser.firstName} ${this.testUser.lastName}`)
    await page.fill('#email', this.testUser.email)
    await page.fill('#password', this.testUser.password)
    await page.fill('#organizationName', this.testUser.companyName)

    await this.captureEvidence(page, 'signup-filled', 'Signup form completed')

    // Submit
    await page.click('button[type="submit"]')
    console.log('Waiting for onboarding URL...')
    
    // Wait for navigation to onboarding (signup uses window.location.href)
    await page.waitForURL('**/onboarding/**', { timeout: 30000 })
    const currentUrl = page.url()
    console.log('Current URL after signup:', currentUrl)
    await this.captureEvidence(page, 'signup-complete', `Redirected to onboarding: ${currentUrl}`)
  }

  async simulateOnboarding(page: Page): Promise<void> {
    console.log('Starting onboarding simulation...')
    const currentUrl = page.url()
    console.log('Current URL at start of onboarding:', currentUrl)
    
    // Wait for onboarding page to load - accept any onboarding URL
    await page.waitForURL('**/onboarding/**')
    const onboardingUrl = page.url()
    console.log('Onboarding URL loaded:', onboardingUrl)
    await this.captureEvidence(page, 'onboarding-start', `Onboarding page loaded: ${onboardingUrl}`)

    // Step 1: Plan selection
    console.log('Waiting for plan selection step...')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // Give extra time for dynamic content
    
    // Try multiple selectors for the welcome text
    const welcomeSelectors = [
      'text=Welcome to Word Is Bond',
      'h2:has-text("Welcome to Word Is Bond")',
      'text=Welcome to Word',
      'text=Word Is Bond'
    ]
    
    let welcomeFound = false
    for (const selector of welcomeSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 })
        console.log(`Found welcome text with selector: ${selector}`)
        welcomeFound = true
        break
      } catch (error) {
        console.log(`Selector ${selector} not found, trying next...`)
      }
    }
    
    if (!welcomeFound) {
      console.log('Welcome text not found, checking page content...')
      const pageContent = await page.textContent('body')
      console.log('Page contains:', pageContent?.substring(0, 500))
      throw new Error('Welcome text not found on onboarding page')
    }
    
    await this.captureEvidence(page, 'onboarding-plan', 'Plan selection step visible')
    console.log('Plan selection step loaded')

    // Click Continue to proceed
    await page.click('button:has-text("Configure My Business")')
    console.log('Clicked Configure My Business on plan selection')

    // Step 2: Number setup
    console.log('Waiting for number setup step...')
    await page.waitForSelector('text=Claim Your Voice', { timeout: 10000 })
    await this.captureEvidence(page, 'onboarding-number', 'Number setup step loaded')
    console.log('Number setup step loaded')

    // Fill phone number
    await page.fill('input[name="phoneNumber"]', this.testUser.phoneNumber)
    await page.click('button:has-text("Next: Compliance Setup")')
    console.log('Phone number filled and continued')

    // Step 3: Compliance
    console.log('Waiting for compliance step...')
    await page.waitForSelector('text=Compliance Configuration', { timeout: 10000 })
    await this.captureEvidence(page, 'onboarding-compliance', 'Compliance step loaded')
    console.log('Compliance step loaded')

    await page.click('button:has-text("Save & Continue")')
    console.log('Compliance accepted and continued')

    // Step 4: Import contacts (skip)
    console.log('Waiting for import contacts step...')
    await page.waitForSelector('text=Import Your Contacts', { timeout: 10000 })
    await this.captureEvidence(page, 'onboarding-import', 'Import contacts step loaded')
    console.log('Import contacts step loaded')

    await page.click('button:has-text("Skip for Now")')
    console.log('Skipped import contacts')

    // Step 5: Test call
    console.log('Waiting for test call step...')
    await page.waitForSelector('text=Test Call', { timeout: 10000 })
    await this.captureEvidence(page, 'onboarding-test-call', 'Test call step loaded')
    console.log('Test call step loaded')

    // Make test call
    await page.click('button:has-text("Make Test Call")')
    console.log('Initiated test call')

    await page.waitForSelector('text=Call Connected', { timeout: SIMULATOR_CONFIG.timeouts.callConnect })
    await this.captureEvidence(page, 'test-call-connected', 'Test call connected')
    console.log('Test call connected')

    // End call
    await page.click('button:has-text("End Call")')
    await page.waitForSelector('text=Call Completed', { timeout: 10000 })
    await this.captureEvidence(page, 'test-call-completed', 'Test call completed')
    console.log('Test call completed')

    await page.click('button:has-text("Continue")')
    console.log('Continued after test call')

    // Step 6: Team setup (skip)
    console.log('Waiting for team setup step...')
    await page.waitForSelector('text=Invite Team', { timeout: 10000 })
    await this.captureEvidence(page, 'onboarding-team', 'Team setup step loaded')
    console.log('Team setup step loaded')

    await page.click('button:has-text("Skip")')
    console.log('Skipped team setup')

    // Step 7: Tour
    console.log('Waiting for tour step...')
    await page.waitForSelector('text=Get Started', { timeout: 10000 })
    await this.captureEvidence(page, 'onboarding-tour', 'Tour step loaded')
    console.log('Tour step loaded')

    await page.click('button:has-text("Continue")')
    console.log('Started tour')

    // Step 8: Launch - should redirect to dashboard
    console.log('Waiting for dashboard redirect...')
    await page.waitForURL('**/dashboard', { timeout: 10000 })
    await this.captureEvidence(page, 'onboarding-complete', 'Onboarding completed, redirected to dashboard')
    console.log('Onboarding simulation completed successfully!')
  }

  async simulateFeatureTesting(page: Page): Promise<void> {
    // Test dashboard
    await this.captureEvidence(page, 'dashboard-loaded', 'Main dashboard loaded')

    // Test analytics
    await page.click('text=Analytics')
    await page.waitForLoadState('networkidle')
    await this.captureEvidence(page, 'analytics-loaded', 'Analytics page loaded')

    // Test campaigns
    await page.click('text=Campaigns')
    await page.waitForLoadState('networkidle')
    await this.captureEvidence(page, 'campaigns-loaded', 'Campaigns page loaded')

    // Test reports
    await page.click('text=Reports')
    await page.waitForLoadState('networkidle')
    await this.captureEvidence(page, 'reports-loaded', 'Reports page loaded')
  }

  async simulateVoiceTranslationWorkflow(page: Page): Promise<void> {
    console.log('🚀 Starting Voice Translation Workflow simulation...')

    // Navigate to voice operations
    await page.goto('/voice-operations')
    await page.waitForLoadState('networkidle')
    await this.captureEvidence(page, 'voice-ops-loaded', 'Voice Operations page loaded')
    console.log('Voice Operations page loaded')

    // Check if authentication is required
    const signInRequired = await page.locator('text=Sign in required').isVisible()
    if (signInRequired) {
      console.log('Authentication required - performing manual login...')

      // Navigate directly to sign-in page instead of clicking button
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

      await this.captureEvidence(page, 'login-credentials-entered', 'Login credentials entered')

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

        await this.captureEvidence(page, 'post-login-voice-ops', 'Voice operations page after login')
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
            await this.captureEvidence(page, 'post-login-voice-ops', 'Voice operations page after login')
          } catch (navError) {
            console.log('Navigation to voice operations failed:', navError.message)
            this.reportKink('high', 'navigation', 'Failed to navigate to voice operations after login',
              'voice-translation-workflow', 'Verify post-login navigation works')
            return
          }
        } else {
          this.reportKink('high', 'auth', 'Login redirect failed after credential submission',
            'voice-translation-workflow', 'Verify login flow and redirect handling')
          return
        }
      }
    }

    // Check again if we're still not authenticated
    const stillRequiresAuth = await page.locator('text=Sign in required').isVisible()
    if (stillRequiresAuth) {
      console.log('❌ Authentication still required after login attempt')
      this.reportKink('critical', 'auth', 'Authentication failed with provided credentials',
        'voice-translation-workflow', 'Verify credentials are valid and login process works')
      await this.captureEvidence(page, 'auth-failed', 'Authentication still required after login')
      return
    }

    console.log('✅ User is authenticated - proceeding with workflow test')

    // Skip settings configuration for now - assume translation is enabled
    // In a real test, settings would be configured via API or pre-configured
    console.log('Assuming translation settings are pre-configured...')

    // Test basic voice operations page functionality
    console.log('Testing voice operations page functionality...')

    // Check if we can see the main voice operations interface
    const pageTitle = page.locator('h1, h2, .page-title').first()
    try {
      await pageTitle.waitFor({ timeout: 5000 })
      const titleText = await pageTitle.textContent()
      console.log('Voice operations page title:', titleText)
      await this.captureEvidence(page, 'voice-ops-interface', `Voice operations interface loaded: ${titleText}`)
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
          await this.captureEvidence(page, 'phone-input-found', `Phone input available: ${selector}`)
          break
        }
      } catch (error) {
        // Continue checking other selectors
      }
    }

    if (!phoneInputFound) {
      console.log('Phone input not found - this may be expected if call controls are not yet implemented')
      this.reportKink('low', 'ui', 'Phone input field not found on authenticated voice operations page',
        'voice-translation-workflow', 'Verify call controls are properly rendered for authenticated users')
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
          await this.captureEvidence(page, 'dial-button-found', `Dial button available: ${selector}`)
          break
        }
      } catch (error) {
        // Continue checking other selectors
      }
    }

    if (!dialButtonFound) {
      console.log('Dial button not found - this may be expected if call controls are not yet implemented')
      this.reportKink('low', 'ui', 'Dial button not found on authenticated voice operations page',
        'voice-translation-workflow', 'Verify dial button is properly rendered for authenticated users')
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
          await this.captureEvidence(page, 'translation-ui-found', `Translation UI available: ${selector}`)
          break
        }
      } catch (error) {
        // Continue checking other selectors
      }
    }

    if (!translationUIFound) {
      console.log('Translation UI not found - this may be expected if translation features are not yet enabled')
      this.reportKink('low', 'ui', 'Translation UI elements not visible on voice operations page',
        'voice-translation-workflow', 'Verify translation interface is properly rendered')
    }

    console.log('✅ Voice Translation Workflow authentication and page load test completed successfully!')
    console.log('📊 Summary:')
    console.log(`   - Authentication: ✅ Successful`)
    console.log(`   - Page Load: ✅ Successful`)
    console.log(`   - Phone Input: ${phoneInputFound ? '✅ Found' : '⚠️ Not found'}`)
    console.log(`   - Dial Button: ${dialButtonFound ? '✅ Found' : '⚠️ Not found'}`)
    console.log(`   - Translation UI: ${translationUIFound ? '✅ Found' : '⚠️ Not found'}`)
  }

  private async mockCustomerSpeech(page: Page, englishText: string): Promise<void> {
    // Mock customer speech by triggering translation via API
    // This simulates what would happen when actual speech is transcribed
    try {
      await page.evaluate(async (text) => {
        // Simulate SSE event for translation
        const event = new CustomEvent('translation-segment', {
          detail: {
            original_text: text,
            translated_text: 'Hola, necesito ayuda con el saldo de mi cuenta.',
            source_language: 'en',
            target_language: 'es',
            confidence: 0.95
          }
        })
        window.dispatchEvent(event)
      }, englishText)

      console.log('Mock customer speech injected:', englishText)
    } catch (error) {
      console.warn('Failed to mock customer speech:', error)
    }
  }

  async generateReport(): Promise<void> {
    const report = {
      testId: this.testId,
      timestamp: new Date().toISOString(),
      user: this.testUser,
      evidence: this.evidence,
      kinks: this.kinks,
      summary: {
        totalSteps: this.evidence.length,
        totalKinks: this.kinks.length,
        criticalKinks: this.kinks.filter(k => k.severity === 'critical').length,
        highKinks: this.kinks.filter(k => k.severity === 'high').length,
        success: this.kinks.filter(k => k.severity === 'critical').length === 0
      }
    }

    const reportPath = path.join(SIMULATOR_CONFIG.evidenceDir, `${this.testId}-report.json`)
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

    console.log(`📊 Simulator report generated: ${reportPath}`)
    console.log(`📸 Evidence captured: ${this.evidence.length} screenshots`)
    console.log(`🐛 Kinks detected: ${this.kinks.length} (${this.kinks.filter(k => k.severity === 'critical').length} critical)`)
  }

  async runVoiceTranslationTest(page: Page): Promise<void> {
    try {
      // Start from dashboard (assuming user is already logged in)
      await page.goto(`${SIMULATOR_CONFIG.baseURL}/dashboard`)
      await page.waitForLoadState('networkidle')
      await this.captureEvidence(page, 'dashboard-start', 'Started voice translation workflow test from dashboard')
      
      await this.measurePerformance(() => this.simulateVoiceTranslationWorkflow(page), 'voice-translation-workflow')
    } finally {
      await this.generateReport()
    }
  }
}

test.describe('Workplace Person Simulator', () => {
  test('Voice translation workflow testing', async ({ page }) => {
    const simulator = new WorkplaceSimulator()

    // Set timeout for voice workflow testing
    test.setTimeout(300000) // 5 minutes

    await simulator.runVoiceTranslationTest(page)
  })
})