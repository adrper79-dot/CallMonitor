/**
 * TCPA Compliance Agent — Validates Telephone Consumer Protection Act enforcement
 *
 * Checks:
 *  1. DNC list enforcement exists
 *  2. Calling hours restrictions
 *  3. Consent management
 *  4. Caller ID presentation
 *  5. SMS opt-out/unsubscribe
 *
 * Maps to: BF-04 Risk & Compliance Control
 * @see ARCH_DOCS/08-COMPLIANCE/
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ValidationAgent, ValidationContext, AgentResult, ValidationFinding } from '../types'

export const complianceTcpaAgent: ValidationAgent = {
  name: 'TCPA Compliance',
  domain: 'compliance-tcpa',
  description: 'Validates TCPA enforcement points: DNC, calling hours, consent, caller ID',

  async run(ctx: ValidationContext): Promise<AgentResult> {
    const findings: ValidationFinding[] = []
    let passed = 0
    let failed = 0
    let warnings = 0
    const start = Date.now()

    const workersDir = path.join(ctx.workspaceRoot, 'workers', 'src')

    // ── Check 1: DNC list checking exists ──────────────────────────────────
    const complianceChecker = path.join(workersDir, 'lib', 'compliance-checker.ts')
    if (fs.existsSync(complianceChecker)) {
      const content = fs.readFileSync(complianceChecker, 'utf-8')

      // DNC check
      if (content.includes('dnc') || content.includes('do_not_call') || content.includes('DNC')) {
        passed++
      } else {
        failed++
        findings.push({
          domain: 'compliance-tcpa',
          severity: 'critical',
          title: 'DNC check missing from pre-dial compliance',
          detail: 'compliance-checker.ts does not reference DNC/do_not_call',
          file: 'workers/src/lib/compliance-checker.ts',
          remediation: 'Add DNC list check to runPreDialCheck()',
        })
      }

      // Calling hours
      if (content.includes('calling_hours') || content.includes('call_window') || content.includes('timezone') || content.includes('getHours')) {
        passed++
      } else {
        warnings++
        findings.push({
          domain: 'compliance-tcpa',
          severity: 'high',
          title: 'Calling hours enforcement not evident',
          detail: 'compliance-checker.ts does not reference calling_hours or timezone checks',
          file: 'workers/src/lib/compliance-checker.ts',
          remediation: 'Add TCPA calling window check (8am-9pm consumer local time)',
        })
      }

      // Consent tracking
      if (content.includes('consent') || content.includes('sms_consent') || content.includes('CONSENT')) {
        passed++
      } else {
        warnings++
        findings.push({
          domain: 'compliance-tcpa',
          severity: 'high',
          title: 'Consent tracking not evident in pre-dial check',
          detail: 'compliance-checker.ts does not reference consent management',
          file: 'workers/src/lib/compliance-checker.ts',
        })
      }
    } else {
      failed++
      findings.push({
        domain: 'compliance-tcpa',
        severity: 'critical',
        title: 'Compliance checker not found',
        detail: 'workers/src/lib/compliance-checker.ts does not exist',
        remediation: 'Create pre-dial compliance gate with TCPA checks',
      })
    }

    // ── Check 2: DNC route exists ──────────────────────────────────────────
    const dncRoutes = ['dnc.ts', 'compliance.ts']
    let dncRouteFound = false
    for (const f of dncRoutes) {
      const fp = path.join(workersDir, 'routes', f)
      if (fs.existsSync(fp)) {
        const content = fs.readFileSync(fp, 'utf-8')
        if (content.includes('dnc') || content.includes('do_not_call')) {
          dncRouteFound = true
          break
        }
      }
    }
    if (dncRouteFound) {
      passed++
    } else {
      warnings++
      findings.push({
        domain: 'compliance-tcpa',
        severity: 'medium',
        title: 'DNC management route not found',
        detail: 'No dedicated DNC management endpoint in routes/',
        remediation: 'DNC may be managed via compliance.ts or accounts.ts — verify',
      })
    }

    // ── Check 3: Caller ID management ──────────────────────────────────────
    const callerIdPath = path.join(workersDir, 'routes', 'caller-id.ts')
    if (fs.existsSync(callerIdPath)) {
      const content = fs.readFileSync(callerIdPath, 'utf-8')
      if (content.includes('caller_id') || content.includes('callerId') || content.includes('phone_number')) {
        passed++
      } else {
        warnings++
        findings.push({
          domain: 'compliance-tcpa',
          severity: 'medium',
          title: 'Caller ID route exists but seems incomplete',
          detail: 'caller-id.ts does not reference standard caller ID fields',
          file: 'workers/src/routes/caller-id.ts',
        })
      }
    } else {
      failed++
      findings.push({
        domain: 'compliance-tcpa',
        severity: 'high',
        title: 'Caller ID management route missing',
        detail: 'TCPA requires accurate caller ID presentation',
        remediation: 'Create workers/src/routes/caller-id.ts',
      })
    }

    // ── Check 4: Unsubscribe / SMS opt-out ─────────────────────────────────
    const unsubPath = path.join(workersDir, 'routes', 'unsubscribe.ts')
    if (fs.existsSync(unsubPath)) {
      const content = fs.readFileSync(unsubPath, 'utf-8')
      if (content.includes('unsubscribe') || content.includes('opt_out') || content.includes('STOP')) {
        passed++
      } else {
        warnings++
        findings.push({
          domain: 'compliance-tcpa',
          severity: 'medium',
          title: 'Unsubscribe route seems incomplete',
          detail: 'unsubscribe.ts does not reference standard opt-out patterns',
          file: 'workers/src/routes/unsubscribe.ts',
        })
      }
    } else {
      warnings++
      findings.push({
        domain: 'compliance-tcpa',
        severity: 'medium',
        title: 'Unsubscribe route not found',
        detail: 'SMS opt-out handling should exist for TCPA compliance',
      })
    }

    // ── Check 5: SMS consent expiry cron ───────────────────────────────────
    const scheduledPath = path.join(workersDir, 'scheduled.ts')
    if (fs.existsSync(scheduledPath)) {
      const content = fs.readFileSync(scheduledPath, 'utf-8')
      if (content.includes('sms_consent') || content.includes('consent_expir') || content.includes('expireSmsConsent')) {
        passed++
      } else {
        warnings++
        findings.push({
          domain: 'compliance-tcpa',
          severity: 'medium',
          title: 'SMS consent expiry cron not found',
          detail: 'scheduled.ts does not reference SMS consent expiry handling',
          file: 'workers/src/scheduled.ts',
          remediation: 'Add SMS consent expiry check to scheduled cron jobs',
        })
      }
    }

    // ── Check 6: Live API — compliance endpoint responds ───────────────────
    try {
      const headers: Record<string, string> = {}
      if (ctx.authToken) headers['Authorization'] = `Bearer ${ctx.authToken}`

      const res = await fetch(`${ctx.apiUrl}/api/compliance/status`, {
        headers,
        signal: AbortSignal.timeout(10000),
      })
      if ([200, 401, 403].includes(res.status)) {
        passed++
      } else {
        warnings++
        findings.push({
          domain: 'compliance-tcpa',
          severity: 'low',
          title: 'Compliance status endpoint unexpected response',
          detail: `GET /api/compliance/status returned ${res.status}`,
        })
      }
    } catch (err: any) {
      warnings++
      findings.push({
        domain: 'compliance-tcpa',
        severity: 'low',
        title: 'Compliance endpoint unreachable',
        detail: err.message,
      })
    }

    return {
      domain: 'compliance-tcpa',
      agentName: 'TCPA Compliance',
      passed,
      failed,
      warnings,
      findings,
      durationMs: Date.now() - start,
    }
  },
}
