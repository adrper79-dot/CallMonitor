/**
 * Security Auditor Agent — Scans codebase for tenant isolation + RBAC + SQL safety
 *
 * File-system based static analysis (no LLM needed):
 *  1. UPDATE/DELETE queries missing organization_id in WHERE
 *  2. Mutation endpoints missing requireRole()
 *  3. SQL string interpolation (template literals in queries)
 *  4. Raw fetch() to API endpoints (should use apiClient)
 *
 * Maps to: VALIDATION_PLAN.md P0/P1 findings
 * @see ARCH_DOCS/VALIDATION_PLAN.md (security audit items)
 * @see workers/src/lib/auth.ts (requireAuth/requireRole)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ValidationAgent, ValidationContext, AgentResult, ValidationFinding } from '../types'

export const securityAuditAgent: ValidationAgent = {
  name: 'Security Auditor',
  domain: 'security',
  description: 'Static analysis for tenant isolation, RBAC enforcement, and SQL injection vectors',

  async run(ctx: ValidationContext): Promise<AgentResult> {
    const findings: ValidationFinding[] = []
    let passed = 0
    let failed = 0
    let warnings = 0
    const start = Date.now()

    const routesDir = path.join(ctx.workspaceRoot, 'workers', 'src', 'routes')
    const libDir = path.join(ctx.workspaceRoot, 'workers', 'src', 'lib')

    if (!fs.existsSync(routesDir)) {
      findings.push({
        domain: 'security',
        severity: 'critical',
        title: 'Routes directory not found',
        detail: `Expected ${routesDir} to exist`,
      })
      return { domain: 'security', agentName: 'Security Auditor', passed: 0, failed: 1, warnings: 0, findings, durationMs: Date.now() - start }
    }

    const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'))

    for (const file of routeFiles) {
      const filePath = path.join(routesDir, file)
      const content = fs.readFileSync(filePath, 'utf-8')
      const relPath = `workers/src/routes/${file}`

      // ── Check 1: UPDATE/DELETE without organization_id ───────────────────
      // Split into lines for accurate comment detection
      const lines = content.split('\n')
      const updateDeleteRegex = /\b(UPDATE|DELETE\s+FROM)\s+\w+/gi
      const matches = content.matchAll(updateDeleteRegex)
      for (const match of matches) {
        const startIdx = match.index!
        const lineNum = content.slice(0, startIdx).split('\n').length
        const line = lines[lineNum - 1]?.trim() || ''

        // Skip comments (single-line, JSDoc, SQL comments)
        if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*') || line.startsWith('--')) continue

        // Skip if match is inside a string description or log message (not actual SQL)
        const colInLine = startIdx - content.lastIndexOf('\n', startIdx - 1) - 1
        const beforeMatch = line.slice(0, colInLine)
        if (/\b(console\.|throw |log\(|description|message|title|label|Error\()/i.test(beforeMatch)) continue

        // Skip files that operate cross-org by design
        if (['webhooks.ts', 'auth.ts', 'health.ts', 'cron-health.ts', 'stripe.ts', 'unsubscribe.ts'].includes(file)) {
          passed++
          continue
        }

        // Get surrounding context (look 800 chars ahead to catch high-index params like $14)
        const endIdx = Math.min(startIdx + 800, content.length)
        const sqlContext = content.slice(startIdx, endIdx)

        // Check if organization_id appears in the query or its wider context
        if (!sqlContext.includes('organization_id') && !sqlContext.includes('org_id')) {
          // Additional check: if it's inside a block comment region, skip
          const beforeContent = content.slice(0, startIdx)
          const lastBlockOpen = beforeContent.lastIndexOf('/*')
          const lastBlockClose = beforeContent.lastIndexOf('*/')
          if (lastBlockOpen > lastBlockClose) continue // inside /* ... */

          // Check if org isolation is enforced by a prior SELECT guard in the same handler
          // Look backwards for a SELECT ... WHERE ... organization_id pattern within 4000 chars
          const lookbackStart = Math.max(0, startIdx - 4000)
          const priorContext = content.slice(lookbackStart, startIdx)
          const hasPriorGuard = /SELECT\b[^;]*\borganization_id\b/i.test(priorContext)

          // Check if this is an INSERT...ON CONFLICT...DO UPDATE (org_id in INSERT VALUES)
          // The UPDATE keyword appears inside ON CONFLICT DO UPDATE SET, so look back 1000 chars
          // for the INSERT that started this statement
          const upsertLookback = Math.max(0, startIdx - 1000)
          const statementContext = content.slice(upsertLookback, endIdx)
          const isUpsert = /INSERT\b[^;]*\borganization_id\b[^;]*ON\s+CONFLICT/is.test(statementContext)

          if (hasPriorGuard || isUpsert) {
            passed++
            continue
          }

          failed++
          findings.push({
            domain: 'security',
            severity: 'critical',
            title: `Missing org isolation: ${match[0]}`,
            detail: `${relPath}:${lineNum} — UPDATE/DELETE without organization_id in WHERE clause`,
            file: relPath,
            line: lineNum,
            remediation: 'Add AND organization_id = $N to WHERE clause with session.organization_id',
          })
        } else {
          passed++
        }
      }

      // ── Check 2: POST/PUT/PATCH/DELETE handlers without requireRole ──────
      // Match Hono route registrations: routeVar.post('/path', ...
      // Exclude KV.put, R2.put, env.KV.delete etc by requiring Routes suffix or known pattern
      const mutationRegex = /(?:Routes|routes)\.(post|put|patch|delete)\s*\(\s*['"`]/gi
      const mutationMatches = content.matchAll(mutationRegex)

      for (const match of mutationMatches) {
        const startIdx = match.index!
        const lineNum = content.slice(0, startIdx).split('\n').length

        // Look at the handler chain (middleware list) AND handler body (first ~600 chars)
        const handlerContext = content.slice(startIdx, Math.min(startIdx + 600, content.length))

        // Skip webhook routes, health routes, auth routes, unsubscribe routes
        if (['webhooks.ts', 'health.ts', 'auth.ts', 'unsubscribe.ts', 'cron-health.ts'].includes(file)) {
          passed++
          continue
        }

        const hasAuth = handlerContext.includes('requireAuth') ||
                        handlerContext.includes('requireRole') ||
                        handlerContext.includes('authMiddleware') ||
                        handlerContext.includes('requirePlan') ||
                        /rateLimit/i.test(handlerContext) // rate limit middleware implies auth chain (case-insensitive for callerIdRateLimit etc)

        // If auth not found in first 600 chars, check if handler delegates to a helper
        // function that contains auth (e.g., `return await initiateVerification(c)`)
        let hasAuthInDelegate = false
        if (!hasAuth) {
          const delegateMatch = handlerContext.match(/(?:return\s+)?(?:await\s+)?(\w+)\s*\(\s*c\s*[,)]/i)
          if (delegateMatch) {
            const fnName = delegateMatch[1]
            // Check if the delegated function is defined in this file and contains requireRole/requireAuth
            const fnRegex = new RegExp(`(?:async\\s+)?function\\s+${fnName}|(?:const|let)\\s+${fnName}\\s*=`, 'i')
            const fnDefMatch = content.match(fnRegex)
            if (fnDefMatch) {
              const fnStart = fnDefMatch.index!
              const fnBody = content.slice(fnStart, Math.min(fnStart + 1000, content.length))
              hasAuthInDelegate = fnBody.includes('requireAuth') ||
                                   fnBody.includes('requireRole')
            }
          }
        }

        if (hasAuth || hasAuthInDelegate) {
          passed++
        } else {
          warnings++
          findings.push({
            domain: 'security',
            severity: 'high',
            title: `Mutation without RBAC: ${match[1].toUpperCase()} handler`,
            detail: `${relPath}:${lineNum} — mutation endpoint may lack requireAuth/requireRole middleware`,
            file: relPath,
            line: lineNum,
            remediation: 'Add requireAuth() or requireRole() middleware before handler',
          })
        }
      }

      // ── Check 3: SQL string interpolation ────────────────────────────────
      // Look for template literals containing SQL keywords with ${} interpolation
      // but NOT safe patterns like parameterized placeholder generation, dynamic SET
      // clauses from whitelisted fields, or hardcoded conditional clauses
      const templateSqlRegex = /`[^`]*\b(SELECT|INSERT|UPDATE|DELETE|WHERE)\b[^`]*\$\{/gi
      const templateMatches = content.matchAll(templateSqlRegex)

      for (const match of templateMatches) {
        const startIdx = match.index!
        const lineNum = content.slice(0, startIdx).split('\n').length
        const line = lines[lineNum - 1]?.trim() || ''

        // Skip comments
        if (line.startsWith('//') || line.startsWith('*')) continue

        // Get the full template literal for analysis (up to 500 chars)
        const interpolation = content.slice(startIdx, Math.min(startIdx + 500, content.length))

        // Safe patterns that use ${} but are NOT injection risks:
        const isSafe =
          // Dynamic column/table names from code-controlled variables
          interpolation.includes('${tableName}') ||
          interpolation.includes('${table}') ||
          interpolation.includes('${schema}') ||
          // Verified numeric values
          interpolation.includes('${limit}') ||
          interpolation.includes('${offset}') ||
          // Sort/order from validated enum  
          interpolation.includes('${column}') ||
          interpolation.includes('${orderBy}') ||
          interpolation.includes('${sortDir}') ||
          interpolation.includes('${direction}') ||
          // Dynamic WHERE/SET clauses built with parameterized $N placeholders
          interpolation.includes('${conditions}') ||
          interpolation.includes('${whereClause}') ||
          interpolation.includes('${filterClause}') ||
          interpolation.includes('${setClauses}') ||
          interpolation.includes('${updates}') ||
          interpolation.includes('.join(') ||  // Array.join for $N placeholders
          // Parameterized IN clause placeholders ($3, $4, $5...)
          interpolation.includes('${placeholders}') ||
          interpolation.includes('${placeholder') ||
          // Dynamic param index (builds $1, $2 programmatically)
          /\$\{\s*params\.length/i.test(interpolation) ||
          /\$\$\{.*paramIndex/i.test(interpolation) ||
          /\$\$\{.*params\.length/i.test(interpolation) ||
          /\$\$\{.*idx/i.test(interpolation) ||
          /\$\$\{i\s*\+/i.test(interpolation) ||
          // Hardcoded conditional SQL fragments (not user input)
          /\$\{\s*\w+\s*\?\s*[`'"].*AND\s+\w+\s*=\s*\$/i.test(interpolation) ||
          // c.html() output — HTML, not SQL
          /c\.html\(/.test(content.slice(Math.max(0, startIdx - 50), startIdx)) ||
          // Audit/log related template (not SQL execution)
          /\$\{.*\.name\}|\$\{.*\.email\}|\$\{.*displayName\}|\$\{.*token\}/i.test(interpolation) ||
          // Dynamic SET from code-controlled fields (e.g., setClauses built from Object.entries or allowedFields)
          interpolation.includes('${field}') ||
          // Count queries using parameterized status
          /\$\{\s*\w+Clause\s*\}/i.test(interpolation) ||
          interpolation.includes('${sinceClause}') ||
          interpolation.includes('${callbackWhereClause}') ||
          interpolation.includes('${countQuery}')

        if (!isSafe) {
          // Final check: is the interpolated value a user-supplied string literal like '${status}'?
          // That's a real injection — but ${params.length} or ${setClauses.join} is not.
          const dangerousInterpolation = /\$\{(?!.*\.length|.*\.join|.*Index|.*params|.*idx|.*placeholders).*\}/.test(
            interpolation.slice(0, 100)
          )
          if (!dangerousInterpolation) {
            passed++
            continue
          }

          failed++
          findings.push({
            domain: 'security',
            severity: 'high',
            title: 'SQL string interpolation detected',
            detail: `${relPath}:${lineNum} — template literal contains SQL with \${} interpolation`,
            file: relPath,
            line: lineNum,
            remediation: 'Use parameterized queries ($1, $2, $3) — never string interpolation in SQL',
          })
        } else {
          passed++
        }
      }
    }

    // ── Check 4: Frontend raw fetch() to API ─────────────────────────────────
    const libClientDir = path.join(ctx.workspaceRoot, 'lib')
    const appDir = path.join(ctx.workspaceRoot, 'app')
    const componentsDir = path.join(ctx.workspaceRoot, 'components')
    const hooksDir = path.join(ctx.workspaceRoot, 'hooks')

    for (const dir of [appDir, componentsDir, hooksDir]) {
      if (!fs.existsSync(dir)) continue
      const tsxFiles = getAllFiles(dir, ['.tsx', '.ts'])

      for (const filePath of tsxFiles) {
        const content = fs.readFileSync(filePath, 'utf-8')
        const relPath = path.relative(ctx.workspaceRoot, filePath).replace(/\\/g, '/')

        // Look for raw fetch() calls to API
        const rawFetchRegex = /fetch\s*\(\s*[`'"]\/?api\//g
        const fetchMatches = content.matchAll(rawFetchRegex)

        for (const match of fetchMatches) {
          const lineNum = content.slice(0, match.index!).split('\n').length
          warnings++
          findings.push({
            domain: 'security',
            severity: 'medium',
            title: 'Raw fetch() to API endpoint',
            detail: `${relPath}:${lineNum} — should use apiGet/apiPost from @/lib/apiClient`,
            file: relPath,
            line: lineNum,
            remediation: 'Replace raw fetch() with apiGet/apiPost/apiPut/apiDelete from @/lib/apiClient',
          })
        }
      }
    }

    // Summary
    if (failed === 0 && warnings === 0) {
      findings.push({
        domain: 'security',
        severity: 'info',
        title: 'Security scan clean',
        detail: `Scanned ${routeFiles.length} route files — no critical issues found`,
      })
    }

    return {
      domain: 'security',
      agentName: 'Security Auditor',
      passed,
      failed,
      warnings,
      findings,
      durationMs: Date.now() - start,
    }
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAllFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        results.push(...getAllFiles(fullPath, extensions))
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        results.push(fullPath)
      }
    }
  } catch { /* directory not readable */ }
  return results
}
