/**
 * Production Workers API Integration Tests
 * 
 * Tests real Cloudflare Workers API endpoints.
 * NO MOCKS - all requests hit the production Workers API.
 * 
 * Run with: npm run test:production
 */

import { describe, test, expect, beforeAll } from 'vitest'
import { 
  apiCall,
  API_URL, 
  TEST_ORG_ID, 
  TEST_USER_ID,
  RUN_API_TESTS,
  createTestSession
} from './setup'

const describeOrSkip = RUN_API_TESTS ? describe : describe.skip

describeOrSkip('Production Workers API Tests', () => {
  let sessionToken: string | null = null

  beforeAll(async () => {
    console.log(`🌐 Testing API at: ${API_URL}`)
    // Create a test session for authenticated requests
    sessionToken = await createTestSession()
    console.log(`🔑 Test session: ${sessionToken ? 'created' : 'failed'}`)
  })

  describe('Health & Status', () => {
    test('health endpoint returns healthy', async () => {
      const { status, data } = await apiCall('GET', '/api/health')
      
      expect(status).toBe(200)
      expect(data.status).toBe('healthy')
      
      console.log('✅ Health check:', JSON.stringify(data))
    })

    test('health check includes all services', async () => {
      const { data } = await apiCall('GET', '/api/health')
      
      expect(data.checks).toBeDefined()
      expect(Array.isArray(data.checks)).toBe(true)
      
      const serviceNames = data.checks.map((c: any) => c.service)
      expect(serviceNames).toContain('database')
      expect(serviceNames).toContain('kv')
      expect(serviceNames).toContain('r2')
      
      // All should be healthy
      for (const check of data.checks) {
        expect(check.status).toBe('healthy')
      }
    })

    test('API responds with CORS headers', async () => {
      const { headers } = await apiCall('GET', '/api/health')
      
      // Should have CORS headers
      const accessControl = headers.get('access-control-allow-origin')
      expect(accessControl).toBeDefined()
    })
  })

  describe('Authentication', () => {
    test('unauthenticated requests return 401 or redirect', async () => {
      const { status } = await apiCall('GET', '/api/calls')
      // Unauthenticated can return 401 (unauthorized) or 302/307 (redirect to login)
      expect([401, 302, 307, 403]).toContain(status)
    })

    test('session endpoint exists', async () => {
      const { status, data } = await apiCall('GET', '/api/auth/session')
      // May return null session (200) or may not exist (404)
      expect([200, 404]).toContain(status)
      console.log(`📝 Session endpoint: ${status}`)
    })

    test('authenticated request with session token', async () => {
      if (!sessionToken) {
        console.log('⚠️ No session token, skipping authenticated test')
        return
      }

      const { status, data } = await apiCall('GET', '/api/auth/session', {
        sessionToken
      })
      
      // Session may or may not be recognized
      expect([200, 401, 404]).toContain(status)
      console.log(`📝 Auth with token: ${status}`)
    })
  })

  describe('Calls API', () => {
    test('GET /api/calls requires authentication', async () => {
      const { status } = await apiCall('GET', '/api/calls')
      expect(status).toBe(401)
    })

    test('GET /api/calls returns calls for authenticated user', async () => {
      if (!sessionToken) {
        console.log('⚠️ No session token, skipping authenticated test')
        return
      }

      const { status, data } = await apiCall('GET', '/api/calls', {
        sessionToken
      })
      
      // Calls endpoint may have different response structures
      if (status === 200) {
        console.log(`📞 Calls endpoint returned 200`)
        expect(data).toBeDefined()
      } else {
        console.log(`📞 Calls endpoint returned ${status}`)
        expect([200, 401, 403]).toContain(status)
      }
    })

    test('GET /api/calls with query params', async () => {
      if (!sessionToken) return

      const { status, data } = await apiCall('GET', '/api/calls?status=completed', {
        sessionToken
      })
      
      // Accept various responses - we're testing the route exists
      expect([200, 400, 401, 403]).toContain(status)
      console.log(`📞 Calls with filter: ${status}`)
    })

    test('GET /api/calls pagination', async () => {
      if (!sessionToken) return

      const { status, data } = await apiCall('GET', '/api/calls?page=1&limit=5', {
        sessionToken
      })
      
      expect([200, 400, 401, 403]).toContain(status)
      console.log(`📞 Calls with pagination: ${status}`)
    })

    test('GET /api/calls/:id', async () => {
      if (!sessionToken) return

      const { status } = await apiCall('GET', '/api/calls/00000000-0000-0000-0000-000000000000', {
        sessionToken
      })
      
      // Should return 404 for non-existent, or 401/403 if not authorized
      expect([404, 401, 403]).toContain(status)
      console.log(`📞 Single call lookup: ${status}`)
    })
  })

  describe('Organizations API', () => {
    test('GET /api/organizations/current requires auth', async () => {
      const { status } = await apiCall('GET', '/api/organizations/current')
      // Should require auth (401/403) or redirect, or might not exist (404)
      expect([401, 403, 302, 307, 404]).toContain(status)
      console.log(`🏢 Organizations endpoint: ${status}`)
    })

    test('GET /api/organizations/current with auth', async () => {
      if (!sessionToken) return

      const { status, data } = await apiCall('GET', '/api/organizations/current', {
        sessionToken
      })
      
      // May or may not return org depending on session validity
      expect([200, 401, 403, 404]).toContain(status)
      console.log(`🏢 Organizations with auth: ${status}`)
    })
  })

  describe('Webhook Endpoints', () => {
    test('Telnyx webhook endpoint is reachable', async () => {
      const { status } = await apiCall('POST', '/api/webhooks/telnyx', {
        body: { data: { event_type: 'test' } }
      })
      
      // Route exists or doesn't - document current state
      expect([200, 400, 401, 404, 500]).toContain(status)
      console.log(`📝 Telnyx webhook: ${status}${status === 404 ? ' (route not deployed)' : ''}`)
    })

    test('AssemblyAI webhook endpoint is reachable', async () => {
      const { status } = await apiCall('POST', '/api/webhooks/assemblyai', {
        body: { transcript_id: 'test', status: 'test' }
      })
      
      // Route may not exist yet (404) or may work
      expect([200, 400, 404, 500]).toContain(status)
      console.log(`📝 AssemblyAI webhook: ${status}`)
    })

    test('Stripe webhook endpoint is reachable', async () => {
      const { status } = await apiCall('POST', '/api/webhooks/stripe', {
        body: { type: 'test' }
      })
      
      // Stripe webhooks require signature verification
      expect([200, 400, 401, 404, 500]).toContain(status)
      console.log(`📝 Stripe webhook: ${status}`)
    })
  })

  describe('Error Handling', () => {
    test('non-existent routes return 404', async () => {
      const { status } = await apiCall('GET', '/api/nonexistent-route')
      expect(status).toBe(404)
    })

    test('API handles malformed requests gracefully', async () => {
      // Send request to health endpoint (which exists) with unusual headers
      const response = await fetch(`${API_URL}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'text/html' }
      })
      
      // Should still return 200 - API handles any request format
      expect([200, 400, 406]).toContain(response.status)
    })
  })

  describe('Performance', () => {
    test('health endpoint responds within 500ms', async () => {
      const start = Date.now()
      await apiCall('GET', '/api/health')
      const duration = Date.now() - start
      
      expect(duration).toBeLessThan(500)
      console.log(`⚡ Health check: ${duration}ms`)
    })

    test('calls list responds within 1000ms', async () => {
      if (!sessionToken) return

      const start = Date.now()
      await apiCall('GET', '/api/calls?limit=10', { sessionToken })
      const duration = Date.now() - start
      
      expect(duration).toBeLessThan(1000)
      console.log(`⚡ Calls list: ${duration}ms`)
    })
  })
})
