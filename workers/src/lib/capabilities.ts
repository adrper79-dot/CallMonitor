/**
 * Feature Capability Checker - Plan-based feature access
 *
 * Provides granular capability checking for UI feature toggles.
 * Used by frontend to show/hide features and display upgrade CTAs.
 *
 * @module workers/src/lib/capabilities
 */

import type { Env } from '../index'
import {
  getOrgPlan,
  hasAccess,
  FEATURE_PLAN_REQUIREMENTS,
  PLAN_LIMITS,
  type PlanName,
} from './plan-gating'
import { logger } from './logger'

export interface CapabilityResult {
  allowed: boolean
  current_plan: PlanName
  required_plan?: PlanName
  upgrade_url?: string
  limits?: Record<string, number>
}

/**
 * Check if organization has access to a specific capability
 *
 * @example
 * const result = await checkCapability(env, orgId, 'translation')
 * if (!result.allowed) {
 *   return { message: 'Upgrade to Pro', upgrade_url: result.upgrade_url }
 * }
 */
export async function checkCapability(
  env: Env,
  orgId: string,
  capability: string
): Promise<CapabilityResult> {
  try {
    // Get organization's current plan
    const currentPlan = await getOrgPlan(env, orgId)

    // Get required plan for capability
    const requiredPlan = FEATURE_PLAN_REQUIREMENTS[capability]

    if (!requiredPlan) {
      logger.warn('Unknown capability requested', { capability, org_id: orgId })
      // Unknown capability → allow (fail open)
      return {
        allowed: true,
        current_plan: currentPlan,
      }
    }

    // Check access
    const allowed = hasAccess(currentPlan, requiredPlan)

    if (!allowed) {
      return {
        allowed: false,
        current_plan: currentPlan,
        required_plan: requiredPlan,
        upgrade_url: `/settings?tab=billing&upgrade_to=${requiredPlan}`,
      }
    }

    // Return with limits
    return {
      allowed: true,
      current_plan: currentPlan,
      limits: {
        max_calls_per_month: PLAN_LIMITS[currentPlan].max_calls_per_month,
        max_users: PLAN_LIMITS[currentPlan].max_users,
        max_call_duration_seconds: PLAN_LIMITS[currentPlan].max_call_duration_seconds,
        retention_days: PLAN_LIMITS[currentPlan].retention_days,
      },
    }
  } catch (err: any) {
    logger.error('Capability check error - FAILING OPEN', {
      error: err?.message,
      capability,
      org_id: orgId,
    })

    // Fail open - allow access on error
    return {
      allowed: true,
      current_plan: 'free',
    }
  }
}

/**
 * Batch check multiple capabilities
 * More efficient than individual checks (single DB query)
 */
export async function checkCapabilities(
  env: Env,
  orgId: string,
  capabilities: string[]
): Promise<Record<string, CapabilityResult>> {
  try {
    // Get plan once for all checks
    const currentPlan = await getOrgPlan(env, orgId)

    const results: Record<string, CapabilityResult> = {}

    for (const capability of capabilities) {
      const requiredPlan = FEATURE_PLAN_REQUIREMENTS[capability]

      if (!requiredPlan) {
        // Unknown capability → allow
        results[capability] = {
          allowed: true,
          current_plan: currentPlan,
        }
        continue
      }

      const allowed = hasAccess(currentPlan, requiredPlan)

      if (!allowed) {
        results[capability] = {
          allowed: false,
          current_plan: currentPlan,
          required_plan: requiredPlan,
          upgrade_url: `/settings?tab=billing&upgrade_to=${requiredPlan}`,
        }
      } else {
        results[capability] = {
          allowed: true,
          current_plan: currentPlan,
        }
      }
    }

    return results
  } catch (err: any) {
    logger.error('Batch capability check error - FAILING OPEN', {
      error: err?.message,
      org_id: orgId,
    })

    // Fail open - allow all
    const results: Record<string, CapabilityResult> = {}
    for (const capability of capabilities) {
      results[capability] = {
        allowed: true,
        current_plan: 'free',
      }
    }
    return results
  }
}

/**
 * Get all capabilities for an organization (for UI state initialization)
 */
export async function getAllCapabilities(env: Env, orgId: string) {
  const allCapabilities = Object.keys(FEATURE_PLAN_REQUIREMENTS)
  return checkCapabilities(env, orgId, allCapabilities)
}

/**
 * Get plan details with feature list
 */
export async function getPlanDetails(env: Env, orgId: string) {
  try {
    const currentPlan = await getOrgPlan(env, orgId)
    const limits = PLAN_LIMITS[currentPlan]

    // Get list of enabled features
    const enabledFeatures: string[] = []
    const disabledFeatures: { feature: string; required_plan: PlanName }[] = []

    for (const [feature, requiredPlan] of Object.entries(FEATURE_PLAN_REQUIREMENTS)) {
      if (hasAccess(currentPlan, requiredPlan)) {
        enabledFeatures.push(feature)
      } else {
        disabledFeatures.push({ feature, required_plan: requiredPlan })
      }
    }

    return {
      current_plan: currentPlan,
      limits,
      enabled_features: enabledFeatures,
      disabled_features: disabledFeatures,
    }
  } catch (err: any) {
    logger.error('Get plan details error', { error: err?.message, org_id: orgId })
    throw err
  }
}
