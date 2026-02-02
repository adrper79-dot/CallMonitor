/**
 * Feature Flags API
 * 
 * GET /api/features - Get all feature flags for the organization
 * PUT /api/features - Update feature flag settings
 * 
 * Per MASTER_ARCHITECTURE: Kill switches protect uptime, costs, compliance
 * Buyers trust systems that can say "no" safely
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/pgClient'
import { FeatureFlag, FEATURE_FLAGS, FeatureStatus } from '@/types/tier1-features'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/features
 * Get all feature flags and their status for the organization
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Get user's organization
    const memberRes = await query(`SELECT organization_id, role FROM org_members WHERE user_id = $1 LIMIT 1`, [userId])
    const member = memberRes?.rows && memberRes.rows.length ? memberRes.rows[0] : null
    if (!member) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization membership not found' } },
        { status: 403 }
      )
    }

    // Get global feature flags
    const gfRes = await query(`SELECT feature, enabled, disabled_reason FROM global_feature_flags`)
    const globalFlags = gfRes?.rows || []
    const globalFlagMap = new Map((globalFlags || []).map((f: any) => [f.feature, f]))

    // Get org-specific feature flags
    const ofRes = await query(`SELECT * FROM org_feature_flags WHERE organization_id = $1`, [member.organization_id])
    const orgFlags = ofRes?.rows || []
    const orgFlagMap = new Map((orgFlags || []).map((f: any) => [f.feature, f]))

    // Build feature status for all features
    const features: FeatureStatus[] = FEATURE_FLAGS.map(feature => {
      const global = globalFlagMap.get(feature)
      const org = orgFlagMap.get(feature)

      // Global takes precedence (platform-level kill switch)
      if (global?.enabled === false) {
        return {
          feature,
          enabled: false,
          reason: global.disabled_reason || 'Disabled by platform'
        }
      }

      // Then org-level
      if (org) {
        return {
          feature,
          enabled: org.enabled,
          reason: org.enabled ? undefined : org.disabled_reason,
          usage: org.daily_limit || org.monthly_limit ? {
            daily: org.current_daily_usage,
            daily_limit: org.daily_limit,
            monthly: org.current_monthly_usage,
            monthly_limit: org.monthly_limit
          } : undefined
        }
      }

      // Default: enabled
      return {
        feature,
        enabled: true
      }
    })

    return NextResponse.json({
      success: true,
      features,
      organization_id: member.organization_id
    })
  } catch (error: any) {
    logger.error('[features GET] Error', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/features
 * Update a feature flag for the organization
 */
export async function PUT(request: NextRequest) {
  try {
    // Authenticate
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { feature, enabled, disabled_reason, daily_limit, monthly_limit } = body

    // Validate feature
    if (!feature || !FEATURE_FLAGS.includes(feature)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_FEATURE', message: `Invalid feature. Must be one of: ${FEATURE_FLAGS.join(', ')}` } },
        { status: 400 }
      )
    }

    // Validate enabled is boolean
    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ENABLED', message: 'enabled must be a boolean' } },
        { status: 400 }
      )
    }

    // Get user's organization and verify admin role
    const { rows: memberRows } = await query(
      `SELECT organization_id, role FROM org_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    )
    const member = memberRows?.[0]

    if (!member) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization membership not found' } },
        { status: 403 }
      )
    }

    // Only owners and admins can manage feature flags
    if (!['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners and admins can manage feature flags' } },
        { status: 403 }
      )
    }

    // Check if global flag prevents enabling
    if (enabled) {
      const gf = await query(`SELECT enabled FROM global_feature_flags WHERE feature = $1 LIMIT 1`, [feature])
      const globalFlag = gf?.rows && gf.rows.length ? gf.rows[0] : null
      if (globalFlag?.enabled === false) {
        return NextResponse.json(
          { success: false, error: { code: 'GLOBALLY_DISABLED', message: 'This feature is disabled platform-wide' } },
          { status: 403 }
        )
      }
    }

    // Upsert feature flag
    let updatedFlag: any = null
    try {
      const now = new Date().toISOString()
      const res = await query(`INSERT INTO org_feature_flags (organization_id, feature, enabled, disabled_reason, disabled_at, disabled_by, daily_limit, monthly_limit, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (organization_id, feature) DO UPDATE SET enabled = EXCLUDED.enabled, disabled_reason = EXCLUDED.disabled_reason, disabled_at = EXCLUDED.disabled_at, disabled_by = EXCLUDED.disabled_by, daily_limit = EXCLUDED.daily_limit, monthly_limit = EXCLUDED.monthly_limit, updated_at = EXCLUDED.updated_at RETURNING *`, [member.organization_id, feature, enabled, enabled ? null : (disabled_reason || null), enabled ? null : now, enabled ? null : userId, daily_limit ?? null, monthly_limit ?? null, now])
      updatedFlag = res?.rows && res.rows.length ? res.rows[0] : null
      if (!updatedFlag) {
        throw new Error('Upsert returned no rows')
      }
    } catch (upsertError: any) {
      logger.error('[features PUT] Upsert error', upsertError, { feature })
      return NextResponse.json(
        { success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to update feature flag' } },
        { status: 500 }
      )
    }

    // Log to audit (fire and forget)
    ; (async () => {
      try {
        await query(
          `INSERT INTO audit_logs (
            id, organization_id, user_id, resource_type, resource_id, action, actor_type, actor_label, after, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [
            uuidv4(),
            member.organization_id,
            userId,
            'feature_flag',
            updatedFlag.id,
            enabled ? 'enable' : 'disable',
            'human',
            userId,
            JSON.stringify({ feature, enabled, disabled_reason, daily_limit, monthly_limit })
          ]
        )
      } catch (err) {
        logger.error('[features PUT] Audit log error', err, { featureId: updatedFlag.id })
      }
    })()

    return NextResponse.json({
      success: true,
      feature: {
        feature: updatedFlag.feature,
        enabled: updatedFlag.enabled,
        reason: updatedFlag.disabled_reason,
        usage: updatedFlag.daily_limit || updatedFlag.monthly_limit ? {
          daily: updatedFlag.current_daily_usage,
          daily_limit: updatedFlag.daily_limit,
          monthly: updatedFlag.current_monthly_usage,
          monthly_limit: updatedFlag.monthly_limit
        } : undefined
      }
    })
  } catch (error: any) {
    logger.error('[features PUT] Error', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
