/**
 * Individual Webhook API
 * 
 * PATCH /api/webhooks/[id] - Update webhook
 * DELETE /api/webhooks/[id] - Delete webhook
 * 
 * @module api/webhooks/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { logger } from '@/lib/logger'
import { AppError } from '@/lib/errors'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

/**
 * PATCH /api/webhooks/[id]
 * Update webhook subscription
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['owner', 'admin'])
    const { id: userId, organizationId, role } = session.user
    const webhookId = params.id

    const body = await req.json()
    const { isActive } = body

    // Get webhook to verify ownership
    const { rows: webhooks } = await query(
      `SELECT organization_id FROM webhook_subscriptions WHERE id = $1 LIMIT 1`,
      [webhookId]
    )
    const webhook = webhooks[0]

    if (!webhook) {
      throw new AppError('Webhook not found', 404)
    }

    if (webhook.organization_id !== organizationId) {
      throw new AppError('Unauthorized', 403)
    }

    // Update webhook
    const { rows: updatedRows } = await query(
      `UPDATE webhook_subscriptions 
       SET is_active = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [isActive, webhookId]
    )

    const updated = updatedRows[0]

    logger.info('Webhook subscription updated', {
      webhookId,
      isActive,
      userId,
    })

    return NextResponse.json({ webhook: updated })
  } catch (error: any) {
    logger.error('PATCH /api/webhooks/[id] error', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}

/**
 * DELETE /api/webhooks/[id]
 * Delete webhook subscription
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['owner', 'admin'])
    const { id: userId, organizationId, role } = session.user
    const webhookId = params.id

    // Get webhook to verify ownership
    const { rows: webhooks } = await query(
      `SELECT organization_id FROM webhook_subscriptions WHERE id = $1 LIMIT 1`,
      [webhookId]
    )
    const webhook = webhooks[0]

    if (!webhook) {
      throw new AppError('Webhook not found', 404)
    }

    if (webhook.organization_id !== organizationId) {
      throw new AppError('Unauthorized', 403)
    }

    // Delete webhook
    await query(`DELETE FROM webhook_subscriptions WHERE id = $1`, [webhookId])

    logger.info('Webhook subscription deleted', {
      webhookId,
      userId,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('DELETE /api/webhooks/[id] error', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}
