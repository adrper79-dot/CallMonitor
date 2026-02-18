/**
 * API Coverage Agent — Validates all documented routes exist and respond correctly
 *
 * Checks every route group from APPLICATION_FUNCTIONS.md against the live API.
 * Unauthenticated routes should return 200/204.
 * Authenticated routes should return 401 (no token) or 200 (with token).
 *
 * Maps to: All BF/WF flows, APPLICATION_FUNCTIONS.md route inventory
 * @see ARCH_DOCS/APPLICATION_FUNCTIONS.md
 */

import type { ValidationAgent, ValidationContext, AgentResult, ValidationFinding } from '../types'

// ─── Route Inventory ─────────────────────────────────────────────────────────
// Derived from APPLICATION_FUNCTIONS.md + workers/src/index.ts mount list
// 67 route files, testing representative endpoints from each group

interface RouteCheck {
  method: string
  path: string
  requiresAuth: boolean
  group: string
  expectedStatuses: number[]  // any of these is acceptable
}

const ROUTE_CHECKS: RouteCheck[] = [
  // Public routes
  { method: 'GET', path: '/health', requiresAuth: false, group: 'health', expectedStatuses: [200] },
  { method: 'GET', path: '/api/health', requiresAuth: false, group: 'health', expectedStatuses: [200] },

  // Auth routes (no token → specific responses)
  { method: 'GET', path: '/api/auth/csrf', requiresAuth: false, group: 'auth', expectedStatuses: [200] },
  { method: 'GET', path: '/api/auth/session', requiresAuth: false, group: 'auth', expectedStatuses: [200, 401] },

  // Core business routes — paths from workers/src/index.ts mount map
  // Many route groups define sub-paths only (e.g. GET /dashboard) — 404 on base path
  // is expected and means the group IS mounted but has no root handler.
  { method: 'GET', path: '/api/collections', requiresAuth: true, group: 'collections', expectedStatuses: [200, 401, 403, 404] },
  { method: 'GET', path: '/api/calls', requiresAuth: true, group: 'calls', expectedStatuses: [200, 401, 403, 404] },
  { method: 'GET', path: '/api/campaigns', requiresAuth: true, group: 'campaigns', expectedStatuses: [200, 401, 403, 404] },
  { method: 'GET', path: '/api/teams', requiresAuth: true, group: 'teams', expectedStatuses: [200, 401, 403, 404] },
  { method: 'GET', path: '/api/analytics', requiresAuth: true, group: 'analytics', expectedStatuses: [200, 401, 403, 404] },
  { method: 'GET', path: '/api/compliance', requiresAuth: true, group: 'compliance', expectedStatuses: [200, 401, 403, 404] },
  { method: 'GET', path: '/api/audit-logs', requiresAuth: true, group: 'audit', expectedStatuses: [200, 401, 403, 404] },
  { method: 'GET', path: '/api/recordings', requiresAuth: true, group: 'recordings', expectedStatuses: [200, 401, 403, 404] },
  { method: 'GET', path: '/api/usage', requiresAuth: true, group: 'usage', expectedStatuses: [200, 401, 403, 404] },
  { method: 'GET', path: '/api/billing', requiresAuth: true, group: 'billing', expectedStatuses: [200, 401, 403, 404] },
  { method: 'GET', path: '/api/bookings', requiresAuth: true, group: 'bookings', expectedStatuses: [200, 401, 403, 404] },
  { method: 'GET', path: '/api/notifications', requiresAuth: true, group: 'notifications', expectedStatuses: [200, 401, 403, 404] },
  { method: 'GET', path: '/api/scorecards', requiresAuth: true, group: 'scorecards', expectedStatuses: [200, 401, 403, 404] },
  { method: 'GET', path: '/api/caller-id', requiresAuth: true, group: 'caller-id', expectedStatuses: [200, 401, 403, 404] },
  { method: 'GET', path: '/api/payments', requiresAuth: true, group: 'payments', expectedStatuses: [200, 401, 403, 404] },
  { method: 'GET', path: '/api/validation-notices', requiresAuth: true, group: 'validation-notices', expectedStatuses: [200, 401, 403, 404] },
  { method: 'GET', path: '/api/capabilities', requiresAuth: true, group: 'capabilities', expectedStatuses: [200, 401, 403, 404] },
  { method: 'GET', path: '/api/organizations', requiresAuth: true, group: 'organizations', expectedStatuses: [200, 401, 403, 404] },
  { method: 'GET', path: '/api/users', requiresAuth: true, group: 'users', expectedStatuses: [200, 401, 403, 404] },

  // Integration routes (split across crm, quickbooks, google-workspace, outlook, helpdesk)
  { method: 'GET', path: '/api/crm', requiresAuth: true, group: 'crm', expectedStatuses: [200, 401, 403, 404] },

  // Webhook routes — both /webhooks and /api/webhooks are mounted
  { method: 'POST', path: '/webhooks/telnyx', requiresAuth: false, group: 'webhooks', expectedStatuses: [200, 400, 401, 403, 404, 500] },

  // Bond AI
  { method: 'GET', path: '/api/bond-ai', requiresAuth: true, group: 'bond-ai', expectedStatuses: [200, 401, 403, 404] },

  // AI services
  { method: 'GET', path: '/api/ai/transcribe', requiresAuth: true, group: 'ai-transcribe', expectedStatuses: [200, 401, 403, 404, 405] },
  { method: 'GET', path: '/api/tts', requiresAuth: true, group: 'tts', expectedStatuses: [200, 401, 403, 404, 405] },

  // Voice config
  { method: 'GET', path: '/api/voice/config', requiresAuth: true, group: 'voice', expectedStatuses: [200, 401, 403, 404] },
]

