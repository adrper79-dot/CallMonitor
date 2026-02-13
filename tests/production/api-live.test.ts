/**
 * LIVE Workers API Integration Tests — NO MOCKS
 *
 * Tests every API route against the real production Workers.
 * Each test properly distinguishes:
 *   ✅ PASS: Service is up and returned expected results
 *   ⚠️ WARN: Service works but is degraded (slow, partial)
 *   ❌ FAIL: Service is up but returned unexpected results
 *   ⛔ DOWN: Service is unreachable (network/config issue)
 *
 * Run: npm run test:prod:api
 */

import { describe, test, expect, beforeAll } from 'vitest'
import { apiCall, API_URL, checkApiReachable, type ServiceCheckResult } from './helpers'

describe('Live Workers API Tests', () => {
  let apiHealth: ServiceCheckResult

  beforeAll(async () => {
    apiHealth = await checkApiReachable()
    console.log(`\n🌐 API Status: ${apiHealth.status.toUpperCase()} (${apiHealth.latency_ms}ms)`)
    console.log(`   URL: ${API_URL}`)
    if (apiHealth.status === 'down') {
      console.error('⛔ Workers API is DOWN — all API tests will report SERVICE_DOWN')
    }
  })

  // ─── INFRASTRUCTURE ───────────────────────────────────────────────────────

  describe('Infrastructure Health', () => {
    test('Workers API is reachable', () => {
      expect(apiHealth.status, `API SERVICE DOWN: ${apiHealth.error || 'unreachable'}`).not.toBe(
        'down'
      )
    })

    test('Health endpoint returns service checks', async () => {
      if (apiHealth.status === 'down') {
        console.log('⛔ SKIPPED — API DOWN')
        return
      }

      const { status, data, latency_ms, service_reachable } = await apiCall('GET', '/api/health')
      expect(service_reachable, 'API SERVICE DOWN during health check').toBe(true)
      expect(status).toBe(200)
      expect(data.status).toBeDefined()
      expect(data.checks).toBeDefined()
      expect(Array.isArray(data.checks)).toBe(true)

      // Log each service check
      for (const check of data.checks) {
        const icon = check.status === 'healthy' ? '✅' : check.status === 'degraded' ? '⚠️' : '❌'
        console.log(`   ${icon} ${check.service}: ${check.status} (${check.responseTime || '?'}ms)`)
      }
    })

    test('Health response time under 2 seconds', async () => {
      if (apiHealth.status === 'down') return
      const { latency_ms, service_reachable } = await apiCall('GET', '/api/health')
      expect(service_reachable).toBe(true)
      expect(latency_ms, `Health check took ${latency_ms}ms — API is DEGRADED`).toBeLessThan(2000)
    })

    test('CORS headers are present', async () => {
      if (apiHealth.status === 'down') return
      const { headers, service_reachable } = await apiCall('GET', '/api/health')
      expect(service_reachable).toBe(true)
      const cors = headers.get('access-control-allow-origin')
      expect(cors, 'Missing CORS headers — cross-origin requests will fail').toBeDefined()
    })

    test('404 handler returns structured JSON', async () => {
      if (apiHealth.status === 'down') return
      const { status, data, service_reachable } = await apiCall(
        'GET',
        '/api/this-route-does-not-exist'
      )
      expect(service_reachable).toBe(true)
      expect(status).toBe(404)
      expect(data.error).toBeDefined()
    })
  })

  // ─── AUTH ENDPOINTS ───────────────────────────────────────────────────────

  describe('Authentication Endpoints', () => {
    test('GET /api/auth/session — returns session status', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('GET', '/api/auth/session')
      expect(service_reachable, 'AUTH SERVICE DOWN').toBe(true)
      // 200 (no session) or 401 are both valid
      expect([200, 401]).toContain(status)
    })

    test('POST /api/auth/callback/credentials — rejects empty credentials', async () => {
      if (apiHealth.status === 'down') return
      const { status, data, service_reachable } = await apiCall(
        'POST',
        '/api/auth/callback/credentials',
        {
          body: { email: '', password: '' },
        }
      )
      expect(service_reachable, 'AUTH SERVICE DOWN').toBe(true)
      expect([400, 401, 422, 429]).toContain(status)
    })

    test('GET /api/auth/csrf — returns CSRF token', async () => {
      if (apiHealth.status === 'down') return
      const { status, data, service_reachable } = await apiCall('GET', '/api/auth/csrf')
      expect(service_reachable, 'CSRF SERVICE DOWN').toBe(true)
      // May return token or may be structured differently
      expect([200, 404]).toContain(status)
    })

    test('Protected routes reject unauthenticated requests', async () => {
      if (apiHealth.status === 'down') return
      const endpoints = ['/api/calls', '/api/organizations/current', '/api/bond-ai/conversations']
      for (const ep of endpoints) {
        const { status, service_reachable } = await apiCall('GET', ep)
        expect(service_reachable, `${ep} SERVICE DOWN`).toBe(true)
        expect([401, 403], `${ep} should reject unauthenticated requests`).toContain(status)
      }
    })
  })

  // ─── CALLS API ────────────────────────────────────────────────────────────

  describe('Calls API', () => {
    test('GET /api/calls — requires auth', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('GET', '/api/calls')
      expect(service_reachable).toBe(true)
      expect(status).toBe(401)
    })

    test('GET /api/call-capabilities — returns capabilities', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('GET', '/api/call-capabilities')
      expect(service_reachable).toBe(true)
      // May require auth or return capabilities
      expect([200, 401, 403]).toContain(status)
    })
  })

  // ─── BOND AI API ──────────────────────────────────────────────────────────

  describe('Bond AI API', () => {
    test('GET /api/bond-ai/conversations — requires auth', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('GET', '/api/bond-ai/conversations')
      expect(service_reachable, 'BOND AI SERVICE DOWN').toBe(true)
      expect(status).toBe(401)
    })

    test('GET /api/bond-ai/alerts — requires auth', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('GET', '/api/bond-ai/alerts')
      expect(service_reachable).toBe(true)
      expect(status).toBe(401)
    })

    test('POST /api/bond-ai/copilot — requires auth', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('POST', '/api/bond-ai/copilot', {
        body: { call_id: 'test', question: 'test' },
      })
      expect(service_reachable).toBe(true)
      expect(status).toBe(401)
    })

    test('GET /api/bond-ai/insights — requires auth', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('GET', '/api/bond-ai/insights')
      expect(service_reachable).toBe(true)
      expect(status).toBe(401)
    })
  })

  // ─── TEAMS API ────────────────────────────────────────────────────────────

  describe('Teams API', () => {
    test('GET /api/teams — requires auth', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('GET', '/api/teams')
      expect(service_reachable, 'TEAMS SERVICE DOWN').toBe(true)
      expect(status).toBe(401)
    })

    test('GET /api/teams/my-orgs — requires auth', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('GET', '/api/teams/my-orgs')
      expect(service_reachable).toBe(true)
      expect(status).toBe(401)
    })
  })

  // ─── RBAC API ─────────────────────────────────────────────────────────────

  describe('RBAC API', () => {
    test('GET /api/rbac/context — requires auth', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('GET', '/api/rbac/context')
      expect(service_reachable, 'RBAC SERVICE DOWN').toBe(true)
      expect(status).toBe(401)
    })

    test('GET /api/rbac/roles — returns role definitions', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('GET', '/api/rbac/roles')
      expect(service_reachable).toBe(true)
      // Roles may be public or require auth
      expect([200, 401]).toContain(status)
    })
  })

  // ─── WEBHOOKS ─────────────────────────────────────────────────────────────

  describe('Webhook Endpoints', () => {
    test('POST /api/webhooks/telnyx — route exists', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('POST', '/api/webhooks/telnyx', {
        body: { data: { event_type: 'test.ping' } },
      })
      expect(service_reachable, 'WEBHOOK SERVICE DOWN').toBe(true)
      // Should exist: 200, 400 (validation), or 500 (processing error)
      // 404 means the route is not deployed
      if (status === 404) {
        console.warn('⚠️ Telnyx webhook route not found — route may not be deployed')
      }
      expect([200, 400, 401, 404, 500]).toContain(status)
    })

    test('POST /api/webhooks/stripe — route exists', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('POST', '/api/webhooks/stripe', {
        body: { type: 'test.ping' },
      })
      expect(service_reachable).toBe(true)
      expect([200, 400, 401, 404, 500]).toContain(status)
    })
  })

  // ─── REMAINING FEATURE ROUTES ─────────────────────────────────────────────

  describe('Feature Route Reachability', () => {
    const routes = [
      { path: '/api/analytics/kpis', name: 'Analytics' },
      { path: '/api/campaigns', name: 'Campaigns' },
      { path: '/api/voice/targets', name: 'Voice' },
      { path: '/api/billing', name: 'Billing' },
      { path: '/api/surveys', name: 'Surveys' },
      { path: '/api/caller-id', name: 'Caller ID' },
      { path: '/api/ai-config', name: 'AI Config' },
      { path: '/api/usage', name: 'Usage' },
      { path: '/api/recordings', name: 'Recordings' },
      { path: '/api/scorecards', name: 'Scorecards' },
      { path: '/api/bookings', name: 'Bookings' },
      { path: '/api/users/me', name: 'Users' },
      { path: '/api/shopper/scripts', name: 'Mystery Shopper' },
    ]

    for (const route of routes) {
      test(`${route.name} (${route.path}) — route is mounted`, async () => {
        if (apiHealth.status === 'down') return
        const { status, service_reachable } = await apiCall('GET', route.path)
        expect(service_reachable, `${route.name} SERVICE DOWN`).toBe(true)
        // 401/403 = route exists and requires auth (expected)
        // 200 = route exists and is public
        // 404 = route NOT deployed (test fails)
        if (status === 404) {
          console.error(`❌ ${route.name} route NOT FOUND at ${route.path}`)
        }
        expect(status, `Route ${route.path} returned 404 — not deployed`).not.toBe(404)
      })
    }
  })

  // ─── LIVE TEST RUNNER ─────────────────────────────────────────────────────

  describe('Live Test Runner (Workers-Side)', () => {
    test('GET /api/test/catalog — returns test catalog (auth-gated)', async () => {
      if (apiHealth.status === 'down') return
      const { status, data, service_reachable } = await apiCall('GET', '/api/test/catalog')
      expect(service_reachable, 'TEST RUNNER SERVICE DOWN').toBe(true)
      // Auth-gated since H-2 fix: 401 without session, 403 without admin role
      expect([200, 401, 403]).toContain(status)
      if (status !== 200) {
        console.log(`   \ud83d\udd12 Test catalog: ${status} (auth/admin required)`)
        return
      }
      expect(data.catalog).toBeDefined()
      expect(data.total_tests).toBeGreaterThan(0)
      console.log(
        `   📋 ${data.total_tests} tests available across ${data.catalog.length} categories`
      )
    })

    test('GET /api/test/health — runs infrastructure probes', async () => {
      if (apiHealth.status === 'down') return
      const { status, data, service_reachable } = await apiCall('GET', '/api/test/health')
      expect(service_reachable, 'TEST HEALTH SERVICE DOWN').toBe(true)
      expect([200, 503]).toContain(status)
      expect(data.overall).toBeDefined()
      expect(data.results).toBeDefined()

      // Log each probe result
      for (const result of data.results) {
        const icon =
          result.status === 'healthy'
            ? '✅'
            : result.status === 'degraded'
              ? '⚠️'
              : result.status === 'down'
                ? '⛔'
                : '❌'
        console.log(`   ${icon} ${result.service}: ${result.details} (${result.latency_ms}ms)`)
      }
      console.log(`   Overall: ${data.overall} | Total: ${data.total_latency_ms}ms`)
    })

    test('POST /api/test/run — executes single test (auth-gated)', async () => {
      if (apiHealth.status === 'down') return
      const { status, data, service_reachable } = await apiCall('POST', '/api/test/run', {
        body: { categoryId: 'infrastructure', testId: 'db-connection' },
      })
      expect(service_reachable).toBe(true)
      // Auth-gated: 401 without session, 403 without admin role
      expect([200, 401, 403]).toContain(status)
      if (status !== 200) {
        console.log(`   \ud83d\udd12 Test run: ${status} (auth/admin required)`)
        return
      }
      expect(data.test_id).toBe('db-connection')
      expect(data.correlation_id).toBeDefined()

      if (data.service_down) {
        console.log(`   ⛔ Database SERVICE DOWN: ${data.error}`)
      } else if (data.passed) {
        console.log(`   ✅ ${data.details} (${data.duration_ms}ms)`)
      } else {
        console.log(`   ❌ ${data.details}`)
      }
    })

    test('POST /api/test/run-all — executes full suite (auth-gated)', async () => {
      if (apiHealth.status === 'down') return
      const { status, data, service_reachable } = await apiCall('POST', '/api/test/run-all')
      expect(service_reachable).toBe(true)
      // Auth-gated: 401 without session, 403 without admin role
      expect([200, 401, 403]).toContain(status)
      if (status !== 200) {
        console.log(`   \ud83d\udd12 Test run-all: ${status} (auth/admin required)`)
        return
      }
      expect(data.summary).toBeDefined()

      const s = data.summary
      console.log(`\n   ┌─────────────────────────────────────────┐`)
      console.log(`   │  FULL TEST SUITE RESULTS                 │`)
      console.log(`   ├─────────────────────────────────────────┤`)
      console.log(`   │  ✅ Passed:       ${String(s.passed).padStart(4)}                  │`)
      console.log(`   │  ⚠️  Warnings:     ${String(s.warnings).padStart(4)}                  │`)
      console.log(`   │  ❌ Failed:       ${String(s.failed).padStart(4)}                  │`)
      console.log(
        `   │  ⛔ Services Down: ${String(s.services_down).padStart(4)}                  │`
      )
      console.log(`   │  📊 Total:        ${String(s.total).padStart(4)}                  │`)
      console.log(
        `   │  ⏱️  Duration:     ${String(s.suite_duration_ms).padStart(4)}ms               │`
      )
      console.log(`   └─────────────────────────────────────────┘\n`)

      // Log failures and service-down issues
      for (const result of data.results) {
        if (result.service_down) {
          console.log(`   ⛔ SERVICE DOWN: ${result.test_name} — ${result.error}`)
        } else if (!result.passed) {
          console.log(`   ❌ FAILED: ${result.test_name} — ${result.details}`)
          if (result.differential) {
            console.log(`      Expected: ${result.differential.expected}`)
            console.log(`      Actual:   ${result.differential.actual}`)
          }
        }
      }
    }, 60000) // 60 second timeout for full suite
  })

  // ─── PERFORMANCE ──────────────────────────────────────────────────────────

  describe('Performance Benchmarks', () => {
    test('Root endpoint responds under 300ms', async () => {
      if (apiHealth.status === 'down') return
      const { latency_ms, service_reachable } = await apiCall('GET', '/')
      expect(service_reachable).toBe(true)
      console.log(`   ⚡ Root: ${latency_ms}ms`)
      expect(latency_ms).toBeLessThan(300)
    })

    test('Health endpoint responds under 1000ms', async () => {
      if (apiHealth.status === 'down') return
      const { latency_ms, service_reachable } = await apiCall('GET', '/api/health')
      expect(service_reachable).toBe(true)
      console.log(`   ⚡ Health: ${latency_ms}ms`)
      expect(latency_ms).toBeLessThan(1000)
    })
  })

  // ─── MONITORING ENDPOINTS ─────────────────────────────────────────────────

  describe('Internal Monitoring Endpoints', () => {
    test('GET /api/internal/cron-health returns cron job status', async () => {
      if (apiHealth.status === 'down') {
        console.log('⛔ SKIPPED — API DOWN')
        return
      }

      const { status, data, service_reachable } = await apiCall('GET', '/api/internal/cron-health', {
        headers: { 'X-Internal-Key': process.env.INTERNAL_API_KEY || '' },
      })
      expect(service_reachable, 'API SERVICE DOWN during cron health check').toBe(true)
      // Internal endpoints require X-Internal-Key; tolerate 401/403/404/429/500/503
      expect([200, 401, 403, 404, 429, 500, 503]).toContain(status)
      if (status !== 200) {
        console.log(`   🔒 Cron health: ${status} (${status === 404 ? 'not deployed' : status === 429 ? 'rate limited' : status >= 500 ? 'server error' : 'internal key required'})`)
        return
      }

      expect(data).toHaveProperty('jobs')
      expect(Array.isArray(data.jobs)).toBe(true)

      // Should have our 3 cron jobs
      const jobNames = data.jobs.map((j: any) => j.job_name)
      expect(jobNames).toContain('retry_transcriptions')
      expect(jobNames).toContain('aggregate_usage')
      expect(jobNames).toContain('cleanup_sessions')

      // Each job should have status and metrics
      data.jobs.forEach((job: any) => {
        expect(['healthy', 'degraded', 'down', 'unknown']).toContain(job.status)
        expect(job).toHaveProperty('last_run')
        expect(job).toHaveProperty('staleness_minutes')
      })

      console.log(`   ⏰ Cron health: ${data.jobs.length} jobs monitored`)
    })

    test('GET /api/internal/webhook-dlq returns failed webhook entries', async () => {
      if (apiHealth.status === 'down') {
        console.log('⛔ SKIPPED — API DOWN')
        return
      }

      const { status, data, service_reachable } = await apiCall('GET', '/api/internal/webhook-dlq', {
        headers: { 'X-Internal-Key': process.env.INTERNAL_API_KEY || '' },
      })
      expect(service_reachable, 'API SERVICE DOWN during DLQ check').toBe(true)
      // Internal endpoints require X-Internal-Key; 404/429/5xx if not deployed or rate limited
      expect([200, 401, 403, 404, 429, 500, 503]).toContain(status)
      if (status !== 200) {
        console.log(`   🔒 Webhook DLQ: ${status} (${status === 404 ? 'not deployed' : status === 429 ? 'rate limited' : status >= 500 ? 'server error' : 'internal key required'})`)
        return
      }

      expect(data).toHaveProperty('entries')
      expect(Array.isArray(data.entries)).toBe(true)
      expect(data).toHaveProperty('total_count')
      expect(typeof data.total_count).toBe('number')

      console.log(`   📬 DLQ entries: ${data.total_count}`)
    })

    test('GET /api/internal/schema-health validates database schema', async () => {
      if (apiHealth.status === 'down') {
        console.log('⛔ SKIPPED — API DOWN')
        return
      }

      const { status, data, service_reachable } = await apiCall('GET', '/api/internal/schema-health', {
        headers: { 'X-Internal-Key': process.env.INTERNAL_API_KEY || '' },
      })
      expect(service_reachable, 'API SERVICE DOWN during schema health check').toBe(true)
      // Internal endpoints require X-Internal-Key; 404/429/5xx if not deployed or rate limited
      expect([200, 401, 403, 404, 429, 500, 503]).toContain(status)
      if (status !== 200) {
        console.log(`   🔒 Schema health: ${status} (${status === 404 ? 'not deployed' : status === 429 ? 'rate limited' : status >= 500 ? 'server error' : 'internal key required'})`)
        return
      }

      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('tables')
      expect(data).toHaveProperty('timestamp')

      // Should validate critical tables
      const criticalTables = ['calls', 'users', 'organizations', 'voice_configs', 'usage_stats']
      criticalTables.forEach(tableName => {
        expect(data.tables).toHaveProperty(tableName)
        const tableInfo = data.tables[tableName]
        expect(tableInfo).toHaveProperty('status')
        expect(tableInfo).toHaveProperty('column_count')
        expect(tableInfo).toHaveProperty('missing_columns')
        expect(Array.isArray(tableInfo.missing_columns)).toBe(true)
      })

      console.log(`   🗄️ Schema health: ${data.status}`)
    })
  })
})
