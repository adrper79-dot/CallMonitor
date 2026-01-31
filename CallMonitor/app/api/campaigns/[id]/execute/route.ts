/**
 * Campaign Execution API
 * 
 * POST /api/campaigns/[id]/execute - Execute/start campaign
 * RBAC: Owner/Admin only
 * 
 * Transitions campaign from draft/scheduled → active
 * Triggers call execution engine
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireRole } from '@/lib/rbac-server'
import { logger } from '@/lib/logger'
import { ApiErrors, apiSuccess } from '@/lib/errors/apiHandler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/campaigns/[id]/execute
 * Start campaign execution
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return ApiErrors.unauthorized()
    }

    const userId = (session.user as any).id
    const campaignId = params.id

    // Get user's organization and role
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('organization_id, role')
      .eq('id', userId)
      .single()

    if (userError || !user?.organization_id) {
      return ApiErrors.notFound('Organization')
    }

    // Role check - must be owner or admin
    await requireRole(['owner', 'admin'])

    // Get campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('*, caller_id:caller_ids(id, phone_number)')
      .eq('id', campaignId)
      .eq('organization_id', user.organization_id)
      .single()

    if (campaignError || !campaign) {
      return ApiErrors.notFound('Campaign')
    }

    // Validate campaign can be executed
    if (!['draft', 'scheduled', 'paused'].includes(campaign.status)) {
      return ApiErrors.badRequest(`Cannot execute campaign with status: ${campaign.status}`)
    }

    // Validate required fields
    if (!campaign.caller_id) {
      return ApiErrors.badRequest('Campaign must have a caller ID before execution')
    }

    if (campaign.target_list.length === 0) {
      return ApiErrors.badRequest('Campaign must have at least one target')
    }

    // Update campaign status to active
    const { data: updatedCampaign, error: updateError } = await supabaseAdmin
      .from('campaigns')
      .update({
        status: 'active',
        started_at: campaign.started_at || new Date().toISOString()
      })
      .eq('id', campaignId)
      .select()
      .single()

    if (updateError) {
      logger.error('Error updating campaign status', updateError, { campaignId })
      return ApiErrors.dbError('Failed to start campaign')
    }

    // Get pending calls
    const { data: pendingCalls, error: callsError } = await supabaseAdmin
      .from('campaign_calls')
      .select('id, target_phone, target_metadata, attempt_number, max_attempts')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .limit(100) // Process first 100 calls

    if (callsError) {
      logger.error('Error fetching pending calls', callsError, { campaignId })
      return ApiErrors.dbError('Failed to fetch pending calls')
    }

    // Log audit event
    await supabaseAdmin.from('campaign_audit_log').insert({
      campaign_id: campaignId,
      user_id: userId,
      action: 'started',
      changes: { campaign: updatedCampaign, pending_calls: pendingCalls?.length }
    })

    // Queue campaign for execution via campaign executor
    // This will handle rate limiting, retries, and progress tracking
    const { queueCampaignExecution } = await import('@/lib/services/campaignExecutor')
    
    // Queue the campaign (non-blocking - runs in background)
    queueCampaignExecution(campaignId).catch(error => {
      logger.error('Campaign execution error', error, { campaignId })
      // Log to audit but don't fail the API response
      void supabaseAdmin.from('campaign_audit_log').insert({
        campaign_id: campaignId,
        user_id: userId,
        action: 'execution_error',
        changes: { error: error.message }
      })
    })

    return NextResponse.json({ 
      success: true,
      campaign: updatedCampaign,
      message: `Campaign started with ${pendingCalls?.length || 0} pending calls`,
      execution: {
        campaign_id: campaignId,
        status: 'active',
        pending_calls: pendingCalls?.length || 0,
        note: 'Campaign execution engine is processing calls with rate limiting and retry logic'
      }
    })
  } catch (error) {
    logger.error('Error in POST /api/campaigns/[id]/execute', error)
    return ApiErrors.internal('Internal server error')
  }
}
