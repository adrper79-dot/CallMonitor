/**
 * KV-backed Rate Limiter for Cloudflare Workers
 *
 * Uses sliding-window counter stored in KV with TTL-based expiry.
 * Applied as Hono middleware to protect auth endpoints from brute-force.
 *
 * @see ARCH_DOCS/CIO_PRODUCTION_REVIEW.md — M6: Rate limiting on auth endpoints
 */

import type { Context, Next, MiddlewareHandler } from 'hono'
import type { Env } from '../index'
import { logger } from './logger'

interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number
  /** Window size in seconds */
  windowSeconds: number
  /** Key prefix in KV (e.g. 'rl:login') */
  prefix: string
}

interface RateLimitEntry {
  count: number
  resetAt: number // epoch ms
}

/**
 * Create a rate-limiting middleware for Hono routes.
 *
 * Key = prefix + client IP (via CF-Connecting-IP header).
 * Uses KV `expirationTtl` so stale entries auto-purge.
 *
 * Returns 429 with Retry-After header when limit is exceeded.
 */
export function rateLimit(config: RateLimitConfig): MiddlewareHandler<{ Bindings: Env }> {
  const { limit, windowSeconds, prefix } = config

  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const kv = c.env.KV
    if (!kv) {
      // KV not available (e.g. local dev without --kv) — skip silently
      logger.warn('[rate-limit] KV not bound, skipping rate limit check')
      return next()
    }

    // Identify client by CF-Connecting-IP → X-Forwarded-For → 'unknown'
    const ip =
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown'

    const key = `${prefix}:${ip}`
    const now = Date.now()

    try {
      const existing = await kv.get<RateLimitEntry>(key, 'json')

      if (existing && now < existing.resetAt) {
        // Window still active
        if (existing.count >= limit) {
          const retryAfter = Math.ceil((existing.resetAt - now) / 1000)
          c.header('Retry-After', String(retryAfter))
          c.header('X-RateLimit-Limit', String(limit))
          c.header('X-RateLimit-Remaining', '0')
          c.header('X-RateLimit-Reset', String(Math.ceil(existing.resetAt / 1000)))
          return c.json(
            {
              error: 'Too many requests. Please try again later.',
              code: 'RATE_LIMIT',
              retry_after: retryAfter,
            },
            429
          )
        }

        // Increment counter — keep same expiry window
        const updated: RateLimitEntry = { count: existing.count + 1, resetAt: existing.resetAt }
        const remainingTtl = Math.ceil((existing.resetAt - now) / 1000)
        await kv.put(key, JSON.stringify(updated), { expirationTtl: Math.max(remainingTtl, 1) })

        c.header('X-RateLimit-Limit', String(limit))
        c.header('X-RateLimit-Remaining', String(limit - updated.count))
        c.header('X-RateLimit-Reset', String(Math.ceil(existing.resetAt / 1000)))
      } else {
        // New window — create entry
        const resetAt = now + windowSeconds * 1000
        const entry: RateLimitEntry = { count: 1, resetAt }
        await kv.put(key, JSON.stringify(entry), { expirationTtl: windowSeconds })

        c.header('X-RateLimit-Limit', String(limit))
        c.header('X-RateLimit-Remaining', String(limit - 1))
        c.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))
      }
    } catch (err) {
      // KV failure should never block requests — fail open
      logger.error('[rate-limit] KV error, failing open', { error: (err as Error).message })
    }

    return next()
  }
}

// ─── Pre-configured limiters for auth endpoints ──────────────────────────────

/** Login: 10 attempts per 15 minutes per IP */
export const loginRateLimit = rateLimit({
  limit: 10,
  windowSeconds: 15 * 60,
  prefix: 'rl:login',
})

/** Signup: 5 attempts per hour per IP */
export const signupRateLimit = rateLimit({
  limit: 5,
  windowSeconds: 60 * 60,
  prefix: 'rl:signup',
})

/** Forgot password: 3 attempts per 15 minutes per IP */
export const forgotPasswordRateLimit = rateLimit({
  limit: 3,
  windowSeconds: 15 * 60,
  prefix: 'rl:forgot',
})

// ─── Pre-configured limiters for business-critical routes ────────────────────

/** Billing mutations: 20 per 15 minutes per IP (checkout, cancel, portal) */
export const billingRateLimit = rateLimit({
  limit: 20,
  windowSeconds: 15 * 60,
  prefix: 'rl:billing',
})

/** Call mutations: 30 per 5 minutes per IP (start, end, outcome) */
export const callMutationRateLimit = rateLimit({
  limit: 30,
  windowSeconds: 5 * 60,
  prefix: 'rl:call',
})

/** Voice/telephony actions: 20 per 5 minutes per IP (place call, config) */
export const voiceRateLimit = rateLimit({
  limit: 20,
  windowSeconds: 5 * 60,
  prefix: 'rl:voice',
})

/** Team management: 15 per 15 minutes per IP (invites, members) */
export const teamRateLimit = rateLimit({
  limit: 15,
  windowSeconds: 15 * 60,
  prefix: 'rl:team',
})

/** Booking mutations: 20 per 5 minutes per IP */
export const bookingRateLimit = rateLimit({
  limit: 20,
  windowSeconds: 5 * 60,
  prefix: 'rl:booking',
})

/** Webhook subscriptions: 10 per 5 minutes per IP */
export const webhookRateLimit = rateLimit({
  limit: 10,
  windowSeconds: 5 * 60,
  prefix: 'rl:webhook',
})
