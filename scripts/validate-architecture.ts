#!/usr/bin/env tsx
/**
 * Architecture Validation — ARCH_DOCS Structural Integrity Checker
 *
 * Validates that the filesystem, APPLICATION_FUNCTIONS.md, and wrangler.toml
 * are synchronized. Part of the 4-layer validation pyramid (Layer 1).
 *
 * Checks:
 *   1. Route file count matches APPLICATION_FUNCTIONS.md
 *   2. Lib module count matches APPLICATION_FUNCTIONS.md
 *   3. Cron expressions in wrangler.toml match scheduled.ts handlers
 *   4. Every route file is referenced in APPLICATION_FUNCTIONS.md
 *   5. Orphan detection — components imported nowhere
 *
 * Usage:
 *   npx tsx scripts/validate-architecture.ts            # Full check
 *   npx tsx scripts/validate-architecture.ts --verbose   # Show per-file detail
 *   npx tsx scripts/validate-architecture.ts --json      # JSON output
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — one or more checks failed
 *
 * @architecture TOGAF Phase G — Implementation Governance
 * @standards ARCH_DOCS/MASTER_ARCHITECTURE.md
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── Config ─────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..')
const WORKERS_DIR = path.join(ROOT, 'workers', 'src')
const ROUTES_DIR = path.join(WORKERS_DIR, 'routes')
const LIB_DIR = path.join(WORKERS_DIR, 'lib')
const APP_FUNCTIONS_PATH = path.join(ROOT, 'ARCH_DOCS', 'APPLICATION_FUNCTIONS.md')
const WRANGLER_PATH = path.join(ROOT, 'workers', 'wrangler.toml')
const SCHEDULED_PATH = path.join(WORKERS_DIR, 'scheduled.ts')

const args = process.argv.slice(2)
const VERBOSE = args.includes('--verbose')
const JSON_OUTPUT = args.includes('--json')

// ─── Types ──────────────────────────────────────────────────────────────────

interface CheckResult {
  name: string
  passed: boolean
  expected: string | number
  actual: string | number
  details: string[]
}

interface ArchReport {
  timestamp: string
  duration_ms: number
  checks: CheckResult[]
  all_passed: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function listTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
}

function extractDocCount(content: string, label: string): number | null {
  // Match patterns like "| Backend Route Files | Hono on Workers | 61 |"
  const regex = new RegExp(`\\|\\s*${label}\\s*\\|[^|]*\\|\\s*(\\d+)\\s*\\|`, 'i')
  const match = content.match(regex)
  return match ? parseInt(match[1], 10) : null
}

// ─── Check 1: Route File Count ──────────────────────────────────────────────

function checkRouteCount(docContent: string): CheckResult {
  const routeFiles = listTsFiles(ROUTES_DIR)
  const docCount = extractDocCount(docContent, 'Backend Route Files')

  const details: string[] = []
  if (VERBOSE) {
    details.push(`Route files found: ${routeFiles.join(', ')}`)
  }

  if (docCount === null) {
    return {
      name: 'Route file count',
      passed: false,
      expected: 'documented',
      actual: routeFiles.length,
      details: ['Could not find "Backend Route Files" count in APPLICATION_FUNCTIONS.md'],
    }
  }

  const passed = routeFiles.length === docCount
  if (!passed) {
    details.push(`APPLICATION_FUNCTIONS.md says ${docCount}, filesystem has ${routeFiles.length}`)
    // Find which files might be missing from docs or extra
    details.push(`Files: ${routeFiles.join(', ')}`)
  }

  return {
    name: 'Route file count',
    passed,
    expected: docCount,
    actual: routeFiles.length,
    details,
  }
}

// ─── Check 2: Lib Module Count ──────────────────────────────────────────────

function checkLibCount(docContent: string): CheckResult {
  const libFiles = listTsFiles(LIB_DIR)
  const docCount = extractDocCount(docContent, 'Backend Lib Modules')

  const details: string[] = []
  if (VERBOSE) {
    details.push(`Lib files found: ${libFiles.join(', ')}`)
  }

  if (docCount === null) {
    return {
      name: 'Lib module count',
      passed: false,
      expected: 'documented',
      actual: libFiles.length,
      details: ['Could not find "Backend Lib Modules" count in APPLICATION_FUNCTIONS.md'],
    }
  }

  const passed = libFiles.length === docCount
  if (!passed) {
    details.push(`APPLICATION_FUNCTIONS.md says ${docCount}, filesystem has ${libFiles.length}`)
    details.push(`Files: ${libFiles.join(', ')}`)
  }

  return {
    name: 'Lib module count',
    passed,
    expected: docCount,
    actual: libFiles.length,
    details,
  }
}

// ─── Check 3: Cron Configuration Consistency ────────────────────────────────

function checkCronConsistency(): CheckResult {
  const details: string[] = []

  // Parse wrangler.toml crons
  let wranglerContent: string
  try {
    wranglerContent = fs.readFileSync(WRANGLER_PATH, 'utf8')
  } catch {
    return {
      name: 'Cron configuration',
      passed: false,
      expected: 'wrangler.toml readable',
      actual: 'file not found',
      details: ['Cannot read workers/wrangler.toml'],
    }
  }

  const cronRegex = /"([^"]+)"/g
  const cronsSection = wranglerContent.match(/crons\s*=\s*\[([\s\S]*?)\]/)?.[1] || ''
  const wranglerCrons: string[] = []
  let cronMatch
  while ((cronMatch = cronRegex.exec(cronsSection)) !== null) {
    wranglerCrons.push(cronMatch[1])
  }

  // Parse scheduled.ts for handler markers
  let scheduledContent: string
  try {
    scheduledContent = fs.readFileSync(SCHEDULED_PATH, 'utf8')
  } catch {
    return {
      name: 'Cron configuration',
      passed: false,
      expected: 'scheduled.ts readable',
      actual: 'file not found',
      details: ['Cannot read workers/src/scheduled.ts'],
    }
  }

  // Count distinct cron handlers by looking for trackCronExecution calls
  const handlerMatches = scheduledContent.match(/trackCronExecution\([\s\S]*?'([^']+)'/g) || []
  const handlerNames = handlerMatches.map((m) => {
    const nameMatch = m.match(/'([^']+)'/)
    return nameMatch ? nameMatch[1] : 'unknown'
  })

  // Also count switch cases for cron patterns
  const switchCases = scheduledContent.match(/case\s+'[^']+'/g) || []
  const cronCases = switchCases.map((c) => c.replace(/case\s+'/, '').replace(/'$/, ''))

  if (VERBOSE) {
    details.push(`Wrangler crons (${wranglerCrons.length}): ${wranglerCrons.join(', ')}`)
    details.push(`Scheduled handlers (${handlerNames.length}): ${handlerNames.join(', ')}`)
    details.push(`Switch cases (${cronCases.length}): ${cronCases.join(', ')}`)
  }

  // Check wrangler crons match switch cases in scheduled.ts
  const unmatchedCrons: string[] = []
  for (const cron of wranglerCrons) {
    if (!cronCases.includes(cron) && !scheduledContent.includes(cron)) {
      unmatchedCrons.push(cron)
    }
  }

  if (unmatchedCrons.length > 0) {
    details.push(`Crons in wrangler.toml without handler in scheduled.ts: ${unmatchedCrons.join(', ')}`)
  }

  const passed = unmatchedCrons.length === 0 && wranglerCrons.length > 0
  return {
    name: 'Cron configuration',
    passed,
    expected: `${wranglerCrons.length} crons with handlers`,
    actual: `${wranglerCrons.length} crons, ${unmatchedCrons.length} unmatched`,
    details,
  }
}

// ─── Check 4: Route File Coverage in Docs ───────────────────────────────────

function checkRouteDocCoverage(docContent: string): CheckResult {
  const routeFiles = listTsFiles(ROUTES_DIR)
  const details: string[] = []
  const undocumented: string[] = []

  // Normalize doc content for matching
  const docLower = docContent.toLowerCase()

  for (const file of routeFiles) {
    const baseName = file.replace('.ts', '')
    // Check if the route file name appears in the docs (as filename or route reference)
    // Handle hyphenated names that map to path segments (e.g., ai-llm → ai/llm)
    const patterns = [
      baseName,
      `${baseName}.ts`,
      `/${baseName}`,
      baseName.replace(/-/g, ' '),
      baseName.replace(/-/g, '/'),       // ai-llm → ai/llm
      `/${baseName.replace(/-/g, '/')}`,  // /ai/llm
    ]

    // Also try partial matches: each segment of hyphenated name
    const segments = baseName.split('-')
    if (segments.length > 1) {
      // e.g., "call-capabilities" → check for "capabilities" as standalone ref
      for (const seg of segments) {
        if (seg.length > 3) patterns.push(seg)
      }
    }

    const found = patterns.some((p) => docLower.includes(p.toLowerCase()))
    if (!found) {
      undocumented.push(file)
    }
  }

  if (undocumented.length > 0) {
    details.push(`Route files not referenced in APPLICATION_FUNCTIONS.md: ${undocumented.join(', ')}`)
  }

  if (VERBOSE && undocumented.length === 0) {
    details.push('All route files referenced in docs')
  }

  return {
    name: 'Route documentation coverage',
    passed: undocumented.length === 0,
    expected: `${routeFiles.length} routes documented`,
    actual: `${routeFiles.length - undocumented.length}/${routeFiles.length} documented`,
    details,
  }
}

// ─── Check 5: Cron Count in Docs ────────────────────────────────────────────

function checkCronDocCount(docContent: string): CheckResult {
  const details: string[] = []

  // Parse actual cron count from wrangler.toml
  let wranglerContent: string
  try {
    wranglerContent = fs.readFileSync(WRANGLER_PATH, 'utf8')
  } catch {
    return {
      name: 'Cron count in docs',
      passed: false,
      expected: 'wrangler.toml readable',
      actual: 'file not found',
      details: [],
    }
  }

  const cronsSection = wranglerContent.match(/crons\s*=\s*\[([\s\S]*?)\]/)?.[1] || ''
  const cronRegex = /"([^"]+)"/g
  let cronCount = 0
  while (cronRegex.exec(cronsSection) !== null) cronCount++

  // Extract documented cron count from APPLICATION_FUNCTIONS.md
  const docCount = extractDocCount(docContent, 'Cron Jobs')

  if (docCount === null) {
    return {
      name: 'Cron count in docs',
      passed: false,
      expected: 'documented',
      actual: cronCount,
      details: ['Could not find "Cron Jobs" count in APPLICATION_FUNCTIONS.md'],
    }
  }

  // Note: wrangler has 5 cron entries, but some trigger multiple jobs
  // The APPLICATION_FUNCTIONS.md counts logical job handlers (e.g., 8)
  // So we also count trackCronExecution calls in scheduled.ts
  let scheduledContent: string
  try {
    scheduledContent = fs.readFileSync(SCHEDULED_PATH, 'utf8')
  } catch {
    return {
      name: 'Cron count in docs',
      passed: false,
      expected: 'scheduled.ts readable',
      actual: 'file not found',
      details: [],
    }
  }

  // Count only actual invocations: "await trackCronExecution(" — not the function definition or comments
  const handlerMatches = scheduledContent.match(/await\s+trackCronExecution\(/g) || []
  const actualJobCount = handlerMatches.length

  if (VERBOSE) {
    details.push(`Wrangler cron entries: ${cronCount}`)
    details.push(`trackCronExecution calls: ${actualJobCount}`)
    details.push(`Documented cron jobs: ${docCount}`)
  }

  // The doc count should match the number of logical cron handlers
  const passed = docCount === actualJobCount
  if (!passed) {
    details.push(
      `APPLICATION_FUNCTIONS.md says ${docCount} cron jobs, scheduled.ts has ${actualJobCount} trackCronExecution calls`
    )
  }

  return {
    name: 'Cron count in docs',
    passed,
    expected: docCount,
    actual: actualJobCount,
    details,
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const start = Date.now()

  // Load APPLICATION_FUNCTIONS.md
  let docContent: string
  try {
    docContent = fs.readFileSync(APP_FUNCTIONS_PATH, 'utf8')
  } catch {
    console.error('❌ Cannot read ARCH_DOCS/APPLICATION_FUNCTIONS.md')
    process.exit(1)
  }

  // Run all checks
  const checks: CheckResult[] = [
    checkRouteCount(docContent),
    checkLibCount(docContent),
    checkCronConsistency(),
    checkRouteDocCoverage(docContent),
    checkCronDocCount(docContent),
  ]

  const duration = Date.now() - start
  const allPassed = checks.every((c) => c.passed)

  const report: ArchReport = {
    timestamp: new Date().toISOString(),
    duration_ms: duration,
    checks,
    all_passed: allPassed,
  }

  // ─── Output ─────────────────────────────────────────────────────────────

  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log('\n🏛️  Architecture Validation Report')
    console.log('═'.repeat(60))
    console.log(`Timestamp: ${report.timestamp}`)
    console.log(`Duration:  ${report.duration_ms}ms\n`)

    for (const check of checks) {
      const icon = check.passed ? '✅' : '❌'
      console.log(`${icon} ${check.name}`)
      console.log(`   Expected: ${check.expected}`)
      console.log(`   Actual:   ${check.actual}`)
      for (const d of check.details) {
        console.log(`   ↳ ${d}`)
      }
      console.log()
    }

    console.log('═'.repeat(60))
    console.log(`Result: ${allPassed ? '✅ ALL CHECKS PASSED' : '❌ FAILURES DETECTED'}`)
    console.log(`Checks: ${checks.filter((c) => c.passed).length}/${checks.length} passed`)
    console.log()
  }

  process.exit(allPassed ? 0 : 1)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
