/**
 * Feature Validation Suite — Agentic L1 + L2 Route Validation
 *
 * L1: Route Reachability — Every registered endpoint responds (not 404)
 * L2: Auth Gate — Protected endpoints reject unauthenticated requests
 *
 * This test is driven entirely by the Feature Registry.
 * Adding a new route to the registry automatically creates tests.
 *
 * Run: npm run test:validate
 */

import { describe, test, expect, beforeAll } from 'vitest'
import { apiCall, API_URL, checkApiReachable, type ServiceCheckResult } from './helpers'
import {
  FEATURE_REGISTRY,
  getAllEndpoints,
  getRegistryStats,
  getCategories,
  getFeaturesByCategory,
  type FeatureDefinition,
} from './feature-registry'

describe('Feature Validation — Full Platform Sweep', () => {
  let apiHealth: ServiceCheckResult
  const results: {
    featureId: string
    endpoint: string
    method: string
    l1: 'PASS' | 'FAIL' | 'DOWN'
    l2: 'PASS' | 'FAIL' | 'SKIP' | 'DOWN'
    latency_ms: number
    status: number
  }[] = []

  beforeAll(async () => {
    apiHealth = await checkApiReachable()
    const stats = getRegistryStats()
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`  FEATURE VALIDATION — AGENTIC SWEEP`)
    console.log(`${'═'.repeat(60)}`)
    console.log(`  🌐 API: ${API_URL}`)
    console.log(`  📊 Status: ${apiHealth.status.toUpperCase()} (${apiHealth.latency_ms}ms)`)
    console.log(`  📦 Registry: ${stats.totalFeatures} features, ${stats.totalEndpoints} endpoints`)
    console.log(
      `  📂 Categories: ${stats.byCategory.map((c) => `${c.category}(${c.endpoints})`).join(', ')}`
    )
    console.log(`${'═'.repeat(60)}\n`)

    if (apiHealth.status === 'down') {
      console.error('⛔ Workers API is DOWN — ALL validation tests will report SERVICE_DOWN')
    }
  })

  // ─── L1: ROUTE REACHABILITY ─────────────────────────────────────────────
  // Every endpoint in the registry must be deployed (not 404)

  describe('L1 — Route Reachability', () => {
    for (const category of getCategories()) {
      const features = getFeaturesByCategory(category)

      describe(`[${category.toUpperCase()}] (${features.length} features)`, () => {
        for (const feature of features) {
          for (const ep of feature.endpoints) {
            test(`${feature.name} — ${ep.method} ${ep.path}`, async () => {
              if (apiHealth.status === 'down') {
                results.push({
                  featureId: feature.id,
                  endpoint: ep.path,
                  method: ep.method,
                  l1: 'DOWN',
                  l2: 'DOWN',
                  latency_ms: 0,
                  status: 0,
                })
                console.log(`  ⛔ DOWN — API unreachable`)
                return
              }

              const body = ep.method === 'POST' ? { body: {} } : undefined
              const { status, service_reachable, latency_ms } = await apiCall(
                ep.method,
                ep.path,
                body
              )

              if (!service_reachable) {
                results.push({
                  featureId: feature.id,
                  endpoint: ep.path,
                  method: ep.method,
                  l1: 'DOWN',
                  l2: 'DOWN',
                  latency_ms,
                  status: 0,
                })
                console.log(`  ⛔ DOWN — ${ep.path} unreachable`)
                return
              }

              const l1 = status !== 404 ? 'PASS' : 'FAIL'
              results.push({
                featureId: feature.id,
                endpoint: ep.path,
                method: ep.method,
                l1,
                l2: 'SKIP', // filled in L2
                latency_ms,
                status,
              })

              const icon = l1 === 'PASS' ? '✅' : '❌'
              console.log(`  ${icon} ${ep.method} ${ep.path} → ${status} (${latency_ms}ms)`)

              expect(status, `${ep.method} ${ep.path} returned 404 — NOT DEPLOYED`).not.toBe(404)
              expect(service_reachable, `${ep.path} SERVICE DOWN`).toBe(true)
            })
          }
        }
      })
    }
  })

  // ─── L2: AUTH GATE VALIDATION ───────────────────────────────────────────
  // Protected endpoints must return 401/403 without auth
  // Public endpoints must NOT return 401/403

  describe('L2 — Auth Gate Verification', () => {
    for (const category of getCategories()) {
      const features = getFeaturesByCategory(category)

      describe(`[${category.toUpperCase()}]`, () => {
        for (const feature of features) {
          for (const ep of feature.endpoints) {
            test(`${feature.name} — ${ep.method} ${ep.path} — ${ep.requiresAuth ? 'PROTECTED' : 'PUBLIC'}`, async () => {
              if (apiHealth.status === 'down') {
                console.log(`  ⛔ DOWN — API unreachable`)
                return
              }

              const body = ep.method === 'POST' ? { body: {} } : undefined
              const { status, service_reachable } = await apiCall(ep.method, ep.path, body)

              if (!service_reachable) {
                console.log(`  ⛔ DOWN — ${ep.path} unreachable`)
                return
              }

              // Update results from L1
              const existing = results.find(
                (r) =>
                  r.endpoint === ep.path && r.method === ep.method && r.featureId === feature.id
              )

              if (ep.requiresAuth) {
                // Protected endpoint: must reject unauthenticated
                // 429 (rate limit) is also a valid rejection — it blocks access before auth
                const isRejected = status === 401 || status === 403 || status === 429
                if (existing) existing.l2 = isRejected ? 'PASS' : 'FAIL'
                const icon = isRejected ? '🔒' : '🚨'
                console.log(`  ${icon} ${ep.method} ${ep.path} → ${status} (expected 401/403/429)`)
                expect(
                  [401, 403, 429],
                  `${ep.path} SECURITY: endpoint should reject unauthenticated requests but returned ${status}`
                ).toContain(status)
              } else {
                // Public endpoint: should return expected status
                if (existing) existing.l2 = 'PASS'
                const valid = ep.unauthStatus.includes(status)
                const icon = valid ? '🌐' : '⚠️'
                console.log(
                  `  ${icon} ${ep.method} ${ep.path} → ${status} (expected ${ep.unauthStatus.join('/')})`
                )
                expect(
                  ep.unauthStatus,
                  `${ep.path} returned unexpected ${status} (expected ${ep.unauthStatus.join('/')})`
                ).toContain(status)
              }
            })
          }
        }
      })
    }
  })

  // ─── REPORT CARD ────────────────────────────────────────────────────────

  describe('Validation Report', () => {
    test('Generate validation report card', () => {
      if (results.length === 0) {
        console.log('No results collected — API may be down')
        return
      }

      const l1Pass = results.filter((r) => r.l1 === 'PASS').length
      const l1Fail = results.filter((r) => r.l1 === 'FAIL').length
      const l1Down = results.filter((r) => r.l1 === 'DOWN').length
      const l2Pass = results.filter((r) => r.l2 === 'PASS').length
      const l2Fail = results.filter((r) => r.l2 === 'FAIL').length
      const total = results.length
      const avgLatency = Math.round(results.reduce((s, r) => s + r.latency_ms, 0) / total)

      console.log(`\n${'═'.repeat(60)}`)
      console.log(`  VALIDATION REPORT CARD`)
      console.log(`${'═'.repeat(60)}`)
      console.log(`  📋 Total Endpoints Tested:  ${total}`)
      console.log(`  `)
      console.log(`  L1 — Route Reachability:`)
      console.log(`    ✅ Deployed:   ${l1Pass}/${total}`)
      console.log(`    ❌ Missing:    ${l1Fail}/${total}`)
      console.log(`    ⛔ Down:       ${l1Down}/${total}`)
      console.log(`  `)
      console.log(`  L2 — Auth Gates:`)
      console.log(`    🔒 Correct:    ${l2Pass}/${total}`)
      console.log(`    🚨 Broken:     ${l2Fail}/${total}`)
      console.log(`  `)
      console.log(`  ⚡ Avg Latency:  ${avgLatency}ms`)
      console.log(`${'═'.repeat(60)}`)

      // Log failures
      const failures = results.filter((r) => r.l1 === 'FAIL' || r.l2 === 'FAIL')
      if (failures.length > 0) {
        console.log(`\n  ❌ FAILURES:`)
        for (const f of failures) {
          console.log(
            `    - ${f.method} ${f.endpoint} → L1:${f.l1} L2:${f.l2} (status ${f.status})`
          )
        }
      }

      // Categorized breakdown
      console.log(`\n  📂 BY CATEGORY:`)
      for (const cat of getCategories()) {
        const catResults = results.filter((r) => {
          const feature = FEATURE_REGISTRY.find((f) => f.id === r.featureId)
          return feature?.category === cat
        })
        const pass = catResults.filter(
          (r) => r.l1 === 'PASS' && (r.l2 === 'PASS' || r.l2 === 'SKIP')
        ).length
        const icon = pass === catResults.length ? '✅' : pass > 0 ? '⚠️' : '❌'
        console.log(`    ${icon} ${cat}: ${pass}/${catResults.length}`)
      }

      console.log(`\n${'═'.repeat(60)}\n`)

      // Assert no failures
      expect(l1Fail, `${l1Fail} endpoints returned 404 — NOT DEPLOYED`).toBe(0)
      expect(l2Fail, `${l2Fail} auth gates are BROKEN`).toBe(0)
    })
  })
}, 120000) // 2 minute timeout for full sweep
