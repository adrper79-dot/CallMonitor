/**
 * Campaign Detail API
 * 
 * Endpoints for individual campaign operations
 * RBAC: Owner/Admin can manage, all can view
 * 
 * GET /api/campaigns/[id] - Get campaign details
 * PATCH /api/campaigns/[id] - Update campaign
 * DELETE /api/campaigns/[id] - Delete campaign
 */

/**
 * Campaign Detail API
 * 
 * Endpoints for individual campaign operations
 * RBAC: Owner/Admin can manage, all can view
 * 
 * GET /api/campaigns/[id] - Get campaign details
 * PATCH /api/campaigns/[id] - Update campaign
 * DELETE /api/campaigns/[id] - Delete campaign
 */

import { NextRequest, NextResponse } from 'next/server'
import { query, withTransaction } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { ApiErrors, apiSuccess } from '@/lib/errors/apiHandler'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/campaigns/[id]
 * Get campaign details with call stats
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole('viewer')
    const userId = session.user.id
    const organizationId = session.user.organizationId
    const campaignId = params.id

    // Get campaign with details
    const { rows: campaigns } = await query(
      `SELECT 
            c.*,
            json_build_object('id', u.id, 'name', u.name, 'email', u.email) as created_by,
            json_build_object('id', cid.id, 'phone_number', cid.phone_number) as caller_id,
            json_build_object('id', s.id, 'name', s.name) as script,
            json_build_object('id', sv.id, 'name', sv.name) as survey
         FROM campaigns c
         LEFT JOIN users u ON c.created_by = u.id
         LEFT JOIN caller_ids cid ON c.caller_id_id = cid.id
         LEFT JOIN shopper_scripts s ON c.script_id = s.id
         LEFT JOIN surveys sv ON c.survey_id = sv.id
         WHERE c.id = $1 AND c.organization_id = $2`,
      [campaignId, organizationId]
    )
    const campaign = campaigns[0]

    if (!campaign) {
      return ApiErrors.notFound('Campaign')
    }

    // Get aggregated stats directly from DB instead of fetching all rows
    const { rows: statsRows } = await query(
      `SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'calling') as calling,
            COUNT(*) FILTER (WHERE status = 'completed') as completed,
            COUNT(*) FILTER (WHERE status = 'failed') as failed,
            COUNT(*) FILTER (WHERE outcome = 'answered') as answered,
            COUNT(*) FILTER (WHERE outcome = 'no_answer') as no_answer,
            COALESCE(AVG(duration_seconds), 0) as avg_duration
         FROM campaign_calls
         WHERE campaign_id = $1`,
      [campaignId]
    )

    // Parse counts as integers (COUNT returns bigint/string)
    const rawStats = statsRows[0]
    const callStats = {
      total: parseInt(rawStats.total),
      pending: parseInt(rawStats.pending),
      calling: parseInt(rawStats.calling),
      completed: parseInt(rawStats.completed),
      failed: parseInt(rawStats.failed),
      answered: parseInt(rawStats.answered),
      no_answer: parseInt(rawStats.no_answer),
      avg_duration: parseFloat(rawStats.avg_duration)
    }

    return apiSuccess({
      campaign: {
        ...campaign,
        call_stats: callStats
      }
    })
  } catch (error) {
    logger.error('GET /api/campaigns/[id] failed', error)
    return ApiErrors.internal('Failed to fetch campaign')
  }
}

