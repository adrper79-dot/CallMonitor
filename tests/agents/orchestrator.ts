/**
 * Test Orchestrator — Word Is Bond AI Agent Testing System
 *
 * Runs all scenarios sequentially, captures results,
 * and generates a master HTML report linking to per-role reports.
 */

import { AIAgent } from './agent'
import { TEST_SCENARIOS } from './scenarios'
import { TEST_CONFIG, TEST_USERS } from './config'
import type { TestResult, OrchestratorResult } from './types'
import * as fs from 'node:fs'
import * as path from 'node:path'

export class TestOrchestrator {
  private scenarioFilter?: string[]

  constructor(opts?: { roles?: string[] }) {
    this.scenarioFilter = opts?.roles
  }

  async runAll(): Promise<OrchestratorResult> {
    const scenarios = this.scenarioFilter
      ? TEST_SCENARIOS.filter((s) => this.scenarioFilter!.includes(s.requiredRole))
      : TEST_SCENARIOS

    console.log(`\n${'═'.repeat(75)}`)
    console.log(`🚀 Word Is Bond — AI Agent Test Suite`)
    console.log(`📊 Scenarios: ${scenarios.length}`)
    console.log(`🌐 Target: ${TEST_CONFIG.baseUrl}`)
    console.log(`👥 Roles: ${[...new Set(scenarios.map((s) => s.requiredRole))].join(', ')}`)
    console.log(`${'═'.repeat(75)}\n`)

    const startTime = Date.now()
    const results: TestResult[] = []

    // Group scenarios by role to reuse browser session (login once per role)
    const roleGroups = new Map<string, typeof scenarios>()
    for (const scenario of scenarios) {
      const group = roleGroups.get(scenario.requiredRole) || []
      group.push(scenario)
      roleGroups.set(scenario.requiredRole, group)
    }

    for (const [role, roleScenarios] of roleGroups) {
      console.log(`\n🔑 Starting role group: ${role} (${roleScenarios.length} scenarios)\n`)
      const agent = new AIAgent(role)

      try {
        // Initialize browser + login once for this role
        await agent.initialize()
        const loginOk = await agent.login()

        if (!loginOk) {
          console.error(`❌ Login failed for role: ${role} — skipping all scenarios`)
          for (const scenario of roleScenarios) {
            results.push({
              scenario: scenario.name,
              user: TEST_USERS[role]?.name || 'unknown',
              role: role,
              shell: TEST_USERS[role]?.shell || 'agent',
              goal: scenario.goal,
              success: false,
              totalSteps: 0,
              steps: [],
              duration: 0,
              error: 'Login failed for role',
            })
          }
          continue
        }

        // Run all scenarios reusing the same session
        for (let i = 0; i < roleScenarios.length; i++) {
          const scenario = roleScenarios[i]
          await sleep(1500) // Brief pause between scenarios

          try {
            const result = await agent.runScenarioWithSession(scenario)
            const reportPath = agent.generateReport(result)
            results.push({ ...result, reportPath })
          } catch (err: any) {
            console.error(`❌ Scenario crashed: ${scenario.name}`, err.message)
            results.push({
              scenario: scenario.name,
              user: TEST_USERS[role]?.name || 'unknown',
              role: role,
              shell: TEST_USERS[role]?.shell || 'agent',
              goal: scenario.goal,
              success: false,
              totalSteps: 0,
              steps: [],
              duration: 0,
              error: err.message,
            })
          }
        }
      } catch (err: any) {
        console.error(`❌ Role group ${role} failed at init: ${err.message}`)
        // Mark all remaining scenarios for this role as failed
        for (const scenario of roleScenarios) {
          if (!results.find((r) => r.scenario === scenario.name)) {
            results.push({
              scenario: scenario.name,
              user: TEST_USERS[role]?.name || 'unknown',
              role: role,
              shell: TEST_USERS[role]?.shell || 'agent',
              goal: scenario.goal,
              success: false,
              totalSteps: 0,
              steps: [],
              duration: 0,
              error: err.message,
            })
          }
        }
      } finally {
        try { await agent.close() } catch { /* cleanup */ }
      }

      // Pause between role groups
      await sleep(3000)
    }

    const duration = Date.now() - startTime
    const passed = results.filter((r) => r.success).length
    const failed = results.length - passed

    const summary: OrchestratorResult = {
      totalScenarios: results.length,
      passed,
      failed,
      duration,
      results,
    }

    this.generateMasterReport(summary)
    this.generateJsonSummary(summary)

    console.log(`\n${'═'.repeat(75)}`)
    console.log(`📊 Suite Complete`)
    console.log(`   ✅ Passed: ${passed}/${results.length}`)
    console.log(`   ❌ Failed: ${failed}/${results.length}`)
    console.log(`   ⏱️  Duration: ${(duration / 60_000).toFixed(1)} minutes`)
    console.log(`${'═'.repeat(75)}\n`)

    return summary
  }

