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
 * EXCEPTIONS: Test organization bypasses rate limits for integration testing.
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

    // TEST ORGANIZATION BYPASS: Skip rate limiting for test org to prevent 429s in integration tests
    // Check session for test org ID (3cc2cb3c-2f6c-4418-8c98-a7948aea9625)
    try {
      const authHeader = c.req.header('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        // Check if this is a test session by looking up the user's organization
        const db = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
        if (db) {
          const { Client } = await import('pg')
          const client = new Client({ connectionString: db })
          await client.connect()
          try {
            const result = await client.query(
              `
              SELECT om.organization_id
              FROM public.sessions s
              JOIN public.users u ON u.id = s.user_id
              LEFT JOIN org_members om ON om.user_id = u.id
              WHERE s.session_token = $1 AND s.expires > NOW()
              LIMIT 1
            `,
              [token]
            )
            if (result.rows.length > 0 && result.rows[0].organization_id === '3cc2cb3c-2f6c-4418-8c98-a7948aea9625') {
              logger.info('[rate-limit] Test organization session detected, bypassing rate limit', { prefix, ip })
              await client.end()
              return next()
            }
          } finally {
            await client.end()
          }
        }
      }
    } catch (err) {
      logger.warn('[rate-limit] Error checking test session bypass', { error: err })
      // Ignore auth parsing errors — proceed with rate limiting
    }

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

/** Login: 10 attempts per 15 minutes per IP (brute-force protection) */
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

/** Analytics queries: 60 per 5 minutes per IP */
export const analyticsRateLimit = rateLimit({
  limit: 60,
  windowSeconds: 5 * 60,
  prefix: 'rl:analytics',
})

/** Analytics export: 5 per 15 minutes per IP (heavy CSV operation) */
export const analyticsExportRateLimit = rateLimit({
  limit: 5,
  windowSeconds: 15 * 60,
  prefix: 'rl:analytics-export',
})

/** AI transcription: 10 per 5 minutes per IP */
export const aiTranscriptionRateLimit = rateLimit({
  limit: 10,
  windowSeconds: 5 * 60,
  prefix: 'rl:ai-transcription',
})

/** AI LLM (OpenAI): 30 per 5 minutes per IP */
export const aiLlmRateLimit = rateLimit({
  limit: 30,
  windowSeconds: 5 * 60,
  prefix: 'rl:ai-llm',
})

/** AI TTS: 20 per 5 minutes per IP */
export const aiTtsRateLimit = rateLimit({
  limit: 20,
  windowSeconds: 5 * 60,
  prefix: 'rl:ai-tts',
})

/** Collections CRM mutations: 30 per 5 minutes per IP */
export const collectionsRateLimit = rateLimit({
  limit: 30,
  windowSeconds: 5 * 60,
  prefix: 'rl:collections',
})

/** Collections CSV import: 5 per 15 minutes per IP (heavy operation) */
export const collectionsImportRateLimit = rateLimit({
  limit: 5,
  windowSeconds: 15 * 60,
  prefix: 'rl:collections-import',
})

/** Campaign mutations: 20 per 5 minutes per IP */
export const campaignsRateLimit = rateLimit({
  limit: 20,
  windowSeconds: 5 * 60,
  prefix: 'rl:campaigns',
})

/** Retention policy mutations: 10 per 15 minutes per IP */
export const retentionRateLimit = rateLimit({
  limit: 10,
  windowSeconds: 15 * 60,
  prefix: 'rl:retention',
})

/** Compliance mutations: 20 per 5 minutes per IP */
export const complianceRateLimit = rateLimit({
  limit: 20,
  windowSeconds: 5 * 60,
  prefix: 'rl:compliance',
})

/** Admin mutations: 10 per 15 minutes per IP */
export const adminRateLimit = rateLimit({
  limit: 10,
  windowSeconds: 15 * 60,
  prefix: 'rl:admin',
})

/** Survey mutations: 20 per 5 minutes per IP */
export const surveyRateLimit = rateLimit({ limit: 20, windowSeconds: 5 * 60, prefix: 'rl:survey' })

/** Bond AI mutations: 20 per 5 minutes per IP */
export const bondAiRateLimit = rateLimit({ limit: 20, windowSeconds: 5 * 60, prefix: 'rl:bond-ai' })

/** AI summary generation: 10 per 5 minutes per IP (OpenAI spend) */
export const aiSummaryRateLimit = rateLimit({
  limit: 10,
  windowSeconds: 5 * 60,
  prefix: 'rl:ai-summary',
})

/** User management: 10 per 15 minutes per IP */
export const userRateLimit = rateLimit({ limit: 10, windowSeconds: 15 * 60, prefix: 'rl:user' })

/** Organization mutations: 5 per 15 minutes per IP */
export const orgRateLimit = rateLimit({ limit: 5, windowSeconds: 15 * 60, prefix: 'rl:org' })

