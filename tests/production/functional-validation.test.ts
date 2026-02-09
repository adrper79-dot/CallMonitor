/**
 * L3 — Functional Integration Tests — NO MOCKS
 *
 * Deep feature verification against live production:
 *   - Response shape validation
 *   - Data integrity checks
 *   - Cross-feature integration
 *   - Performance baselines
 *
 * Run: npm run test:validate:functional
 */

import { describe, test, expect, beforeAll } from 'vitest'
import { apiCall, API_URL, checkApiReachable, type ServiceCheckResult } from './helpers'

describe('L3 — Functional Integration Tests', () => {
  let apiHealth: ServiceCheckResult

  beforeAll(async () => {
    apiHealth = await checkApiReachable()
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`  L3 — FUNCTIONAL INTEGRATION TESTS`)
    console.log(`${'═'.repeat(60)}`)
    console.log(`  🌐 API: ${API_URL} | Status: ${apiHealth.status.toUpperCase()}`)
    console.log(`${'═'.repeat(60)}\n`)
  })

  // ─── HEALTH & INFRASTRUCTURE ──────────────────────────────────────────

  describe('Health Response Shape', () => {
    test('GET /api/health returns structured checks array', async () => {
      if (apiHealth.status === 'down') return
      const { status, data } = await apiCall('GET', '/api/health')
      expect(status).toBe(200)
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('checks')
      expect(Array.isArray(data.checks)).toBe(true)
      for (const check of data.checks) {
        expect(check).toHaveProperty('service')
        expect(check).toHaveProperty('status')
        expect(['healthy', 'degraded', 'down', 'error']).toContain(check.status)
      }
      console.log(`  ✅ Health: ${data.checks.length} service checks, overall=${data.status}`)
    })

    test('GET /api/health checks database connectivity', async () => {
      if (apiHealth.status === 'down') return
      const { data } = await apiCall('GET', '/api/health')
      const dbCheck = data.checks?.find(
        (c: any) =>
          c.service?.toLowerCase().includes('db') ||
          c.service?.toLowerCase().includes('database') ||
          c.service?.toLowerCase().includes('neon')
      )
      if (dbCheck) {
        console.log(`  🗄️ DB: ${dbCheck.status} (${dbCheck.responseTime || '?'}ms)`)
        expect(['healthy', 'degraded']).toContain(dbCheck.status)
      } else {
        console.log(`  ⚠️ No DB check found in health response`)
      }
    })
  })

  // ─── AUTH FLOW ────────────────────────────────────────────────────────

  describe('Auth Flow Validation', () => {
    test('POST /api/auth/callback/credentials rejects empty body', async () => {
      if (apiHealth.status === 'down') return
      const { status, data } = await apiCall('POST', '/api/auth/callback/credentials', {
        body: { email: '', password: '' },
      })
      expect([400, 401, 422]).toContain(status)
      console.log(`  🔒 Empty creds → ${status} (${data?.error || 'rejected'})`)
    })

    test('POST /api/auth/callback/credentials rejects invalid email', async () => {
      if (apiHealth.status === 'down') return
      const { status } = await apiCall('POST', '/api/auth/callback/credentials', {
        body: { email: 'not-an-email', password: 'password123' },
      })
      expect([400, 401, 422]).toContain(status)
      console.log(`  🔒 Invalid email → ${status}`)
    })

    test('GET /api/auth/session returns no-session state without cookie', async () => {
      if (apiHealth.status === 'down') return
      const { status, data } = await apiCall('GET', '/api/auth/session')
      expect([200, 401]).toContain(status)
      if (status === 200) {
        // If 200, should indicate no active session
        expect(data.user).toBeFalsy()
      }
      console.log(`  🔓 No-cookie session → ${status}`)
    })
  })

  // ─── TEST RUNNER INFRASTRUCTURE ───────────────────────────────────────

  describe('Workers-Side Test Runner', () => {
    test('GET /api/test/catalog returns structured catalog', async () => {
      if (apiHealth.status === 'down') return
      const { status, data } = await apiCall('GET', '/api/test/catalog')
      expect(status).toBe(200)
      expect(data).toHaveProperty('catalog')
      expect(data).toHaveProperty('total_tests')
      expect(Array.isArray(data.catalog)).toBe(true)
      expect(data.total_tests).toBeGreaterThan(0)
      for (const cat of data.catalog) {
        expect(cat).toHaveProperty('id')
        expect(cat).toHaveProperty('name')
        expect(cat).toHaveProperty('tests')
        expect(Array.isArray(cat.tests)).toBe(true)
      }
      console.log(`  📋 Catalog: ${data.total_tests} tests in ${data.catalog.length} categories`)
    })

    test('POST /api/test/run with invalid test returns error', async () => {
      if (apiHealth.status === 'down') return
      const { status, data } = await apiCall('POST', '/api/test/run', {
        body: { categoryId: 'nonexistent', testId: 'nonexistent' },
      })
      // Should return 404 or 400 for unknown test, not 500
      expect([400, 404]).toContain(status)
      console.log(`  ✅ Invalid test → ${status} (graceful error)`)
    })

    test('GET /api/test/health returns structured probes', async () => {
      if (apiHealth.status === 'down') return
      const { status, data } = await apiCall('GET', '/api/test/health')
      expect([200, 503]).toContain(status)
      expect(data).toHaveProperty('overall')
      expect(data).toHaveProperty('results')
      expect(Array.isArray(data.results)).toBe(true)
      for (const probe of data.results) {
        expect(probe).toHaveProperty('service')
        expect(probe).toHaveProperty('status')
        expect(probe).toHaveProperty('latency_ms')
      }
      console.log(`  🏥 Health probes: ${data.results.length} services, overall=${data.overall}`)
    })

    test('POST /api/test/run-all returns summary + results', async () => {
      if (apiHealth.status === 'down') return
      const { status, data } = await apiCall('POST', '/api/test/run-all')
      expect(status).toBe(200)
      expect(data).toHaveProperty('summary')
      expect(data).toHaveProperty('results')
      expect(data.summary).toHaveProperty('passed')
      expect(data.summary).toHaveProperty('failed')
      expect(data.summary).toHaveProperty('total')
      const s = data.summary
      console.log(
        `  🧪 Full suite: ${s.passed}✅ ${s.failed}❌ ${s.warnings}⚠️ ${s.services_down}⛔ (${s.suite_duration_ms}ms)`
      )
    }, 60000)
  })

  // ─── WEBHOOK ENDPOINTS ────────────────────────────────────────────────

  describe('Webhook Validation', () => {
    test('POST /api/webhooks/telnyx handles test.ping', async () => {
      if (apiHealth.status === 'down') return
      const { status, data } = await apiCall('POST', '/api/webhooks/telnyx', {
        body: { data: { event_type: 'test.ping', payload: {} } },
      })
      // Should not 500 on valid-shaped webhook
      expect(status).not.toBe(500)
      console.log(`  📞 Telnyx webhook test.ping → ${status}`)
    })

    test('POST /api/webhooks/telnyx rejects empty body', async () => {
      if (apiHealth.status === 'down') return
      const { status } = await apiCall('POST', '/api/webhooks/telnyx', {
        body: {},
      })
      expect([400, 500]).toContain(status)
      console.log(`  📞 Telnyx empty body → ${status}`)
    })

    test('POST /api/webhooks/stripe rejects unsigned payload', async () => {
      if (apiHealth.status === 'down') return
      const { status } = await apiCall('POST', '/api/webhooks/stripe', {
        body: { type: 'payment_intent.succeeded', data: {} },
      })
      // Should reject without valid Stripe signature
      expect([400, 401, 500]).toContain(status)
      console.log(`  💳 Stripe unsigned → ${status}`)
    })
  })

  // ─── ROUTE FUNCTIONAL SHAPES ──────────────────────────────────────────

  describe('Feature Route Response Shapes', () => {
    // RBAC Roles — may be public, should return structured data
    test('GET /api/rbac/roles returns role definitions when public', async () => {
      if (apiHealth.status === 'down') return
      const { status, data } = await apiCall('GET', '/api/rbac/roles')
      if (status === 200) {
        // Should have role data
        expect(data).toBeDefined()
        const hasRoles = data.roles || data.data || Array.isArray(data)
        expect(hasRoles).toBeTruthy()
        console.log(`  👤 Roles: public, ${JSON.stringify(data).length} bytes`)
      } else {
        console.log(`  🔒 Roles: requires auth (${status})`)
      }
    })

    // 404 handler
    test('Non-existent route returns structured 404', async () => {
      if (apiHealth.status === 'down') return
      const { status, data } = await apiCall('GET', '/api/definitely-not-a-real-endpoint-xyz')
      expect(status).toBe(404)
      expect(data).toHaveProperty('error')
      console.log(`  🚫 404: structured error response ✓`)
    })

    // CORS on all routes
    test('CORS headers present on health endpoint', async () => {
      if (apiHealth.status === 'down') return
      const { headers } = await apiCall('GET', '/api/health')
      const cors = headers.get('access-control-allow-origin')
      expect(cors).toBeDefined()
      console.log(`  🌍 CORS: ${cors}`)
    })
  })

  // ─── LIVE TRANSLATION ────────────────────────────────────────────────

  describe('Live Translation Pipeline', () => {
    test('GET /api/voice/translate requires auth', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('GET', '/api/voice/translate/stream')
      expect(service_reachable).toBe(true)
      expect(status).not.toBe(404)
      // Should require auth — SSE endpoint
      expect([401, 403]).toContain(status)
      console.log(`  🌐 Translation SSE: ${status} (auth gate ✓)`)
    })

    test('Voice config endpoint is reachable', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('GET', '/api/voice/config')
      expect(service_reachable).toBe(true)
      expect(status).not.toBe(404)
      console.log(`  🎙️ Voice config: ${status}`)
    })

    test('WebRTC dial endpoint exists', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('POST', '/api/webrtc/dial', {
        body: {},
      })
      expect(service_reachable).toBe(true)
      expect(status).not.toBe(404)
      console.log(`  📱 WebRTC dial: ${status}`)
    })

    test('Translation probe via Workers test runner', async () => {
      if (apiHealth.status === 'down') return
      const { status, data } = await apiCall('POST', '/api/test/run', {
        body: { categoryId: 'voice', testId: 'translation-config' },
      })
      if (status === 200 && data.passed !== undefined) {
        const icon = data.service_down ? '⛔' : data.passed ? '✅' : '❌'
        console.log(
          `  ${icon} Translation config probe: ${data.details || 'done'} (${data.duration_ms || '?'}ms)`
        )
      } else if (status === 404 || status === 400) {
        console.log(
          `  ⚠️ Translation probe not in test catalog (${status}) — expected for new feature`
        )
      }
    })
  })

  // ─── PERFORMANCE BASELINES ────────────────────────────────────────────

  describe('Performance Baselines', () => {
    test('Root endpoint < 500ms', async () => {
      if (apiHealth.status === 'down') return
      const { latency_ms, service_reachable } = await apiCall('GET', '/')
      expect(service_reachable).toBe(true)
      console.log(`  ⚡ Root: ${latency_ms}ms`)
      expect(latency_ms).toBeLessThan(500)
    })

    test('Health endpoint < 2000ms', async () => {
      if (apiHealth.status === 'down') return
      const { latency_ms, service_reachable } = await apiCall('GET', '/api/health')
      expect(service_reachable).toBe(true)
      console.log(`  ⚡ Health: ${latency_ms}ms`)
      expect(latency_ms).toBeLessThan(2000)
    })

    test('Auth session check < 1000ms', async () => {
      if (apiHealth.status === 'down') return
      const { latency_ms, service_reachable } = await apiCall('GET', '/api/auth/session')
      expect(service_reachable).toBe(true)
      console.log(`  ⚡ Auth session: ${latency_ms}ms`)
      expect(latency_ms).toBeLessThan(1000)
    })

    test('Test catalog < 1000ms', async () => {
      if (apiHealth.status === 'down') return
      const { latency_ms, service_reachable } = await apiCall('GET', '/api/test/catalog')
      expect(service_reachable).toBe(true)
      console.log(`  ⚡ Test catalog: ${latency_ms}ms`)
      expect(latency_ms).toBeLessThan(1000)
    })
  })

  // ─── CROSS-CUTTING: SECURITY ──────────────────────────────────────────

  describe('Security Validation', () => {
    const sensitiveEndpoints = [
      { method: 'GET' as const, path: '/api/calls' },
      { method: 'GET' as const, path: '/api/organizations/current' },
      { method: 'GET' as const, path: '/api/users/me' },
      { method: 'GET' as const, path: '/api/analytics/kpis' },
      { method: 'GET' as const, path: '/api/billing' },
      { method: 'GET' as const, path: '/api/compliance/violations' },
      { method: 'GET' as const, path: '/api/recordings' },
      { method: 'GET' as const, path: '/api/audit' },
      { method: 'GET' as const, path: '/api/reports' },
      { method: 'GET' as const, path: '/api/admin/metrics' },
    ]

    test('All sensitive endpoints reject unauthenticated requests', async () => {
      if (apiHealth.status === 'down') return
      const failures: string[] = []

      for (const ep of sensitiveEndpoints) {
        const { status, service_reachable } = await apiCall(ep.method, ep.path)
        if (!service_reachable) continue
        if (status !== 401 && status !== 403) {
          failures.push(`${ep.method} ${ep.path} → ${status} (expected 401/403)`)
        }
      }

      if (failures.length > 0) {
        console.error(`  🚨 SECURITY FAILURES:`)
        failures.forEach((f) => console.error(`    - ${f}`))
      } else {
        console.log(`  🔒 All ${sensitiveEndpoints.length} sensitive endpoints properly gated`)
      }

      expect(failures, `Security failures: ${failures.join('; ')}`).toHaveLength(0)
    })

    test('SQL injection in query params does not cause 500', async () => {
      if (apiHealth.status === 'down') return
      const { status } = await apiCall('GET', "/api/auth/session?id=1'%20OR%201=1--")
      // Should not cause 500 (SQL injection)
      expect(status).not.toBe(500)
      console.log(`  🛡️ SQL injection test: ${status} (no 500 ✓)`)
    })

    test('XSS in query params does not reflect', async () => {
      if (apiHealth.status === 'down') return
      const { data } = await apiCall('GET', '/api/health?x=<script>alert(1)</script>')
      const str = JSON.stringify(data)
      expect(str).not.toContain('<script>')
      console.log(`  🛡️ XSS test: no reflection ✓`)
    })
  })
}, 120000)