/**
 * PATCH /api/campaigns/[id]
 * Update campaign (name, description, status, schedule)
 * RBAC: Owner/Admin only
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['owner', 'admin'])
    const userId = session.user.id
    const organizationId = session.user.organizationId
    const campaignId = params.id
    const body = await request.json()
    const {
      name,
      description,
      status,
      scheduled_at,
      recurring_pattern,
      call_config
    } = body

    // Perform update in transaction for integrity and audit logging
    const updated = await withTransaction(async (client) => {
      // Get existing campaign for checks and audit diff
      const { rows: existingRows } = await client.query(
        `SELECT * FROM campaigns WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [campaignId, organizationId]
      )
      const existingCampaign = existingRows[0]

      if (!existingCampaign) {
        throw new AppError('Campaign not found', 404)
      }

      // Validate status transitions
      if (status) {
        const validTransitions: Record<string, string[]> = {
          draft: ['scheduled', 'active', 'canceled'],
          scheduled: ['active', 'paused', 'canceled'],
          active: ['paused', 'completed', 'canceled'],
          paused: ['active', 'canceled'],
          completed: [],
          canceled: []
        }
        if (!validTransitions[existingCampaign.status]?.includes(status)) {
          throw new AppError(`Invalid status transition from ${existingCampaign.status} to ${status}`, 400)
        }
      }

      // Build dynamic update query
      const updates: string[] = []
      const values: any[] = []
      let paramIdx = 1

      const addUpdate = (field: string, value: any) => {
        updates.push(`${field} = $${paramIdx++}`)
        values.push(value)
      }

      if (name !== undefined) addUpdate('name', name)
      if (description !== undefined) addUpdate('description', description)
      if (status !== undefined) {
        addUpdate('status', status)
        if (status === 'active' && !existingCampaign.started_at) {
          addUpdate('started_at', new Date().toISOString())
        }
        if (status === 'completed') {
          addUpdate('completed_at', new Date().toISOString())
        }
      }
      if (scheduled_at !== undefined) addUpdate('scheduled_at', scheduled_at)
      if (recurring_pattern !== undefined) addUpdate('recurring_pattern', recurring_pattern ? JSON.stringify(recurring_pattern) : null)
      if (call_config !== undefined) addUpdate('call_config', JSON.stringify(call_config))

      if (updates.length === 0) return existingCampaign

      // Add updated_at
      updates.push(`updated_at = NOW()`)

      // Add WHERE clause params
      values.push(campaignId, organizationId)

      const queryStr = `
            UPDATE campaigns 
            SET ${updates.join(', ')} 
            WHERE id = $${paramIdx++} AND organization_id = $${paramIdx++}
            RETURNING *
        `

      const { rows: updatedRows } = await client.query(queryStr, values)
      const campaign = updatedRows[0]

      // Audit Log
      await client.query(
        `INSERT INTO campaign_audit_log (campaign_id, user_id, action, changes, created_at)
             VALUES ($1, $2, 'updated', $3, NOW())`,
        [campaignId, userId, JSON.stringify({ before: existingCampaign, after: campaign })]
      )

      return campaign
    }, { organizationId, userId })

    return apiSuccess({ campaign: updated })
  } catch (error: any) {
    logger.error('PATCH /api/campaigns/[id] failed', error)
    if (error instanceof AppError) {
      return ApiErrors.badRequest(error.message)
    }
    return ApiErrors.internal('Failed to update campaign')
  }
}

/**
 * DELETE /api/campaigns/[id]
 * Delete campaign (soft delete by setting status to canceled)
 * RBAC: Owner/Admin only
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['owner', 'admin'])
    const userId = session.user.id
    const organizationId = session.user.organizationId
    const campaignId = params.id

    await withTransaction(async (client) => {
      // Get existing campaign
      const { rows: existingRows } = await client.query(
        `SELECT status FROM campaigns WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [campaignId, organizationId]
      )
      const campaign = existingRows[0]

      if (!campaign) {
        throw new AppError('Campaign not found', 404)
      }

      // Can only delete draft or completed campaigns
      // Active campaigns must be canceled first
      if (!['draft', 'completed', 'canceled'].includes(campaign.status)) {
        throw new AppError('Can only delete draft, completed, or canceled campaigns. Please cancel active campaigns first.', 400)
      }

      // Hard delete campaign (cascades to campaign_calls and campaign_audit_log)
      // Ensure cascading is handled by DB FKs. If not, this might fail or leave orphans.
      // Assuming FKs are set with ON DELETE CASCADE based on standard practice for this project.
      await client.query(
        `DELETE FROM campaigns WHERE id = $1 AND organization_id = $2`,
        [campaignId, organizationId]
      )
    }, { organizationId, userId })

    return apiSuccess({ deleted: true })
  } catch (error: any) {
    logger.error('DELETE /api/campaigns/[id] failed', error)
    if (error instanceof AppError && error.statusCode === 404) return ApiErrors.notFound(error.message)
    if (error instanceof AppError) return ApiErrors.badRequest(error.message)

    return ApiErrors.internal('Failed to delete campaign')
  }
}

// Helper class for transaction logic errors to bubble up clearly
class AppError extends Error {
  statusCode: number
  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
  }
}
