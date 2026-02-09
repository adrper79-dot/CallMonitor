/**
 * Webhook Auto-Retry — Unit Tests
 *
 * Tests the webhook delivery retry logic.
 * Uses mock functions to avoid real HTTP calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the logger before importing
vi.mock('../../workers/src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('Webhook Retry Module', () => {
  describe('deliverWithRetry', () => {
    it('should succeed on first attempt and return immediately', async () => {
      // Mock a successful fetch
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      })
      vi.stubGlobal('fetch', mockFetch)

      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        end: vi.fn(),
      }

      // Dynamically import after mock setup
      const { deliverWithRetry } = await import('../../workers/src/lib/webhook-retry')

      const result = await deliverWithRetry({
        db: mockDb as any,
        env: {},
        url: 'https://example.com/webhook',
        payload: { event: 'test', data: {} },
        orgId: '00000000-0000-0000-0000-000000000001',
        event: 'test.delivery',
        maxRetries: 3,
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
      expect(result.attempts).toBe(1)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      vi.unstubAllGlobals()
    })

    it('should include correct headers in delivery request', async () => {
      let capturedHeaders: Record<string, string> = {}
      const mockFetch = vi.fn().mockImplementation((url, opts) => {
        capturedHeaders = opts.headers
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('OK'),
        })
      })
      vi.stubGlobal('fetch', mockFetch)

      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        end: vi.fn(),
      }

      const { deliverWithRetry } = await import('../../workers/src/lib/webhook-retry')

      await deliverWithRetry({
        db: mockDb as any,
        env: {},
        url: 'https://example.com/webhook',
        payload: { event: 'test' },
        orgId: '00000000-0000-0000-0000-000000000001',
        event: 'call.ended',
        maxRetries: 0,
      })

      expect(capturedHeaders['Content-Type']).toBe('application/json')
      expect(capturedHeaders['X-Webhook-Event']).toBe('call.ended')
      expect(capturedHeaders['X-Webhook-Timestamp']).toBeDefined()

      vi.unstubAllGlobals()
    })

    it('should log delivery attempt to database', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      })
      vi.stubGlobal('fetch', mockFetch)

      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        end: vi.fn(),
      }

      const { deliverWithRetry } = await import('../../workers/src/lib/webhook-retry')

      await deliverWithRetry({
        db: mockDb as any,
        env: {},
        url: 'https://example.com/webhook',
        payload: { test: true },
        orgId: '00000000-0000-0000-0000-000000000001',
        event: 'test.delivery',
        webhookId: '00000000-0000-0000-0000-000000000002',
      })

      // Wait for async log to fire
      await new Promise((r) => setTimeout(r, 50))

      // Should have called db.query to log the delivery
      const logCall = mockDb.query.mock.calls.find((call: string[][]) =>
        call[0]?.includes('webhook_deliveries')
      )
      expect(logCall).toBeDefined()

      vi.unstubAllGlobals()
    })

    it('should return failure result on first failed attempt', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })
      vi.stubGlobal('fetch', mockFetch)

      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        end: vi.fn(),
      }

      const { deliverWithRetry } = await import('../../workers/src/lib/webhook-retry')

      const result = await deliverWithRetry({
        db: mockDb as any,
        env: {},
        url: 'https://example.com/webhook',
        payload: { test: true },
        orgId: '00000000-0000-0000-0000-000000000001',
        event: 'test.delivery',
        maxRetries: 0, // No retries for this test
      })

      expect(result.success).toBe(false)
      expect(result.status).toBe(500)
      expect(result.attempts).toBe(1)

      vi.unstubAllGlobals()
    })

    it('should handle network errors gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'))
      vi.stubGlobal('fetch', mockFetch)

      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        end: vi.fn(),
      }

      const { deliverWithRetry } = await import('../../workers/src/lib/webhook-retry')

      const result = await deliverWithRetry({
        db: mockDb as any,
        env: {},
        url: 'https://example.com/webhook',
        payload: { test: true },
        orgId: '00000000-0000-0000-0000-000000000001',
        event: 'test.delivery',
        maxRetries: 0,
      })

      expect(result.success).toBe(false)
      expect(result.status).toBe(0)
      expect(result.duration_ms).toBeGreaterThanOrEqual(0)

      vi.unstubAllGlobals()
    })
  })

  describe('fanOutToSubscribers', () => {
    it('should return 0 when no matching subscriptions exist', async () => {
      const mockFetch = vi.fn()
      vi.stubGlobal('fetch', mockFetch)

      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        end: vi.fn(),
      }

      const { fanOutToSubscribers } = await import('../../workers/src/lib/webhook-retry')

      const count = await fanOutToSubscribers({
        db: mockDb as any,
        env: {},
        orgId: '00000000-0000-0000-0000-000000000001',
        event: 'call.ended',
        payload: { call_id: '123' },
      })

      expect(count).toBe(0)
      expect(mockFetch).not.toHaveBeenCalled()

      vi.unstubAllGlobals()
    })

    it('should deliver to all matching subscriptions', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      })
      vi.stubGlobal('fetch', mockFetch)

      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: [
            { id: 'sub-1', url: 'https://a.com/hook', secret: 'sec1', events: ['call.ended'] },
            { id: 'sub-2', url: 'https://b.com/hook', secret: 'sec2', events: ['call.ended'] },
          ],
        }),
        end: vi.fn(),
      }

      const { fanOutToSubscribers } = await import('../../workers/src/lib/webhook-retry')

      const count = await fanOutToSubscribers({
        db: mockDb as any,
        env: {},
        orgId: '00000000-0000-0000-0000-000000000001',
        event: 'call.ended',
        payload: { call_id: '123' },
      })

      expect(count).toBe(2)
      // Wait for deliveries
      await new Promise((r) => setTimeout(r, 50))
      expect(mockFetch).toHaveBeenCalledTimes(2)

      vi.unstubAllGlobals()
    })

    it('should handle database errors gracefully', async () => {
      const mockDb = {
        query: vi.fn().mockRejectedValue(new Error('DB connection failed')),
        end: vi.fn(),
      }

      const { fanOutToSubscribers } = await import('../../workers/src/lib/webhook-retry')

      const count = await fanOutToSubscribers({
        db: mockDb as any,
        env: {},
        orgId: '00000000-0000-0000-0000-000000000001',
        event: 'call.ended',
        payload: { call_id: '123' },
      })

      expect(count).toBe(0) // Graceful degradation
    })
  })
})