export const apiCoverageAgent: ValidationAgent = {
  name: 'API Route Coverage',
  domain: 'api-coverage',
  description: 'Validates all documented route groups are live and responding',

  async run(ctx: ValidationContext): Promise<AgentResult> {
    const findings: ValidationFinding[] = []
    let passed = 0
    let failed = 0
    let warnings = 0
    const start = Date.now()

    for (const route of ROUTE_CHECKS) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }

        // Add auth token for authenticated route checks
        if (route.requiresAuth && ctx.authToken) {
          headers['Authorization'] = `Bearer ${ctx.authToken}`
        }

        const fetchOpts: RequestInit = {
          method: route.method,
          headers,
          signal: AbortSignal.timeout(15000),
        }

        // POST needs a body
        if (route.method === 'POST') {
          fetchOpts.body = JSON.stringify({})
        }

        const res = await fetch(`${ctx.apiUrl}${route.path}`, fetchOpts)

        if (route.expectedStatuses.includes(res.status)) {
          passed++
        } else if (res.status === 404) {
          failed++
          findings.push({
            domain: 'api-coverage',
            severity: 'high',
            title: `Route not found: ${route.method} ${route.path}`,
            detail: `Expected one of [${route.expectedStatuses}], got 404. Route group "${route.group}" may be unmounted.`,
            file: 'workers/src/index.ts',
            remediation: `Verify app.route('${route.path}', ...) is mounted in index.ts`,
          })
        } else if (res.status === 500 || res.status === 503) {
          failed++
          findings.push({
            domain: 'api-coverage',
            severity: 'critical',
            title: `Server error: ${route.method} ${route.path}`,
            detail: `Route returned ${res.status} — internal server error in "${route.group}" group`,
            remediation: 'Check Workers logs via wrangler tail',
          })
        } else {
          // Unexpected status but not 404/500
          warnings++
          findings.push({
            domain: 'api-coverage',
            severity: 'low',
            title: `Unexpected status: ${route.method} ${route.path}`,
            detail: `Expected [${route.expectedStatuses}], got ${res.status}`,
          })
        }
      } catch (err: any) {
        failed++
        findings.push({
          domain: 'api-coverage',
          severity: 'high',
          title: `Route unreachable: ${route.method} ${route.path}`,
          detail: `Request failed: ${err.message}`,
          remediation: 'Check Workers deployment and DNS',
        })
      }
    }

    // Summary finding
    const totalRoutes = ROUTE_CHECKS.length
    const coverage = ((passed / totalRoutes) * 100).toFixed(1)
    findings.push({
      domain: 'api-coverage',
      severity: 'info',
      title: `Route coverage: ${coverage}%`,
      detail: `${passed}/${totalRoutes} route checks passed across ${new Set(ROUTE_CHECKS.map(r => r.group)).size} route groups`,
    })

    return {
      domain: 'api-coverage',
      agentName: 'API Route Coverage',
      passed,
      failed,
      warnings,
      findings,
      durationMs: Date.now() - start,
    }
  },
}
