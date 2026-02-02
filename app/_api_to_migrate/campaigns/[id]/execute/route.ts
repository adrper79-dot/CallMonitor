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
import { query, withTransaction } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'

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
    // Role check - must be owner or admin
    // requireRole handles session retrieval and db check for org/role
    const session = await requireRole(['owner', 'admin'])
    const userId = session.user.id
    const organizationId = session.user.organizationId
    const campaignId = params.id

    // Get campaign with caller_id phone number
    const { rows: campaigns } = await query(
      `SELECT c.*, cid.phone_number as caller_id_phone 
       FROM campaigns c
       LEFT JOIN caller_ids cid ON c.caller_id_id = cid.id
       WHERE c.id = $1 AND c.organization_id = $2`,
      [campaignId, organizationId],
      { organizationId }
    )
    const campaign = campaigns[0]

    if (!campaign) {
      return ApiErrors.notFound('Campaign')
    }

    // Validate campaign can be executed
    if (!['draft', 'scheduled', 'paused'].includes(campaign.status)) {
      return ApiErrors.badRequest(`Cannot execute campaign with status: ${campaign.status}`)
    }

    // Validate required fields
    if (!campaign.caller_id_id) { // Checked via ID existence, effectively check if linked
      return ApiErrors.badRequest('Campaign must have a caller ID before execution')
    }

    // Check targets count
    if ((campaign.total_targets || 0) === 0) {
      // Double check actual calls count just in case total_targets is out of sync
      const { rows: countRows } = await query(
        `SELECT COUNT(*) as count FROM campaign_calls WHERE campaign_id = $1`,
        [campaignId]
      )
      if (parseInt(countRows[0].count) === 0) {
        return ApiErrors.badRequest('Campaign must have at least one target')
      }
    }

    // Count pending calls for reference
    const { rows: pendingRows } = await query(
      `SELECT COUNT(*) as count FROM campaign_calls 
       WHERE campaign_id = $1 AND status = 'pending'`,
      [campaignId]
    )
    const pendingCount = parseInt(pendingRows[0].count)

    // Update campaign status and log in transaction
    const updatedCampaign = await withTransaction(async (client) => {
      // Update status
      const { rows: updated } = await client.query(
        `UPDATE campaigns 
         SET status = 'active', 
             started_at = COALESCE(started_at, NOW()),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [campaignId]
      )

      if (!updated.length) {
        throw new Error('Failed to update campaign status')
      }

      // Audit Log
      await client.query(
        `INSERT INTO campaign_audit_log (campaign_id, user_id, action, changes, created_at)
         VALUES ($1, $2, 'started', $3, NOW())`,
        [
          campaignId,
          userId,
          JSON.stringify({
            campaign: updated[0],
            pending_calls_count: pendingCount
          })
        ]
      )

      return updated[0]
    }, { organizationId, userId })

    // Queue campaign for execution via campaign executor
    // This will handle rate limiting, retries, and progress tracking
    const { queueCampaignExecution } = await import('@/lib/services/campaignExecutor')

    // Queue the campaign (non-blocking - runs in background)
    queueCampaignExecution(campaignId).catch(async (error) => {
      logger.error('Campaign execution error', error, { campaignId })
      // Log to audit but don't fail the API response
      try {
        await query(
          `INSERT INTO campaign_audit_log (campaign_id, user_id, action, changes, created_at)
             VALUES ($1, $2, 'execution_error', $3, NOW())`,
          [campaignId, userId, JSON.stringify({ error: error.message })]
        )
      } catch (e) {
        logger.error('Failed to log execution error audit', e)
      }
    })

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
      message: `Campaign started with ${pendingCount} pending calls`,
      execution: {
        campaign_id: campaignId,
        status: 'active',
        pending_calls: pendingCount,
        note: 'Campaign execution engine is processing calls with rate limiting and retry logic'
      }
    })
  } catch (error: any) {
    logger.error('Error in POST /api/campaigns/[id]/execute', error)
    if (error.code === 'UNAUTHORIZED' || error.statusCode === 403) {
      return ApiErrors.forbidden('Insufficient permissions')
    }
    return ApiErrors.internal('Internal server error')
  }
}
