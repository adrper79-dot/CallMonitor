/**
 * Feature Flag Utility — Centralized feature flag checking
 *
 * Provides cached, performant access to feature flags with fallback logic:
 * 1. Check org-specific flags first
 * 2. Fall back to global flags
 * 3. Default to false if not found
 *
 * Usage:
 * ```ts
 * import { getFeatureFlag } from '../lib/feature-flags'
 *
 * const enabled = await getFeatureFlag(db, 'grok_chat', session.organization_id)
 * if (enabled) {
 *   // use Grok for chat
 * }
 * ```
 */

import type { DbClient } from './db'
import { logger } from './logger'

// Simple in-memory cache with TTL
interface CacheEntry {
  value: boolean
  expires: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get feature flag value with caching
 * @param db Database client
 * @param feature Feature name
 * @param organizationId Organization ID (optional for global flags)
 * @returns Promise<boolean> - true if enabled, false otherwise
 */
export async function getFeatureFlag(
  db: DbClient,
  feature: string,
  organizationId?: string
): Promise<boolean> {
  const cacheKey = `${organizationId || 'global'}:${feature}`
  const now = Date.now()

  // Check cache first
  const cached = cache.get(cacheKey)
  if (cached && cached.expires > now) {
    return cached.value
  }

  try {
    let enabled = false

    // Check org-specific flag first
    if (organizationId) {
      const orgResult = await db.query(
        'SELECT enabled FROM org_feature_flags WHERE organization_id = $1 AND feature = $2',
        [organizationId, feature]
      )

      if (orgResult.rows.length > 0) {
        enabled = orgResult.rows[0].enabled
      } else {
        // Fall back to global flag
        const globalResult = await db.query(
          'SELECT enabled FROM global_feature_flags WHERE feature = $1',
          [feature]
        )

        if (globalResult.rows.length > 0) {
          enabled = globalResult.rows[0].enabled
        }
      }
    } else {
      // Global flag only
      const globalResult = await db.query(
        'SELECT enabled FROM global_feature_flags WHERE feature = $1',
        [feature]
      )

      if (globalResult.rows.length > 0) {
        enabled = globalResult.rows[0].enabled
      }
    }

    // Cache the result
    cache.set(cacheKey, {
      value: enabled,
      expires: now + CACHE_TTL,
    })

    return enabled
  } catch (error) {
    logger.error('Failed to get feature flag', { feature, organizationId, error })
    // On error, return false (fail-safe)
    return false
  }
}

/**
 * Clear feature flag cache (useful for testing or admin operations)
 */
export function clearFeatureFlagCache(): void {
  cache.clear()
}

/**
 * Check if feature is enabled with usage tracking for org flags
 * @param db Database client
 * @param feature Feature name
 * @param organizationId Organization ID
 * @returns Promise<{enabled: boolean, canUse: boolean}> - enabled status and usage allowance
 */
export async function checkFeatureWithUsage(
  db: DbClient,
  feature: string,
  organizationId: string
): Promise<{ enabled: boolean; canUse: boolean }> {
  try {
    const result = await db.query(
      `SELECT enabled, daily_limit, monthly_limit, current_daily_usage, current_monthly_usage, usage_reset_at
       FROM org_feature_flags
       WHERE organization_id = $1 AND feature = $2`,
      [organizationId, feature]
    )

    if (result.rows.length === 0) {
      // Fall back to global flag
      const enabled = await getFeatureFlag(db, feature)
      return { enabled, canUse: enabled }
    }

    const flag = result.rows[0]
    if (!flag.enabled) {
      return { enabled: false, canUse: false }
    }

    // Check usage limits
    const now = new Date()
    const resetAt = flag.usage_reset_at ? new Date(flag.usage_reset_at) : null

    let canUse = true

    if (flag.daily_limit && flag.current_daily_usage >= flag.daily_limit) {
      canUse = false
    }

    if (flag.monthly_limit && flag.current_monthly_usage >= flag.monthly_limit) {
      canUse = false
    }

    // Reset counters if needed
    if (resetAt && now >= resetAt) {
      await db.query(
        `UPDATE org_feature_flags
         SET current_daily_usage = 0, current_monthly_usage = 0, usage_reset_at = NOW() + INTERVAL '1 day'
         WHERE organization_id = $1 AND feature = $2`,
        [organizationId, feature]
      )
      canUse = true
    }

    return { enabled: true, canUse }
  } catch (error) {
    logger.error('Failed to check feature with usage', { feature, organizationId, error })
    return { enabled: false, canUse: false }
  }
}

/**
 * Increment usage counter for org feature flag
 * @param db Database client
 * @param feature Feature name
 * @param organizationId Organization ID
 */
export async function incrementFeatureUsage(
  db: DbClient,
  feature: string,
  organizationId: string
): Promise<void> {
  try {
    await db.query(
      `UPDATE org_feature_flags
       SET current_daily_usage = current_daily_usage + 1,
           current_monthly_usage = current_monthly_usage + 1
       WHERE organization_id = $1 AND feature = $2`,
      [organizationId, feature]
    )
  } catch (error) {
    logger.error('Failed to increment feature usage', { feature, organizationId, error })
  }
}