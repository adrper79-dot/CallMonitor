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
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { isLiveTranslationPreviewEnabled } from '@/lib/env-validation'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

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

    // SECURITY: Require authenticated user
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }
      }, { status: 401 })
    }

    let organizationId = orgId

    // If callId provided, get org from call
    if (callId && !orgId) {
      const { data: callRows, error: callError } = await supabaseAdmin
        .from('calls')
        .select('organization_id')
        .eq('id', callId)
        .limit(1)

      if (callError || !callRows?.[0]) {
        return NextResponse.json({
          success: false,
          error: { code: 'CALL_NOT_FOUND', message: 'Call not found' }
        }, { status: 404 })
      }

      organizationId = callRows[0].organization_id
    }

    // SECURITY: Verify user is member of organization
    const { data: memberRows, error: memberError } = await supabaseAdmin
      .from('org_members')
      .select('id, role')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .limit(1)

    if (memberError || !memberRows?.[0]) {
      return NextResponse.json({
        success: false,
        error: { code: 'AUTH_ORG_MISMATCH', message: 'Not authorized for this organization' }
      }, { status: 403 })
    }

    // Get organization plan
    const { data: orgRows, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('plan')
      .eq('id', organizationId)
      .limit(1)

    if (orgError || !orgRows?.[0]) {
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
      organization_id: organizationId,
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
