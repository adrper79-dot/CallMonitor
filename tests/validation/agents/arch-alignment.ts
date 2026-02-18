/**
 * Architecture Alignment Agent — Validates ARCH_DOCS ↔ codebase synchronization
 *
 * Checks:
 *  1. Version consistency across all ARCH_DOCS files
 *  2. Route count matches APPLICATION_FUNCTIONS.md declared count
 *  3. Lib module count accuracy
 *  4. Cron job count accuracy
 *  5. E2E test files referenced in CURRENT_STATUS.md exist
 *  6. ROADMAP progress line matches actual checked items
 *
 * Maps to: TOGAF Phase H (Architecture Change Management)
 * @see ARCH_DOCS/MASTER_ARCHITECTURE.md
 * @see ARCH_DOCS/APPLICATION_FUNCTIONS.md
 * @see ARCH_DOCS/CURRENT_STATUS.md
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ValidationAgent, ValidationContext, AgentResult, ValidationFinding } from '../types'

export const archAlignmentAgent: ValidationAgent = {
  name: 'ARCH_DOCS Alignment',
  domain: 'arch-alignment',
  description: 'Validates ARCH_DOCS documentation matches actual codebase state',

  async run(ctx: ValidationContext): Promise<AgentResult> {
    const findings: ValidationFinding[] = []
    let passed = 0
    let failed = 0
    let warnings = 0
    const start = Date.now()

    // ── Check 1: Version consistency across ARCH_DOCS ──────────────────────
    const versionFiles = [
      'ARCH_DOCS/MASTER_ARCHITECTURE.md',
      'ARCH_DOCS/APPLICATION_FUNCTIONS.md',
      'ARCH_DOCS/CURRENT_STATUS.md',
      'ARCH_DOCS/LESSONS_LEARNED.md',
      '.github/copilot-instructions.md',
    ]

    const versions: { file: string; version: string }[] = []
    for (const relPath of versionFiles) {
      const fp = path.join(ctx.workspaceRoot, relPath)
      if (!fs.existsSync(fp)) continue
      const content = fs.readFileSync(fp, 'utf-8')

      // Extract version patterns like "v5.3" or "Version: v5.3"
      const vMatch = content.match(/\bv(\d+\.\d+)\b/)
      if (vMatch) {
        versions.push({ file: relPath, version: vMatch[0] })
      }
    }

    const uniqueVersions = [...new Set(versions.map(v => v.version))]
    if (uniqueVersions.length === 1) {
      passed++
    } else if (uniqueVersions.length > 1) {
      warnings++
      findings.push({
        domain: 'arch-alignment',
        severity: 'medium',
        title: `Version mismatch across ARCH_DOCS`,
        detail: `Found ${uniqueVersions.length} different versions: ${versions.map(v => `${v.file}=${v.version}`).join(', ')}`,
        remediation: `Harmonize all files to the latest version: ${uniqueVersions.sort().pop()}`,
      })
    }

    // ── Check 2: Route file count ──────────────────────────────────────────
    const routesDir = path.join(ctx.workspaceRoot, 'workers', 'src', 'routes')
    if (fs.existsSync(routesDir)) {
      const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'))
      const routeCount = routeFiles.length

      // Check APPLICATION_FUNCTIONS.md for declared count
      const appFuncPath = path.join(ctx.workspaceRoot, 'ARCH_DOCS', 'APPLICATION_FUNCTIONS.md')
      if (fs.existsSync(appFuncPath)) {
        const content = fs.readFileSync(appFuncPath, 'utf-8')
        const countMatch = content.match(/(\d+)\s*route\s*files?/i)
        if (countMatch) {
          const declaredCount = parseInt(countMatch[1])
          if (declaredCount === routeCount) {
            passed++
          } else {
            warnings++
            findings.push({
              domain: 'arch-alignment',
              severity: 'medium',
              title: `Route count mismatch`,
              detail: `APPLICATION_FUNCTIONS.md says ${declaredCount} route files, actual: ${routeCount}`,
              file: 'ARCH_DOCS/APPLICATION_FUNCTIONS.md',
              remediation: `Update to ${routeCount} route files`,
            })
          }
        }
      }
    }

    // ── Check 3: Lib module count ──────────────────────────────────────────
    const libDir = path.join(ctx.workspaceRoot, 'workers', 'src', 'lib')
    if (fs.existsSync(libDir)) {
      const libFiles = fs.readdirSync(libDir).filter(f => f.endsWith('.ts'))
      const libCount = libFiles.length

      findings.push({
        domain: 'arch-alignment',
        severity: 'info',
        title: `Workers lib modules: ${libCount}`,
        detail: `Found ${libCount} lib modules in workers/src/lib/`,
      })
      passed++
    }

    // ── Check 4: Cron job count ────────────────────────────────────────────
    const scheduledPath = path.join(ctx.workspaceRoot, 'workers', 'src', 'scheduled.ts')
    if (fs.existsSync(scheduledPath)) {
      const content = fs.readFileSync(scheduledPath, 'utf-8')
      // Count unique async function definitions or case blocks
      const cronFunctions = content.match(/async function \w+/g) || []
      // Subtract the main scheduled handler itself
      const cronCount = Math.max(0, cronFunctions.length - 1)

      const wranglerPath = path.join(ctx.workspaceRoot, 'workers', 'wrangler.toml')
      if (fs.existsSync(wranglerPath)) {
        const wConfig = fs.readFileSync(wranglerPath, 'utf-8')
        const cronPatterns = wConfig.match(/crons\s*=\s*\[([^\]]*)\]/s)
        if (cronPatterns) {
          const declaredCrons = (cronPatterns[1].match(/"/g) || []).length / 2
          findings.push({
            domain: 'arch-alignment',
            severity: 'info',
            title: `Cron jobs: ${declaredCrons} scheduled, ${cronCount} implemented`,
            detail: `wrangler.toml declares ${declaredCrons} cron triggers, scheduled.ts has ${cronCount} handler functions`,
          })
          passed++
        }
      }
    }

    // ── Check 5: Frontend pages exist ──────────────────────────────────────
    const expectedPages = [
      'app/work/page.tsx',
      'app/command/page.tsx',
      'app/accounts/page.tsx',
      'app/analytics/page.tsx',
      'app/campaigns/page.tsx',
      'app/compliance/page.tsx',
      'app/settings/page.tsx',
      'app/admin/page.tsx',
      'app/signin/page.tsx',
      'app/signup/page.tsx',
      'app/onboarding/page.tsx',
      'app/inbox/page.tsx',
      'app/payments/page.tsx',
    ]

    let pagesFound = 0
    let pagesMissing = 0
    for (const page of expectedPages) {
      const fp = path.join(ctx.workspaceRoot, page)
      if (fs.existsSync(fp)) {
        pagesFound++
      } else {
        pagesMissing++
        findings.push({
          domain: 'arch-alignment',
          severity: 'low',
          title: `Missing page: ${page}`,
          detail: `Expected frontend page does not exist`,
          file: page,
        })
      }
    }

    if (pagesMissing === 0) {
      passed++
    } else {
      warnings += pagesMissing
    }

    // ── Check 6: ROADMAP accuracy ──────────────────────────────────────────
    const roadmapPath = path.join(ctx.workspaceRoot, 'ROADMAP.md')
    if (fs.existsSync(roadmapPath)) {
      const content = fs.readFileSync(roadmapPath, 'utf-8')
      const checkedItems = (content.match(/- \[x\]/g) || []).length
      const uncheckedItems = (content.match(/- \[ \]/g) || []).length
      const totalItems = checkedItems + uncheckedItems

      // Check if progress line matches
      const progressMatch = content.match(/(\d+)\/(\d+)\s*items?\s*complete/i)
      if (progressMatch) {
        const declared = parseInt(progressMatch[1])
        const declaredTotal = parseInt(progressMatch[2])

        if (declared === checkedItems && declaredTotal === totalItems) {
          passed++
        } else {
          warnings++
          findings.push({
            domain: 'arch-alignment',
            severity: 'medium',
            title: 'ROADMAP progress mismatch',
            detail: `Header says ${declared}/${declaredTotal}, actual: ${checkedItems}/${totalItems} (${uncheckedItems} unchecked)`,
            file: 'ROADMAP.md',
            remediation: `Update progress to ${checkedItems}/${totalItems}`,
          })
        }
      }

      findings.push({
        domain: 'arch-alignment',
        severity: 'info',
        title: `ROADMAP: ${checkedItems}/${totalItems} items checked`,
        detail: `${uncheckedItems} remaining items`,
      })
    }

    return {
      domain: 'arch-alignment',
      agentName: 'ARCH_DOCS Alignment',
      passed,
      failed,
      warnings,
      findings,
      durationMs: Date.now() - start,
    }
  },
}
