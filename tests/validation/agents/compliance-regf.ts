/**
 * Reg F Compliance Agent — Validates FDCPA Regulation F enforcement completeness
 *
 * Checks that all 6 Reg F enforcement points from REG_F_ENGINEERING_SPEC.md
 * are wired into the codebase (not just defined as enum constants).
 *
 * Enforcement points:
 *  1. TASK-002: Attorney representation block (§1006.6(b)(2))
 *  2. TASK-006: SMS consent expiry (§1006.6(e))
 *  3. TASK-008: Conversation cooldown / 7-in-7 (§1006.14(b)(2))
 *  4. TASK-011: Validation notices (§1006.34)
 *  5. TASK-015: Two-party consent (§1006.6(c))
 *  6. TASK-017: SOL tracking (§1006.26)
 *
 * Maps to: BF-04 Risk & Compliance Control
 * @see ARCH_DOCS/08-COMPLIANCE/REG_F_ENGINEERING_SPEC.md
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ValidationAgent, ValidationContext, AgentResult, ValidationFinding } from '../types'

interface RegFCheck {
  task: string
  section: string
  description: string
  auditAction: string
  requiredInFile: string
  searchPattern: string
}

const REG_F_CHECKS: RegFCheck[] = [
  {
    task: 'TASK-002',
    section: '§1006.6(b)(2)',
    description: 'Attorney representation block',
    auditAction: 'COMPLIANCE_ATTORNEY_BLOCKED',
    requiredInFile: 'workers/src/lib/compliance-checker.ts',
    searchPattern: 'COMPLIANCE_ATTORNEY_BLOCKED',
  },
  {
    task: 'TASK-006',
    section: '§1006.6(e)',
    description: 'SMS consent expiry enforcement',
    auditAction: 'COMPLIANCE_SMS_CONSENT_EXPIRED',
    requiredInFile: 'workers/src/scheduled.ts',
    searchPattern: 'COMPLIANCE_SMS_CONSENT_EXPIRED',
  },
  {
    task: 'TASK-008',
    section: '§1006.14(b)(2)',
    description: 'Conversation cooldown (7-in-7 rule)',
    auditAction: 'COMPLIANCE_CONVERSATION_COOLDOWN',
    requiredInFile: 'workers/src/lib/compliance-checker.ts',
    searchPattern: 'COMPLIANCE_CONVERSATION_COOLDOWN',
  },
  {
    task: 'TASK-011',
    section: '§1006.34',
    description: 'Validation notice creation',
    auditAction: 'VALIDATION_NOTICE_CREATED',
    requiredInFile: 'workers/src/routes/validation-notices.ts',
    searchPattern: 'VALIDATION_NOTICE_CREATED',
  },
  {
    task: 'TASK-015',
    section: '§1006.6(c)',
    description: 'Two-party consent state enforcement',
    auditAction: 'COMPLIANCE_TWO_PARTY_STATE',
    requiredInFile: 'workers/src/lib/compliance-checker.ts',
    searchPattern: 'COMPLIANCE_TWO_PARTY_STATE',
  },
  {
    task: 'TASK-017',
    section: '§1006.26',
    description: 'Statute of limitations tracking',
    auditAction: 'COMPLIANCE_SOL_WARNING',
    requiredInFile: 'workers/src/lib/compliance-checker.ts',
    searchPattern: 'COMPLIANCE_SOL_WARNING',
  },
]

export const complianceRegFAgent: ValidationAgent = {
  name: 'FDCPA Reg F Compliance',
  domain: 'compliance-regf',
  description: 'Validates all Reg F enforcement points are wired and producing audit trail',

  async run(ctx: ValidationContext): Promise<AgentResult> {
    const findings: ValidationFinding[] = []
    let passed = 0
    let failed = 0
    let warnings = 0
    const start = Date.now()

    // ── Check 1: Each enforcement point exists in the correct file ─────────
    for (const check of REG_F_CHECKS) {
      const filePath = path.join(ctx.workspaceRoot, check.requiredInFile)

      if (!fs.existsSync(filePath)) {
        failed++
        findings.push({
          domain: 'compliance-regf',
          severity: 'critical',
          title: `Missing file: ${check.task} (${check.section})`,
          detail: `${check.requiredInFile} does not exist — ${check.description} cannot be enforced`,
          file: check.requiredInFile,
          remediation: `Create ${check.requiredInFile} with ${check.description} logic`,
        })
        continue
      }

      const content = fs.readFileSync(filePath, 'utf-8')

      // Check that the audit action is actually used (not just imported)
      if (content.includes(check.searchPattern)) {
        // Verify it's in a writeAuditLog call, not just an import
        const hasWriteCall = content.includes(`AuditAction.${check.searchPattern}`)
        if (hasWriteCall) {
          passed++
        } else {
          warnings++
          findings.push({
            domain: 'compliance-regf',
            severity: 'medium',
            title: `${check.task}: Pattern found but not in writeAuditLog`,
            detail: `${check.requiredInFile} contains "${check.searchPattern}" but may not be wired to audit trail`,
            file: check.requiredInFile,
            remediation: `Ensure writeAuditLog(db, { action: AuditAction.${check.searchPattern}, ... }) is called`,
          })
        }
      } else {
        failed++
        findings.push({
          domain: 'compliance-regf',
          severity: 'critical',
          title: `${check.task} not enforced (${check.section})`,
          detail: `${check.requiredInFile} does not contain "${check.searchPattern}" — ${check.description} is not producing audit trail`,
          file: check.requiredInFile,
          remediation: `Add writeAuditLog call with AuditAction.${check.auditAction} when ${check.description} is triggered`,
        })
      }
    }

    // ── Check 2: AuditAction enum has all Reg F constants ──────────────────
    const auditPath = path.join(ctx.workspaceRoot, 'workers', 'src', 'lib', 'audit.ts')
    if (fs.existsSync(auditPath)) {
      const auditContent = fs.readFileSync(auditPath, 'utf-8')
      const requiredActions = REG_F_CHECKS.map(c => c.auditAction)

      for (const action of requiredActions) {
        if (auditContent.includes(action)) {
          passed++
        } else {
          failed++
          findings.push({
            domain: 'compliance-regf',
            severity: 'high',
            title: `Missing AuditAction: ${action}`,
            detail: `workers/src/lib/audit.ts does not define AuditAction.${action}`,
            file: 'workers/src/lib/audit.ts',
            remediation: `Add ${action} to the AuditAction enum`,
          })
        }
      }
    }

    // ── Check 3: Validation notices route exists ───────────────────────────
    const vnPath = path.join(ctx.workspaceRoot, 'workers', 'src', 'routes', 'validation-notices.ts')
    if (fs.existsSync(vnPath)) {
      const vnContent = fs.readFileSync(vnPath, 'utf-8')

      // Must have CRUD: POST create, PATCH sent, PATCH disputed
      const hasCrud = vnContent.includes('.post(') && vnContent.includes('.patch(')
      if (hasCrud) {
        passed++
      } else {
        failed++
        findings.push({
          domain: 'compliance-regf',
          severity: 'high',
          title: 'Validation notices missing CRUD',
          detail: 'validation-notices.ts should have POST (create) and PATCH (sent/disputed) handlers',
          file: 'workers/src/routes/validation-notices.ts',
        })
      }
    }

    // ── Check 4: Compliance checker has pre-dial gate ──────────────────────
    const ccPath = path.join(ctx.workspaceRoot, 'workers', 'src', 'lib', 'compliance-checker.ts')
    if (fs.existsSync(ccPath)) {
      const ccContent = fs.readFileSync(ccPath, 'utf-8')

      // Must check: attorney_represented, two_party_consent states, conversation_cooldown
      // Note: our impl uses `conversation_cooldown` (boolean flag) rather than a raw count field
      const checks = [
        { name: 'attorney check', pattern: 'attorney_represented' },
        { name: 'two-party states', pattern: 'two_party_consent' },
        { name: 'conversation cooldown', pattern: 'conversation_cooldown' },
        { name: 'state SOL rules', pattern: 'state_sol_rules' },
        { name: 'employer block', pattern: 'employer_prohibits_contact' },
      ]

      for (const c of checks) {
        if (ccContent.includes(c.pattern)) {
          passed++
        } else {
          warnings++
          findings.push({
            domain: 'compliance-regf',
            severity: 'medium',
            title: `Pre-dial check missing: ${c.name}`,
            detail: `compliance-checker.ts does not reference "${c.pattern}"`,
            file: 'workers/src/lib/compliance-checker.ts',
            remediation: `Add ${c.name} check to runPreDialCheck()`,
          })
        }
      }
    }

    // ── Check 5: Live API — validation-notices endpoint responds ───────────
    try {
      const headers: Record<string, string> = {}
      if (ctx.authToken) {
        headers['Authorization'] = `Bearer ${ctx.authToken}`
      }
      const res = await fetch(`${ctx.apiUrl}/api/validation-notices`, {
        headers,
        signal: AbortSignal.timeout(10000),
      })
      if ([200, 401, 403].includes(res.status)) {
        passed++
      } else {
        warnings++
        findings.push({
          domain: 'compliance-regf',
          severity: 'medium',
          title: 'Validation notices endpoint unexpected status',
          detail: `GET /api/validation-notices returned ${res.status}`,
        })
      }
    } catch (err: any) {
      warnings++
      findings.push({
        domain: 'compliance-regf',
        severity: 'medium',
        title: 'Validation notices endpoint unreachable',
        detail: err.message,
      })
    }

    return {
      domain: 'compliance-regf',
      agentName: 'FDCPA Reg F Compliance',
      passed,
      failed,
      warnings,
      findings,
      durationMs: Date.now() - start,
    }
  },
}