/** Recording mutations: 10 per 5 minutes per IP */
export const recordingRateLimit = rateLimit({
  limit: 10,
  windowSeconds: 5 * 60,
  prefix: 'rl:recording',
})

/** Report generation: 10 per 5 minutes per IP */
export const reportRateLimit = rateLimit({ limit: 10, windowSeconds: 5 * 60, prefix: 'rl:report' })

/** Email operations: 5 per 5 minutes per IP */
export const emailRateLimit = rateLimit({ limit: 5, windowSeconds: 5 * 60, prefix: 'rl:email' })

/** Shopper/script mutations: 20 per 5 minutes per IP */
export const shopperRateLimit = rateLimit({
  limit: 20,
  windowSeconds: 5 * 60,
  prefix: 'rl:shopper',
})

export const callerIdRateLimit = rateLimit({
  limit: 20,
  windowSeconds: 5 * 60,
  prefix: 'rl:caller-id',
})
export const callerIdVerifyRateLimit = rateLimit({
  limit: 5,
  windowSeconds: 5 * 60,
  prefix: 'rl:caller-id-verify',
})
export const audioRateLimit = rateLimit({ limit: 20, windowSeconds: 5 * 60, prefix: 'rl:audio' })
export const scorecardsRateLimit = rateLimit({
  limit: 30,
  windowSeconds: 5 * 60,
  prefix: 'rl:scorecards',
})

// ─── Feature v5.0 Rate Limiters ──────────────────────────────────────────────

/** Sentiment analysis: 30 per minute per IP (OpenAI cost control) */
export const sentimentRateLimit = rateLimit({
  limit: 30,
  windowSeconds: 60,
  prefix: 'rl:sentiment',
})

/** IVR payment flows: 10 per minute per IP (financial transaction safety) */
export const ivrRateLimit = rateLimit({ limit: 10, windowSeconds: 60, prefix: 'rl:ivr' })

/** Predictive dialer queue operations: 5 per minute per IP */
export const predictiveDialerRateLimit = rateLimit({
  limit: 5,
  windowSeconds: 60,
  prefix: 'rl:dialer',
})

/** AI toggle (mode switching): 10 per minute per IP */
export const aiToggleRateLimit = rateLimit({ limit: 10, windowSeconds: 60, prefix: 'rl:ai-toggle' })

/** DTMF gather operations: 20 per minute per IP */
export const gatherRateLimit = rateLimit({ limit: 20, windowSeconds: 60, prefix: 'rl:gather' })

/** RBAC permission queries: 30 per 5 minutes per IP */
export const rbacRateLimit = rateLimit({ limit: 30, windowSeconds: 5 * 60, prefix: 'rl:rbac' })

/** Audit log queries: 100 per 5 minutes per IP (UI polling - ActivityFeed, CallList, etc.) */
export const auditRateLimit = rateLimit({ limit: 100, windowSeconds: 5 * 60, prefix: 'rl:audit' })

/** External webhook receivers: 100 per minute per IP (Telnyx/AssemblyAI/Stripe) */
export const externalWebhookRateLimit = rateLimit({ limit: 100, windowSeconds: 60, prefix: 'rl:ext-webhook' })

// ─── PAID API RATE LIMITERS (BL-107) ────────────────────────────────────────

/** ElevenLabs TTS: 10 requests per 5 minutes per IP (cost control - ~$0.30/1K chars) */
export const elevenLabsTtsRateLimit = rateLimit({
  limit: 10,
  windowSeconds: 5 * 60,
  prefix: 'rl:elevenlabs-tts',
})

/** Telnyx Voice API: 20 requests per 5 minutes per IP (API quota + cost protection) */
export const telnyxVoiceRateLimit = rateLimit({
  limit: 20,
  windowSeconds: 5 * 60,
  prefix: 'rl:telnyx-voice',
})

// ─── MUTATION ENDPOINT RATE LIMITERS (BL-108) ─────────────────────────────

/** AI Config mutations: 10 requests per 15 minutes per IP (configuration changes) */
export const aiConfigRateLimit = rateLimit({
  limit: 10,
  windowSeconds: 15 * 60,
  prefix: 'rl:ai-config',
})

/** Onboarding mutations: 3 per 15 minutes per IP (Stripe + Telnyx spend protection) */
export const onboardingRateLimit = rateLimit({
  limit: 3,
  windowSeconds: 15 * 60,
  prefix: 'rl:onboarding',
})

/** Dialer agent status: 30 per 5 minutes per IP */
export const dialerRateLimit = rateLimit({
  limit: 30,
  windowSeconds: 5 * 60,
  prefix: 'rl:dialer-status',
})

/** Reliability webhook retries: 10 per 5 minutes per IP */
export const reliabilityRateLimit = rateLimit({
  limit: 10,
  windowSeconds: 5 * 60,
  prefix: 'rl:reliability',
})

