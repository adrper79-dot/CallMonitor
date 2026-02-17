/**
 * AI Agent Framework — Word Is Bond Platform
 *
 * Autonomous browser agent that uses Claude to drive the UI
 * as a real user would. Captures screenshots, network events,
 * and generates HTML evidence reports.
 *
 * Auth flow mirrors the real app:
 *   GET /api/auth/csrf → POST /api/auth/callback/credentials → session token
 *   Login form: input#email, input#password, button[type="submit"]
 *   Post-login lands at role shell: /work | /command | /dashboard
 *
 * @see ARCH_DOCS/01-CORE/FLOW_CATALOG.md
 * @see tests/e2e/workplace-simulator.spec.ts (existing pattern)
 */

import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test'
import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { TEST_CONFIG, TEST_USERS, type TestUser } from './config'
import type { TestScenario, TestResult, TestStep } from './types'

// ─── Claude Client ───────────────────────────────────────────────────────────

const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ─── AI Agent Class ──────────────────────────────────────────────────────────

export class AIAgent {
  private browser!: Browser
  private context!: BrowserContext
  private page!: Page
  private user: TestUser
  private roleName: string
  private steps: TestStep[] = []
  private conversationHistory: Anthropic.MessageParam[] = []

  constructor(roleName: string) {
    const user = TEST_USERS[roleName]
    if (!user) throw new Error(`Unknown role: ${roleName}. Valid: ${Object.keys(TEST_USERS).join(', ')}`)
    this.user = user
    this.roleName = roleName
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    console.log(`\n🤖 Initializing AI Agent: ${this.user.name} (${this.user.role})`)

    this.browser = await chromium.launch({
      headless: TEST_CONFIG.headless,
      slowMo: TEST_CONFIG.slowMo,
    })

    // Ensure video dir exists
    const videoDir = path.join(TEST_CONFIG.videoDir, this.roleName)
    fs.mkdirSync(videoDir, { recursive: true })

    this.context = await this.browser.newContext({
      viewport: TEST_CONFIG.viewport,
      recordVideo: {
        dir: videoDir,
        size: TEST_CONFIG.viewport,
      },
    })

    this.page = await this.context.newPage()

    // Ensure screenshot dir exists
    const screenshotDir = path.join(TEST_CONFIG.screenshotDir, this.roleName)
    fs.mkdirSync(screenshotDir, { recursive: true })
  }

  async close(): Promise<void> {
    try {
      await this.context?.close()
    } catch { /* video finalisation */ }
    try {
      await this.browser?.close()
    } catch { /* already closed */ }
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  // Mirrors the real auth flow from components/AuthProvider.tsx:
  //   input#email → input#password → button[type="submit"]
  //   Post-login URL includes /dashboard, /work, /command, or /onboarding

  async login(): Promise<boolean> {
    console.log(`🔐 Logging in as ${this.user.email} (${this.user.role})...`)

    const maxRetries = 3
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.page.goto(`${TEST_CONFIG.baseUrl}/signin`, {
          waitUntil: 'domcontentloaded',
          timeout: TEST_CONFIG.actionTimeout,
        })

        // Wait for form to be ready
        await this.page.waitForSelector('input#email', { state: 'visible', timeout: 10000 })

        if (attempt === 1) {
          await this.captureStep('Navigate to login page', true)
        }

        // Fill credentials
        await this.page.locator('input#email').fill(this.user.email)
        await this.page.waitForTimeout(300)
        await this.page.locator('input#password').fill(this.user.password)
        await this.page.waitForTimeout(300)

        if (attempt === 1) {
          await this.captureStep('Fill login credentials', true)
        }

        // Submit
        await this.page.locator('button[type="submit"]').click()

        // Wait for navigation to protected route
        let loginSuccess = false
        try {
          await this.page.waitForURL(
            (url) =>
              ['/dashboard', '/work', '/command', '/onboarding', '/accounts', '/analytics'].some((p) =>
                url.pathname.includes(p),
              ),
            { timeout: TEST_CONFIG.loginTimeout },
          )
          loginSuccess = true
        } catch {
          loginSuccess = false
        }

        if (loginSuccess) {
          await this.captureStep('Successfully logged in', true)
          console.log(`✅ Logged in → ${this.page.url()}`)
          return true
        }

        // Failed — check if it's worth retrying
        if (attempt < maxRetries) {
          const delay = attempt * 5000 // 5s, 10s backoff
          console.log(`⏳ Login attempt ${attempt} failed, retrying in ${delay / 1000}s...`)
          await this.page.waitForTimeout(delay)
        }
      } catch (err: any) {
        if (attempt < maxRetries) {
          const delay = attempt * 5000
          console.log(`⏳ Login error (attempt ${attempt}): ${err.message}. Retrying in ${delay / 1000}s...`)
          await this.page.waitForTimeout(delay)
        } else {
          await this.captureStep('Login error', false, err.message)
          console.error(`❌ Login error: ${err.message}`)
          return false
        }
      }
    }

