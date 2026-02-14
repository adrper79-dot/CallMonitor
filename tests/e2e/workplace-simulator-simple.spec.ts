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
    await page.goto('/signup')
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
    // Step 1: Configure
    await page.waitForURL('**/onboarding/configure')
    await this.captureEvidence(page, 'onboarding-configure', 'Configure step loaded')

    // Select plan and configure
    await page.click('text=Business') // Select business plan
    await page.fill('input[name="phoneNumber"]', this.testUser.phoneNumber)
    await page.click('button:has-text("Continue")')

    // Step 2: First Data
    await page.waitForURL('**/onboarding/first-data')
    await this.captureEvidence(page, 'onboarding-first-data', 'First data step loaded')

    // Add sample customer data
    await page.click('button:has-text("Add Customer")')
    await page.fill('input[name="name"]', faker.person.fullName())
    await page.fill('input[name="phone"]', faker.phone.number())
    await page.fill('input[name="balance"]', faker.finance.amount(1000, 50000))
    await page.click('button:has-text("Save")')

    await page.click('button:has-text("Continue")')

    // Step 3: Test Call
    await page.waitForURL('**/onboarding/test-call')
    await this.captureEvidence(page, 'onboarding-test-call', 'Test call step loaded')

    // Simulate test call
    await page.click('button:has-text("Make Test Call")')
    await page.waitForSelector('text=Call Connected', { timeout: SIMULATOR_CONFIG.timeouts.callConnect })
    await this.captureEvidence(page, 'test-call-connected', 'Test call connected')

    // End call
    await page.click('button:has-text("End Call")')
    await page.waitForSelector('text=Call Completed')
    await this.captureEvidence(page, 'test-call-completed', 'Test call completed')

    await page.click('button:has-text("Continue")')

    // Step 4: Tour
    await page.waitForURL('**/onboarding/tour')
    await this.captureEvidence(page, 'onboarding-tour', 'Tour step loaded')

    // Complete tour
    await page.click('button:has-text("Next")') // Multiple next clicks
    await page.click('button:has-text("Next")')
    await page.click('button:has-text("Next")')
    await page.click('button:has-text("Finish")')

    // Step 5: Complete
    await page.waitForURL('**/work/**')
    await this.captureEvidence(page, 'onboarding-complete', 'Onboarding completed, redirected to work')
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