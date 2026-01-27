/**
 * Webhook Test API
 * 
 * POST /api/webhooks/[id]/test - Send test webhook
 * 
 * @module api/webhooks/[id]/test
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { logger } from '@/lib/logger'
import { AppError } from '@/lib/errors'
import { createHmac } from 'node:crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/webhooks/[id]/test
 * Send test webhook
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['owner', 'admin'])
    const { id: userId, organizationId, role } = session.user
    const webhookId = params.id

    // Get webhook
    const { rows: webhooks } = await query(
      `SELECT * FROM webhook_subscriptions WHERE id = $1 LIMIT 1`,
      [webhookId]
    )
    const webhook = webhooks[0]

    if (!webhook) {
      throw new AppError('Webhook not found', 404)
    }

    if (webhook.organization_id !== organizationId) {
      throw new AppError('Unauthorized', 403)
    }

    // Create test payload
    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from Word Is Bond',
        webhook_id: webhookId,
        organization_id: organizationId,
      },
    }

    // Sign payload
    const signature = createHmac('sha256', webhook.secret)
      .update(JSON.stringify(testPayload))
      .digest('hex')

    // Send webhook
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-ID': webhookId,
        'User-Agent': 'WordIsBond-Webhooks/1.0',
      },
      body: JSON.stringify(testPayload),
    })

    const success = response.ok

    // Update stats
    const countField = success ? 'success_count' : 'failure_count'
    await query(
      `UPDATE webhook_subscriptions 
       SET ${countField} = ${countField} + 1, last_triggered_at = NOW() 
       WHERE id = $1`,
      [webhookId]
    )

    logger.info('Test webhook sent', {
      webhookId,
      success,
      statusCode: response.status,
    })

    return NextResponse.json({
      success,
      statusCode: response.status,
      message: success ? 'Test webhook sent successfully' : 'Webhook failed',
    })
  } catch (error: any) {
    logger.error('POST /api/webhooks/[id]/test error', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}
