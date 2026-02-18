/**
 * Audit Completeness Agent — Validates all mutation routes have writeAuditLog
 *
 * Every POST/PUT/PATCH/DELETE endpoint that modifies data MUST call
 * writeAuditLog() from workers/src/lib/audit.ts.
 *
 * Additionally validates:
 *  - AuditAction enum constants are used (not string literals)
 *  - Audit log uses old_value/new_value (not before/after)
 *
 * Maps to: ARCH_DOCS copilot-instructions.md Rule #3
 * @see workers/src/lib/audit.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ValidationAgent, ValidationContext, AgentResult, ValidationFinding } from '../types'

// Routes that are exempt from audit logging requirements
const EXEMPT_ROUTES = new Set([
  'health.ts',          // no mutations
  'cron-health.ts',     // no mutations
  'auth.ts',            // login/logout logged separately
  'webhooks.ts',        // external webhooks, logged differently
  'unsubscribe.ts',     // public endpoint, has its own audit
  'capabilities.ts',    // read-only plan/feature checks (POST /check is a batch read)
  'test.ts',            // dev/test suite runner, no production data mutation
  'tts.ts',             // audio generation + R2 cache, no DB mutation
])

export const auditCompletenessAgent: ValidationAgent = {
  name: 'Audit Trail Completeness',
  domain: 'audit-completeness',
  description: 'Validates all mutation endpoints call writeAuditLog with enum constants',

  async run(ctx: ValidationContext): Promise<AgentResult> {
    const findings: ValidationFinding[] = []
    let passed = 0
    let failed = 0
    let warnings = 0
    const start = Date.now()

    const routesDir = path.join(ctx.workspaceRoot, 'workers', 'src', 'routes')
    if (!fs.existsSync(routesDir)) {
      return {
        domain: 'audit-completeness',
        agentName: 'Audit Trail Completeness',
        passed: 0, failed: 1, warnings: 0,
        findings: [{ domain: 'audit-completeness', severity: 'critical', title: 'Routes dir missing', detail: 'workers/src/routes/ not found' }],
        durationMs: Date.now() - start,
      }
    }

    const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'))

    for (const file of routeFiles) {
      if (EXEMPT_ROUTES.has(file)) continue

      const filePath = path.join(routesDir, file)
      const content = fs.readFileSync(filePath, 'utf-8')
      const relPath = `workers/src/routes/${file}`

      // Check if file has any mutation handlers
      const hasMutations = /\.(post|put|patch|delete)\s*\(/i.test(content)
      if (!hasMutations) {
        passed++ // Read-only route, no audit needed
        continue
      }

      // Check if file imports writeAuditLog
      const hasAuditImport = content.includes('writeAuditLog')
      if (!hasAuditImport) {
        failed++
        findings.push({
          domain: 'audit-completeness',
          severity: 'high',
          title: `No audit logging: ${file}`,
          detail: `${relPath} has mutation endpoints but does not import writeAuditLog`,
          file: relPath,
          remediation: "Add import { writeAuditLog, AuditAction } from '../lib/audit' and call on mutations",
        })
        continue
      }

      // Check that AuditAction enum is used (not string literals)
      const hasAuditActionImport = content.includes('AuditAction')
      if (!hasAuditActionImport) {
        warnings++
        findings.push({
          domain: 'audit-completeness',
          severity: 'medium',
          title: `String literal audit actions: ${file}`,
          detail: `${relPath} imports writeAuditLog but not AuditAction enum — may use string literals`,
          file: relPath,
          remediation: 'Import AuditAction enum and use AuditAction.XXX constants instead of string literals',
        })
      } else {
        passed++
      }

      // Check for before/after usage (should be old_value/new_value)
      if (content.includes('before:') || content.includes('after:')) {
        // Check if it's in an audit log context
        const beforeAfterInAudit = /writeAuditLog[^}]*\b(before|after)\s*:/s.test(content)
        if (beforeAfterInAudit) {
          failed++
          findings.push({
            domain: 'audit-completeness',
            severity: 'high',
            title: `Wrong audit column names: ${file}`,
            detail: `${relPath} uses "before/after" in audit log — must use "oldValue/newValue"`,
            file: relPath,
            remediation: 'Change before: → oldValue: and after: → newValue:',
          })
        }
      }
    }

    // ── Check: AuditAction enum size (should have 200+ entries) ────────────
    const auditPath = path.join(ctx.workspaceRoot, 'workers', 'src', 'lib', 'audit.ts')
    if (fs.existsSync(auditPath)) {
      const auditContent = fs.readFileSync(auditPath, 'utf-8')
      const actionMatches = auditContent.match(/^\s+\w+\s*[:=]\s*'/gm)
      const actionCount = actionMatches?.length || 0

      if (actionCount >= 200) {
        passed++
        findings.push({
          domain: 'audit-completeness',
          severity: 'info',
          title: `AuditAction enum: ${actionCount} actions defined`,
          detail: 'Comprehensive audit trail coverage',
        })
      } else if (actionCount >= 100) {
        warnings++
        findings.push({
          domain: 'audit-completeness',
          severity: 'low',
          title: `AuditAction enum: only ${actionCount} actions`,
          detail: 'Consider adding more granular audit actions for compliance',
        })
      } else {
        failed++
        findings.push({
          domain: 'audit-completeness',
          severity: 'high',
          title: `AuditAction enum: only ${actionCount} actions`,
          detail: 'Insufficient audit coverage for SOC2/HIPAA compliance',
        })
      }
    }

    return {
      domain: 'audit-completeness',
      agentName: 'Audit Trail Completeness',
      passed,
      failed,
      warnings,
      findings,
      durationMs: Date.now() - start,
    }
  },
}
