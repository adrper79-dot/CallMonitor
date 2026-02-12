/**
 * Plan Gating Middleware - Subscription-based feature access control
 *
 * Enforces plan limits based on organization_plans table with KV caching.
 * Implements fail-open strategy (see LESSONS_LEARNED.md).
 *
 * @module workers/src/lib/plan-gating
 */

import type { Context, Next } from 'hono'
import type { Env, AppEnv } from '../index'
import { getDb } from './db'
import { logger } from './logger'

/**
 * Plan hierarchy (ascending order of access)
 */
export const PLAN_HIERARCHY = ['free', 'starter', 'pro', 'business', 'enterprise'] as const
export type PlanName = (typeof PLAN_HIERARCHY)[number]

/**
 * Feature capabilities mapped to minimum required plan
 */
export const FEATURE_PLAN_REQUIREMENTS: Record<string, PlanName> = {
  // Translation features
  translation: 'pro',
  live_translation: 'business',

  // AI features
  bond_ai: 'pro',
  call_copilot: 'business',

  // Recording & Transcription
  call_recording: 'starter',
  call_transcription: 'starter',

  // Reports & Analytics
  reports: 'business',
  custom_reports: 'business',
  analytics_dashboard: 'pro',

  // Team features
  teams: 'pro',
  departments: 'business',

  // Quality & Compliance
  secret_shopper: 'business',
  scorecard_templates: 'business',
  qa_alerts: 'business',

  // Advanced features
  voice_cloning: 'enterprise',
  custom_integrations: 'enterprise',
  sso: 'enterprise',
}

/**
 * Plan capability limits (for usage-based enforcement)
 */
export const PLAN_LIMITS: Record<
  PlanName,
  {
    max_calls_per_month: number
    max_users: number
    max_call_duration_seconds: number
    retention_days: number
    max_storage_gb: number
  }
> = {
  free: {
    max_calls_per_month: 100,
    max_users: 1,
    max_call_duration_seconds: 600, // 10 min
    retention_days: 7,
    max_storage_gb: 1,
  },
  starter: {
    max_calls_per_month: 1000,
    max_users: 5,
    max_call_duration_seconds: 1800, // 30 min
    retention_days: 30,
    max_storage_gb: 5,
  },
  pro: {
    max_calls_per_month: 5000,
    max_users: 20,
    max_call_duration_seconds: 3600, // 1 hour
    retention_days: 90,
    max_storage_gb: 25,
  },
  business: {
    max_calls_per_month: 20000,
    max_users: 100,
    max_call_duration_seconds: 7200, // 2 hours
    retention_days: 365,
    max_storage_gb: 100,
  },
  enterprise: {
    max_calls_per_month: -1, // unlimited
    max_users: -1, // unlimited
    max_call_duration_seconds: 14400, // 4 hours
    retention_days: 2555, // 7 years (legal compliance)
    max_storage_gb: -1, // unlimited
  },
}

/**
 * Cache TTL for plan lookups (5 minutes)
 */
const PLAN_CACHE_TTL = 300

/**
 * Get organization plan from database with KV caching
 */
export async function getOrgPlan(env: Env, orgId: string): Promise<PlanName> {
  const cacheKey = `plan:${orgId}`

  try {
    // Try KV cache first (fail-open if unavailable)
    if (env.KV) {
      const cached = await env.KV.get(cacheKey)
      if (cached) {
        logger.info('Plan cache hit', { org_id: orgId, plan: cached })
        return cached as PlanName
      }
    }
  } catch (kvErr: any) {
    // KV error → log and continue to database
    logger.warn('KV unavailable for plan lookup', { error: kvErr?.message })
  }

  // Query database for plan
  let plan: PlanName = 'free' // Default fallback

  try {
    const db = getDb(env)

    const result = await db.query(
      `SELECT plan, subscription_status
       FROM organizations
       WHERE id = $1`,
      [orgId]
    )

    await db.end()

    if (result.rows.length > 0) {
      const row = result.rows[0]

      // Check if subscription is active
      // Treat null/missing status as 'active' for backward compatibility
      // (orgs created before Stripe integration have no subscription_status)
      const status = row.subscription_status || 'active'
      const isActive = ['active', 'trialing'].includes(status)

      if (isActive && row.plan) {
        const dbPlan = row.plan.toLowerCase()
        // Validate plan is in hierarchy
        if (PLAN_HIERARCHY.includes(dbPlan as PlanName)) {
          plan = dbPlan as PlanName
        }
      } else if (isActive && !row.plan) {
        // Org has no plan set — treat as 'free' (the default)
        plan = 'free'
      }
    }

    // Cache result in KV (fire-and-forget)
    if (env.KV) {
      env.KV.put(cacheKey, plan, { expirationTtl: PLAN_CACHE_TTL }).catch(() => {})
    }
  } catch (dbErr: any) {
    // Database error → fail open (allow request but log)
    logger.error('Database error during plan lookup - FAILING OPEN', {
      org_id: orgId,
      error: dbErr?.message,
    })
  }

  return plan
}

