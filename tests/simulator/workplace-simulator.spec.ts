/**
 * Workplace Person Simulator — Word Is Bond Platform
 *
 * Comprehensive E2E test suite that simulates complete employee journeys
 * from signup through productive use, testing all features and detecting kinks.
 *
 * @architecture Playwright-based E2E testing with evidence capture
 * @standards ARCH_DOCS compliant (snake_case, TypeScript, Zod validation)
 * @features Automated onboarding, feature testing, kink detection, reporting
 */

import { test, expect, Page } from '@playwright/test'
import { EvidenceCollector } from './helpers/evidence-collector'
import { FeatureTester } from './helpers/feature-testers'
import { TestDataGenerator, GeneratedUser } from './helpers/data-generator'
import { SIMULATOR_CONFIG, SELECTORS, URLS } from './config'

// ── Types & Interfaces ──────────────────────────────────────────────────────

        kinks.push({
          severity: e.timing_ms! > 15000 ? 'high' : 'medium',
          category: 'performance',
          description: `Slow operation: ${e.action} took ${e.timing_ms}ms`,
          evidence: e,
          recommendation: 'Optimize loading times or add loading indicators'
        })
      })

    // Error kinks: failed actions
    this.evidence
      .filter(e => e.error)
      .forEach(e => {
        kinks.push({
          severity: 'high',
          category: 'broken_flow',
          description: `Error in ${e.step}: ${e.error}`,
          evidence: e,
          recommendation: 'Fix error handling and validation'
        })
      })

    // UI kinks: missing elements or unexpected states
    this.evidence
      .filter(e => e.metadata?.missing_elements?.length > 0)
      .forEach(e => {
        kinks.push({
          severity: 'medium',
          category: 'ui',
          description: `Missing UI elements: ${e.metadata.missing_elements.join(', ')}`,
          evidence: e,
          recommendation: 'Ensure all required UI elements are rendered'
        })
      })

    return kinks
  }
}

// ── Feature Testers ────────────────────────────────────────────────────────

class FeatureTester {
  constructor(private page: Page, private evidence: EvidenceCollector) {}

