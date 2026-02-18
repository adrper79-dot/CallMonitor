/**
 * Validation Orchestrator — Word Is Bond Platform
 *
 * Runs all validation agents sequentially, collects findings,
 * and produces a consolidated report (JSON + HTML).
 *
 * Architecture (adapted from Claude suggestion → ARCH_DOCS standards):
 *
 *   Orchestrator
 *     ├─ Technical Validation
 *     │   ├─ API Health Agent         → latency baselines, service health
 *     │   ├─ API Coverage Agent       → all routes exist and respond
 *     │   └─ Security Auditor         → tenant isolation, RBAC, SQL safety
 *     │
 *     ├─ Compliance Validation
 *     │   ├─ Reg F Agent              → 6 FDCPA enforcement points
 *     │   ├─ TCPA Agent               → DNC, consent, caller ID
 *     │   └─ Audit Completeness       → all mutations logged
 *     │
 *     └─ Architecture Validation
 *         ├─ ARCH_DOCS Alignment      → version, count, freshness
 *         ├─ Integration Health       → 12 provider checks
 *         └─ Flow Completeness        → BF/WF flows ↔ routes/pages
 *
 * TOGAF Phase: G — Implementation Governance
 * @see ARCH_DOCS/VALIDATION_PLAN.md
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { VAL_CONFIG } from './config'
import type {
  ValidationAgent,
  ValidationContext,
  ValidationSummary,
  ValidationFinding,
  AgentResult,
} from './types'

// ─── Import All Agents ───────────────────────────────────────────────────────

import { apiHealthAgent } from './agents/api-health'
import { apiCoverageAgent } from './agents/api-coverage'
import { securityAuditAgent } from './agents/security-audit'
import { complianceRegFAgent } from './agents/compliance-regf'
import { complianceTcpaAgent } from './agents/compliance-tcpa'
import { auditCompletenessAgent } from './agents/audit-completeness'
import { archAlignmentAgent } from './agents/arch-alignment'
import { integrationHealthAgent } from './agents/integration-health'
import { flowCompletenessAgent } from './agents/flow-completeness'

// ─── Agent Registry ──────────────────────────────────────────────────────────

const ALL_AGENTS: ValidationAgent[] = [
  // Technical
  apiHealthAgent,
  apiCoverageAgent,
  securityAuditAgent,
  // Compliance
  complianceRegFAgent,
  complianceTcpaAgent,
  auditCompletenessAgent,
  // Architecture
  archAlignmentAgent,
  integrationHealthAgent,
  flowCompletenessAgent,
]

// ─── Orchestrator ────────────────────────────────────────────────────────────

export async function runValidation(opts?: { domains?: string[] }): Promise<ValidationSummary> {
  const start = Date.now()

  console.log(`\n${'═'.repeat(75)}`)
  console.log(`🔍 Word Is Bond — Comprehensive Validation Framework`)
  console.log(`📡 API: ${VAL_CONFIG.apiUrl}`)
  console.log(`🌐 UI:  ${VAL_CONFIG.uiUrl}`)
  console.log(`${'═'.repeat(75)}\n`)

  // ── Auth ─────────────────────────────────────────────────────────────────
  let authToken: string | null = null
  try {
    console.log('🔐 Authenticating...')
    authToken = await getAuthToken()
    if (authToken) {
      console.log('✅ Authenticated\n')
    } else {
      console.log('⚠️  Auth failed — running unauthenticated checks only\n')
    }
  } catch (err: any) {
    console.log(`⚠️  Auth error: ${err.message} — continuing without auth\n`)
  }

  const ctx: ValidationContext = {
    apiUrl: VAL_CONFIG.apiUrl,
    uiUrl: VAL_CONFIG.uiUrl,
    authToken,
    workspaceRoot: VAL_CONFIG.workspaceRoot,
  }

  // ── Filter agents if requested ───────────────────────────────────────────
  const agents = opts?.domains
    ? ALL_AGENTS.filter(a => opts.domains!.includes(a.domain))
    : ALL_AGENTS

  console.log(`📋 Running ${agents.length} validation agents:\n`)
  for (const agent of agents) {
    console.log(`   • ${agent.name} (${agent.domain})`)
  }
  console.log('')

  // ── Run each agent sequentially ──────────────────────────────────────────
  const results: AgentResult[] = []

  for (const agent of agents) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`▶ ${agent.name}`)
    console.log(`  ${agent.description}`)

    try {
      const result = await agent.run(ctx)
      results.push(result)

      const icon = result.failed > 0 ? '❌' : result.warnings > 0 ? '⚠️' : '✅'
      console.log(`${icon} ${agent.name}: ${result.passed} passed, ${result.failed} failed, ${result.warnings} warnings (${result.durationMs}ms)`)

      // Print critical/high findings immediately
      for (const f of result.findings) {
        if (f.severity === 'critical') {
          console.log(`   🔴 CRITICAL: ${f.title}`)
        } else if (f.severity === 'high') {
          console.log(`   🟠 HIGH: ${f.title}`)
        }
      }
    } catch (err: any) {
      console.error(`💥 ${agent.name} crashed: ${err.message}`)
      results.push({
        domain: agent.domain,
        agentName: agent.name,
        passed: 0,
        failed: 1,
        warnings: 0,
        findings: [{
          domain: agent.domain,
          severity: 'critical',
          title: `Agent crashed: ${agent.name}`,
          detail: err.message,
        }],
        durationMs: 0,
      })
    }
  }

  // ── Compile Summary ──────────────────────────────────────────────────────
  const allFindings: ValidationFinding[] = results.flatMap(r => r.findings)
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0)
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0)
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings, 0)

  const summary: ValidationSummary = {
    timestamp: new Date().toISOString(),
    version: 'v5.3',
    targetApi: VAL_CONFIG.apiUrl,
    targetUi: VAL_CONFIG.uiUrl,
    totalAgents: agents.length,
    totalChecks: totalPassed + totalFailed + totalWarnings,
    totalPassed,
    totalFailed,
    totalWarnings,
    criticalFindings: allFindings.filter(f => f.severity === 'critical').length,
    highFindings: allFindings.filter(f => f.severity === 'high').length,
    durationMs: Date.now() - start,
    agentResults: results,
    allFindings,
  }

  // ── Output ───────────────────────────────────────────────────────────────
  fs.mkdirSync(VAL_CONFIG.reportDir, { recursive: true })

  // JSON report
  const jsonPath = path.join(VAL_CONFIG.reportDir, `validation-${Date.now()}.json`)
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf-8')

  // HTML report
  const htmlPath = path.join(VAL_CONFIG.reportDir, `validation-${Date.now()}.html`)
  fs.writeFileSync(htmlPath, generateHtml(summary), 'utf-8')

  // Console summary
  console.log(`\n${'═'.repeat(75)}`)
  console.log(`📊 VALIDATION COMPLETE`)
  console.log(`   Agents: ${agents.length}`)
  console.log(`   Checks: ${summary.totalChecks}`)
  console.log(`   ✅ Passed:   ${totalPassed}`)
  console.log(`   ❌ Failed:   ${totalFailed}`)
  console.log(`   ⚠️  Warnings: ${totalWarnings}`)
  console.log(`   🔴 Critical: ${summary.criticalFindings}`)
  console.log(`   🟠 High:     ${summary.highFindings}`)
  console.log(`   ⏱️  Duration: ${(summary.durationMs / 1000).toFixed(1)}s`)
  console.log(`\n   📄 JSON: ${jsonPath}`)
  console.log(`   📄 HTML: ${htmlPath}`)
  console.log(`${'═'.repeat(75)}\n`)

  return summary
}

// ─── Auth Helper ─────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string | null> {
  try {
    // Step 1: Get CSRF token
    const csrfRes = await fetch(`${VAL_CONFIG.apiUrl}/api/auth/csrf`, {
      signal: AbortSignal.timeout(10000),
    })
    const csrfData = await csrfRes.json() as any
    const csrfToken = csrfData.csrfToken

    // Step 2: Sign in
    const loginRes = await fetch(`${VAL_CONFIG.apiUrl}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: VAL_CONFIG.authEmail,
        password: VAL_CONFIG.authPassword,
        csrfToken,
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!loginRes.ok) return null

    const loginData = await loginRes.json() as any
    return loginData.token || loginData.sessionToken || null
  } catch {
    return null
  }
}

// ─── HTML Report Generator ───────────────────────────────────────────────────

function generateHtml(summary: ValidationSummary): string {
  const severityColors: Record<string, string> = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#2563eb',
    info: '#6b7280',
  }

  const severityBg: Record<string, string> = {
    critical: '#fef2f2',
    high: '#fff7ed',
    medium: '#fefce8',
    low: '#eff6ff',
    info: '#f9fafb',
  }

  // Agent summary cards
  const agentCards = summary.agentResults.map(r => {
    const status = r.failed > 0 ? 'fail' : r.warnings > 0 ? 'warn' : 'pass'
    const icon = r.failed > 0 ? '❌' : r.warnings > 0 ? '⚠️' : '✅'
    return `
      <div class="agent-card ${status}">
        <div class="agent-icon">${icon}</div>
        <div class="agent-info">
          <h3>${esc(r.agentName)}</h3>
          <div class="agent-stats">
            <span class="stat pass">${r.passed} passed</span>
            <span class="stat fail">${r.failed} failed</span>
            <span class="stat warn">${r.warnings} warnings</span>
            <span class="stat time">${r.durationMs}ms</span>
          </div>
        </div>
      </div>`
  }).join('\n')

  // Findings table (sorted by severity)
  const severityOrder = ['critical', 'high', 'medium', 'low', 'info']
  const sortedFindings = [...summary.allFindings].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  )

  const findingsRows = sortedFindings.map(f => `
    <tr>
      <td><span class="badge" style="background:${severityBg[f.severity]};color:${severityColors[f.severity]}">${f.severity.toUpperCase()}</span></td>
      <td><code>${f.domain}</code></td>
      <td><strong>${esc(f.title)}</strong><br><small>${esc(f.detail)}</small></td>
      <td>${f.file ? `<code>${esc(f.file)}</code>${f.line ? `:${f.line}` : ''}` : '—'}</td>
      <td>${f.remediation ? esc(f.remediation) : '—'}</td>
    </tr>`
  ).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Validation Report — Word Is Bond v${summary.version}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;padding:24px}
    .container{max-width:1400px;margin:0 auto}
    h1{font-size:28px;margin-bottom:8px;color:#f8fafc}
    .subtitle{color:#94a3b8;margin-bottom:32px;font-size:14px}
    .summary-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:16px;margin-bottom:32px}
    .summary-card{background:#1e293b;padding:20px;border-radius:8px;text-align:center;border:1px solid #334155}
    .summary-card h4{font-size:11px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px;letter-spacing:1px}
    .summary-card .value{font-size:32px;font-weight:700}
    .value.green{color:#22c55e}.value.red{color:#ef4444}.value.yellow{color:#eab308}.value.blue{color:#3b82f6}
    .section{margin-bottom:32px}
    .section h2{font-size:20px;margin-bottom:16px;color:#f8fafc;border-bottom:1px solid #334155;padding-bottom:8px}
    .agent-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .agent-card{display:flex;gap:12px;padding:16px;background:#1e293b;border-radius:8px;border:1px solid #334155}
    .agent-card.fail{border-color:#ef4444}.agent-card.warn{border-color:#eab308}.agent-card.pass{border-color:#22c55e}
    .agent-icon{font-size:24px;display:flex;align-items:center}
    .agent-info h3{font-size:14px;margin-bottom:4px}
    .agent-stats{display:flex;gap:8px;flex-wrap:wrap}
    .stat{font-size:11px;padding:2px 6px;border-radius:4px;background:#334155}
    .stat.pass{color:#22c55e}.stat.fail{color:#ef4444}.stat.warn{color:#eab308}.stat.time{color:#94a3b8}
    table{width:100%;border-collapse:collapse}
    th{text-align:left;padding:10px 12px;background:#1e293b;font-size:12px;text-transform:uppercase;color:#94a3b8;letter-spacing:.5px}
    td{padding:10px 12px;border-bottom:1px solid #1e293b;font-size:13px;vertical-align:top}
    .badge{padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.5px}
    code{background:#334155;padding:2px 4px;border-radius:3px;font-size:12px;color:#e2e8f0}
    small{color:#94a3b8}
    .footer{margin-top:32px;text-align:center;color:#64748b;font-size:12px}
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 Comprehensive Validation Report</h1>
    <p class="subtitle">Word Is Bond ${summary.version} — ${new Date(summary.timestamp).toLocaleString()} — ${(summary.durationMs / 1000).toFixed(1)}s</p>

    <div class="summary-grid">
      <div class="summary-card"><h4>Total Checks</h4><div class="value blue">${summary.totalChecks}</div></div>
      <div class="summary-card"><h4>Passed</h4><div class="value green">${summary.totalPassed}</div></div>
      <div class="summary-card"><h4>Failed</h4><div class="value red">${summary.totalFailed}</div></div>
      <div class="summary-card"><h4>Warnings</h4><div class="value yellow">${summary.totalWarnings}</div></div>
      <div class="summary-card"><h4>Critical</h4><div class="value ${summary.criticalFindings > 0 ? 'red' : 'green'}">${summary.criticalFindings}</div></div>
      <div class="summary-card"><h4>High</h4><div class="value ${summary.highFindings > 0 ? 'yellow' : 'green'}">${summary.highFindings}</div></div>
    </div>

    <div class="section">
      <h2>Agent Results</h2>
      <div class="agent-grid">
        ${agentCards}
      </div>
    </div>

    <div class="section">
      <h2>All Findings (${summary.allFindings.length})</h2>
      <table>
        <thead><tr><th>Severity</th><th>Domain</th><th>Finding</th><th>File</th><th>Remediation</th></tr></thead>
        <tbody>${findingsRows}</tbody>
      </table>
    </div>

    <div class="footer">
      <p>Generated by Word Is Bond Comprehensive Validation Framework</p>
      <p>API: ${esc(summary.targetApi)} | UI: ${esc(summary.targetUi)}</p>
    </div>
  </div>
</body>
</html>`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