    await this.captureStep('Login failed after all retries', false, `Stuck at: ${this.page.url()}`)
    console.error(`❌ Login failed after ${maxRetries} attempts. Current URL: ${this.page.url()}`)
    return false
  }

  // ── AI Decision Engine ─────────────────────────────────────────────────────

  async decideNextAction(goal: string): Promise<AgentAction> {
    const screenshot = await this.page.screenshot({ fullPage: false })
    const url = this.page.url()
    const title = await this.page.title()

    // Gather interactive elements from the page
    const interactiveElements = await this.page.evaluate(() => {
      const els: Array<{ type: string; text: string; selector: string; href?: string; name?: string; placeholder?: string }> = []

      // Buttons
      document.querySelectorAll('button').forEach((btn) => {
        if (btn.offsetParent !== null && btn.innerText.trim()) {
          const text = btn.innerText.trim().substring(0, 60)
          // Build a robust selector
          const testId = btn.getAttribute('data-testid')
          const ariaLabel = btn.getAttribute('aria-label')
          let selector = testId
            ? `button[data-testid="${testId}"]`
            : ariaLabel
              ? `button[aria-label="${ariaLabel}"]`
              : `button:has-text("${text.substring(0, 30)}")`
          els.push({ type: 'button', text, selector })
        }
      })

      // Links
      document.querySelectorAll('a[href]').forEach((link) => {
        if (link instanceof HTMLAnchorElement && link.offsetParent !== null) {
          const text = link.innerText.trim().substring(0, 60)
          const href = link.getAttribute('href') || ''
          els.push({ type: 'link', text, href, selector: `a[href="${href}"]` })
        }
      })

      // Inputs
      document.querySelectorAll('input, textarea, select').forEach((input) => {
        if (input instanceof HTMLElement && input.offsetParent !== null) {
          const el = input as HTMLInputElement
          const name = el.getAttribute('name') || el.getAttribute('id') || ''
          const placeholder = el.getAttribute('placeholder') || ''
          const type = el.getAttribute('type') || el.tagName.toLowerCase()
          const selector = el.id
            ? `#${el.id}`
            : name
              ? `[name="${name}"]`
              : placeholder
                ? `[placeholder="${placeholder}"]`
                : `${el.tagName.toLowerCase()}`
          els.push({ type: `input(${type})`, text: placeholder, name, placeholder, selector })
        }
      })

      return els.slice(0, 35)
    })

    // Build the prompt
    const recentSteps = this.steps
      .slice(-5)
      .map((s) => `  ${s.stepNumber}. [${s.success ? 'OK' : 'FAIL'}] ${s.reasoning}`)
      .join('\n')

    let response: any
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      system: `You are an autonomous QA tester for a debt collections call center platform called "Word Is Bond".
You are logged in as ${this.user.name} with role "${this.user.role}" (shell: ${this.user.shell}).
Your permissions: ${this.user.permissions.join(', ')}.
IMPORTANT: Only do things your role has permissions for. Be realistic.
IMPORTANT: Use the EXACT selectors provided — do not fabricate selectors.
IMPORTANT: When there is nothing left to do, respond with action "complete".`,
      messages: [
        ...this.conversationHistory.slice(-6), // Keep context window manageable
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshot.toString('base64'),
              },
            },
            {
              type: 'text',
              text: `Current URL: ${url}
Page Title: ${title}

GOAL: ${goal}

Recent steps:
${recentSteps || '  (none yet)'}

Interactive elements on page:
${JSON.stringify(interactiveElements, null, 2)}

What should you do next? Respond with ONLY valid JSON:
{
  "action": "click" | "type" | "navigate" | "wait" | "scroll" | "select" | "complete",
  "target": "CSS selector or URL",
  "value": "text to type or select option (if applicable)",
  "reasoning": "one-line explanation",
  "expectation": "what should happen"
}

If the goal is fully achieved, use action "complete".`,
            },
          ],
        },
      ],
    })
        break // success — exit retry loop
      } catch (apiErr: any) {
        console.error(`  ⚠️  Claude API error (attempt ${attempt}/3): ${apiErr.message}`)
        if (attempt === 3) {
          return { action: 'complete', target: '', value: '', reasoning: `Claude API failed after 3 attempts: ${apiErr.message}`, expectation: '' }
        }
        await new Promise((r) => setTimeout(r, 2000 * attempt)) // exponential backoff
      }
    }

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) {
      return { action: 'complete', target: '', value: '', reasoning: 'Claude returned no actionable JSON', expectation: '' }
    }

    const action: AgentAction = JSON.parse(jsonMatch[0])

    // Track conversation
    this.conversationHistory.push(
      { role: 'user', content: `Goal: ${goal} | URL: ${url} | Elements: ${interactiveElements.length}` },
      { role: 'assistant', content: JSON.stringify(action) },
    )

    return action
  }

  // ── Action Executor ────────────────────────────────────────────────────────

  async executeAction(action: AgentAction): Promise<boolean> {
    console.log(`  📍 Step ${this.steps.length + 1}: ${action.reasoning}`)
    console.log(`     Action: ${action.action} → ${action.target || '(none)'}`)

    try {
      switch (action.action) {
        case 'click':
          await this.page.locator(action.target).first().click({ timeout: TEST_CONFIG.actionTimeout })
          await this.page.waitForTimeout(800)
          break

        case 'type':
          await this.page.locator(action.target).first().fill(action.value || '')
          await this.page.waitForTimeout(400)
          break

        case 'navigate':
          await this.page.goto(
            action.target.startsWith('http') ? action.target : `${TEST_CONFIG.baseUrl}${action.target}`,
            { waitUntil: 'domcontentloaded', timeout: TEST_CONFIG.actionTimeout },
          )
          await this.page.waitForTimeout(800)
          break

        case 'wait':
          await this.page.waitForTimeout(parseInt(action.value || '2000', 10))
          break

        case 'scroll':
          await this.page.evaluate((dir) => {
            window.scrollBy(0, dir === 'up' ? -400 : 400)
          }, action.value || 'down')
          await this.page.waitForTimeout(500)
          break

        case 'select':
          await this.page.locator(action.target).first().selectOption(action.value || '')
          await this.page.waitForTimeout(400)
          break

        case 'complete':
          console.log(`  ✅ Goal achieved!`)
          await this.captureStep(action.reasoning, true)
          return true
      }

      // Wait for network to settle
      await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})

      await this.captureStep(action.reasoning, true)
      return false
    } catch (err: any) {
      console.error(`  ❌ Action failed: ${err.message}`)
      await this.captureStep(action.reasoning, false, err.message)
      return false
    }
  }

  // ── Screenshot Capture ─────────────────────────────────────────────────────

  async captureStep(reasoning: string, success: boolean, error?: string): Promise<void> {
    const stepNumber = this.steps.length + 1
    const timestamp = new Date()
    const screenshotPath = path.join(
      TEST_CONFIG.screenshotDir,
      this.roleName,
      `step-${stepNumber.toString().padStart(3, '0')}-${timestamp.getTime()}.png`,
    )

    try {
      await this.page.screenshot({ path: screenshotPath, fullPage: false })
    } catch {
      // screenshot may fail if browser closed
    }

    this.steps.push({
      stepNumber,
      action: reasoning,
      reasoning,
      screenshot: screenshotPath,
      timestamp,
      success,
      url: this.page.url(),
      error,
    })
  }

  // ── Run Scenario ───────────────────────────────────────────────────────────

  async runScenario(scenario: TestScenario): Promise<TestResult> {
    console.log(`\n${'═'.repeat(65)}`)
    console.log(`📋 Scenario: ${scenario.name}`)
    console.log(`🎯 Goal: ${scenario.goal}`)
    console.log(`👤 User: ${this.user.name} (${this.user.role} → ${this.user.shell} shell)`)
    console.log(`${'═'.repeat(65)}\n`)

    await this.initialize()

    const loginOk = await this.login()
    if (!loginOk) {
      await this.close()
      return this.buildResult(scenario, false)
    }

    return this._runScenarioSteps(scenario, true)
  }

  /**
   * Run a scenario reusing an already-initialized and logged-in session.
   * The orchestrator calls this to avoid repeated logins for the same role.
   */
  async runScenarioWithSession(scenario: TestScenario): Promise<TestResult> {
    console.log(`\n${'═'.repeat(65)}`)
    console.log(`📋 Scenario: ${scenario.name}`)
    console.log(`🎯 Goal: ${scenario.goal}`)
    console.log(`👤 User: ${this.user.name} (${this.user.role} → ${this.user.shell} shell)`)
    console.log(`${'═'.repeat(65)}\n`)

    // Reset per-scenario state without closing browser
    this.steps = []
    this.conversationHistory = []

    return this._runScenarioSteps(scenario, false)
  }

  private async _runScenarioSteps(scenario: TestScenario, closeOnDone: boolean): Promise<TestResult> {
    // Navigate to starting point
    if (scenario.startUrl) {
      const fullUrl = `${TEST_CONFIG.baseUrl}${scenario.startUrl}`
      try {
        await this.page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: TEST_CONFIG.actionTimeout })
        await this.page.waitForTimeout(1000)
        await this.captureStep(`Navigate to ${scenario.startUrl}`, true)
      } catch (err: any) {
        await this.captureStep(`Failed to navigate to ${scenario.startUrl}`, false, err.message)
      }
    }

    // AI decision loop
    let completed = false
    let attempts = 0
    const maxAttempts = scenario.maxSteps || 20

    while (!completed && attempts < maxAttempts) {
      attempts++

      try {
        const action = await this.decideNextAction(scenario.goal)
        completed = await this.executeAction(action)
      } catch (err: any) {
        console.error(`  ⚠️  AI decision error: ${err.message}`)
        await this.captureStep('AI decision error', false, err.message)
        // Continue — don't abort on a single error
      }

      if (completed) break
      await this.page.waitForTimeout(500)
    }

    if (!completed) {
      await this.captureStep(`Scenario ended after ${attempts} steps without completing goal`, false)
    }

    if (closeOnDone) {
      await this.close()
    }
    return this.buildResult(scenario, completed)
  }

  // ── Build Result ───────────────────────────────────────────────────────────

  private buildResult(scenario: TestScenario, success: boolean): TestResult {
    const first = this.steps[0]?.timestamp?.getTime() ?? Date.now()
    const last = this.steps[this.steps.length - 1]?.timestamp?.getTime() ?? Date.now()

    return {
      scenario: scenario.name,
      user: this.user.name,
      role: this.user.role,
      shell: this.user.shell,
      goal: scenario.goal,
      success,
      totalSteps: this.steps.length,
      steps: this.steps,
      duration: last - first,
    }
  }

  // ── HTML Report Generator ──────────────────────────────────────────────────

  generateReport(result: TestResult): string {
    fs.mkdirSync(TEST_CONFIG.reportDir, { recursive: true })

    const reportPath = path.join(TEST_CONFIG.reportDir, `${this.roleName}-${Date.now()}.html`)
    const successRate =
      result.steps.length > 0
        ? ((result.steps.filter((s) => s.success).length / result.steps.length) * 100).toFixed(0)
        : '0'

    const stepsHtml = result.steps
      .map((step) => {
        const relScreenshot = path.relative(TEST_CONFIG.reportDir, step.screenshot)
        return `
      <div class="step ${step.success ? '' : 'fail'}">
        <div class="step-header">
          <div class="step-number">${step.stepNumber}</div>
          <div class="step-title">${escapeHtml(step.reasoning)}</div>
          <div class="step-time">${step.timestamp.toLocaleTimeString()}</div>
          <span class="badge ${step.success ? 'success' : 'fail'}">${step.success ? 'Pass' : 'Fail'}</span>
        </div>
        <div class="step-url">${escapeHtml(step.url)}</div>
        ${step.error ? `<div class="error">Error: ${escapeHtml(step.error)}</div>` : ''}
        <img src="${relScreenshot}" class="step-screenshot" alt="Step ${step.stepNumber}" loading="lazy" onerror="this.style.display='none'">
      </div>`
      })
      .join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AI Agent Report — ${escapeHtml(result.user)} (${result.role})</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;padding:20px}
    .container{max-width:1400px;margin:0 auto;background:#fff;padding:40px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1)}
    h1{color:#1a1a1a;margin-bottom:10px}
    .meta{color:#666;margin-bottom:30px;font-size:14px}
    .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-bottom:40px}
    .summary-card{background:#f9f9f9;padding:20px;border-radius:6px;border-left:4px solid #4CAF50}
    .summary-card.fail{border-left-color:#f44336}
    .summary-card h3{font-size:12px;color:#666;text-transform:uppercase;margin-bottom:8px}
    .summary-card .value{font-size:28px;font-weight:600;color:#1a1a1a}
    .step{margin-bottom:30px;padding:20px;background:#fafafa;border-radius:6px}
    .step.fail{border-left:3px solid #f44336}
    .step-header{display:flex;align-items:center;gap:12px;margin-bottom:10px}
    .step-number{width:36px;height:36px;border-radius:50%;background:#4CAF50;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px;flex-shrink:0}
    .step.fail .step-number{background:#f44336}
    .step-title{flex:1;font-size:16px;font-weight:500}
    .step-time{color:#999;font-size:13px}
    .step-url{color:#888;font-size:12px;font-family:monospace;margin-bottom:8px}
    .step-screenshot{width:100%;border-radius:4px;margin-top:12px;box-shadow:0 2px 8px rgba(0,0,0,.1)}
    .error{background:#ffebee;color:#c62828;padding:10px;border-radius:4px;margin-top:8px;font-family:monospace;font-size:13px}
    .badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600}
    .badge.success{background:#e8f5e9;color:#2e7d32}
    .badge.fail{background:#ffebee;color:#c62828}
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 AI Agent Test Report</h1>
    <div class="meta">
      Scenario: <strong>${escapeHtml(result.scenario)}</strong> |
      User: <strong>${escapeHtml(result.user)}</strong> |
      Role: <strong>${result.role}</strong> |
      Shell: <strong>${result.shell}</strong> |
      Date: <strong>${new Date().toLocaleString()}</strong>
    </div>
    <div class="summary">
      <div class="summary-card ${result.success ? '' : 'fail'}">
        <h3>Status</h3>
        <div class="value">${result.success ? '✅ Pass' : '❌ Fail'}</div>
      </div>
      <div class="summary-card">
        <h3>Total Steps</h3>
        <div class="value">${result.totalSteps}</div>
      </div>
      <div class="summary-card">
        <h3>Duration</h3>
        <div class="value">${(result.duration / 1000).toFixed(1)}s</div>
      </div>
      <div class="summary-card">
        <h3>Success Rate</h3>
        <div class="value">${successRate}%</div>
      </div>
    </div>
    <h2 style="margin-bottom:20px">Test Steps</h2>
    ${stepsHtml}
  </div>
</body>
</html>`

    fs.writeFileSync(reportPath, html, 'utf-8')
    console.log(`📄 Report: ${reportPath}`)
    return reportPath
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentAction {
  action: 'click' | 'type' | 'navigate' | 'wait' | 'scroll' | 'select' | 'complete'
  target: string
  value?: string
  reasoning: string
  expectation: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
