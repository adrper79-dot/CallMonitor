/**
 * KV-backed Idempotency Layer for Cloudflare Workers
 *
 * Prevents duplicate mutation processing when clients retry POST/PUT/DELETE.
 * Client sends `Idempotency-Key` header; Workers checks KV for a cached response.
 *
 * Pattern:
 *   1. Client sends POST with `Idempotency-Key: <uuid>`
 *   2. Workers checks KV for `idem:<key>` — if found, returns cached response
 *   3. If not found, processes request, stores response in KV with TTL
 *   4. Subsequent retries with same key get the cached response
 *
 * @see ROADMAP.md — RISK/SCALE: Idempotency (KV-backed)
 * @see ARCH_DOCS/CIO_PRODUCTION_AUDIT_2026-02-05.md — resilience patterns
 */

import type { Context, Next, MiddlewareHandler } from 'hono'
import type { Env } from '../index'
import type { Session } from './auth'
import { logger } from './logger'

/** Default TTL: 24 hours (in seconds) — matches Stripe's idempotency window */
const DEFAULT_TTL_SECONDS = 24 * 60 * 60

/** KV key prefix */
const KV_PREFIX = 'idem'

/** Cached response shape stored in KV */
interface CachedResponse {
  status: number
  body: string
  headers: Record<string, string>
  createdAt: string
}

/**
 * Create idempotency middleware for mutation routes (POST/PUT/DELETE).
 *
 * Usage:
 * ```ts
 * import { idempotent } from '../lib/idempotency'
 *
 * billingRoutes.post('/checkout', idempotent(), async (c) => { ... })
 * ```
 *
 * The client must send an `Idempotency-Key` header (UUID recommended).
 * If omitted, the request passes through without idempotency protection.
 *
 * @param ttlSeconds — How long to cache the response (default: 24h)
 */
export function idempotent(ttlSeconds = DEFAULT_TTL_SECONDS): MiddlewareHandler<{
  Bindings: Env
}> {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const key = c.req.header('Idempotency-Key')

    // No key = pass through (idempotency is opt-in per request)
    if (!key) {
      return next()
    }

    // Validate key format — must be non-empty, max 256 chars
    if (key.length > 256) {
      return c.json({ error: 'Idempotency-Key too long (max 256 chars)' }, 400)
    }

    // BL-059: Scope idempotency key per organization to prevent cross-tenant collision
    const session = (
      c as unknown as Context<{ Bindings: Env; Variables: { session: Session } }>
    ).get('session')
    const orgScope = session?.organization_id || 'global'
    const kvKey = `${KV_PREFIX}:${orgScope}:${key}`

    // Check for cached response
    try {
      const cached = await c.env.KV.get<CachedResponse>(kvKey, 'json')
      if (cached) {
        logger.info('Idempotency cache hit', { key: kvKey })

        // Return cached response with indicator header
        const res = new Response(cached.body, {
          status: cached.status,
          headers: {
            'Content-Type': 'application/json',
            'Idempotent-Replayed': 'true',
            ...cached.headers,
          },
        })
        return res
      }
    } catch (err) {
      // KV read failure — continue processing (fail-open for availability)
      logger.warn('Idempotency KV read failed, processing normally', {
        key: kvKey,
        error: (err as Error)?.message,
      })
    }

    // Process the request
    await next()

    // Cache the response for future retries
    try {
      const response = c.res
      const body = await response.clone().text()

      const toCache: CachedResponse = {
        status: response.status,
        body,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
        },
        createdAt: new Date().toISOString(),
      }

      await c.env.KV.put(kvKey, JSON.stringify(toCache), {
        expirationTtl: ttlSeconds,
      })
    } catch (err) {
      // KV write failure — non-fatal, response still goes through
      logger.warn('Idempotency KV write failed', {
        key: kvKey,
        error: (err as Error)?.message,
      })
    }
  }
}

