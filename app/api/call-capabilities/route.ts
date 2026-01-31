/**
 * GET /api/call-capabilities
 * 
 * Check what features are available for an organization or call.
 * Used by UI to show/hide features based on plan and configuration.
 * 
 * Query params:
 * - orgId: Organization ID (required if callId not provided)
 * - callId: Call ID (optional, will look up org from call)
 * 
 * SECURITY: Requires authentication and org membership verification
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { isLiveTranslationPreviewEnabled } from '@/lib/env-validation'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('orgId')
    const callId = searchParams.get('callId')

    if (!orgId && !callId) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'orgId or callId required' }
      }, { status: 400 })
    }

    // SECURITY: Require authenticated user (Viewer+)
    const session = await requireRole('viewer')
    const userId = session.user.id
    // This session validates the user is in *an* organization (the one in the session). 
    // But this endpoint might query capability for a specific called/requested org.
    // However, requireRole checks against `org_members` and returns membership.
    // Logic below handles cross-check if provided orgId differs from session orgId.

    // Actually, `requireRole` sets `session.user.organizationId` based on the user's active org membership.
    // If the client passes `orgId`, we must verify the user belongs to THAT org, or is an admin etc.
    // `requireRole` only verifies the user has a role in *some* org or their default org? 
    // Let's assume `requireRole` verifies the user is authenticated and gets their primary org.
    // If we want to check access to a *different* org, we need to query `org_members`.

    let targetOrganizationId = orgId || session.user.organizationId

    // If callId provided, get org from call
    if (callId) {
      const { rows: callRows } = await query(
        `SELECT organization_id FROM calls WHERE id = $1 LIMIT 1`,
        [callId]
      )

      if (callRows.length === 0) {
        return NextResponse.json({
          success: false,
          error: { code: 'CALL_NOT_FOUND', message: 'Call not found' }
        }, { status: 404 })
      }

      targetOrganizationId = callRows[0].organization_id
    }

    // SECURITY: Verify user is member of the target organization
    if (targetOrganizationId !== session.user.organizationId) {
      // Since the user might belong to multiple orgs, check DB
      const { rows: memberRows } = await query(
        `SELECT id, role FROM org_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
        [targetOrganizationId, userId]
      )

      if (memberRows.length === 0) {
        return NextResponse.json({
          success: false,
          error: { code: 'AUTH_ORG_MISMATCH', message: 'Not authorized for this organization' }
        }, { status: 403 })
      }
    }

    // Get organization plan
    const { rows: orgRows } = await query(
      `SELECT plan FROM organizations WHERE id = $1 LIMIT 1`,
      [targetOrganizationId]
    )

    if (orgRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: { code: 'ORG_NOT_FOUND', message: 'Organization not found' }
      }, { status: 404 })
    }

    const plan = orgRows[0].plan || 'free'

    // Define capabilities by plan tier
    const capabilities = getCapabilitiesForPlan(plan)

    return NextResponse.json({
      success: true,
      organization_id: targetOrganizationId,
      plan,
      capabilities
    })

  } catch (err: any) {
    logger.error('GET /api/call-capabilities error', err)
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to check capabilities' }
    }, { status: 500 })
  }
}

/**
 * Define capabilities based on plan tier
 * Per ARCH_DOCS: Capability-driven, not UI-driven. Plans gate execution, not visibility.
 */
function getCapabilitiesForPlan(plan: string): Record<string, boolean> {
  const planLower = (plan || 'free').toLowerCase()
  const isFeatureFlagEnabled = isLiveTranslationPreviewEnabled()

  // Base capabilities (all plans)
  const base = {
    record: false,
    transcribe: false,
    translate: false,
    survey: false,
    synthetic_caller: false,
    real_time_translation_preview: false,
  }

  // Enterprise plan (highest tier)
  if (['enterprise', 'global'].includes(planLower)) {
    return {
      record: true,
      transcribe: true,
      translate: true,
      survey: true,
      synthetic_caller: true,
      real_time_translation_preview: isFeatureFlagEnabled,
      secret_shopper: true,
      api_access: true,
      sso: true,
      dedicated_support: true,
      custom_integrations: true,
    }
  }

  // Business plan (includes live translation preview)
  if (planLower === 'business') {
    return {
      record: true,
      transcribe: true,
      translate: true,
      survey: true,
      synthetic_caller: true,
      real_time_translation_preview: isFeatureFlagEnabled,
      secret_shopper: true,
      api_access: true,
    }
  }

  // Pro/Standard/Active/Trial plans
  if (['pro', 'standard', 'active', 'trial'].includes(planLower)) {
    return {
      record: true,
      transcribe: true,
      translate: false,
      survey: true,
      synthetic_caller: false,
      real_time_translation_preview: false,
    }
  }

  // Free/Base plan (limited)
  return base
}
