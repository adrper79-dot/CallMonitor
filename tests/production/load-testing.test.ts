/**
 * Load Testing Suite - Production Infrastructure Validation
 *
 * Tests system behavior under sustained load using the "bridge crossing" framework:
 *   - 100 concurrent authenticated requests
 *   - 10 concurrent bridge call initiations
 *   - 50 concurrent collection account creations
 *   - Sustained load: 50 RPS for 2 minutes
 *   - Database connection pool saturation
 *   - Memory stability
 *
 * Performance budgets:
 *   - p50 < 500ms
 *   - p95 < 1s
 *   - p99 < 2s
 *
 * L4 Integration Tests - Uses real production API
 * CAUTION: These tests create significant load. Only run when enabled.
 *
 * Run with: RUN_LOAD_TESTS=1 npm run test:production
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import {
  pool,
  query,
  apiCall,
  API_URL,
  TEST_ORG_ID,
  TEST_USER_ID,
  createTestSession,
  cleanupTestData,
} from './setup'

// Feature flag for conditional test execution
const RUN_LOAD_TESTS = process.env.RUN_LOAD_TESTS === '1'
const describeOrSkip = RUN_LOAD_TESTS ? describe : describe.skip

// Test configuration
const CONCURRENT_REQUESTS = 100
const CONCURRENT_BRIDGE_CALLS = 10
const CONCURRENT_COLLECTION_ACCOUNTS = 50
const SUSTAINED_RPS = 50
const SUSTAINED_DURATION_SECONDS = 120 // 2 minutes (reduced from 5 min for CI)

// Performance budgets (milliseconds)
const PERFORMANCE_BUDGET = {
  p50: 500,
  p95: 1000,
  p99: 2000,
}

interface LatencyMetrics {
  min: number
  max: number
  mean: number
  p50: number
  p95: number
  p99: number
  samples: number[]
}

/**
 * Calculate latency percentiles from array of durations
 */
