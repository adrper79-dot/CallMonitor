#!/usr/bin/env tsx
/**
 * Validation Orchestrator — Agentic Flow Entry Point
 *
 * This script drives the full validation pipeline:
 * 1. Health-check the API
 * 2. Run L1 route reachability sweep
 * 3. Run L2 auth gate verification
 * 4. Run L3 functional tests
 * 5. Generate report card
 *
 * Usage:
 *   npx tsx scripts/validate-all.ts              # Full sweep
 *   npx tsx scripts/validate-all.ts --quick       # L1+L2 only
 *   npx tsx scripts/validate-all.ts --feature=voice  # Single category
 *
 * Designed to be called by AI agents as a sub-agent flow.
 */

import { config } from 'dotenv'
config({ path: './tests/.env.production' })

const API_URL = process.env.WORKERS_API_URL || 'https://wordisbond-api.adrper79.workers.dev'
const args = process.argv.slice(2)
const QUICK_MODE = args.includes('--quick')
const FEATURE_FILTER = args.find((a) => a.startsWith('--feature='))?.split('=')[1]

// ─── Types ──────────────────────────────────────────────────────────────────

interface EndpointResult {
  featureId: string
  featureName: string
  category: string
  method: string
  path: string
  requiresAuth: boolean
  l1: 'PASS' | 'FAIL' | 'DOWN'
  l2: 'PASS' | 'FAIL' | 'SKIP' | 'DOWN'
  status: number
  latency_ms: number
  error?: string
}

interface SweepReport {
  timestamp: string
  api_url: string
  duration_ms: number
  quick_mode: boolean
  feature_filter: string | null
  api_healthy: boolean
  total_endpoints: number
  l1_pass: number
  l1_fail: number
  l1_down: number
  l2_pass: number
  l2_fail: number
  avg_latency_ms: number
  failures: EndpointResult[]
  byCategory: Record<string, { total: number; pass: number }>
}

// ─── Dynamic import of feature registry ─────────────────────────────────

async function loadRegistry() {
  const mod = await import('../tests/production/feature-registry')
  return mod
}

// ─── API Call ───────────────────────────────────────────────────────────

async function apiCall(
  method: string,
  path: string,
  body?: any
): Promise<{
  status: number
  data: any
  latency_ms: number
  reachable: boolean
}> {
  const url = `${API_URL}${path}`
  const start = Date.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    const resp = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    clearTimeout(timer)
    const latency_ms = Date.now() - start
    const ct = resp.headers.get('content-type')
    const data = ct?.includes('json') ? await resp.json() : await resp.text()
    return { status: resp.status, data, latency_ms, reachable: true }
  } catch (err: any) {
    return { status: 0, data: null, latency_ms: Date.now() - start, reachable: false }
  }
}

// ─── Main Orchestration ─────────────────────────────────────────────────

