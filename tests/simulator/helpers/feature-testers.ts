/**
 * Feature Testers — Workplace Person Simulator
 * Individual test methods for each major platform feature
 */

import { Page } from '@playwright/test'
import { EvidenceCollector } from './evidence-collector'
import { SELECTORS, SIMULATOR_CONFIG, PERFORMANCE_BENCHMARKS } from '../config'
import { TestDataGenerator, GeneratedCallScenario } from './data-generator'

export interface FeatureTestResult {
  feature: string
  success: boolean
  duration_ms: number
  evidence_ids: string[]
  notes?: string
  metrics?: Record<string, any>
}

export class FeatureTester {
  constructor(
    private page: Page,
    private evidence: EvidenceCollector
  ) {}

  /**
   * Test call placement functionality
   */
  async testCallPlacement(scenario?: GeneratedCallScenario): Promise<FeatureTestResult> {
    const startTime = Date.now()
    const evidenceIds: string[] = []
    const callData = scenario || TestDataGenerator.generateCallScenario()

    try {
      // Navigate to voice operations
      await this.page.goto('/voice')
      await this.page.waitForLoadState('networkidle')

      const loadEvidence = await this.evidence.captureEvidence(
        this.page,
        'call-placement',
        'load-voice-page',
        { screenshot: true, timing_ms: Date.now() - startTime }
      )
      evidenceIds.push(loadEvidence.id)

      // Enter target number
      await this.page.fill(SELECTORS.TARGET_NUMBER_INPUT, callData.target_number)

      const enterEvidence = await this.evidence.captureEvidence(
        this.page,
        'call-placement',
        'enter-target-number',
        { screenshot: true }
      )
      evidenceIds.push(enterEvidence.id)

      // Enable features based on config
      if (SIMULATOR_CONFIG.FEATURES.TRANSCRIPTION) {
        await this.page.check(SELECTORS.TRANSCRIPT_TOGGLE)
      }
      if (SIMULATOR_CONFIG.FEATURES.POST_TRANSLATION) {
        await this.page.check(SELECTORS.TRANSLATION_TOGGLE)
      }

      const configEvidence = await this.evidence.captureEvidence(
        this.page,
        'call-placement',
        'configure-features',
        { screenshot: true }
      )
      evidenceIds.push(configEvidence.id)

      // Start call
      await this.page.click(SELECTORS.START_CALL)

      const startEvidence = await this.evidence.captureEvidence(
        this.page,
        'call-placement',
        'initiate-call',
        { screenshot: true }
      )
      evidenceIds.push(startEvidence.id)

      // Wait for call to connect (simulate)
      await this.page.waitForSelector(SELECTORS.CALL_STATUS, { timeout: PERFORMANCE_BENCHMARKS.CALL_CONNECT_MAX_MS })

      const connectEvidence = await this.evidence.captureEvidence(
        this.page,
        'call-placement',
        'call-connected',
        { screenshot: true }
      )
      evidenceIds.push(connectEvidence.id)

      // Simulate call duration
      const callDuration = Math.min(callData.expected_duration_sec * 1000, 10000) // Cap at 10s for testing
      await this.page.waitForTimeout(callDuration)

      // End call
      await this.page.click(SELECTORS.END_CALL)

      const endEvidence = await this.evidence.captureEvidence(
        this.page,
        'call-placement',
        'end-call',
        { screenshot: true }
      )
      evidenceIds.push(endEvidence.id)

      const duration = Date.now() - startTime

      return {
        feature: 'call-placement',
        success: true,
        duration_ms: duration,
        evidence_ids: evidenceIds,
        notes: `Successfully placed call to ${callData.target_number} for ${callDuration}ms`,
        metrics: {
          call_duration_simulated: callDuration,
          features_enabled: {
            transcription: SIMULATOR_CONFIG.FEATURES.TRANSCRIPTION,
            translation: SIMULATOR_CONFIG.FEATURES.POST_TRANSLATION
          }
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime

      const errorEvidence = await this.evidence.captureEvidence(
        this.page,
        'call-placement',
        'error',
        { error: error.message, screenshot: true }
      )
      evidenceIds.push(errorEvidence.id)

      return {
        feature: 'call-placement',
        success: false,
        duration_ms: duration,
        evidence_ids: evidenceIds,
        notes: `Call placement failed: ${error.message}`
      }
    }
  }

  /**
   * Test transcription functionality
   */
  async testTranscription(): Promise<FeatureTestResult> {
    const startTime = Date.now()
    const evidenceIds: string[] = []

    try {
      // Wait for transcription to complete
      await this.page.waitForSelector(SELECTORS.TRANSCRIPT_READY, {
        timeout: PERFORMANCE_BENCHMARKS.TRANSCRIPT_READY_MAX_MS
      })

      const readyEvidence = await this.evidence.captureEvidence(
        this.page,
        'transcription',
        'transcript-ready',
        { screenshot: true, timing_ms: Date.now() - startTime }
      )
      evidenceIds.push(readyEvidence.id)

      // Verify transcript content
      const transcriptText = await this.page.textContent('[data-testid="transcript-content"]')
      const hasContent = transcriptText && transcriptText.length > 10

      const contentEvidence = await this.evidence.captureEvidence(
        this.page,
        'transcription',
        'verify-content',
        {
          screenshot: true,
          metadata: {
            transcript_length: transcriptText?.length || 0,
            has_content: hasContent
          }
        }
      )
      evidenceIds.push(contentEvidence.id)

      // Check for speaker labels
      const speakerLabels = await this.page.$$('[data-testid="speaker-label"]')
      const hasSpeakers = speakerLabels.length > 0

      const speakerEvidence = await this.evidence.captureEvidence(
        this.page,
        'transcription',
        'check-speaker-labels',
        {
          screenshot: true,
          metadata: {
            speaker_count: speakerLabels.length,
            has_speakers: hasSpeakers
          }
        }
      )
      evidenceIds.push(speakerEvidence.id)

      const duration = Date.now() - startTime
      const success = hasContent && hasSpeakers

      return {
        feature: 'transcription',
        success,
        duration_ms: duration,
        evidence_ids: evidenceIds,
        notes: success
          ? `Transcription completed with ${transcriptText?.length} characters and ${speakerLabels.length} speakers`
          : 'Transcription incomplete or missing expected elements',
        metrics: {
          transcript_length: transcriptText?.length || 0,
          speaker_count: speakerLabels.length,
          processing_time_ms: duration
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime

      const errorEvidence = await this.evidence.captureEvidence(
        this.page,
        'transcription',
        'error',
        { error: error.message, screenshot: true }
      )
      evidenceIds.push(errorEvidence.id)

      return {
        feature: 'transcription',
        success: false,
        duration_ms: duration,
        evidence_ids: evidenceIds,
        notes: `Transcription test failed: ${error.message}`
      }
    }
  }

  /**
   * Test analytics dashboard
   */
  async testAnalytics(): Promise<FeatureTestResult> {
    const startTime = Date.now()
    const evidenceIds: string[] = []

    try {
      // Navigate to analytics
      await this.page.goto('/analytics')
      await this.page.waitForLoadState('networkidle')

      const loadEvidence = await this.evidence.captureEvidence(
        this.page,
        'analytics',
        'load-dashboard',
        { screenshot: true, timing_ms: Date.now() - startTime }
      )
      evidenceIds.push(loadEvidence.id)

      // Check for key analytics elements
      const requiredElements = [
        { selector: SELECTORS.CALL_VOLUME_CHART, name: 'call-volume-chart' },
        { selector: SELECTORS.PERFORMANCE_METRICS, name: 'performance-metrics' },
        { selector: SELECTORS.SENTIMENT_ANALYSIS, name: 'sentiment-analysis' }
      ]

      const elementChecks = []

      for (const element of requiredElements) {
        try {
          await this.page.waitForSelector(element.selector, { timeout: 5000 })
          elementChecks.push({ name: element.name, found: true })
        } catch {
          elementChecks.push({ name: element.name, found: false })
        }
      }

      const elementsEvidence = await this.evidence.captureEvidence(
        this.page,
        'analytics',
        'verify-elements',
        {
          screenshot: true,
          metadata: { element_checks: elementChecks }
        }
      )
      evidenceIds.push(elementsEvidence.id)

      // Test date range selection
      try {
        await this.page.click('[data-testid="date-range-selector"]')
        await this.page.click('[data-testid="date-range-last-30-days"]')

        const dateEvidence = await this.evidence.captureEvidence(
          this.page,
          'analytics',
          'test-date-filter',
          { screenshot: true }
        )
        evidenceIds.push(dateEvidence.id)
      } catch (dateError) {
        const dateErrorEvidence = await this.evidence.captureEvidence(
          this.page,
          'analytics',
          'date-filter-error',
          { error: dateError.message }
        )
        evidenceIds.push(dateErrorEvidence.id)
      }

      const duration = Date.now() - startTime
      const missingElements = elementChecks.filter(check => !check.found)
      const success = missingElements.length === 0

      return {
        feature: 'analytics',
        success,
        duration_ms: duration,
        evidence_ids: evidenceIds,
        notes: success
          ? 'All analytics elements loaded successfully'
          : `Missing elements: ${missingElements.map(e => e.name).join(', ')}`,
        metrics: {
          elements_found: elementChecks.filter(c => c.found).length,
          elements_missing: missingElements.length,
          load_time_ms: duration
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime

      const errorEvidence = await this.evidence.captureEvidence(
        this.page,
        'analytics',
        'error',
        { error: error.message, screenshot: true }
      )
      evidenceIds.push(errorEvidence.id)

      return {
        feature: 'analytics',
        success: false,
        duration_ms: duration,
        evidence_ids: evidenceIds,
        notes: `Analytics test failed: ${error.message}`
      }
    }
  }

  /**
   * Test campaign management
   */
  async testCampaigns(): Promise<FeatureTestResult> {
    const startTime = Date.now()
    const evidenceIds: string[] = []

    try {
      // Navigate to campaigns
      await this.page.goto('/campaigns')
      await this.page.waitForLoadState('networkidle')

      const loadEvidence = await this.evidence.captureEvidence(
        this.page,
        'campaigns',
        'load-page',
        { screenshot: true, timing_ms: Date.now() - startTime }
      )
      evidenceIds.push(loadEvidence.id)

      // Create a test campaign
      await this.page.click('[data-testid="create-campaign"]')

      const createEvidence = await this.evidence.captureEvidence(
        this.page,
        'campaigns',
        'open-create-form',
        { screenshot: true }
      )
      evidenceIds.push(createEvidence.id)

      // Fill campaign details
      await this.page.fill('[data-testid="campaign-name"]', 'Test Campaign - Simulator')
      await this.page.fill('[data-testid="campaign-description"]', 'Automated test campaign')
      await this.page.selectOption('[data-testid="campaign-type"]', 'outbound')

      const fillEvidence = await this.evidence.captureEvidence(
        this.page,
        'campaigns',
        'fill-details',
        { screenshot: true }
      )
      evidenceIds.push(fillEvidence.id)

      // Save campaign
      await this.page.click('[data-testid="save-campaign"]')
      await this.page.waitForSelector('[data-testid="campaign-created"]')

      const saveEvidence = await this.evidence.captureEvidence(
        this.page,
        'campaigns',
        'campaign-created',
        { screenshot: true }
      )
      evidenceIds.push(saveEvidence.id)

      const duration = Date.now() - startTime

      return {
        feature: 'campaigns',
        success: true,
        duration_ms: duration,
        evidence_ids: evidenceIds,
        notes: 'Campaign created successfully'
      }
    } catch (error) {
      const duration = Date.now() - startTime

      const errorEvidence = await this.evidence.captureEvidence(
        this.page,
        'campaigns',
        'error',
        { error: error.message, screenshot: true }
      )
      evidenceIds.push(errorEvidence.id)

      return {
        feature: 'campaigns',
        success: false,
        duration_ms: duration,
        evidence_ids: evidenceIds,
        notes: `Campaign test failed: ${error.message}`
      }
    }
  }

  /**
   * Test report generation
   */
  async testReports(): Promise<FeatureTestResult> {
    const startTime = Date.now()
    const evidenceIds: string[] = []

    try {
      // Navigate to reports
      await this.page.goto('/reports')
      await this.page.waitForLoadState('networkidle')

      const loadEvidence = await this.evidence.captureEvidence(
        this.page,
        'reports',
        'load-page',
        { screenshot: true, timing_ms: Date.now() - startTime }
      )
      evidenceIds.push(loadEvidence.id)

      // Generate a test report
      await this.page.click('[data-testid="generate-report"]')
      await this.page.selectOption('[data-testid="report-type"]', 'performance')

      const generateEvidence = await this.evidence.captureEvidence(
        this.page,
        'reports',
        'select-report-type',
        { screenshot: true }
      )
      evidenceIds.push(generateEvidence.id)

      // Set date range
      await this.page.fill('[data-testid="report-start-date"]', '2026-01-01')
      await this.page.fill('[data-testid="report-end-date"]', '2026-02-13')

      const dateEvidence = await this.evidence.captureEvidence(
        this.page,
        'reports',
        'set-date-range',
        { screenshot: true }
      )
      evidenceIds.push(dateEvidence.id)

      // Run report
      await this.page.click('[data-testid="run-report"]')
      await this.page.waitForSelector('[data-testid="report-results"]', { timeout: 30000 })

      const resultsEvidence = await this.evidence.captureEvidence(
        this.page,
        'reports',
        'report-generated',
        { screenshot: true }
      )
      evidenceIds.push(resultsEvidence.id)

      const duration = Date.now() - startTime

      return {
        feature: 'reports',
        success: true,
        duration_ms: duration,
        evidence_ids: evidenceIds,
        notes: 'Report generated successfully'
      }
    } catch (error) {
      const duration = Date.now() - startTime

      const errorEvidence = await this.evidence.captureEvidence(
        this.page,
        'reports',
        'error',
        { error: error.message, screenshot: true }
      )
      evidenceIds.push(errorEvidence.id)

      return {
        feature: 'reports',
        success: false,
        duration_ms: duration,
        evidence_ids: evidenceIds,
        notes: `Reports test failed: ${error.message}`
      }
    }
  }

  /**
   * Run all enabled feature tests
   */
  async testAllFeatures(): Promise<FeatureTestResult[]> {
    const results: FeatureTestResult[] = []

    if (SIMULATOR_CONFIG.FEATURES.CALL_PLACEMENT) {
      results.push(await this.testCallPlacement())
    }

    if (SIMULATOR_CONFIG.FEATURES.TRANSCRIPTION) {
      results.push(await this.testTranscription())
    }

    if (SIMULATOR_CONFIG.FEATURES.ANALYTICS) {
      results.push(await this.testAnalytics())
    }

    if (SIMULATOR_CONFIG.FEATURES.CAMPAIGNS) {
      results.push(await this.testCampaigns())
    }

    if (SIMULATOR_CONFIG.FEATURES.REPORTS) {
      results.push(await this.testReports())
    }

    return results
  }
}