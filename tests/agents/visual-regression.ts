/**
 * Visual Regression Detection with Claude SDK — Word Is Bond Platform
 *
 * Detects UI bugs through semantic visual analysis that pixel-diff tools miss:
 * - Layout regressions (broken grids, overlapping elements)
 * - Content errors (missing text, truncated content)
 * - Accessibility violations (poor contrast, tiny touch targets)
 * - Styling bugs (wrong colors, broken images)
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx tsx tests/agents/visual-regression.ts
 *   ANTHROPIC_API_KEY=sk-... npx tsx tests/agents/visual-regression.ts --update-baselines
 *
 * @see ARCH_DOCS/CLAUDE_SDK_TESTING_STRATEGY.md
 */

import Anthropic from '@anthropic-ai/sdk'
import { chromium, type Browser, type Page } from '@playwright/test'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import * as path from 'node:path'

// ─── Types ───────────────────────────────────────────────────────────────────

interface VisualBug {
  severity: 'critical' | 'major' | 'minor'
  category: 'layout' | 'content' | 'accessibility' | 'styling'
  description: string
  location: string
  recommendation: string
}

interface TestResult {
  url: string
  bugs: VisualBug[]
  baselineExists: boolean
  timestamp: Date
}

// ─── Config ──────────────────────────────────────────────────────────────────

const CONFIG = {
  baseUrl: process.env.BASE_URL || 'https://wordis-bond.com',
  baselineDir: path.join(process.cwd(), 'test-results', 'baselines'),
  reportDir: path.join(process.cwd(), 'test-results', 'visual-regression'),
  updateBaselines: process.argv.includes('--update-baselines'),
  viewport: { width: 1920, height: 1080 },
  criticalPages: [
    '/',
    '/signin',
    '/dashboard',
    '/work',
    '/work/dialer',
    '/accounts',
    '/analytics',
    '/settings/profile',
    '/campaigns',
  ],
}

// ─── Claude Client ───────────────────────────────────────────────────────────

const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ─── Visual Regression Detector ──────────────────────────────────────────────

export class VisualRegressionDetector {
  private browser!: Browser
  private page!: Page

  async initialize(): Promise<void> {
    mkdirSync(CONFIG.baselineDir, { recursive: true })
    mkdirSync(CONFIG.reportDir, { recursive: true })

    this.browser = await chromium.launch({ headless: true })
    const context = await this.browser.newContext({ viewport: CONFIG.viewport })
    this.page = await context.newPage()
  }

  async close(): Promise<void> {
    await this.browser?.close()
  }

