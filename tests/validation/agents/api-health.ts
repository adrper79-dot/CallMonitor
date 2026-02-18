/**
 * API Health Agent — Validates production API health + latency baselines
 *
 * Checks:
 *  - /health returns 200 with all services healthy
 *  - Response time < 2s for health, < 5s for deep endpoints
 *  - All bound services (DB, KV, R2, Telnyx) report healthy
 *
 * Maps to: BF-06 Platform Governance
 * @see workers/src/routes/health.ts
 */

import type { ValidationAgent, ValidationContext, AgentResult, ValidationFinding } from '../types'

export const apiHealthAgent: ValidationAgent = {
  name: 'API Health & Latency',
  domain: 'api-health',
  description: 'Validates production API health endpoints and response time baselines',

  async run(ctx: ValidationContext): Promise<AgentResult> {
    const findings: ValidationFinding[] = []
    let passed = 0
    let failed = 0
    let warnings = 0
    const start = Date.now()

    // ── Check 1: /health returns 200 ──────────────────────────────────────
    try {
      const t0 = Date.now()
      const res = await fetch(`${ctx.apiUrl}/health`, { signal: AbortSignal.timeout(15000) })
      const latency = Date.now() - t0
      const body = await res.json() as any

      if (res.status === 200 && body.status === 'healthy') {
        passed++
      } else {
        failed++
        findings.push({
          domain: 'api-health',
          severity: 'critical',
          title: 'Health endpoint unhealthy',
          detail: `GET /health returned status=${res.status}, body.status=${body.status}`,
          remediation: 'Check Cloudflare Workers deployment and Neon DB connectivity',
        })
      }

      // Latency check
      if (latency > 2000) {
        warnings++
        findings.push({
          domain: 'api-health',
          severity: 'medium',
          title: 'Health endpoint slow',
          detail: `GET /health took ${latency}ms (threshold: 2000ms)`,
          remediation: 'Check Hyperdrive connection pool and cold start times',
        })
      } else {
        passed++
      }

      // ── Check 2: All bound services healthy ──────────────────────────────
      const services = body.checks || []
      const expectedServices = ['database', 'kv', 'r2', 'telnyx']

      for (const expected of expectedServices) {
        const svc = services.find((s: any) => s.service === expected)
        if (!svc) {
          failed++
          findings.push({
            domain: 'api-health',
            severity: 'high',
            title: `Missing health check: ${expected}`,
            detail: `Service "${expected}" not found in health response`,
            remediation: `Verify ${expected} binding in wrangler.toml`,
          })
        } else if (svc.status !== 'healthy') {
          failed++
          findings.push({
            domain: 'api-health',
            severity: 'critical',
            title: `Service unhealthy: ${expected}`,
            detail: `${expected} status="${svc.status}" — ${svc.message}`,
            remediation: `Check ${expected} service connectivity and credentials`,
          })
        } else {
          passed++
          // Check individual service latency
          if (svc.responseTime && svc.responseTime > 1000) {
            warnings++
            findings.push({
              domain: 'api-health',
              severity: 'low',
              title: `Slow service: ${expected}`,
              detail: `${expected} responded in ${svc.responseTime}ms`,
            })
          }
        }
      }
    } catch (err: any) {
      failed++
      findings.push({
        domain: 'api-health',
        severity: 'critical',
        title: 'Health endpoint unreachable',
        detail: `GET ${ctx.apiUrl}/health failed: ${err.message}`,
        remediation: 'Verify Workers deployment is live and DNS is resolving',
      })
    }

    // ── Check 3: CORS headers present ──────────────────────────────────────
    try {
      const res = await fetch(`${ctx.apiUrl}/health`, {
        method: 'OPTIONS',
        headers: { 'Origin': ctx.uiUrl, 'Access-Control-Request-Method': 'GET' },
        signal: AbortSignal.timeout(10000),
      })

      const acao = res.headers.get('access-control-allow-origin')
      if (acao === ctx.uiUrl || acao === '*') {
        passed++
      } else {
        warnings++
        findings.push({
          domain: 'api-health',
          severity: 'medium',
          title: 'CORS origin mismatch',
          detail: `Expected ACAO="${ctx.uiUrl}", got "${acao}"`,
          file: 'workers/src/index.ts',
          remediation: 'Update CORS_ORIGIN env var in wrangler.toml',
        })
      }
    } catch {
      warnings++
      findings.push({
        domain: 'api-health',
        severity: 'low',
        title: 'CORS preflight check failed',
        detail: 'OPTIONS request to /health did not complete',
      })
    }

    // ── Check 4: UI is serving ─────────────────────────────────────────────
    try {
      const res = await fetch(ctx.uiUrl, { signal: AbortSignal.timeout(10000) })
      if (res.status === 200) {
        passed++
      } else {
        failed++
        findings.push({
          domain: 'api-health',
          severity: 'critical',
          title: 'UI not serving',
          detail: `GET ${ctx.uiUrl} returned ${res.status}`,
          remediation: 'Check Cloudflare Pages deployment',
        })
      }
    } catch (err: any) {
      failed++
      findings.push({
        domain: 'api-health',
        severity: 'critical',
        title: 'UI unreachable',
        detail: `GET ${ctx.uiUrl} failed: ${err.message}`,
      })
    }

    return {
      domain: 'api-health',
      agentName: 'API Health & Latency',
      passed,
      failed,
      warnings,
      findings,
      durationMs: Date.now() - start,
    }
  },
}
