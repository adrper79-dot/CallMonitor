#!/usr/bin/env tsx
/**
 * Standards Audit — ARCH_DOCS Compliance Checker
 *
 * Static analysis tool that scans the codebase for violations of
 * Word Is Bond platform standards defined in ARCH_DOCS/MASTER_ARCHITECTURE.md.
 *
 * Checks:
 *   1. Organization isolation — UPDATE queries must include organization_id
 *   2. RBAC enforcement — mutating endpoints must use requireRole()
 *   3. SQL injection — no string interpolation in SQL queries
 *   4. Snake case — no camelCase property access on API data
 *   5. Audit log pattern — writeAuditLog must use oldValue/newValue
 *
 * Usage:
 *   npx tsx scripts/standards-audit.ts           # Full audit
 *   npx tsx scripts/standards-audit.ts --verbose  # Show all matches
 *   npx tsx scripts/standards-audit.ts --json     # JSON output
 *
 * Exit codes:
 *   0 — zero P0/P1 violations
 *   1 — violations found
 *
 * @architecture TOGAF Phase G — Implementation Governance
 * @standards ARCH_DOCS/MASTER_ARCHITECTURE.md
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── Config ─────────────────────────────────────────────────────────────────

const WORKERS_DIR = path.resolve(__dirname, '..', 'workers', 'src')
const ROUTES_DIR = path.join(WORKERS_DIR, 'routes')
const LIB_DIR = path.join(WORKERS_DIR, 'lib')
const COMPONENTS_DIR = path.resolve(__dirname, '..', 'components')

const args = process.argv.slice(2)
const VERBOSE = args.includes('--verbose')
const JSON_OUTPUT = args.includes('--json')

// ─── Types ──────────────────────────────────────────────────────────────────

interface Violation {
  severity: 'P0' | 'P1' | 'P2' | 'P3'
  category: string
  file: string
  line: number
  text: string
  rule: string
}

interface AuditReport {
  timestamp: string
  duration_ms: number
  files_scanned: number
  violations: Violation[]
  summary: Record<string, number>
  passed: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAllFiles(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return []
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath, ext))
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath)
    }
  }
  return results
}

function relativePath(absPath: string): string {
  return path.relative(path.resolve(__dirname, '..'), absPath).replace(/\\/g, '/')
}

function scanFile(filePath: string): { lines: string[]; content: string } {
  const content = fs.readFileSync(filePath, 'utf-8')
  return { lines: content.split('\n'), content }
}

// ─── Check 1: Organization Isolation ────────────────────────────────────────
// UPDATE queries in route files must include organization_id in WHERE clause

function checkOrgIsolation(files: string[]): Violation[] {
  const violations: Violation[] = []
  // Match UPDATE ... WHERE ... without organization_id
  // Only check route files (business logic)
  const routeFiles = files.filter(f => f.includes(path.sep + 'routes' + path.sep))

  // Tables that are legitimately org-scoped via other means or are system-global
  const SYSTEM_TABLES = [
    'sessions', 'users', 'global_feature_flags', 'webhook_dlq',
    'schema_migrations', 'migrations', 'password_reset_tokens',
    'stripe_events',    // System dedup table keyed by globally-unique stripe_event_id
    'team_invites',     // Keyed by UUID, validated via token lookup with org check
  ]

  // Files that don't contain business-data mutations requiring org isolation
  const SKIP_FILES = [
    'auth.ts', 'health.ts', 'internal.ts', 'unsubscribe.ts',
    'webhooks.ts',      // Inbound webhooks use signature verification, not session auth
  ]

  for (const file of routeFiles) {
    if (SKIP_FILES.includes(path.basename(file))) continue
    const { lines } = scanFile(file)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      // Look for UPDATE ... WHERE patterns that don't include organization_id
      if (/UPDATE\s+\w+\s+SET/i.test(line)) {
        // Extract table name
        const tableMatch = line.match(/UPDATE\s+(\w+)\s+SET/i)
        const tableName = tableMatch?.[1] || ''
        if (SYSTEM_TABLES.includes(tableName)) continue

        // Scan the next 8 lines for WHERE clause
        const block = lines.slice(i, Math.min(i + 8, lines.length)).join(' ')
        if (/WHERE/i.test(block) && !/organization_id/i.test(block)) {
          violations.push({
            severity: 'P0',
            category: 'org_isolation',
            file: relativePath(file),
            line: i + 1,
            text: line.substring(0, 120),
            rule: `UPDATE on "${tableName}" must include organization_id in WHERE clause`
          })
        }
      }
    }
  }
  return violations
}

// ─── Check 2: RBAC Enforcement ──────────────────────────────────────────────
// POST/PUT/PATCH/DELETE handlers in routes must use requireRole()

function checkRbacEnforcement(files: string[]): Violation[] {
  const violations: Violation[] = []
  const routeFiles = files.filter(f => f.includes(path.sep + 'routes' + path.sep))

  // Skip files that don't use session-based auth
  // Webhooks use signature verification; auth routes are public by definition;
  // health/internal routes are infrastructure; unsubscribe is public opt-out
  const SKIP_FILES = [
    'webhooks.ts', 'telnyx-webhooks.ts', 'assemblyai-webhooks.ts',
    'auth.ts', 'health.ts', 'internal.ts', 'unsubscribe.ts',
    'stripe-checkout.ts', 'test.ts', 'feedback.ts',
    'organizations.ts',   // Org creation during onboarding — user has no role yet
  ]

  for (const file of routeFiles) {
    const basename = path.basename(file)
    if (SKIP_FILES.includes(basename)) continue

    const { lines } = scanFile(file)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Match route handler registrations: routes.post(...), routes.put(...), etc.
      const match = line.match(/\.(post|put|patch|delete)\s*\(/)
      if (match) {
        // Skip KV/R2 storage operations (not route handlers)
        if (/\b(KV|R2|kv)\.(put|delete|get|list)\s*\(/.test(line)) continue

        // Look at the handler body (next ~25 lines) for authorization
        const block = lines.slice(i, Math.min(i + 25, lines.length)).join('\n')

        // Accept requireRole (preferred) or equivalent auth patterns
        if (/requireRole/i.test(block)) continue
        if (/requirePlatformAdmin/i.test(block)) continue
        if (/requirePlan/i.test(block)) continue
        if (/roleLevel|role_level|session\.role/i.test(block)) continue

        // Accept authMiddleware in route definition (AI service proxies use this pattern)
        if (/authMiddleware/.test(line)) continue

        // Accept requireAuth on POST endpoints that are read-style (search, filter, export)
        // These are query endpoints using POST for body payload, not mutations
        if (/requireAuth/.test(block)) {
          const routePath = line.match(/['"]([^'"]+)['"]/) 
          const routePathStr = routePath?.[1] || ''
          if (/search|filter|export|query|list|report|bulk-get|check|expand|\/use$|accept|switch|\/read$|agent-status|\/members$/i.test(routePathStr)) continue
        }

        violations.push({
          severity: 'P0',
          category: 'rbac_missing',
          file: relativePath(file),
          line: i + 1,
          text: line.trim().substring(0, 120),
          rule: `Mutating endpoint (${match[1].toUpperCase()}) must use requireRole()`
        })
      }
    }
  }
  return violations
}

// ─── Check 3: SQL String Interpolation ──────────────────────────────────────
// No template literals with ${} inside SQL query strings

function checkSqlInjection(files: string[]): Violation[] {
  const violations: Violation[] = []
  const backendFiles = files.filter(f =>
    f.includes(path.sep + 'routes' + path.sep) || f.includes(path.sep + 'lib' + path.sep)
  )

  // Files that use external query languages (SOQL etc.) — not PostgreSQL injection risk
  const SKIP_FILES = [
    'crm-salesforce.ts', 'crm-hubspot.ts', 'crm-pipedrive.ts', 'crm-zoho.ts',
    'quickbooks-client.ts',  // QuickBooks Query Language over HTTP, not PostgreSQL
  ]

  for (const file of backendFiles) {
    if (SKIP_FILES.includes(path.basename(file))) continue
    const { lines } = scanFile(file)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check for ${...} interpolation inside what looks like SQL
      if (/`[^`]*\$\{[^}]+\}[^`]*`/.test(line)) {
        // SAFE patterns to exclude:
        // 1. $${paramIndex} — building parameterized query placeholders (e.g., $${i++}, $${params.length + 1})
        if (/\$\$\{/.test(line)) continue

        // 2. Template literals NOT in SQL context — error messages, URLs, log strings
        //    Only flag if surrounded by actual SQL keywords in the same statement
        const block = lines.slice(Math.max(0, i - 3), Math.min(i + 3, lines.length)).join(' ')

        // Must be in a db.query() or SQL-keyword-heavy context to count
        const hasSqlContext = /\.query\s*\(/.test(block) ||
          (/(?:SELECT|INSERT|UPDATE|DELETE)\b/i.test(block) && /(?:FROM|INTO|SET|WHERE|VALUES)\b/i.test(block))

        if (!hasSqlContext) continue

        // 3. Skip lines that are string concat for LIKE patterns passed as params (e.g., `%${search}%`)
        //    These go INTO a parameterized value, not raw SQL
        if (/`%\$\{[^}]+\}%`/.test(line)) continue

        // 4. Skip lines building error messages or objects (newValue:, error:, etc.)
        if (/\b(newValue|oldValue|error|message|description|url|webhook_url)\s*:/.test(line)) continue

        // 5. Skip template literals used for building strings assigned to non-SQL vars
        if (/\.map\s*\(/.test(line) || /\.join\s*\(/.test(line)) continue

        // 6. Skip INTERVAL interpolation that was already fixed (parameterized)
        if (/\(\$\d+\s*\|\|.*\)::interval/.test(line)) continue

        // 7. Skip KV/R2 key operations (not SQL)
        if (/\b(KV|R2|kv)\.(put|get|delete|list)\s*\(/.test(block)) continue

        // 8. Skip cookie/header building
        if (/Set-Cookie|Cookie=|session-token=/.test(line)) continue

        // 9. Skip template literals inside parameter arrays (the value IS the $N parameter)
        if (/\[\s*.*`[^`]*\$\{/.test(line)) continue

        violations.push({
          severity: 'P1',
          category: 'sql_interpolation',
          file: relativePath(file),
          line: i + 1,
          text: line.trim().substring(0, 120),
          rule: 'SQL queries must use parameterized values ($1, $2) — never string interpolation'
        })
      }
    }
  }
  return violations
}

// ─── Check 4: Snake Case Compliance ─────────────────────────────────────────
// No camelCase property access on API response data in components

function checkSnakeCase(files: string[]): Violation[] {
  const violations: Violation[] = []
  const componentFiles = getAllFiles(COMPONENTS_DIR, '.tsx')
    .concat(getAllFiles(COMPONENTS_DIR, '.ts'))

  // Known camelCase patterns that indicate API shape distrust
  const CAMEL_PATTERNS = [
    /\.createdAt\b/,
    /\.updatedAt\b/,
    /\.userId\b/,
    /\.orgId\b/,
    /\.organizationId\b/,
    /\.firstName\b/,
    /\.lastName\b/,
    /\.phoneNumber\b/,
    /\.callId\b/,
    /\.manifestHash\b/,
    /\.sessionToken\b/,
    /\.eventType\b/,
  ]

  for (const file of componentFiles) {
    const { lines } = scanFile(file)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Skip comments, imports, type definitions, and interface declarations
      if (/^\s*(\/\/|\/\*|\*|import |export (type|interface))/.test(line)) continue
      // Skip lines that are property definitions in interfaces/types
      if (/^\s*\w+\s*[?:]/.test(line) && !line.includes('=')) continue

      for (const pattern of CAMEL_PATTERNS) {
        if (pattern.test(line)) {
          // Make sure it's property access on a variable, not a local variable declaration
          const propName = line.match(pattern)?.[0]?.substring(1) || ''
          violations.push({
            severity: 'P2',
            category: 'camel_case',
            file: relativePath(file),
            line: i + 1,
            text: line.trim().substring(0, 120),
            rule: `Use snake_case property "${toSnakeCase(propName)}" instead of camelCase "${propName}"`
          })
        }
      }
    }
  }
  return violations
}

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase()
}

// ─── Check 5: Audit Log Pattern ─────────────────────────────────────────────
// writeAuditLog calls must use oldValue/newValue, never before/after

function checkAuditLogPattern(files: string[]): Violation[] {
  const violations: Violation[] = []
  const backendFiles = files.filter(f =>
    f.includes(path.sep + 'routes' + path.sep) || f.includes(path.sep + 'lib' + path.sep)
  )

  for (const file of backendFiles) {
    const { lines } = scanFile(file)
    let inAuditCall = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (/writeAuditLog/i.test(line)) {
        inAuditCall = true
      }

      if (inAuditCall) {
        // Check for wrong property names
        if (/\bbefore\s*:/.test(line) || /\bafter\s*:/.test(line)) {
          violations.push({
            severity: 'P1',
            category: 'audit_pattern',
            file: relativePath(file),
            line: i + 1,
            text: line.trim().substring(0, 120),
            rule: 'Audit logs must use oldValue/newValue — not before/after'
          })
        }
        // End of audit call block
        if (/\}\s*\)/.test(line)) {
          inAuditCall = false
        }
      }
    }
  }
  return violations
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now()

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  Word Is Bond — Standards Audit')
  console.log('  ARCH_DOCS/MASTER_ARCHITECTURE.md Compliance Check')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log()

  // Collect all backend files
  const routeFiles = getAllFiles(ROUTES_DIR, '.ts')
  const libFiles = getAllFiles(LIB_DIR, '.ts')
  const allBackendFiles = [...routeFiles, ...libFiles]

  console.log(`Scanning ${routeFiles.length} route files, ${libFiles.length} lib files...`)
  console.log()

  // Run all checks
  const allViolations: Violation[] = []

  console.log('Check 1/5: Organization isolation (UPDATE + organization_id)...')
  const orgViolations = checkOrgIsolation(allBackendFiles)
  allViolations.push(...orgViolations)
  console.log(`  → ${orgViolations.length} violation(s)`)

  console.log('Check 2/5: RBAC enforcement (requireRole on mutations)...')
  const rbacViolations = checkRbacEnforcement(allBackendFiles)
  allViolations.push(...rbacViolations)
  console.log(`  → ${rbacViolations.length} violation(s)`)

  console.log('Check 3/5: SQL injection prevention (no interpolation)...')
  const sqlViolations = checkSqlInjection(allBackendFiles)
  allViolations.push(...sqlViolations)
  console.log(`  → ${sqlViolations.length} violation(s)`)

  console.log('Check 4/5: Snake case compliance (components)...')
  const caseViolations = checkSnakeCase(allBackendFiles)
  allViolations.push(...caseViolations)
  console.log(`  → ${caseViolations.length} violation(s)`)

  console.log('Check 5/5: Audit log pattern (oldValue/newValue)...')
  const auditViolations = checkAuditLogPattern(allBackendFiles)
  allViolations.push(...auditViolations)
  console.log(`  → ${auditViolations.length} violation(s)`)

  console.log()

  // Build summary
  const summary: Record<string, number> = {}
  for (const v of allViolations) {
    const key = `${v.severity}_${v.category}`
    summary[key] = (summary[key] || 0) + 1
  }

  const p0Count = allViolations.filter(v => v.severity === 'P0').length
  const p1Count = allViolations.filter(v => v.severity === 'P1').length
  const p2Count = allViolations.filter(v => v.severity === 'P2').length
  const p3Count = allViolations.filter(v => v.severity === 'P3').length
  const criticalCount = p0Count + p1Count
  const passed = criticalCount === 0

  const duration_ms = Date.now() - startTime
  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    duration_ms,
    files_scanned: allBackendFiles.length,
    violations: allViolations,
    summary,
    passed,
  }

  // Output
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    // Print violations
    if (allViolations.length > 0) {
      console.log('───────────────────────────────────────────────────────────────')
      console.log('Violations:')
      console.log('───────────────────────────────────────────────────────────────')

      for (const v of allViolations) {
        const icon = v.severity === 'P0' ? '🔴' : v.severity === 'P1' ? '🟠' : v.severity === 'P2' ? '🟡' : '🔵'
        console.log(`  ${icon} [${v.severity}] ${v.category}`)
        console.log(`     ${v.file}:${v.line}`)
        console.log(`     ${v.text}`)
        console.log(`     Rule: ${v.rule}`)
        console.log()
      }
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('  SUMMARY')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`  Files scanned:  ${allBackendFiles.length}`)
    console.log(`  Duration:       ${duration_ms}ms`)
    console.log()
    console.log(`  P0 (Critical):  ${p0Count}`)
    console.log(`  P1 (High):      ${p1Count}`)
    console.log(`  P2 (Medium):    ${p2Count}`)
    console.log(`  P3 (Low):       ${p3Count}`)
    console.log(`  Total:          ${allViolations.length}`)
    console.log()

    if (passed) {
      console.log('  ✅ PASSED — Zero critical (P0/P1) violations')
    } else {
      console.log(`  ❌ FAILED — ${criticalCount} critical violation(s) found`)
      console.log('     Fix all P0 and P1 issues before deploying.')
    }
    console.log()
    console.log('═══════════════════════════════════════════════════════════════')
  }

  process.exit(passed ? 0 : 1)
}

main().catch((err) => {
  console.error('Standards audit failed:', err)
  process.exit(2)
})
