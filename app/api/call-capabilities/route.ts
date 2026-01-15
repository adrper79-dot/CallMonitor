/**
 * GET /api/call-capabilities
 * 
 * Check what features are available for an organization or call.
 * Used by UI to show/hide features based on plan and configuration.
 * 
 * Query params:
 * - orgId: Organization ID (required if callId not provided)
 * - callId: Call ID (optional, will look up org from call)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('orgId')
    const callId = searchParams.get('callId')

    if (!orgId && !callId) {
      return NextResponse.json({
        error: 'Either orgId or callId is required'
      }, { status: 400 })
    }

    const supabase = createClient()
    let organizationId = orgId

    // If callId provided, get org from call
    if (callId && !orgId) {
      const { data: call, error: callError } = await supabase
        .from('calls')
        .select('organization_id')
        .eq('id', callId)
        .single()

      if (callError || !call) {
        return NextResponse.json({
          error: 'Call not found'
        }, { status: 404 })
      }

      organizationId = call.organization_id
    }

    // Get organization plan
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      return NextResponse.json({
        error: 'Organization not found'
      }, { status: 404 })
    }

    const plan = org.plan || 'free'

    // Define capabilities by plan tier
    const capabilities = getCapabilitiesForPlan(plan)

    return NextResponse.json({
      success: true,
      organization_id: organizationId,
      plan,
      capabilities
    })

  } catch (err: any) {
    console.error('GET /api/call-capabilities error:', err)
    return NextResponse.json({
      error: 'Failed to check capabilities',
      details: err.message
    }, { status: 500 })
  }
}

/**
 * Define capabilities based on plan tier
 */
function getCapabilitiesForPlan(plan: string): Record<string, boolean> {
  const planLower = (plan || 'free').toLowerCase()

  // Base capabilities (all plans)
  const base = {
    recording: true,
    transcription: true,
    basic_reporting: true,
  }

  // Pro plan additions
  if (['pro', 'growth', 'business', 'enterprise', 'global'].includes(planLower)) {
    return {
      ...base,
      auto_scoring: true,
      evidence_manifest: true,
      after_call_survey: true,
      voice_targets: true,
    }
  }

  // Business plan additions (includes live translation)
  if (['business', 'enterprise', 'global'].includes(planLower)) {
    return {
      ...base,
      auto_scoring: true,
      evidence_manifest: true,
      after_call_survey: true,
      voice_targets: true,
      real_time_translation: true,            // ← SignalWire AI Agent live translation
      real_time_translation_preview: true,     // ← Feature flag for preview
      secret_shopper: true,
      synthetic_caller: true,
      api_access: true,
    }
  }

  // Enterprise plan additions
  if (['enterprise', 'global'].includes(planLower)) {
    return {
      ...base,
      auto_scoring: true,
      evidence_manifest: true,
      after_call_survey: true,
      voice_targets: true,
      real_time_translation: true,
      real_time_translation_preview: true,
      secret_shopper: true,
      synthetic_caller: true,
      api_access: true,
      sso: true,
      dedicated_support: true,
      custom_integrations: true,
    }
  }

  // Free plan (base only)
  return base
}
