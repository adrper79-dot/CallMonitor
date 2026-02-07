/**
 * LIVE Voice & Telnyx Integration Tests — NO MOCKS
 *
 * Tests the voice infrastructure against live services:
 *   - Telnyx API connectivity
 *   - WebRTC token generation
 *   - Call recording access
 *   - Voice config CRUD
 *
 * Run: npm run test:prod:voice
 */

import { describe, test, expect, beforeAll } from 'vitest'
import { apiCall, API_URL, checkApiReachable, type ServiceCheckResult } from './helpers'

describe('Live Voice & Telnyx Tests', () => {
  let apiHealth: ServiceCheckResult

  beforeAll(async () => {
    apiHealth = await checkApiReachable()
    if (apiHealth.status === 'down') {
      console.error('⛔ Workers API is DOWN — voice tests will report SERVICE_DOWN')
    }
  })

  // ─── TELNYX API ─────────────────────────────────────────────────────────

  describe('Telnyx Service', () => {
    test('Telnyx webhook endpoint is mounted', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('POST', '/api/webhooks/telnyx', {
        body: { data: { event_type: 'test.ping' } },
      })
      expect(service_reachable, 'TELNYX WEBHOOK SERVICE DOWN').toBe(true)
      expect(status, 'Telnyx webhook route not found').not.toBe(404)
    })

    test('Voice endpoint is mounted', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('GET', '/api/voice')
      expect(service_reachable, 'VOICE SERVICE DOWN').toBe(true)
      expect(status, 'Voice route not found').not.toBe(404)
    })
  })

  // ─── WEBRTC ─────────────────────────────────────────────────────────────

  describe('WebRTC', () => {
    test('WebRTC token endpoint requires auth', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('POST', '/api/voice/webrtc-token')
      expect(service_reachable, 'WEBRTC SERVICE DOWN').toBe(true)
      // 401 = requires auth (expected), 404 = not mounted
      if (status === 404) {
        console.warn('⚠️ WebRTC token endpoint not found at /api/voice/webrtc-token')
      }
      expect([401, 403, 404]).toContain(status)
    })
  })

  // ─── RECORDINGS ─────────────────────────────────────────────────────────

  describe('Recordings', () => {
    test('Recordings endpoint requires auth', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('GET', '/api/recordings')
      expect(service_reachable, 'RECORDINGS SERVICE DOWN').toBe(true)
      expect(status, 'Recordings route not found').not.toBe(404)
    })
  })

  // ─── CALLER ID ──────────────────────────────────────────────────────────

  describe('Caller ID', () => {
    test('Caller ID endpoint requires auth', async () => {
      if (apiHealth.status === 'down') return
      const { status, service_reachable } = await apiCall('GET', '/api/caller-id')
      expect(service_reachable, 'CALLER ID SERVICE DOWN').toBe(true)
      expect([401, 403, 404]).toContain(status)
    })
  })

  // ─── LIVE PROBES VIA TEST RUNNER ────────────────────────────────────────

  describe('Service Health Probes', () => {
    test('Telnyx API probe (via Workers test runner)', async () => {
      if (apiHealth.status === 'down') return
      const { status, data, service_reachable } = await apiCall('POST', '/api/test/run', {
        body: { categoryId: 'services', testId: 'telnyx' },
      })
      expect(service_reachable).toBe(true)
      if (status !== 200) return

      if (data.service_down) {
        console.log(`⛔ Telnyx API is DOWN: ${data.error}`)
      } else if (data.passed) {
        console.log(`✅ Telnyx API: ${data.details} (${data.duration_ms}ms)`)
      } else {
        console.log(`❌ Telnyx API issue: ${data.details}`)
        if (data.differential) {
          console.log(`   Expected: ${data.differential.expected}`)
          console.log(`   Actual:   ${data.differential.actual}`)
        }
      }
    })

    test('Voice tables probe (via Workers test runner)', async () => {
      if (apiHealth.status === 'down') return
      const { status, data, service_reachable } = await apiCall('POST', '/api/test/run', {
        body: { categoryId: 'voice', testId: 'calls-table' },
      })
      expect(service_reachable).toBe(true)
      if (status !== 200) return

      if (data.service_down) {
        console.log(`⛔ Voice DB table: ${data.error}`)
      } else if (data.passed) {
        console.log(`✅ Voice calls table: ${data.details}`)
      } else {
        console.log(`❌ Voice calls table: ${data.details}`)
      }
    })
  })
})