  async testCallPlacement(targetNumber: string): Promise<FeatureTestResult> {
    const startTime = Date.now()

    try {
      await this.evidence.captureEvidence(
        this.page,
        'call-placement',
        'start-call',
        { screenshot: true }
      )

      // Navigate to voice operations
      await this.page.goto('/voice')
      await this.page.waitForLoadState('networkidle')

      // Enter target number
      await this.page.fill('[data-testid="target-number"]', targetNumber)
      await this.evidence.captureEvidence(
        this.page,
        'call-placement',
        'enter-number',
        { screenshot: true }
      )

      // Start call
      await this.page.click('[data-testid="start-call"]')
      await this.evidence.captureEvidence(
        this.page,
        'call-placement',
        'initiate-call',
        { screenshot: true }
      )

      // Wait for call to connect (simulate)
      await this.page.waitForTimeout(3000)

      // End call
      await this.page.click('[data-testid="end-call"]')
      await this.evidence.captureEvidence(
        this.page,
        'call-placement',
        'end-call',
        { screenshot: true }
      )
ait this.evidence.captureEvidence(
      this.page,
      'first-data',
      'load-page',
      { screenshot: true }
    )

    // Add sample account data
    const accounts = TestDataGenerator.generateAccountData(1)
    const account = accounts[0]

    await this.page.fill('[data-testid="account-name"]', account.name)
    await this.page.fill('[data-testid="account-phone"]', account.phone)
    await this.page.fill('[data-testid="account-email"]', account.email)

    await this.evidence.captureEvidence(
      this.page,
      'first-data',
      'fill-account',
      { screenshot: true }
    )

    // Submit
    await this.page.click('[data-testid="first-data-submit"]')
    await this.page.waitForURL('**/onboarding/test-call')

    const duration = Date.now() - startTime
    await this.evidence.captureEvidence(
      this.page,
      'first-data',
      'complete',
      { timing_ms: duration, screenshot: true }
    )

    this.report.steps_completed!.push('first-data')
  }

  private async stepTestCall(): Promise<void> {
    const startTime = Date.now()

    await this.evidence.captureEvidence(
      this.page,
      'test-call',
      'load-page',
      { screenshot: true }
    )

    // Enter test phone number (user's own number for demo)
    await this.page.fill('[data-testid="test-phone"]', this.report.user!.phone_number)

    await this.evidence.captureEvidence(
      this.page,
      'test-call',
      'enter-phone',
      { screenshot: true }
    )

    // Start test call
    await this.page.click('[data-testid="start-test-call"]')

    // Wait for call simulation
    await this.page.waitForTimeout(5000)

    await this.evidence.captureEvidence(
      this.page,
      'test-call',
      'during-call',
      { screenshot: true }
    )

    // End call
    await this.page.click('[data-testid="end-test-call"]')
    await this.page.waitForURL('**/onboarding/tour')

    const duration = Date.now() - startTime
    await this.evidence.captureEvidence(
      this.page,
      'test-call',
      'complete',
      { timing_ms: duration, screenshot: true }
    )

    this.report.steps_completed!.push('test-call')
  }

  private async stepTour(): Promise<void> {
    const startTime = Date.now()

    await this.evidence.captureEvidence(
      this.page,
      'tour',
      'load-page',
      { screenshot: true }
    )

    // Complete tour steps (simulate clicking through)
    const tourSteps = await this.page.$$('[data-testid="tour-step"]')
    for (let i = 0; i < tourSteps.length; i++) {
      await tourSteps[i].click()
      await this.page.waitForTimeout(1000)
    }

    await this.evidence.captureEvidence(
      this.page,
      'tour',
      'complete-tour',
      { screenshot: true }
    )

    // Finish tour
    await this.page.click('[data-testid="tour-complete"]')
    await this.page.waitForURL('**/work')

    const duration = Date.now() - startTime
    await this.evidence.captureEvidence(
      this.page,
      'tour',
      'complete',
      { timing_ms: duration, screenshot: true }
    )

    this.report.steps_completed!.push('tour')
  }

  private async stepCompleteAndTestFeatures(): Promise<void> {
    // Test core features
    const callData = TestDataGenerator.generateTestCallData()

    const callResult = await this.featureTester.testCallPlacement(callData.target_number)
    const transcriptResult = await this.featureTester.testTranscription()
    const analyticsResult = await this.featureTester.testAnalytics()

    this.report.features_tested = [callResult, transcriptResult, analyticsResult]
    this.report.steps_completed!.push('feature-testing')
  }
}

// ── Test Suite ─────────────────────────────────────────────────────────────

test.describe('Workplace Person Simulator', () => {
  test('Complete Employee Journey Simulation', async ({ page }) => {
    const testId = `simulator-${Date.now()}`
    const simulator = new WorkplacePersonSimulator(page, testId)

    const report = await simulator.simulateCompleteJourney()

    // Generate comprehensive report
    const reportPath = path.join(process.cwd(), 'test-results', 'simulator-reports', `${testId}.json`)
    fs.mkdirSync(path.dirname(reportPath), { recursive: true })
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

    // Assertions
    expect(report.success).toBe(true)
    expect(report.steps_completed).toContain('signup')
    expect(report.steps_completed).toContain('configure')
    expect(report.steps_completed).toContain('first-data')
    expect(report.steps_completed).toContain('test-call')
    expect(report.steps_completed).toContain('tour')
    expect(report.steps_completed).toContain('feature-testing')

    // Check for critical kinks
    const criticalKinks = report.kinks_detected.filter(k => k.severity === 'critical')
    expect(criticalKinks.length).toBe(0)

    // Verify features tested
    expect(report.features_tested.length).toBeGreaterThan(0)
    report.features_tested.forEach(feature => {
      expect(feature.success).toBe(true)
    })

    console.log(`Simulator Report Generated: ${reportPath}`)
  })

  test('Kink Detection - Performance Issues', async ({ page }) => {
    // Test specifically for performance kinks
    const testId = `kink-performance-${Date.now()}`
    const simulator = new WorkplacePersonSimulator(page, testId)

    const report = await simulator.simulateCompleteJourney()

    // Check for performance kinks
    const perfKinks = report.kinks_detected.filter(k => k.category === 'performance')
    console.log(`Performance kinks detected: ${perfKinks.length}`)

    // Log any performance issues found
    perfKinks.forEach(kink => {
      console.log(`Performance Issue: ${kink.description}`)
      console.log(`Recommendation: ${kink.recommendation}`)
    })
  })

  test('Kink Detection - UI/UX Issues', async ({ page }) => {
    // Test specifically for UI/UX kinks
    const testId = `kink-ui-${Date.now()}`
    const simulator = new WorkplacePersonSimulator(page, testId)

    const report = await simulator.simulateCompleteJourney()

    // Check for UI/UX kinks
    const uiKinks = report.kinks_detected.filter(k => ['ui', 'ux'].includes(k.category))
    console.log(`UI/UX kinks detected: ${uiKinks.length}`)

    uiKinks.forEach(kink => {
      console.log(`UI/UX Issue: ${kink.description}`)
      console.log(`Recommendation: ${kink.recommendation}`)
    })
  })
})

// ── CLI Runner for Standalone Execution ────────────────────────────────────

export async function runSimulator(options: {
  headless?: boolean
  outputDir?: string
  iterations?: number
} = {}) {
  const { chromium } = require('playwright')
  const browser = await chromium.launch({ headless: options.headless ?? true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const reports: SimulatorReport[] = []

  for (let i = 0; i < (options.iterations ?? 1); i++) {
    const testId = `simulator-run-${i + 1}-${Date.now()}`
    const simulator = new WorkplacePersonSimulator(page, testId)
    const report = await simulator.simulateCompleteJourney()
    reports.push(report)
  }

  await browser.close()

  // Generate summary report
  const summary = {
    total_runs: reports.length,
    successful_runs: reports.filter(r => r.success).length,
    average_duration_ms: reports.reduce((sum, r) => sum + (r.total_duration_ms ?? 0), 0) / reports.length,
    total_kinks_detected: reports.reduce((sum, r) => sum + r.kinks_detected.length, 0),
    critical_kinks: reports.flatMap(r => r.kinks_detected).filter(k => k.severity === 'critical').length,
    reports: reports.map(r => ({
      test_id: r.test_id,
      success: r.success,
      duration_ms: r.total_duration_ms,
      steps_completed: r.steps_completed.length,
      kinks_detected: r.kinks_detected.length,
      features_tested: r.features_tested.length
    }))
  }

  const outputPath = path.join(options.outputDir ?? 'test-results', 'simulator-summary.json')
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2))

  console.log(`Simulation complete. Summary: ${outputPath}`)
  return summary
}

// Allow CLI execution
if (require.main === module) {
  runSimulator({
    headless: process.argv.includes('--headed') ? false : true,
    iterations: parseInt(process.argv.find(arg => arg.startsWith('--iterations='))?.split('=')[1] ?? '1')
  })
}