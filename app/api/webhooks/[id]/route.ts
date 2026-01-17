/**
 * Individual Webhook API
 * 
 * PATCH /api/webhooks/[id] - Update webhook
 * DELETE /api/webhooks/[id] - Delete webhook
 * 
 * @module api/webhooks/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireRole } from '@/lib/auth/rbac'
import { logger } from '@/lib/logger'
import { AppError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/webhooks/[id]
 * Update webhook subscription
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, organizationId, role } = await requireRole('owner', 'admin')
    const webhookId = params.id

    const body = await req.json()
    const { isActive } = body

    // Get webhook to verify ownership
    const { data: webhook, error: fetchError } = await supabaseAdmin
      .from('webhook_subscriptions')
      .select('organization_id')
      .eq('id', webhookId)
      .single()

    if (fetchError || !webhook) {
      throw new AppError('Webhook not found', 404)
    }

    if (webhook.organization_id !== organizationId) {
      throw new AppError('Unauthorized', 403)
    }

    // Update webhook
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('webhook_subscriptions')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', webhookId)
      .select()
      .single()

    if (updateError) {
      throw new AppError('Failed to update webhook', 500, updateError)
    }

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
    const { userId, organizationId, role } = await requireRole('owner', 'admin')
    const webhookId = params.id

    // Get webhook to verify ownership
    const { data: webhook, error: fetchError } = await supabaseAdmin
      .from('webhook_subscriptions')
      .select('organization_id')
      .eq('id', webhookId)
      .single()

    if (fetchError || !webhook) {
      throw new AppError('Webhook not found', 404)
    }

    if (webhook.organization_id !== organizationId) {
      throw new AppError('Unauthorized', 403)
    }

    // Delete webhook
    const { error: deleteError } = await supabaseAdmin
      .from('webhook_subscriptions')
      .delete()
      .eq('id', webhookId)

    if (deleteError) {
      throw new AppError('Failed to delete webhook', 500, deleteError)
    }

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
