/**
 * Webhook Test API
 * 
 * POST /api/webhooks/subscriptions/[id]/test - Send a test webhook event
 * 
 * Purpose: Let users verify their endpoint receives webhooks correctly
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/pgClient'
import crypto from 'node:crypto'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

/**
 * POST /api/webhooks/subscriptions/[id]/test
 * Send a test webhook event
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const webhookId = params.id

    // Get user's organization and verify admin role
    const { rows: members } = await query(
      `SELECT organization_id, role FROM org_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    )
    const member = members[0]

    if (!member) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization membership not found' } },
        { status: 403 }
      )
    }

    // Only owners and admins can test webhooks
    if (!['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners and admins can test webhooks' } },
        { status: 403 }
      )
    }

    // Verify webhook exists and belongs to organization
    const { rows: webhooks } = await query(
      `SELECT * FROM webhook_subscriptions WHERE id = $1 AND organization_id = $2 LIMIT 1`,
      [webhookId, member.organization_id]
    )
    const webhook = webhooks[0]

    if (!webhook) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
        { status: 404 }
      )
    }

    // Generate test event ID
    const testEventId = `test-${crypto.randomUUID()}`

    // Create test payload
    const testPayload = {
      event: 'call.completed',
      event_id: testEventId,
      timestamp: new Date().toISOString(),
      organization_id: member.organization_id,
      data: {
        call_id: 'test-call-id',
        status: 'completed',
        duration: 120,
        from: '+15551234567',
        to: '+15557654321',
        direction: 'outbound',
        _test: true  // Flag as test event
      }
    }

    // Queue test delivery
    let delivery: any
    try {
      const { rows } = await query(
        `INSERT INTO webhook_deliveries (subscription_id, event_type, event_id, payload, status, max_attempts) 
             VALUES ($1, $2, $3, $4, 'pending', $5)
             RETURNING id, status`,
        [webhookId, 'call.completed', testEventId, JSON.stringify(testPayload), webhook.max_retries + 1]
      )
      delivery = rows[0]
    } catch (insertError) {
      logger.error('[webhook test] Insert error', insertError, { webhookId })
      return NextResponse.json(
        { success: false, error: { code: 'QUEUE_FAILED', message: 'Failed to queue test webhook' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      delivery: {
        id: delivery.id,
        status: 'pending',
        message: 'Test webhook queued. Check your endpoint for delivery.'
      }
    })
  } catch (error: any) {
    logger.error('[webhook test] Error', error, { webhookId: params.id })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
