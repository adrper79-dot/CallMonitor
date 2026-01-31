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
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { logger } from '@/lib/logger'
import { AppError } from '@/types/app-error'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/campaigns/[id]/stats
 * Get campaign execution statistics
 */
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
    const organizationId = session.user.organizationId
    const campaignId = params.id

    // Verify campaign access and existence
    const { rows: campaigns } = await query(
      `SELECT id FROM campaigns WHERE id = $1 AND organization_id = $2`,
      [campaignId, organizationId]
    )

    if (campaigns.length === 0) {
      throw new AppError('Campaign not found', 404)
    }

    // Get stats using database function
    // Equivalent to supabaseAdmin.rpc('get_campaign_stats')
    const { rows: statsData } = await query(
      `SELECT * FROM get_campaign_stats($1)`,
      [campaignId]
    )

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