  // ── Master HTML Report ─────────────────────────────────────────────────────

  private generateMasterReport(summary: OrchestratorResult): void {
    fs.mkdirSync(TEST_CONFIG.reportDir, { recursive: true })
    const reportPath = path.join(TEST_CONFIG.reportDir, `master-report-${Date.now()}.html`)

    const rowsHtml = summary.results
      .map((r) => {
        const detailLink = r.reportPath
          ? `<a href="${path.relative(TEST_CONFIG.reportDir, r.reportPath)}">View</a>`
          : '—'
        const durationStr = r.duration ? `${(r.duration / 1000).toFixed(1)}s` : '—'

        return `<tr>
          <td><strong>${escapeHtml(r.scenario)}</strong><br><small style="color:#666">${escapeHtml(r.goal.substring(0, 80))}…</small></td>
          <td>${escapeHtml(r.user)}</td>
          <td><code>${r.role}</code></td>
          <td><code>${r.shell}</code></td>
          <td>${r.totalSteps}</td>
          <td>${durationStr}</td>
          <td><span class="badge ${r.success ? 'success' : 'fail'}">${r.success ? 'Pass' : 'Fail'}</span></td>
          <td>${detailLink}</td>
        </tr>`
      })
      .join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AI Agent Master Report — Word Is Bond</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;padding:20px}
    .container{max-width:1500px;margin:0 auto;background:#fff;padding:40px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1)}
    h1{color:#1a1a1a;margin-bottom:30px}
    .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-bottom:40px}
    .card{background:#f9f9f9;padding:20px;border-radius:6px;border-left:4px solid #4CAF50}
    .card.warn{border-left-color:#ff9800}
    .card.fail{border-left-color:#f44336}
    .card h3{font-size:12px;color:#666;text-transform:uppercase;margin-bottom:8px}
    .card .value{font-size:32px;font-weight:600}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    th,td{padding:12px;text-align:left;border-bottom:1px solid #eee}
    th{background:#f5f5f5;font-weight:600;font-size:13px}
    .badge{padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600}
    .badge.success{background:#e8f5e9;color:#2e7d32}
    .badge.fail{background:#ffebee;color:#c62828}
    a{color:#1976d2;text-decoration:none}
    a:hover{text-decoration:underline}
    code{background:#f0f0f0;padding:2px 6px;border-radius:3px;font-size:12px}
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 AI Agent Master Test Report — Word Is Bond</h1>
    <p style="color:#666;margin-bottom:30px">Generated: ${new Date().toLocaleString()} | Target: ${TEST_CONFIG.baseUrl}</p>

    <div class="summary">
      <div class="card">
        <h3>Total Tests</h3>
        <div class="value">${summary.totalScenarios}</div>
      </div>
      <div class="card">
        <h3>Passed</h3>
        <div class="value" style="color:#2e7d32">${summary.passed}</div>
      </div>
      <div class="card ${summary.failed > 0 ? 'fail' : ''}">
        <h3>Failed</h3>
        <div class="value" style="color:${summary.failed > 0 ? '#c62828' : '#2e7d32'}">${summary.failed}</div>
      </div>
      <div class="card">
        <h3>Duration</h3>
        <div class="value">${(summary.duration / 60_000).toFixed(1)}m</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Scenario</th>
          <th>User</th>
          <th>Role</th>
          <th>Shell</th>
          <th>Steps</th>
          <th>Duration</th>
          <th>Status</th>
          <th>Report</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>
</body>
</html>`

    fs.writeFileSync(reportPath, html, 'utf-8')
    console.log(`📊 Master report: ${reportPath}`)
  }

  // ── JSON Summary ───────────────────────────────────────────────────────────

  private generateJsonSummary(summary: OrchestratorResult): void {
    const jsonPath = path.join(TEST_CONFIG.reportDir, `agent-test-summary-${Date.now()}.json`)
    const jsonData = {
      timestamp: new Date().toISOString(),
      baseUrl: TEST_CONFIG.baseUrl,
      totalScenarios: summary.totalScenarios,
      passed: summary.passed,
      failed: summary.failed,
      durationMs: summary.duration,
      results: summary.results.map((r) => ({
        scenario: r.scenario,
        role: r.role,
        shell: r.shell,
        success: r.success,
        totalSteps: r.totalSteps,
        durationMs: r.duration,
        error: r.error,
      })),
    }
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8')
    console.log(`📋 JSON summary: ${jsonPath}`)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