/**
 * Check if organization has access to feature based on plan hierarchy
 */
export function hasAccess(currentPlan: PlanName, requiredPlan: PlanName): boolean {
  const currentIndex = PLAN_HIERARCHY.indexOf(currentPlan)
  const requiredIndex = PLAN_HIERARCHY.indexOf(requiredPlan)

  if (currentIndex === -1 || requiredIndex === -1) {
    logger.warn('Invalid plan comparison', { current: currentPlan, required: requiredPlan })
    return false
  }

  return currentIndex >= requiredIndex
}

/**
 * Middleware: Require minimum plan for route access
 *
 * @example
 * router.post('/api/voice/translation', requirePlan('pro'), async (c) => { ... })
 */
export function requirePlan(minPlan: PlanName) {
  return async (c: Context<AppEnv>, next: Next) => {
    try {
      // Get session from context (set by requireAuth middleware)
      const session = c.get('session')

      if (!session || !session.organization_id) {
        return c.json(
          {
            error: 'Authentication required',
            code: 'AUTH_REQUIRED',
          },
          401
        )
      }

      // Get organization plan
      const orgPlan = await getOrgPlan(c.env, session.organization_id)

      // Business rule override: all paid tiers (starter+) may access any feature gated above 'free'
      if (orgPlan !== 'free') {
        return next()
      }

      // Check access
      if (!hasAccess(orgPlan, minPlan)) {
        logger.info('Plan gate blocked request', {
          org_id: session.organization_id,
          current_plan: orgPlan,
          required_plan: minPlan,
          path: c.req.path,
        })

        return c.json(
          {
            error: 'Upgrade required',
            code: 'PLAN_UPGRADE_REQUIRED',
            current_plan: orgPlan,
            required_plan: minPlan,
            upgrade_url: `/settings?tab=billing&upgrade_to=${minPlan}`,
          },
          402
        ) // 402 Payment Required
      }

      await next()
    } catch (err: any) {
      // Unexpected error → fail open (allow request but log)
      logger.error('Plan gating middleware error - FAILING OPEN', {
        error: err?.message,
        path: c.req.path,
      })

      // Continue to handler (fail-open)
      await next()
    }
  }
}

/**
 * Get plan limits for organization
 */
export async function getOrgLimits(env: Env, orgId: string) {
  const plan = await getOrgPlan(env, orgId)
  return PLAN_LIMITS[plan]
}

/**
 * Check if organization has exceeded usage limits
 * Returns { exceeded: boolean, current: number, limit: number }
 */
export async function checkUsageLimit(
  env: Env,
  orgId: string,
  metric: 'calls_this_month' | 'active_users' | 'storage_gb'
): Promise<{ exceeded: boolean; current: number; limit: number }> {
  const limits = await getOrgLimits(env, orgId)

  let current = 0
  let limit = 0

  try {
    const db = getDb(env)

    switch (metric) {
      case 'calls_this_month':
        limit = limits.max_calls_per_month
        if (limit === -1) return { exceeded: false, current: 0, limit: -1 } // Unlimited

        const callResult = await db.query(
          `SELECT COUNT(*) as count
           FROM calls
           WHERE organization_id = $1
             AND created_at >= DATE_TRUNC('month', NOW())`,
          [orgId]
        )
        current = parseInt(callResult.rows[0]?.count || '0')
        break

      case 'active_users':
        limit = limits.max_users
        if (limit === -1) return { exceeded: false, current: 0, limit: -1 }

        const userResult = await db.query(
          `SELECT COUNT(*) as count
           FROM org_members
           WHERE organization_id = $1`,
          [orgId]
        )
        current = parseInt(userResult.rows[0]?.count || '0')
        break

      case 'storage_gb':
        limit = limits.max_storage_gb || 100 // Default 100GB if not specified
        if (limit === -1) return { exceeded: false, current: 0, limit: -1 } // Unlimited

        const storageResult = await db.query(
          `SELECT COALESCE(SUM(size_bytes), 0) / (1024 * 1024 * 1024.0) as storage_gb
           FROM audio_files
           WHERE organization_id = $1`,
          [orgId]
        )
        current = parseFloat(storageResult.rows[0]?.storage_gb || '0')
        break
    }

    await db.end()
  } catch (err: any) {
    logger.error('Usage limit check error', { error: err?.message, metric })
  }

  return {
    exceeded: current > limit && limit !== -1,
    current,
    limit,
  }
}

/**
 * Invalidate plan cache for organization (call after subscription change)
 */
export async function invalidatePlanCache(env: Env, orgId: string): Promise<void> {
  const cacheKey = `plan:${orgId}`

  try {
    if (env.KV) {
      await env.KV.delete(cacheKey)
      logger.info('Plan cache invalidated', { org_id: orgId })
    }
  } catch (err: any) {
    logger.warn('Failed to invalidate plan cache', { error: err?.message })
  }
}

