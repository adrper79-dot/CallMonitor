import { describe, it, expect, vi } from 'vitest'
import { hashRequest, checkIdempotency, storeIdempotency } from '@/lib/idempotency'

// Mock Supabase
vi.mock('@/lib/supabaseAdmin', () => ({
  default: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            limit: vi.fn(() => ({
              data: [],
              error: null
            }))
          }))
        }))
      })),
      insert: vi.fn(() => ({
        data: null,
        error: null
      }))
    }))
  }
}))

describe('Idempotency', () => {
  describe('hashRequest', () => {
    it('should generate consistent hash for same input', () => {
      const body = { test: 'data' }
      const hash1 = hashRequest(body)
      const hash2 = hashRequest(body)
      expect(hash1).toBe(hash2)
    })

    it('should generate different hash for different input', () => {
      const body1 = { test: 'data1' }
      const body2 = { test: 'data2' }
      const hash1 = hashRequest(body1)
      const hash2 = hashRequest(body2)
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('checkIdempotency', () => {
    it('should return cached false for new request', async () => {
      const result = await checkIdempotency('new-key', 'hash-123')
      expect(result.cached).toBe(false)
    })
  })

  describe('storeIdempotency', () => {
    it('should store idempotency record', async () => {
      await expect(
        storeIdempotency('test-key', 'hash-123', { success: true }, 'org-123')
      ).resolves.not.toThrow()
    })
  })
})
