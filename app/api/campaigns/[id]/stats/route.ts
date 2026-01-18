/**
 * Campaign Stats API
 * 
 * GET /api/campaigns/[id]/stats - Get campaign statistics
 * 
 * Used by CampaignProgress component for real-time updates
 * 
 * @module api/campaigns/[id]/stats
 */

import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireRole } from '@/lib/rbac-server'
import { logger } from '@/lib/logger'
import { AppError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/campaigns/[id]/stats
 * Get campaign execution statistics
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole('viewer')
    const userId = session.user.id
    const campaignId = params.id

    // Get user's organization
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .single()

    if (userError || !user?.organization_id) {
      throw new AppError('Organization not found', 404)
    }

    const organizationId = user.organization_id

    // Verify campaign access
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('organization_id')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      throw new AppError('Campaign not found', 404)
    }

    if (campaign.organization_id !== organizationId) {
      throw new AppError('Unauthorized', 403)
    }

    // Get stats using database function
    const { data: statsData, error: statsError } = await supabaseAdmin
      .rpc('get_campaign_stats', { campaign_id_param: campaignId })

    if (statsError) {
      throw new AppError('Failed to fetch stats', 500, 'STATS_FETCH_ERROR', statsError)
    }

    // Return first row (function returns table with one row)
    const stats = statsData && statsData.length > 0 ? statsData[0] : {
      total: 0,
      completed: 0,
      successful: 0,
      failed: 0,
      pending: 0,
      calling: 0,
    }

    return NextResponse.json({ stats })
  } catch (error: any) {
    logger.error('GET /api/campaigns/[id]/stats error', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}