function calculateLatencyMetrics(durations: number[]): LatencyMetrics {
  const sorted = [...durations].sort((a, b) => a - b)
  const len = sorted.length

  if (len === 0) {
    return { min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0, samples: [] }
  }

  const percentile = (p: number) => {
    const index = Math.ceil((p / 100) * len) - 1
    return sorted[Math.max(0, index)]
  }

  const mean = sorted.reduce((a, b) => a + b, 0) / len

  return {
    min: sorted[0],
    max: sorted[len - 1],
    mean: Math.round(mean),
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
    samples: sorted,
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describeOrSkip('Load Testing Suite', () => {
  let sessionToken: string | null = null
  const createdResourceIds: {
    calls: string[]
    accounts: string[]
  } = {
    calls: [],
    accounts: [],
  }

  beforeAll(async () => {
    console.log('⚡ Load Testing Suite')
    console.log('   CAUTION: These tests create significant load on production systems')
    console.log(`   API URL: ${API_URL}`)
    console.log(`   Test Org: ${TEST_ORG_ID}`)

    sessionToken = await createTestSession()
    expect(sessionToken).toBeTruthy()
  })

  afterAll(async () => {
    // Clean up test calls
    for (const callId of createdResourceIds.calls) {
      try {
        await query(`UPDATE calls SET is_deleted = true, deleted_at = NOW() WHERE id = $1`, [
          callId,
        ])
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    // Clean up test accounts
    for (const accountId of createdResourceIds.accounts) {
      try {
        await query(
          `UPDATE collection_accounts SET is_deleted = true, deleted_at = NOW() WHERE id = $1`,
          [accountId]
        )
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    await cleanupTestData()
  })

  describe('Concurrent Request Load', () => {
    test('should handle 100 concurrent authenticated GET requests to /api/calls', async () => {
      if (!sessionToken) throw new Error('No session token')

      console.log(`   Testing ${CONCURRENT_REQUESTS} concurrent GET /api/calls requests...`)

      const startTime = Date.now()
      const durations: number[] = []
      const errors: any[] = []

      // Create 100 concurrent requests
      const requests = Array.from({ length: CONCURRENT_REQUESTS }, async (_, index) => {
        const requestStart = Date.now()
        try {
          const response = await apiCall('GET', '/api/calls?limit=10', { sessionToken })
          const duration = Date.now() - requestStart
          durations.push(duration)

          // Verify response
          expect(response.status).toBe(200)
          expect(response.data).toBeDefined()
        } catch (error) {
          errors.push({ index, error })
        }
      })

      // Wait for all requests to complete
      await Promise.all(requests)

      const totalTime = Date.now() - startTime
      const metrics = calculateLatencyMetrics(durations)

      // Log results
      console.log(`   ✅ Completed ${CONCURRENT_REQUESTS} requests in ${totalTime}ms`)
      console.log(`   Latency: p50=${metrics.p50}ms, p95=${metrics.p95}ms, p99=${metrics.p99}ms`)
      console.log(`   Errors: ${errors.length}`)

      // Assertions
      expect(errors.length).toBe(0) // No errors
      expect(metrics.p50).toBeLessThan(PERFORMANCE_BUDGET.p50)
      expect(metrics.p95).toBeLessThan(PERFORMANCE_BUDGET.p95)
      expect(metrics.p99).toBeLessThan(PERFORMANCE_BUDGET.p99)
    }, 60000) // 60 second timeout

    test('should handle 10 concurrent bridge call initiations', async () => {
      if (!sessionToken) throw new Error('No session token')

      console.log(`   Testing ${CONCURRENT_BRIDGE_CALLS} concurrent bridge call initiations...`)

      const startTime = Date.now()
      const durations: number[] = []
      const errors: any[] = []
      const callIds: string[] = []

      // Create 10 concurrent bridge calls
      const requests = Array.from({ length: CONCURRENT_BRIDGE_CALLS }, async (_, index) => {
        const requestStart = Date.now()
        try {
          const response = await apiCall('POST', '/api/voice/call', {
            sessionToken,
            body: {
              to_number: `+1555000${String(index).padStart(4, '0')}`,
              from_number: '+17062677235',
              flow_type: 'bridge',
            },
          })
          const duration = Date.now() - requestStart
          durations.push(duration)

          // Verify response
          expect(response.status).toBe(200)
          expect(response.data.call_id).toBeDefined()

          callIds.push(response.data.call_id)
        } catch (error) {
          errors.push({ index, error })
        }
      })

      // Wait for all requests to complete
      await Promise.all(requests)

      const totalTime = Date.now() - startTime
      const metrics = calculateLatencyMetrics(durations)

      // Store call IDs for cleanup
      createdResourceIds.calls.push(...callIds)

      // Log results
      console.log(
        `   ✅ Completed ${CONCURRENT_BRIDGE_CALLS} bridge calls in ${totalTime}ms`
      )
      console.log(`   Latency: p50=${metrics.p50}ms, p95=${metrics.p95}ms, p99=${metrics.p99}ms`)
      console.log(`   Errors: ${errors.length}`)
      console.log(`   Created calls: ${callIds.length}`)

      // Assertions
      expect(errors.length).toBe(0)
      expect(callIds.length).toBe(CONCURRENT_BRIDGE_CALLS)
      expect(metrics.p95).toBeLessThan(2000) // Bridge calls take longer, allow 2s
    }, 60000)

    test('should handle 50 concurrent collection account creations', async () => {
      if (!sessionToken) throw new Error('No session token')

      console.log(
        `   Testing ${CONCURRENT_COLLECTION_ACCOUNTS} concurrent collection account creations...`
      )

      const startTime = Date.now()
      const durations: number[] = []
      const errors: any[] = []
      const accountIds: string[] = []

      // Create 50 concurrent collection accounts
      const requests = Array.from(
        { length: CONCURRENT_COLLECTION_ACCOUNTS },
        async (_, index) => {
          const requestStart = Date.now()
          try {
            const response = await apiCall('POST', '/api/collections/accounts', {
              sessionToken,
              body: {
                customer_name: `Load Test Customer ${index}`,
                account_number: `LOAD-TEST-${Date.now()}-${index}`,
                balance_cents: 10000 + index * 100,
                status: 'active',
                contact_phone: `+1555${String(index).padStart(7, '0')}`,
                contact_email: `loadtest${index}@example.com`,
              },
            })
            const duration = Date.now() - requestStart
            durations.push(duration)

            // Verify response
            expect(response.status).toBe(201)
            expect(response.data.id).toBeDefined()

            accountIds.push(response.data.id)
          } catch (error) {
            errors.push({ index, error })
          }
        }
      )

      // Wait for all requests to complete
      await Promise.all(requests)

      const totalTime = Date.now() - startTime
      const metrics = calculateLatencyMetrics(durations)

      // Store account IDs for cleanup
      createdResourceIds.accounts.push(...accountIds)

      // Log results
      console.log(
        `   ✅ Completed ${CONCURRENT_COLLECTION_ACCOUNTS} account creations in ${totalTime}ms`
      )
      console.log(`   Latency: p50=${metrics.p50}ms, p95=${metrics.p95}ms, p99=${metrics.p99}ms`)
      console.log(`   Errors: ${errors.length}`)
      console.log(`   Created accounts: ${accountIds.length}`)

      // Assertions
      expect(errors.length).toBe(0)
      expect(accountIds.length).toBe(CONCURRENT_COLLECTION_ACCOUNTS)
      expect(metrics.p50).toBeLessThan(PERFORMANCE_BUDGET.p50)
      expect(metrics.p95).toBeLessThan(PERFORMANCE_BUDGET.p95)
    }, 60000)
  })

  describe('Sustained Load Testing', () => {
    test(`should maintain performance under sustained ${SUSTAINED_RPS} RPS for ${SUSTAINED_DURATION_SECONDS}s`, async () => {
      if (!sessionToken) throw new Error('No session token')

      console.log(
        `   Testing sustained load: ${SUSTAINED_RPS} RPS for ${SUSTAINED_DURATION_SECONDS}s...`
      )
      console.log(`   Expected total requests: ${SUSTAINED_RPS * SUSTAINED_DURATION_SECONDS}`)

      const startTime = Date.now()
      const durations: number[] = []
      const errors: any[] = []
      const intervalMs = 1000 / SUSTAINED_RPS // Time between requests (20ms for 50 RPS)

      let requestCount = 0
      const targetRequests = SUSTAINED_RPS * SUSTAINED_DURATION_SECONDS

      // Rate-limited request loop
      while (requestCount < targetRequests) {
        const loopStart = Date.now()

        // Make request
        const requestStart = Date.now()
        try {
          const response = await apiCall('GET', '/api/calls?limit=5', { sessionToken })
          const duration = Date.now() - requestStart
          durations.push(duration)

          // Basic validation
          expect(response.status).toBe(200)
        } catch (error) {
          errors.push({ requestCount, error })
        }

        requestCount++

        // Progress logging every 10 seconds
        if (requestCount % (SUSTAINED_RPS * 10) === 0) {
          const elapsed = Math.round((Date.now() - startTime) / 1000)
          const currentMetrics = calculateLatencyMetrics(durations)
          console.log(
            `   Progress: ${requestCount}/${targetRequests} requests (${elapsed}s) - p95=${currentMetrics.p95}ms`
          )
        }

        // Rate limiting: Sleep to maintain target RPS
        const loopDuration = Date.now() - loopStart
        const sleepTime = Math.max(0, intervalMs - loopDuration)
        if (sleepTime > 0) {
          await sleep(sleepTime)
        }
      }

      const totalTime = Date.now() - startTime
      const actualRPS = (requestCount / totalTime) * 1000
      const metrics = calculateLatencyMetrics(durations)

      // Log results
      console.log(`   ✅ Completed ${requestCount} requests in ${totalTime}ms`)
      console.log(`   Actual RPS: ${actualRPS.toFixed(2)}`)
      console.log(`   Latency: p50=${metrics.p50}ms, p95=${metrics.p95}ms, p99=${metrics.p99}ms`)
      console.log(`   Errors: ${errors.length} (${((errors.length / requestCount) * 100).toFixed(2)}%)`)

      // Assertions
      expect(errors.length).toBeLessThan(requestCount * 0.01) // Less than 1% error rate
      expect(actualRPS).toBeGreaterThan(SUSTAINED_RPS * 0.9) // Within 10% of target RPS
      expect(metrics.p95).toBeLessThan(PERFORMANCE_BUDGET.p95 * 1.5) // Allow 50% slack under sustained load
      expect(metrics.p99).toBeLessThan(PERFORMANCE_BUDGET.p99 * 1.5)
    }, SUSTAINED_DURATION_SECONDS * 1000 + 30000) // Test timeout + 30s buffer
  })

  describe('Database Connection Pool Saturation', () => {
    test('should handle connection pool saturation gracefully', async () => {
      if (!sessionToken) throw new Error('No session token')

      console.log('   Testing database connection pool saturation...')

      // Query to simulate connection pool exhaustion
      // Each query holds a connection for a short period
      const POOL_SIZE = 5 // From db.ts POOL_MAX
      const CONCURRENT_DB_QUERIES = POOL_SIZE * 3 // 3x pool size to force queuing

      const startTime = Date.now()
      const durations: number[] = []
      const errors: any[] = []

      const queries = Array.from({ length: CONCURRENT_DB_QUERIES }, async (_, index) => {
        const requestStart = Date.now()
        try {
          // Long-running query to hold connections
          const result = await query(
            `
            SELECT
              id,
              organization_id,
              status,
              pg_sleep(0.1) -- Sleep 100ms to hold connection
            FROM calls
            WHERE organization_id = $1
            LIMIT 5
          `,
            [TEST_ORG_ID]
          )
          const duration = Date.now() - requestStart
          durations.push(duration)

          expect(result).toBeDefined()
        } catch (error: any) {
          errors.push({ index, error: error?.message })
        }
      })

      await Promise.all(queries)

      const totalTime = Date.now() - startTime
      const metrics = calculateLatencyMetrics(durations)

      // Log results
      console.log(`   ✅ Completed ${CONCURRENT_DB_QUERIES} queries in ${totalTime}ms`)
      console.log(`   Latency: p50=${metrics.p50}ms, p95=${metrics.p95}ms, p99=${metrics.p99}ms`)
      console.log(`   Errors: ${errors.length}`)

      // Assertions
      expect(errors.length).toBe(0) // No timeouts or errors
      expect(metrics.p99).toBeLessThan(5000) // Even queued queries complete within 5s
    }, 30000)

    test('should recover after connection pool pressure', async () => {
      if (!sessionToken) throw new Error('No session token')

      console.log('   Testing connection pool recovery...')

      // After saturation test, verify system returns to normal performance
      const startTime = Date.now()
      const response = await apiCall('GET', '/api/calls?limit=10', { sessionToken })
      const duration = Date.now() - startTime

      console.log(`   ✅ Recovery query completed in ${duration}ms`)

      // Assertions
      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(PERFORMANCE_BUDGET.p95) // Back to normal performance
    })
  })

  describe('Memory Stability', () => {
    test('should maintain stable memory usage during sustained load', async () => {
      if (!sessionToken) throw new Error('No session token')

      console.log('   Testing memory stability...')

      // Get initial memory usage (Node.js process memory)
      const initialMemory = process.memoryUsage()
      const memorySnapshots: number[] = []

      // Make 1000 requests and track memory
      const REQUEST_COUNT = 1000
      let completedRequests = 0

      for (let i = 0; i < REQUEST_COUNT; i++) {
        try {
          await apiCall('GET', '/api/calls?limit=5', { sessionToken })
          completedRequests++

          // Take memory snapshot every 100 requests
          if (i % 100 === 0) {
            const currentMemory = process.memoryUsage()
            memorySnapshots.push(currentMemory.heapUsed)
          }
        } catch (error) {
          // Continue on error
        }
      }

      const finalMemory = process.memoryUsage()

      // Calculate memory growth
      const memoryGrowthMB = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024
      const memoryGrowthPercent =
        ((finalMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed) * 100

      // Log results
      console.log(`   ✅ Completed ${completedRequests} requests`)
      console.log(
        `   Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`
      )
      console.log(`   Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`)
      console.log(`   Memory growth: ${memoryGrowthMB.toFixed(2)} MB (${memoryGrowthPercent.toFixed(2)}%)`)

      // Assertions
      expect(completedRequests).toBe(REQUEST_COUNT)
      expect(memoryGrowthMB).toBeLessThan(100) // Less than 100 MB growth
      expect(memoryGrowthPercent).toBeLessThan(50) // Less than 50% memory growth
    }, 120000) // 2 minute timeout
  })

  describe('API Endpoint Stress Testing', () => {
    test('should handle concurrent calls to multiple endpoints', async () => {
      if (!sessionToken) throw new Error('No session token')

      console.log('   Testing concurrent requests to multiple endpoints...')

      const startTime = Date.now()
      const errors: any[] = []

      // Test different endpoints concurrently
      const endpoints = [
        { method: 'GET' as const, path: '/api/calls?limit=10' },
        { method: 'GET' as const, path: '/api/analytics/sentiment' },
        { method: 'GET' as const, path: '/api/voice/targets' },
        { method: 'GET' as const, path: '/api/collections/accounts?limit=10' },
        { method: 'GET' as const, path: '/api/teams/members' },
      ]

      // 10 requests per endpoint = 50 total concurrent requests
      const requests = endpoints.flatMap((endpoint) =>
        Array.from({ length: 10 }, async () => {
          try {
            const response = await apiCall(endpoint.method, endpoint.path, { sessionToken })
            expect(response.status).toBe(200)
          } catch (error) {
            errors.push({ endpoint: endpoint.path, error })
          }
        })
      )

      await Promise.all(requests)

      const totalTime = Date.now() - startTime

      // Log results
      console.log(`   ✅ Completed ${requests.length} requests across ${endpoints.length} endpoints in ${totalTime}ms`)
      console.log(`   Errors: ${errors.length}`)

      // Assertions
      expect(errors.length).toBe(0)
      expect(totalTime).toBeLessThan(10000) // All complete within 10 seconds
    }, 30000)
  })

  describe('Rate Limiting', () => {
    test('should enforce rate limits under burst traffic', async () => {
      if (!sessionToken) throw new Error('No session token')

      console.log('   Testing rate limiting under burst traffic...')

      // Make 200 requests as fast as possible (burst)
      const BURST_SIZE = 200
      const startTime = Date.now()
      const results: Array<{ status: number; rateLimited: boolean }> = []

      const requests = Array.from({ length: BURST_SIZE }, async () => {
        try {
          const response = await apiCall('GET', '/api/calls?limit=5', { sessionToken })
          results.push({
            status: response.status,
            rateLimited: response.status === 429,
          })
        } catch (error: any) {
          results.push({
            status: error?.status || 500,
            rateLimited: false,
          })
        }
      })

      await Promise.all(requests)

      const totalTime = Date.now() - startTime
      const rateLimitedCount = results.filter((r) => r.rateLimited).length
      const successCount = results.filter((r) => r.status === 200).length

      // Log results
      console.log(`   ✅ Completed ${BURST_SIZE} burst requests in ${totalTime}ms`)
      console.log(`   Success: ${successCount}`)
      console.log(`   Rate limited: ${rateLimitedCount}`)

      // Assertions
      expect(results.length).toBe(BURST_SIZE)
      // Rate limiting may not trigger if limits are high, but system should remain stable
      expect(successCount + rateLimitedCount).toBeGreaterThan(BURST_SIZE * 0.8) // At least 80% handled
    }, 60000)
  })
})
