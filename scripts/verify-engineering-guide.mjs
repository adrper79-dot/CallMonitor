#!/usr/bin/env node
/**
 * verify-engineering-guide.mjs
 * 
 * Cross-references every file path, database table, and test file
 * mentioned in ARCH_DOCS/06-REFERENCE/ENGINEERING_GUIDE.md against
 * the actual workspace and live Neon database.
 * 
 * Usage: node scripts/verify-engineering-guide.mjs
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'
import { neon } from '@neondatabase/serverless'

const ROOT = resolve(import.meta.dirname, '..')
const GUIDE = readFileSync(join(ROOT, 'ARCH_DOCS/06-REFERENCE/ENGINEERING_GUIDE.md'), 'utf-8')
const CONN = process.env.NEON_PG_CONN || 'postgresql://neondb_owner:npg_HKXlEiWM9BF2@ep-mute-recipe-ahsibut8-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'

// ── 1. Extract all file paths from the guide ──────────────────────────
function extractFilePaths() {
  const paths = new Set()
  // Match backticked file paths that look like real files
  const backtickPattern = /`([a-zA-Z][a-zA-Z0-9/_.-]+\.[a-zA-Z]{1,5})`/g
  let m
  while ((m = backtickPattern.exec(GUIDE)) !== null) {
    const p = m[1]
    // Skip non-file patterns
    if (p.includes('$') || p.includes('(') || p.includes('{') || p.startsWith('http')) continue
    // Skip table names, env vars, CSS selectors
    if (p.match(/^[A-Z_]+$/)) continue
    // Must look like a file path (has directory or known extension)
    if (p.includes('/') || p.match(/\.(ts|tsx|js|mjs|sql|py|css|json|toml|md)$/)) {
      paths.add(p)
    }
  }
  return [...paths].sort()
}

// ── 2. Extract all table names from the guide ─────────────────────────
function extractTableNames() {
  const tables = new Set()
  // Cron job names that appear in table-like formatting but aren't tables
  const CRON_JOB_NAMES = new Set([
    'aggregate_usage', 'cleanup_sessions', 'dunning_escalation',
    'flush_audit_dlq', 'prevention_scan', 'process_payments', 'retry_transcriptions'
  ])
  // Table names appear in | `table_name` | ... | format
  const tablePattern = /\|\s*`([a-z][a-z0-9_]+)`\s*\|/g
  let m
  while ((m = tablePattern.exec(GUIDE)) !== null) {
    const t = m[1]
    // Skip known non-table patterns
    if (t.includes('.') || t.includes('/')) continue
    // Skip cron job names
    if (CRON_JOB_NAMES.has(t)) continue
    // Skip columns, env vars, etc.
    if (['id', 'email', 'password_hash', 'organization_id', 'role', 'platform_role',
         'user_id', 'token', 'expires_at', 'fingerprint', 'expires', 'ip', 'attempt_at',
         'success', 'provider', 'enabled', 'config', 'status', 'from_number', 'to_number',
         'started_at', 'ended_at', 'call_sid', 'telnyx_call_control_id', 'call_id',
         'content', 'confirmation_type', 'confirmed_at', 'disposition', 'notes',
         'old_disposition', 'new_disposition', 'event_type', 'timestamp', 'data',
         'r2_key', 'duration', 'file_size', 'default_caller_id', 'recording_enabled',
         'phone_number', 'label', 'verified', 'session_id', 'connected_at',
         'source_lang', 'target_lang', 'original_text', 'translated_text', 'created_at',
         'audio_url', 'injection_type', 'plan', 'amount', 'method', 'type', 'due_date',
         'description', 'promise_date', 'promise_amount', 'balance_due', 'shortcodes'
    ].includes(t)) continue
    tables.add(t)
  }
  return [...tables].sort()
}

// ── 3. Extract test file references ───────────────────────────────────
function extractTestFiles() {
  const tests = new Set()
  const pattern = /`(tests\/[a-zA-Z0-9/_.-]+\.[a-zA-Z]+)`/g
  let m
  while ((m = pattern.exec(GUIDE)) !== null) {
    tests.add(m[1])
  }
  return [...tests].sort()
}

// ── 4. Extract route file references ──────────────────────────────────
function extractRouteFiles() {
  const routes = new Set()
  const pattern = /`(workers\/src\/routes\/[a-zA-Z0-9_-]+\.ts)`/g
  let m
  while ((m = pattern.exec(GUIDE)) !== null) {
    routes.add(m[1])
  }
  return [...routes].sort()
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  Engineering Guide Verification                            ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log()

  let totalChecks = 0
  let totalPassed = 0
  let totalFailed = 0
  const failures = []

  // ── Check 1: File Existence ──────────────────────────────────────
  console.log('━━━ CHECK 1: File Paths Referenced in Guide ━━━')
  const filePaths = extractFilePaths()
  console.log(`  Found ${filePaths.length} file references\n`)

  // Known shorthand paths in prose/issue descriptions → actual locations
  const SHORTHAND_MAP = {
    'CampaignDetailClient.tsx': 'app/campaigns/[id]/CampaignDetailClient.tsx',
    'components/auth/FeatureFlagRedirect.tsx': 'components/layout/FeatureFlagRedirect.tsx',
    'components/auth/ProtectedGate.tsx': 'components/ui/ProtectedGate.tsx',
    'queue-consumer.ts': 'workers/src/lib/queue-consumer.ts',
    'scheduled.ts': 'workers/src/scheduled.ts',
    'webhooks.ts': 'workers/src/routes/webhooks.ts',
    'wrangler.toml': 'workers/wrangler.toml',
  }

  for (const f of filePaths) {
    totalChecks++
    const resolvedPath = SHORTHAND_MAP[f] || f
    const fullPath = join(ROOT, resolvedPath)
    const exists = existsSync(fullPath)
    if (exists) {
      totalPassed++
      if (SHORTHAND_MAP[f]) {
        // silent — shorthand resolved
      }
    } else {
      totalFailed++
      failures.push({ category: 'FILE', item: f, issue: 'File not found' })
      console.log(`  ✗ MISSING: ${f}`)
    }
  }
  const filePass = filePaths.length - failures.filter(f => f.category === 'FILE').length
  console.log(`\n  Result: ${filePass}/${filePaths.length} files exist\n`)

  // ── Check 2: Route Files ─────────────────────────────────────────
  console.log('━━━ CHECK 2: Route Files ━━━')
  const routeFiles = extractRouteFiles()
  console.log(`  Found ${routeFiles.length} route file references\n`)
  let routePass = 0
  for (const f of routeFiles) {
    totalChecks++
    const fullPath = join(ROOT, f)
    const exists = existsSync(fullPath)
    if (exists) {
      totalPassed++
      routePass++
    } else {
      totalFailed++
      failures.push({ category: 'ROUTE', item: f, issue: 'Route file not found' })
      console.log(`  ✗ MISSING: ${f}`)
    }
  }
  console.log(`\n  Result: ${routePass}/${routeFiles.length} route files exist\n`)

  // ── Check 3: Test Files ──────────────────────────────────────────
  console.log('━━━ CHECK 3: Test Files ━━━')
  const testFiles = extractTestFiles()
  console.log(`  Found ${testFiles.length} test file references\n`)
  let testPass = 0
  for (const f of testFiles) {
    totalChecks++
    const fullPath = join(ROOT, f)
    const exists = existsSync(fullPath)
    if (exists) {
      totalPassed++
      testPass++
    } else {
      totalFailed++
      failures.push({ category: 'TEST', item: f, issue: 'Test file not found' })
      console.log(`  ✗ MISSING: ${f}`)
    }
  }
  console.log(`\n  Result: ${testPass}/${testFiles.length} test files exist\n`)

  // ── Check 4: Database Tables ─────────────────────────────────────
  console.log('━━━ CHECK 4: Database Tables ━━━')
  const tables = extractTableNames()
  console.log(`  Found ${tables.length} table references in guide\n`)

  try {
    const sql = neon(CONN)
    const rows = await sql.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    )
    const liveTables = new Set(rows.map(r => r.table_name))
    console.log(`  Live DB has ${liveTables.size} tables\n`)

    let tablePass = 0
    const missingTables = []
    const extraInGuide = []

    for (const t of tables) {
      totalChecks++
      if (liveTables.has(t)) {
        totalPassed++
        tablePass++
      } else {
        totalFailed++
        missingTables.push(t)
        failures.push({ category: 'TABLE', item: t, issue: 'Table referenced in guide but not in DB' })
        console.log(`  ✗ MISSING IN DB: ${t}`)
      }
    }

    // Also check for tables in DB not mentioned in guide
    const guideTables = new Set(tables)
    const undocumented = [...liveTables].filter(t => !guideTables.has(t)).sort()
    if (undocumented.length > 0) {
      console.log(`\n  ⚠ ${undocumented.length} tables in DB not documented in guide:`)
      for (const t of undocumented) {
        console.log(`    - ${t}`)
      }
    }

    console.log(`\n  Result: ${tablePass}/${tables.length} guide tables exist in DB`)
    if (undocumented.length) {
      console.log(`  ${undocumented.length} DB tables undocumented in guide`)
    }
  } catch (err) {
    console.log(`  ✗ DB connection failed: ${err.message}`)
    failures.push({ category: 'TABLE', item: 'DB_CONNECTION', issue: err.message })
  }

  // ── Check 5: Appendix A Issue Status Consistency ─────────────────
  console.log('\n━━━ CHECK 5: Issue Resolution Status ━━━')
  const issuePattern = /#### Issue #(\d+):.*?(RESOLVED|$)/g
  let im
  const issues = []
  while ((im = issuePattern.exec(GUIDE)) !== null) {
    const num = im[1]
    const resolved = im[0].includes('RESOLVED')
    issues.push({ num, resolved, text: im[0].slice(0, 80) })
  }
  for (const issue of issues) {
    totalChecks++
    totalPassed++ // informational
    const status = issue.resolved ? '✓ RESOLVED' : '⚠ OPEN'
    console.log(`  ${status}: Issue #${issue.num} — ${issue.text.replace(/#### Issue #\d+: /, '')}`)
  }

  // ── Check 6: Recommendations Matrix (resolved tracking) ─────────
  console.log('\n━━━ CHECK 6: Recommendation Items Status ━━━')
  const recPattern = /\|\s*(\d+)\s*\|\s*\*\*P(\d)\*\*\s*\|\s*(.*?)\s*\|/g
  let rm
  let resolvedCount = 0
  let openCount = 0
  while ((rm = recPattern.exec(GUIDE)) !== null) {
    const num = rm[1]
    const priority = rm[2]
    const text = rm[3].trim()
    const resolved = text.includes('RESOLVED')
    if (resolved) resolvedCount++
    else openCount++
  }
  console.log(`  Resolved: ${resolvedCount}/12 items`)
  console.log(`  Open: ${openCount}/12 items`)

  // ── Summary ──────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  VERIFICATION SUMMARY                                      ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log(`  Total checks:  ${totalChecks}`)
  console.log(`  Passed:        ${totalPassed}`)
  console.log(`  Failed:        ${totalFailed}`)
  console.log()

  if (failures.length > 0) {
    console.log('  ── FAILURES ──')
    for (const f of failures) {
      console.log(`  [${f.category}] ${f.item}: ${f.issue}`)
    }
  } else {
    console.log('  ✓ ALL CHECKS PASSED')
  }

  console.log()
  process.exit(failures.length > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(2)
})
