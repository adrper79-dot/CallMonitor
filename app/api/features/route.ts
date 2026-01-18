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
import supabaseAdmin from '@/lib/supabaseAdmin'
import { FeatureFlag, FEATURE_FLAGS, FeatureStatus } from '@/types/tier1-features'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

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
    const { data: member, error: memberError } = await supabaseAdmin
      .from('org_members')
      .select('organization_id, role')
      .eq('user_id', userId)
      .single()
    
    if (memberError || !member) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization membership not found' } },
        { status: 403 }
      )
    }
    
    // Get global feature flags
    const { data: globalFlags } = await supabaseAdmin
      .from('global_feature_flags')
      .select('feature, enabled, disabled_reason')
    
    const globalFlagMap = new Map(
      globalFlags?.map(f => [f.feature, f]) || []
    )
    
    // Get org-specific feature flags
    const { data: orgFlags } = await supabaseAdmin
      .from('org_feature_flags')
      .select('*')
      .eq('organization_id', member.organization_id)
    
    const orgFlagMap = new Map(
      orgFlags?.map(f => [f.feature, f]) || []
    )
    
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
    const { data: member, error: memberError } = await supabaseAdmin
      .from('org_members')
      .select('organization_id, role')
      .eq('user_id', userId)
      .single()
    
    if (memberError || !member) {
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
      const { data: globalFlag } = await supabaseAdmin
        .from('global_feature_flags')
        .select('enabled')
        .eq('feature', feature)
        .single()
      
      if (globalFlag?.enabled === false) {
        return NextResponse.json(
          { success: false, error: { code: 'GLOBALLY_DISABLED', message: 'This feature is disabled platform-wide' } },
          { status: 403 }
        )
      }
    }
    
    // Upsert feature flag
    const { data: updatedFlag, error: upsertError } = await supabaseAdmin
      .from('org_feature_flags')
      .upsert({
        organization_id: member.organization_id,
        feature,
        enabled,
        disabled_reason: enabled ? null : (disabled_reason || null),
        disabled_at: enabled ? null : new Date().toISOString(),
        disabled_by: enabled ? null : userId,
        daily_limit: daily_limit ?? null,
        monthly_limit: monthly_limit ?? null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'organization_id,feature'
      })
      .select()
      .single()
    
    if (upsertError) {
      logger.error('[features PUT] Upsert error', upsertError, { feature })
      return NextResponse.json(
        { success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to update feature flag' } },
        { status: 500 }
      )
    }
    
    // Log to audit (fire and forget)
    ;(async () => {
      try {
        await supabaseAdmin.from('audit_logs').insert({
          id: crypto.randomUUID(),
          organization_id: member.organization_id,
          user_id: userId,
          resource_type: 'feature_flag',
          resource_id: updatedFlag.id,
          action: enabled ? 'enable' : 'disable',
          after: { feature, enabled, disabled_reason, daily_limit, monthly_limit }
        })
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
