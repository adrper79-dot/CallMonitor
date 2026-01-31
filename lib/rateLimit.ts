import { query } from '@/lib/pgClient'
import { logger } from '@/lib/logger'

/**
 * Rate Limiting Service
 * 
 * Persistent rate limiting using login_attempts table or in-memory fallback.
 * Per AUTH_NOTES.md: Replace in-memory limiter with persistent storage for production.
 */

export interface RateLimitConfig {
  maxAttempts: number
  windowMs: number
  blockMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  blockedUntil?: number
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockMs: 15 * 60 * 1000 // 15 minutes
}

/**
 * Rate limit by identifier (username, IP, etc.)
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStart = now - config.windowMs

  try {
    // Try persistent storage first (login_attempts table)
    const { rows: attempts } = await query(
      `SELECT attempted_at, succeeded FROM login_attempts 
       WHERE username = $1 AND attempted_at >= $2 
       ORDER BY attempted_at DESC`,
      [identifier, new Date(windowStart).toISOString()]
    )

    if (attempts) {
      // Count failed attempts
      const failedAttempts = attempts.filter((a: any) => !a.succeeded)
      const recentFailed = failedAttempts.length

      // Check if blocked
      const lastFailed = failedAttempts[0]
      let blockedUntil: number | undefined
      if (lastFailed && recentFailed >= config.maxAttempts) {
        blockedUntil = new Date(lastFailed.attempted_at).getTime() + config.blockMs
        if (blockedUntil > now) {
          return {
            allowed: false,
            remaining: 0,
            resetAt: blockedUntil,
            blockedUntil
          }
        }
      }

      const remaining = Math.max(0, config.maxAttempts - recentFailed)
      return {
        allowed: remaining > 0,
        remaining,
        resetAt: now + config.windowMs,
        blockedUntil
      }
    }
  } catch (err) {
    // Fallback to in-memory if DB fails
    logger.warn('rateLimit: DB query failed, using in-memory fallback', { error: (err as Error).message })
  }

  // In-memory fallback
  if (!(global as any).__rateLimiter) {
    (global as any).__rateLimiter = new Map()
  }
  const limiter: Map<string, any> = (global as any).__rateLimiter

  const entry = limiter.get(identifier) || { attempts: [] as number[], blockedUntil: 0 }
  entry.attempts = entry.attempts.filter((t: number) => t > windowStart)

  if (entry.blockedUntil && entry.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      blockedUntil: entry.blockedUntil
    }
  }

  const recentAttempts = entry.attempts.length
  if (recentAttempts >= config.maxAttempts) {
    entry.blockedUntil = now + config.blockMs
    limiter.set(identifier, entry)
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      blockedUntil: entry.blockedUntil
    }
  }

  const remaining = config.maxAttempts - recentAttempts
  return {
    allowed: true,
    remaining,
    resetAt: now + config.windowMs
  }
}

/**
 * Record an attempt (success or failure)
 */
export async function recordAttempt(
  identifier: string,
  succeeded: boolean,
  ip?: string
): Promise<void> {
  try {
    // Record in persistent storage
    await query(
      `INSERT INTO login_attempts (username, ip, succeeded, attempted_at) VALUES ($1, $2, $3, NOW())`,
      [identifier, ip || null, succeeded]
    )
  } catch (err) {
    // Best-effort
    logger.warn('recordAttempt: failed', { error: (err as Error).message })
  }

  // Also update in-memory limiter
  if (!(global as any).__rateLimiter) {
    (global as any).__rateLimiter = new Map()
  }
  const limiter: Map<string, any> = (global as any).__rateLimiter
  const entry = limiter.get(identifier) || { attempts: [], blockedUntil: 0 }
  entry.attempts.push(Date.now())
  limiter.set(identifier, entry)
}

/**
 * Get client IP from request
 */
export function getClientIP(req: Request): string {
  // Check various headers (for proxies/load balancers)
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIP = req.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  return 'unknown'
}

/**
 * Rate limit middleware for API routes
 */
/**
 * Check rate limit for a specific identifier
 * Simplified interface for rate limiting
 * 
 * @param identifier - Unique identifier (user ID, IP, etc)
 * @param maxAttempts - Maximum attempts allowed (default: 100)
 * @param windowMs - Time window in ms (default: 60000 = 1 minute)
 */
export async function checkRateLimit(
  identifier: string,
  maxAttempts: number = 100,
  windowMs: number = 60000
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const config: RateLimitConfig = {
    maxAttempts,
    windowMs,
    blockMs: windowMs
  }
  const result = await rateLimit(identifier, config)
  const resetIn = result.resetAt - Date.now()
  return { allowed: result.allowed, remaining: result.remaining, resetIn: Math.max(0, resetIn) }
}

export function withRateLimit(
  handler: (req: Request) => Promise<Response>,
  options?: {
    identifier?: (req: Request) => string
    config?: RateLimitConfig
  }
) {
  return async (req: Request): Promise<Response> => {
    const identifier = options?.identifier
      ? options.identifier(req)
      : getClientIP(req)

    const config = options?.config || DEFAULT_CONFIG
    const limitResult = await rateLimit(identifier, config)

    if (!limitResult.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            severity: 'MEDIUM'
          }
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(config.maxAttempts),
            'X-RateLimit-Remaining': String(limitResult.remaining),
            'X-RateLimit-Reset': String(Math.ceil(limitResult.resetAt / 1000)),
            ...(limitResult.blockedUntil ? {
              'Retry-After': String(Math.ceil((limitResult.blockedUntil - Date.now()) / 1000))
            } : {})
          }
        }
      )
    }

    const response = await handler(req)

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', String(config.maxAttempts))
    response.headers.set('X-RateLimit-Remaining', String(limitResult.remaining))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(limitResult.resetAt / 1000)))

    return response
  }
}
