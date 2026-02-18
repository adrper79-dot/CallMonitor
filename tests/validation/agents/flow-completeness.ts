/**
 * Flow Completeness Agent — Validates BF/WF flows have matching routes + pages
 *
 * Maps each business flow (BF-01→BF-06) and workflow flow (WF-AGENT, WF-MANAGER)
 * from FLOW_MAP_AND_VALIDATION_PLAN.md to actual routes and UI pages.
 *
 * Maps to: ARCH_DOCS/FLOW_MAP_AND_VALIDATION_PLAN.md
 * @see tests/agents/config.ts (SHELL_ROUTES)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ValidationAgent, ValidationContext, AgentResult, ValidationFinding } from '../types'

interface FlowCheck {
  flow: string
  description: string
  requiredRoutes: string[]     // API routes (workers/src/routes/)
  requiredPages: string[]      // Frontend pages (app/)
}

const FLOW_CHECKS: FlowCheck[] = [
  {
    flow: 'BF-01',
    description: 'Organization activation — onboarding + number provisioning',
    requiredRoutes: ['auth.ts', 'organizations.ts', 'users.ts', 'onboarding.ts'],
    requiredPages: ['app/signin/page.tsx', 'app/signup/page.tsx', 'app/onboarding/page.tsx'],
  },
  {
    flow: 'BF-02',
    description: 'Daily collections operations — queue + call + disposition',
    requiredRoutes: ['collections.ts', 'calls.ts', 'voice.ts'],
    requiredPages: ['app/work/page.tsx', 'app/accounts/page.tsx'],
  },
  {
    flow: 'BF-03',
    description: 'Payment recovery — payment links + plans + reconciliation',
    requiredRoutes: ['payments.ts', 'billing.ts'],
    requiredPages: ['app/payments/page.tsx'],
  },
  {
    flow: 'BF-04',
    description: 'Risk & compliance control — pre-dial + DNC + audit',
    requiredRoutes: ['compliance.ts', 'validation-notices.ts', 'audit.ts'],
    requiredPages: ['app/compliance/page.tsx'],
  },
  {
    flow: 'BF-05',
    description: 'Team performance — scorecards + coaching + analytics',
    requiredRoutes: ['scorecards.ts', 'analytics.ts', 'teams.ts'],
    requiredPages: ['app/command/page.tsx', 'app/analytics/page.tsx'],
  },
  {
    flow: 'BF-06',
    description: 'Platform governance — access + integrations + billing review',
    requiredRoutes: ['users.ts', 'crm.ts', 'billing.ts', 'usage.ts'],
    requiredPages: ['app/admin/page.tsx', 'app/settings/page.tsx'],
  },
  {
    flow: 'WF-AGENT',
    description: 'Agent shell workflow — work queue, dialer, accounts, schedule',
    requiredRoutes: ['collections.ts', 'calls.ts', 'voice.ts', 'bookings.ts'],
    requiredPages: ['app/work/page.tsx', 'app/accounts/page.tsx', 'app/schedule/page.tsx'],
  },
  {
    flow: 'WF-MANAGER',
    description: 'Manager shell workflow — command center, teams, campaigns, reports',
    requiredRoutes: ['analytics.ts', 'teams.ts', 'campaigns.ts', 'scorecards.ts'],
    requiredPages: ['app/command/page.tsx', 'app/teams/page.tsx', 'app/campaigns/page.tsx'],
  },
]

export const flowCompletenessAgent: ValidationAgent = {
  name: 'Flow Completeness',
  domain: 'flow-completeness',
  description: 'Validates all BF/WF business flows have matching API routes and UI pages',

  async run(ctx: ValidationContext): Promise<AgentResult> {
    const findings: ValidationFinding[] = []
    let passed = 0
    let failed = 0
    let warnings = 0
    const start = Date.now()

    const routesDir = path.join(ctx.workspaceRoot, 'workers', 'src', 'routes')

    for (const flow of FLOW_CHECKS) {
      let flowPassed = true

      // Check required API routes exist
      for (const route of flow.requiredRoutes) {
        const routePath = path.join(routesDir, route)
        if (fs.existsSync(routePath)) {
          passed++
        } else {
          flowPassed = false
          failed++
          findings.push({
            domain: 'flow-completeness',
            severity: 'high',
            title: `${flow.flow}: Missing route ${route}`,
            detail: `Flow "${flow.description}" requires workers/src/routes/${route} but it doesn't exist`,
            file: `workers/src/routes/${route}`,
            remediation: `Create ${route} to support ${flow.flow}`,
          })
        }
      }

      // Check required frontend pages exist
      for (const page of flow.requiredPages) {
        const pagePath = path.join(ctx.workspaceRoot, page)
        if (fs.existsSync(pagePath)) {
          passed++
        } else {
          flowPassed = false
          warnings++
          findings.push({
            domain: 'flow-completeness',
            severity: 'medium',
            title: `${flow.flow}: Missing page ${page}`,
            detail: `Flow "${flow.description}" expects ${page}`,
            file: page,
          })
        }
      }

      if (flowPassed) {
        findings.push({
          domain: 'flow-completeness',
          severity: 'info',
          title: `${flow.flow}: Complete`,
          detail: `${flow.description} — all ${flow.requiredRoutes.length} routes + ${flow.requiredPages.length} pages present`,
        })
      }
    }

    // ── Bonus: Check index.ts mounts all route files ───────────────────────
    const indexPath = path.join(ctx.workspaceRoot, 'workers', 'src', 'index.ts')
    if (fs.existsSync(indexPath) && fs.existsSync(routesDir)) {
      const indexContent = fs.readFileSync(indexPath, 'utf-8')
      const allRouteFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'))

      let unmounted = 0
      for (const file of allRouteFiles) {
        const routeName = file.replace('.ts', '')
        // Check if imported or referenced in index.ts
        if (!indexContent.includes(routeName)) {
          unmounted++
          findings.push({
            domain: 'flow-completeness',
            severity: 'medium',
            title: `Unmounted route: ${file}`,
            detail: `workers/src/routes/${file} exists but may not be mounted in index.ts`,
            file: 'workers/src/index.ts',
          })
        }
      }

      if (unmounted === 0) {
        passed++
        findings.push({
          domain: 'flow-completeness',
          severity: 'info',
          title: `All ${allRouteFiles.length} route files are mounted`,
          detail: 'Every route file in workers/src/routes/ is referenced in index.ts',
        })
      } else {
        warnings += unmounted
      }
    }

    return {
      domain: 'flow-completeness',
      agentName: 'Flow Completeness',
      passed,
      failed,
      warnings,
      findings,
      durationMs: Date.now() - start,
    }
  },
}
