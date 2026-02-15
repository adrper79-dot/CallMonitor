import { test, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { faker } from '@faker-js/faker'

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

interface KinkReport {
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: 'performance' | 'ux' | 'functionality' | 'accessibility'
  description: string
  step: string
  evidence: string[]
  recommendation: string
}

interface Evidence {
  timestamp: string
  step: string
  description: string
  screenshot?: string
  metadata?: any
}

class WorkplaceSimulator {
  private evidence: Evidence[] = []
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

    // Fill signup form
    await page.fill('#email', this.testUser.email)
    await page.fill('#password', this.testUser.password)
    await page.fill('#organizationName', this.testUser.companyName)
    await page.fill('#name', this.testUser.firstName)

    await this.captureEvidence(page, 'signup-filled', 'Signup form completed')

    // Submit
    await page.click('button[type="submit"]')
    console.log('Waiting for onboarding URL...')
    await page.waitForURL('**/onboarding/**')
    await this.captureEvidence(page, 'signup-complete', 'Redirected to onboarding')
  }

  async simulateOnboarding(page: Page): Promise<void> {
    console.log('Starting onboarding simulation...')

    // Wait for onboarding page to load
    await page.waitForURL('**/onboarding')
    console.log('Onboarding page loaded')
    await this.captureEvidence(page, 'onboarding-start', 'Onboarding page loaded')

    // Step 1: Plan selection
    console.log('Waiting for plan selection step...')
    await page.waitForSelector('text=Welcome to Word Is Bond', { timeout: 10000 })
    await this.captureEvidence(page, 'onboarding-plan', 'Plan selection step visible')
    console.log('Plan selection step loaded')

    // Click Continue to proceed
    await page.click('button:has-text("Continue")')
    console.log('Clicked Continue on plan selection')

    // Step 2: Number setup
    console.log('Waiting for number setup step...')
    await page.waitForSelector('text=Claim your number', { timeout: 10000 })
    await this.captureEvidence(page, 'onboarding-number', 'Number setup step loaded')
    console.log('Number setup step loaded')

    // Fill phone number
    await page.fill('input[name="phoneNumber"]', this.testUser.phoneNumber)
    await page.click('button:has-text("Continue")')
    console.log('Phone number filled and continued')

    // Step 3: Compliance
    console.log('Waiting for compliance step...')
    await page.waitForSelector('text=Compliance', { timeout: 10000 })
    await this.captureEvidence(page, 'onboarding-compliance', 'Compliance step loaded')
    console.log('Compliance step loaded')

    await page.click('button:has-text("Continue")')
    console.log('Compliance accepted and continued')

    // Step 4: Import contacts (skip)
    console.log('Waiting for import contacts step...')
    await page.waitForSelector('text=Import Contacts', { timeout: 10000 })
    await this.captureEvidence(page, 'onboarding-import', 'Import contacts step loaded')
    console.log('Import contacts step loaded')

    await page.click('button:has-text("Skip")')
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

  async runSimulation(page: Page): Promise<void> {
    try {
      await this.measurePerformance(() => this.simulateSignup(page), 'signup')
      await this.measurePerformance(() => this.simulateOnboarding(page), 'onboarding')
      await this.measurePerformance(() => this.simulateFeatureTesting(page), 'feature-testing')
    } finally {
      await this.generateReport()
    }
  }
}

test.describe('Workplace Person Simulator', () => {
  test('Complete employee journey from signup to productive use', async ({ page }) => {
    const simulator = new WorkplaceSimulator()

    // Set longer timeouts for realistic simulation
    test.setTimeout(300000) // 5 minutes

    await simulator.runSimulation(page)
  })
})