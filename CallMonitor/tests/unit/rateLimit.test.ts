import { describe, it, expect, beforeEach, vi } from 'vitest'
import { rateLimit, recordAttempt } from '@/lib/rateLimit'

// Mock Supabase
vi.mock('@/lib/supabaseAdmin', () => ({
  default: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                data: [],
                error: null
              }))
            }))
          }))
        }))
      }))
    }))
  }
}))

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Clear in-memory limiter
    if ((global as any).__rateLimiter) {
      (global as any).__rateLimiter.clear()
    }
  })

  it('should allow requests within limit', async () => {
    const result = await rateLimit('test-identifier', {
      maxAttempts: 5,
      windowMs: 60000,
      blockMs: 60000
    })

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(5)
  })

  it('should block after max attempts', async () => {
    const identifier = 'test-identifier-2'
    const config = {
      maxAttempts: 3,
      windowMs: 60000,
      blockMs: 60000
    }

    // Record attempts
    for (let i = 0; i < 3; i++) {
      await recordAttempt(identifier, false)
    }

    const result = await rateLimit(identifier, config)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.blockedUntil).toBeDefined()
  })

  it('should reset after window expires', async () => {
    const identifier = 'test-identifier-3'
    const config = {
      maxAttempts: 2,
      windowMs: 100, // Very short window
      blockMs: 100
    }

    // Record attempts
    await recordAttempt(identifier, false)
    await recordAttempt(identifier, false)

    // Should be blocked
    let result = await rateLimit(identifier, config)
    expect(result.allowed).toBe(false)

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150))

    // Should be allowed again
    result = await rateLimit(identifier, config)
    expect(result.allowed).toBe(true)
  })
})