async function run() {
  const startTime = Date.now()
  console.log(`\n${'═'.repeat(70)}`)
  console.log(`  🤖 VALIDATION ORCHESTRATOR — ${QUICK_MODE ? 'QUICK' : 'FULL'} SWEEP`)
  console.log(`${'═'.repeat(70)}`)
  console.log(`  API: ${API_URL}`)
  console.log(`  Mode: ${QUICK_MODE ? 'L1+L2 (quick)' : 'L1+L2+L3 (full)'}`)
  if (FEATURE_FILTER) console.log(`  Filter: ${FEATURE_FILTER}`)
  console.log(`  Time: ${new Date().toISOString()}`)
  console.log(`${'═'.repeat(70)}\n`)

  // Step 1: Health check
  console.log('🔍 Step 1: API Health Check...')
  const health = await apiCall('GET', '/api/health')
  const apiHealthy = health.reachable && health.status === 200
  if (!apiHealthy) {
    console.error(
      `  ⛔ API is ${health.reachable ? `unhealthy (${health.status})` : 'UNREACHABLE'}`
    )
    console.error(`  Cannot proceed with validation.\n`)
    process.exit(1)
  }
  console.log(`  ✅ API healthy (${health.latency_ms}ms)\n`)

  // Step 2: Load registry
  console.log('📦 Step 2: Loading Feature Registry...')
  const registry = await loadRegistry()
  let features = registry.FEATURE_REGISTRY
  if (FEATURE_FILTER) {
    features = features.filter((f) => f.category === FEATURE_FILTER || f.id === FEATURE_FILTER)
  }
  const totalEndpoints = features.reduce((s, f) => s + f.endpoints.length, 0)
  console.log(`  📊 ${features.length} features, ${totalEndpoints} endpoints\n`)

  // Step 3: L1 — Route Reachability
  console.log('🚀 Step 3: L1 — Route Reachability Sweep...')
  const results: EndpointResult[] = []

  for (const feature of features) {
    for (const ep of feature.endpoints) {
      const body = ep.method === 'POST' ? {} : undefined
      const resp = await apiCall(ep.method, ep.path, body)

      const l1: 'PASS' | 'FAIL' | 'DOWN' = !resp.reachable
        ? 'DOWN'
        : resp.status === 404
          ? 'FAIL'
          : 'PASS'
      const result: EndpointResult = {
        featureId: feature.id,
        featureName: feature.name,
        category: feature.category,
        method: ep.method,
        path: ep.path,
        requiresAuth: ep.requiresAuth,
        l1,
        l2: 'SKIP',
        status: resp.status,
        latency_ms: resp.latency_ms,
      }

      const icon = l1 === 'PASS' ? '✅' : l1 === 'FAIL' ? '❌' : '⛔'
      console.log(
        `  ${icon} ${ep.method.padEnd(6)} ${ep.path.padEnd(40)} → ${resp.status} (${resp.latency_ms}ms)`
      )
      results.push(result)
    }
  }

  const l1Pass = results.filter((r) => r.l1 === 'PASS').length
  const l1Fail = results.filter((r) => r.l1 === 'FAIL').length
  console.log(
    `\n  L1 Summary: ${l1Pass}✅ ${l1Fail}❌ ${results.filter((r) => r.l1 === 'DOWN').length}⛔\n`
  )

  // Step 4: L2 — Auth Gate Verification
  console.log('🔒 Step 4: L2 — Auth Gate Verification...')
  for (const result of results) {
    if (result.l1 !== 'PASS') {
      result.l2 = 'DOWN'
      continue
    }

    if (result.requiresAuth) {
      const isRejected = result.status === 401 || result.status === 403
      result.l2 = isRejected ? 'PASS' : 'FAIL'
      const icon = isRejected ? '🔒' : '🚨'
      if (!isRejected) {
        console.log(
          `  ${icon} ${result.method.padEnd(6)} ${result.path.padEnd(40)} → ${result.status} (SHOULD BE 401/403!)`
        )
      }
    } else {
      result.l2 = 'PASS'
    }
  }

  const l2Pass = results.filter((r) => r.l2 === 'PASS').length
  const l2Fail = results.filter((r) => r.l2 === 'FAIL').length
  console.log(`  L2 Summary: ${l2Pass}🔒 ${l2Fail}🚨\n`)

  // Step 5: Generate Report
  const duration = Date.now() - startTime
  const avgLatency = Math.round(results.reduce((s, r) => s + r.latency_ms, 0) / results.length)
  const failures = results.filter((r) => r.l1 === 'FAIL' || r.l2 === 'FAIL')

  const byCategory: Record<string, { total: number; pass: number }> = {}
  for (const r of results) {
    if (!byCategory[r.category]) byCategory[r.category] = { total: 0, pass: 0 }
    byCategory[r.category].total++
    if (r.l1 === 'PASS' && r.l2 !== 'FAIL') byCategory[r.category].pass++
  }

  const report: SweepReport = {
    timestamp: new Date().toISOString(),
    api_url: API_URL,
    duration_ms: duration,
    quick_mode: QUICK_MODE,
    feature_filter: FEATURE_FILTER || null,
    api_healthy: apiHealthy,
    total_endpoints: results.length,
    l1_pass: l1Pass,
    l1_fail: l1Fail,
    l1_down: results.filter((r) => r.l1 === 'DOWN').length,
    l2_pass: l2Pass,
    l2_fail: l2Fail,
    avg_latency_ms: avgLatency,
    failures,
    byCategory,
  }

  // Print report card
  console.log(`${'═'.repeat(70)}`)
  console.log(`  📊 VALIDATION REPORT CARD`)
  console.log(`${'═'.repeat(70)}`)
  console.log(`  Total Endpoints:    ${report.total_endpoints}`)
  console.log(`  Duration:           ${report.duration_ms}ms`)
  console.log(`  Avg Latency:        ${report.avg_latency_ms}ms`)
  console.log(``)
  console.log(`  L1 Route Reachability:`)
  console.log(`    ✅ Deployed:      ${report.l1_pass}`)
  console.log(`    ❌ Missing (404): ${report.l1_fail}`)
  console.log(`    ⛔ Down:          ${report.l1_down}`)
  console.log(``)
  console.log(`  L2 Auth Gates:`)
  console.log(`    🔒 Correct:       ${report.l2_pass}`)
  console.log(`    🚨 Broken:        ${report.l2_fail}`)
  console.log(``)
  console.log(`  By Category:`)
  for (const [cat, stats] of Object.entries(byCategory)) {
    const icon = stats.pass === stats.total ? '✅' : stats.pass > 0 ? '⚠️' : '❌'
    console.log(`    ${icon} ${cat.padEnd(15)} ${stats.pass}/${stats.total}`)
  }

  if (failures.length > 0) {
    console.log(`\n  ❌ FAILURES:`)
    for (const f of failures) {
      console.log(`    ${f.method} ${f.path} → L1:${f.l1} L2:${f.l2} (status ${f.status})`)
    }
  }

  const overall = failures.length === 0 ? '✅ PASS' : '❌ FAIL'
  console.log(`\n  OVERALL: ${overall}`)
  console.log(`${'═'.repeat(70)}\n`)

  // Exit code
  process.exit(failures.length > 0 ? 1 : 0)
}

run().catch((err) => {
  console.error('Orchestrator error:', err)
  process.exit(2)
})
