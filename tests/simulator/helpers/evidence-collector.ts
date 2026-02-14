/**
 * Evidence Collector — Workplace Person Simulator
 * Captures screenshots, timings, and metadata for comprehensive test evidence
 */

import { Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { SIMULATOR_CONFIG } from '../config'

export interface EvidenceItem {
  id: string
  timestamp: string
  step: string
  action: string
  screenshot?: string
  timing_ms?: number
  error?: string
  metadata?: Record<string, any>
  url?: string
  user_agent?: string
  viewport?: { width: number; height: number }
}

export interface KinkDetection {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'ui' | 'ux' | 'validation' | 'performance' | 'broken_flow'
  description: string
  evidence_id: string
  recommendation: string
  detected_at: string
}

export class EvidenceCollector {
  private evidence: EvidenceItem[] = []
  private kinks: KinkDetection[] = []
  private screenshotsDir: string
  private testId: string
  private startTime: number

  constructor(testId: string) {
    this.testId = testId
    this.startTime = Date.now()
    this.screenshotsDir = path.join(process.cwd(), 'test-results', 'simulator-screenshots', testId)
    fs.mkdirSync(this.screenshotsDir, { recursive: true })
  }

  /**
   * Capture evidence for a specific action
   */
  async captureEvidence(
    page: Page,
    step: string,
    action: string,
    options: {
      screenshot?: boolean
      timing_ms?: number
      error?: string
      metadata?: Record<string, any>
    } = {}
  ): Promise<EvidenceItem> {
    const evidenceId = `${step}-${action}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const timestamp = new Date().toISOString()

    const evidence: EvidenceItem = {
      id: evidenceId,
      timestamp,
      step,
      action,
      timing_ms: options.timing_ms,
      error: options.error,
      metadata: options.metadata,
      url: page.url(),
      user_agent: await page.evaluate(() => navigator.userAgent),
      viewport: await page.viewportSize() || { width: 1280, height: 720 }
    }

    // Capture screenshot if requested
    if (options.screenshot && SIMULATOR_CONFIG.EVIDENCE.SCREENSHOT_ON_STEP) {
      const screenshotName = `${evidenceId}.png`
      const screenshotPath = path.join(this.screenshotsDir, screenshotName)

      try {
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
          type: 'png',
          quality: 80
        })
        evidence.screenshot = screenshotPath
      } catch (error) {
        console.warn(`Failed to capture screenshot: ${error.message}`)
        evidence.metadata = {
          ...evidence.metadata,
          screenshot_error: error.message
        }
      }
    }

    // Capture screenshot on error
    if (options.error && SIMULATOR_CONFIG.EVIDENCE.SCREENSHOT_ON_ERROR) {
      const errorScreenshotName = `${evidenceId}-error.png`
      const errorScreenshotPath = path.join(this.screenshotsDir, errorScreenshotName)

      try {
        await page.screenshot({
          path: errorScreenshotPath,
          fullPage: true,
          type: 'png'
        })
        evidence.metadata = {
          ...evidence.metadata,
          error_screenshot: errorScreenshotPath
        }
      } catch (screenshotError) {
        console.warn(`Failed to capture error screenshot: ${screenshotError.message}`)
      }
    }

    // Add performance metadata
    if (SIMULATOR_CONFIG.EVIDENCE.TIMING_TRACKING) {
      const performanceEntries = await page.evaluate(() =>
        performance.getEntriesByType('navigation')
      )
      if (performanceEntries.length > 0) {
        const navEntry = performanceEntries[0] as PerformanceNavigationTiming
        evidence.metadata = {
          ...evidence.metadata,
          dom_content_loaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
          load_complete: navEntry.loadEventEnd - navEntry.loadEventStart,
          total_time: Date.now() - this.startTime
        }
      }
    }

    // Add metadata about page state
    if (SIMULATOR_CONFIG.EVIDENCE.METADATA_CAPTURE) {
      evidence.metadata = {
        ...evidence.metadata,
        ...(await this.capturePageState(page))
      }
    }

    this.evidence.push(evidence)

    // Auto-detect kinks
    this.detectKinksFromEvidence(evidence)

    return evidence
  }

  /**
   * Capture current page state for metadata
   */
  private async capturePageState(page: Page): Promise<Record<string, any>> {
    try {
      const state = await page.evaluate(() => {
        const meta = {
          title: document.title,
          url: window.location.href,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          },
          elements: {
            total: document.querySelectorAll('*').length,
            forms: document.querySelectorAll('form').length,
            buttons: document.querySelectorAll('button').length,
            inputs: document.querySelectorAll('input').length,
            links: document.querySelectorAll('a').length
          },
          scripts: document.querySelectorAll('script').length,
          stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
          has_errors: document.querySelectorAll('.error, [data-error]').length > 0,
          loading_elements: document.querySelectorAll('[aria-busy="true"], .loading, .spinner').length
        }

        // Check for common UI issues
        const issues = []
        if (document.querySelectorAll('[aria-invalid="true"]').length > 0) {
          issues.push('form_validation_errors')
        }
        if (document.querySelectorAll('[aria-hidden="true"]').length > document.querySelectorAll('[aria-hidden="false"]').length * 2) {
          issues.push('excessive_hidden_content')
        }
        if (document.querySelectorAll('img[alt=""]').length > 0) {
          issues.push('missing_alt_text')
        }

        return { ...meta, potential_issues: issues }
      })

      return state
    } catch (error) {
      return { page_state_error: error.message }
    }
  }

  /**
   * Auto-detect kinks from evidence
   */
  private detectKinksFromEvidence(evidence: EvidenceItem): void {
    const kinkId = `kink-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Performance kinks
    if (evidence.timing_ms && evidence.timing_ms > SIMULATOR_CONFIG.KINK_THRESHOLDS.SLOW_OPERATION_MS) {
      const severity = evidence.timing_ms > SIMULATOR_CONFIG.KINK_THRESHOLDS.VERY_SLOW_OPERATION_MS ? 'high' : 'medium'
      this.kinks.push({
        id: kinkId,
        severity,
        category: 'performance',
        description: `Slow operation: ${evidence.action} took ${evidence.timing_ms}ms`,
        evidence_id: evidence.id,
        recommendation: 'Optimize loading times, consider lazy loading, or add progress indicators',
        detected_at: evidence.timestamp
      })
    }

    // Error kinks
    if (evidence.error) {
      this.kinks.push({
        id: kinkId,
        severity: 'high',
        category: 'broken_flow',
        description: `Error in ${evidence.step}: ${evidence.error}`,
        evidence_id: evidence.id,
        recommendation: 'Fix error handling, add proper validation, and improve error messages',
        detected_at: evidence.timestamp
      })
    }

    // UI kinks
    if (evidence.metadata?.potential_issues?.includes('missing_alt_text')) {
      this.kinks.push({
        id: kinkId,
        severity: 'low',
        category: 'ui',
        description: 'Images missing alt text for accessibility',
        evidence_id: evidence.id,
        recommendation: 'Add descriptive alt text to all images',
        detected_at: evidence.timestamp
      })
    }

    if (evidence.metadata?.potential_issues?.includes('form_validation_errors')) {
      this.kinks.push({
        id: kinkId,
        severity: 'medium',
        category: 'validation',
        description: 'Form validation errors present on page',
        evidence_id: evidence.id,
        recommendation: 'Review form validation logic and error messaging',
        detected_at: evidence.timestamp
      })
    }

    // UX kinks
    if (evidence.metadata?.loading_elements > 0 && evidence.timing_ms && evidence.timing_ms > 3000) {
      this.kinks.push({
        id: kinkId,
        severity: 'medium',
        category: 'ux',
        description: 'Long loading states without clear feedback',
        evidence_id: evidence.id,
        recommendation: 'Add skeleton loaders or progress indicators for long operations',
        detected_at: evidence.timestamp
      })
    }
  }

  /**
   * Get all collected evidence
   */
  getEvidence(): EvidenceItem[] {
    return [...this.evidence]
  }

  /**
   * Get detected kinks
   */
  getKinks(): KinkDetection[] {
    return [...this.kinks]
  }

  /**
   * Generate evidence summary
   */
  getSummary(): {
    total_evidence: number
    total_kinks: number
    kinks_by_severity: Record<string, number>
    kinks_by_category: Record<string, number>
    average_timing_ms: number
    error_count: number
  } {
    const timings = this.evidence
      .map(e => e.timing_ms)
      .filter(t => t !== undefined) as number[]

    const kinksBySeverity = this.kinks.reduce((acc, kink) => {
      acc[kink.severity] = (acc[kink.severity] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const kinksByCategory = this.kinks.reduce((acc, kink) => {
      acc[kink.category] = (acc[kink.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      total_evidence: this.evidence.length,
      total_kinks: this.kinks.length,
      kinks_by_severity: kinksBySeverity,
      kinks_by_category: kinksByCategory,
      average_timing_ms: timings.length > 0 ? timings.reduce((a, b) => a + b, 0) / timings.length : 0,
      error_count: this.evidence.filter(e => e.error).length
    }
  }

  /**
   * Export evidence to JSON file
   */
  exportToFile(outputPath?: string): string {
    const exportPath = outputPath || path.join(process.cwd(), 'test-results', 'simulator-evidence', `${this.testId}.json`)
    fs.mkdirSync(path.dirname(exportPath), { recursive: true })

    const exportData = {
      test_id: this.testId,
      generated_at: new Date().toISOString(),
      summary: this.getSummary(),
      evidence: this.evidence,
      kinks: this.kinks
    }

    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2))
    return exportPath
  }
}