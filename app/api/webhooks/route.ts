/**
 * Webhooks API
 * 
 * GET /api/webhooks - List webhooks
 * POST /api/webhooks - Create webhook
 * 
 * @module api/webhooks
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { logger } from '@/lib/logger'
import { AppError } from '@/lib/errors'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * GET /api/webhooks
 * List webhook subscriptions
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireRole(['owner', 'admin'])
    const { id: userId, organizationId, role } = session.user

    const searchParams = req.nextUrl.searchParams
    const orgId = searchParams.get('orgId') || organizationId

    if (orgId !== organizationId) {
      throw new AppError('Unauthorized', 403)
    }

    const { rows: webhooks } = await query(
      `SELECT * FROM webhook_subscriptions WHERE organization_id = $1 ORDER BY created_at DESC`,
      [orgId]
    )

    return NextResponse.json({ webhooks })
  } catch (error: any) {
    logger.error('GET /api/webhooks error', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}

/**
 * POST /api/webhooks
 * Create webhook subscription
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(['owner', 'admin'])
    const { id: userId, organizationId, role } = session.user

    const body = await req.json()
    const { url, eventTypes } = body

    if (!url || !eventTypes || !Array.isArray(eventTypes) || eventTypes.length === 0) {
      throw new AppError('Missing required fields', 400)
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      throw new AppError('Invalid webhook URL', 400)
    }

    // Generate secret for webhook signing
    const secret = randomBytes(32).toString('hex')

    // Create webhook subscription
    const { rows } = await query(
      `INSERT INTO webhook_subscriptions (organization_id, url, event_types, secret, is_active, success_count, failure_count)
       VALUES ($1, $2, $3, $4, true, 0, 0)
       RETURNING *`,
      [organizationId, url, JSON.stringify(eventTypes), secret]
    )

    const webhook = rows[0]

    logger.info('Webhook subscription created', {
      webhookId: webhook.id,
      url,
      eventTypes,
      userId,
      organizationId,
    })

    return NextResponse.json({ webhook }, { status: 201 })
  } catch (error: any) {
    logger.error('POST /api/webhooks error', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}