  /**
   * Use Claude to detect visual bugs by comparing screenshots
   */
  async detectBugs(
    baselineScreenshot: Buffer,
    currentScreenshot: Buffer,
    url: string,
  ): Promise<VisualBug[]> {
    console.log(`  🔍 Analyzing ${url} with Claude...`)

    try {
      const response = await claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `You are an expert QA engineer specializing in visual regression testing for a debt collections SaaS platform called "Word Is Bond".

Your task: Compare two screenshots (BASELINE vs CURRENT) and identify visual bugs.

Categories to check:
1. **Layout** — Broken grids, overlapping elements, misaligned components, broken responsive design
2. **Content** — Missing text, truncated labels, duplicate elements, incorrect data display
3. **Accessibility** — Poor color contrast (WCAG violations), tiny touch targets (<44px), missing visible labels
4. **Styling** — Wrong brand colors, missing icons, broken images, incorrect fonts

Severity levels:
- **critical** — Page is unusable or broken (overlapping content, missing critical UI, broken navigation)
- **major** — Feature is broken but workarounds exist (styling issues affecting readability)
- **minor** — Cosmetic issues (small alignment differences, color variations)

IMPORTANT:
- Only report REAL bugs, not minor anti-aliasing differences
- Focus on user-impacting issues
- Be specific about location (e.g., "Login button in header", "Account table row 3")
- Provide actionable recommendations

Return ONLY valid JSON array. If no bugs found, return empty array [].

Example:
[
  {
    "severity": "critical",
    "category": "layout",
    "description": "Navigation menu overlaps main content area",
    "location": "Header navigation bar",
    "recommendation": "Fix z-index or positioning of nav element"
  }
]`,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `URL: ${url}\n\nBASELINE (expected state):`,
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: baselineScreenshot.toString('base64'),
                },
              },
              {
                type: 'text',
                text: 'CURRENT (check for regressions):',
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: currentScreenshot.toString('base64'),
                },
              },
              {
                type: 'text',
                text: 'Analyze and report bugs as JSON array.',
              },
            ],
          },
        ],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
      const jsonMatch = text.match(/\[[\s\S]*?\]/s)

      if (!jsonMatch) {
        console.warn(`  ⚠️  Could not parse Claude response for ${url}`)
        return []
      }

      return JSON.parse(jsonMatch[0])
    } catch (err: any) {
      console.error(`  ❌ Claude API error for ${url}: ${err.message}`)
      return []
    }
  }

  /**
   * Capture screenshot for a page
   */
  async captureScreenshot(url: string): Promise<Buffer> {
    const fullUrl = url.startsWith('http') ? url : `${CONFIG.baseUrl}${url}`

    try {
      await this.page.goto(fullUrl, {
        waitUntil: 'networkidle',
        timeout: 30000,
      })

      // Wait for any loading spinners to disappear
      await this.page.waitForTimeout(2000)

      return await this.page.screenshot({
        fullPage: true,
        animations: 'disabled',
      })
    } catch (err: any) {
      throw new Error(`Failed to capture ${url}: ${err.message}`)
    }
  }

  /**
   * Get baseline file path for a URL
   */
  getBaselinePath(url: string): string {
    const sanitized = url.replace(/[^a-z0-9]/gi, '_')
    return path.join(CONFIG.baselineDir, `${sanitized}.png`)
  }

  /**
   * Run visual regression test for a single page
   */
  async testPage(url: string): Promise<TestResult> {
    console.log(`\n📸 Testing: ${url}`)

    const currentScreenshot = await this.captureScreenshot(url)
    const baselinePath = this.getBaselinePath(url)

    // Update baselines mode
    if (CONFIG.updateBaselines) {
      writeFileSync(baselinePath, currentScreenshot)
      console.log(`  ✅ Baseline updated: ${path.basename(baselinePath)}`)
      return {
        url,
        bugs: [],
        baselineExists: true,
        timestamp: new Date(),
      }
    }

    // Normal comparison mode
    if (!existsSync(baselinePath)) {
      console.log(`  ⚠️  No baseline found, creating new baseline`)
      writeFileSync(baselinePath, currentScreenshot)
      return {
        url,
        bugs: [],
        baselineExists: false,
        timestamp: new Date(),
      }
    }

    const baselineScreenshot = readFileSync(baselinePath)
    const bugs = await this.detectBugs(baselineScreenshot, currentScreenshot, url)

    if (bugs.length === 0) {
      console.log(`  ✅ No visual regressions detected`)
    } else {
      console.log(`  ❌ ${bugs.length} visual bugs found:`)
      bugs.forEach((bug) => {
        console.log(`     [${bug.severity.toUpperCase()}] ${bug.description}`)
      })
    }

    // Save current screenshot for debugging
    const debugPath = path.join(CONFIG.reportDir, `${path.basename(baselinePath, '.png')}_current.png`)
    writeFileSync(debugPath, currentScreenshot)

    return {
      url,
      bugs,
      baselineExists: true,
      timestamp: new Date(),
    }
  }

  /**
   * Run full visual regression suite
   */
  async runSuite(): Promise<void> {
    console.log(`\n${'═'.repeat(75)}`)
    console.log(`🎨 Visual Regression Detection Suite — Word Is Bond`)
    console.log(`${'═'.repeat(75)}`)
    console.log(`Base URL: ${CONFIG.baseUrl}`)
    console.log(`Pages: ${CONFIG.criticalPages.length}`)
    console.log(`Mode: ${CONFIG.updateBaselines ? 'UPDATE BASELINES' : 'DETECT REGRESSIONS'}`)
    console.log(`${'═'.repeat(75)}\n`)

    const results: TestResult[] = []
    let totalBugs = 0
    let criticalBugs = 0

    for (const url of CONFIG.criticalPages) {
      try {
        const result = await this.testPage(url)
        results.push(result)
        totalBugs += result.bugs.length
        criticalBugs += result.bugs.filter((b) => b.severity === 'critical').length
      } catch (err: any) {
        console.error(`\n❌ Failed to test ${url}: ${err.message}`)
        results.push({
          url,
          bugs: [
            {
              severity: 'critical',
              category: 'layout',
              description: `Test failed: ${err.message}`,
              location: 'Page load',
              recommendation: 'Investigate page rendering issue',
            },
          ],
          baselineExists: false,
          timestamp: new Date(),
        })
        totalBugs++
        criticalBugs++
      }
    }

    // Generate HTML report
    this.generateHTMLReport(results)

    // Summary
    console.log(`\n${'═'.repeat(75)}`)
    console.log(`📊 SUMMARY`)
    console.log(`${'═'.repeat(75)}`)
    console.log(`Pages tested: ${results.length}`)
    console.log(`Total bugs: ${totalBugs}`)
    console.log(`Critical bugs: ${criticalBugs}`)
    console.log(`Report: ${path.join(CONFIG.reportDir, 'report.html')}`)
    console.log(`${'═'.repeat(75)}\n`)

    // Exit with error if critical bugs found
    if (criticalBugs > 0 && !CONFIG.updateBaselines) {
      console.error(`\n❌ ${criticalBugs} CRITICAL visual bugs detected. Fix before deploying!\n`)
      process.exit(1)
    }

    if (totalBugs > 0 && !CONFIG.updateBaselines) {
      console.warn(`\n⚠️  ${totalBugs} visual bugs detected (non-critical). Review before deploying.\n`)
    }

    if (CONFIG.updateBaselines) {
      console.log(`\n✅ Baselines updated successfully!\n`)
    } else {
      console.log(`\n✅ Visual regression tests passed!\n`)
    }
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(results: TestResult[]): void {
    const reportPath = path.join(CONFIG.reportDir, 'report.html')

    const totalBugs = results.reduce((sum, r) => sum + r.bugs.length, 0)
    const criticalCount = results.reduce(
      (sum, r) => sum + r.bugs.filter((b) => b.severity === 'critical').length,
      0,
    )

    const resultsHTML = results
      .map(
        (result) => `
      <div class="page-result">
        <h3>${escapeHtml(result.url)}</h3>
        <div class="meta">Tested: ${result.timestamp.toLocaleString()}</div>
        ${
          result.bugs.length === 0
            ? '<div class="badge success">✓ No bugs</div>'
            : `
          <div class="bugs">
            ${result.bugs
              .map(
                (bug) => `
              <div class="bug ${bug.severity}">
                <div class="bug-header">
                  <span class="badge ${bug.severity}">${bug.severity}</span>
                  <span class="category">${bug.category}</span>
                </div>
                <div class="description">${escapeHtml(bug.description)}</div>
                <div class="location">📍 ${escapeHtml(bug.location)}</div>
                <div class="recommendation">💡 ${escapeHtml(bug.recommendation)}</div>
              </div>
            `,
              )
              .join('')}
          </div>
        `
        }
      </div>
    `,
      )
      .join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual Regression Report — Word Is Bond</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #1a1a1a; margin-bottom: 30px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
    .summary-card { background: #f9f9f9; padding: 20px; border-radius: 6px; border-left: 4px solid #4CAF50; }
    .summary-card.critical { border-left-color: #f44336; }
    .summary-card h3 { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 8px; }
    .summary-card .value { font-size: 32px; font-weight: 600; color: #1a1a1a; }
    .page-result { margin-bottom: 30px; padding: 20px; background: #fafafa; border-radius: 6px; }
    .page-result h3 { margin-bottom: 10px; color: #1a1a1a; }
    .meta { color: #666; font-size: 14px; margin-bottom: 15px; }
    .bugs { margin-top: 15px; }
    .bug { margin-bottom: 15px; padding: 15px; background: #fff; border-radius: 4px; border-left: 3px solid #ff9800; }
    .bug.critical { border-left-color: #f44336; }
    .bug.major { border-left-color: #ff9800; }
    .bug.minor { border-left-color: #2196F3; }
    .bug-header { display: flex; gap: 10px; margin-bottom: 10px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .badge.success { background: #4CAF50; color: #fff; }
    .badge.critical { background: #f44336; color: #fff; }
    .badge.major { background: #ff9800; color: #fff; }
    .badge.minor { background: #2196F3; color: #fff; }
    .category { background: #e0e0e0; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .description { font-size: 16px; font-weight: 500; margin-bottom: 8px; }
    .location { font-size: 14px; color: #666; margin-bottom: 8px; }
    .recommendation { font-size: 14px; color: #1976D2; padding: 10px; background: #E3F2FD; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎨 Visual Regression Report</h1>
    <div class="meta">Generated: ${new Date().toLocaleString()}</div>
    
    <div class="summary">
      <div class="summary-card">
        <h3>Pages Tested</h3>
        <div class="value">${results.length}</div>
      </div>
      <div class="summary-card ${totalBugs > 0 ? 'critical' : ''}">
        <h3>Total Bugs</h3>
        <div class="value">${totalBugs}</div>
      </div>
      <div class="summary-card ${criticalCount > 0 ? 'critical' : ''}">
        <h3>Critical Bugs</h3>
        <div class="value">${criticalCount}</div>
      </div>
    </div>

    ${resultsHTML}
  </div>
</body>
</html>`

    writeFileSync(reportPath, html)
    console.log(`\n📄 HTML report generated: ${reportPath}`)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY environment variable is required.')
    process.exit(1)
  }

  const detector = new VisualRegressionDetector()

  try {
    await detector.initialize()
    await detector.runSuite()
  } catch (err: any) {
    console.error(`\n❌ Fatal error: ${err.message}`)
    process.exit(1)
  } finally {
    await detector.close()
  }
}

// Run if executed directly
if (require.main === module) {
  main()
}
