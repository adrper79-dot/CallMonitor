/**
 * Webhooks API
 * 
 * GET /api/webhooks - List webhooks
 * POST /api/webhooks - Create webhook
 * 
 * @module api/webhooks
 */

import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireRole } from '@/lib/rbac'
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
    const { userId, organizationId, role } = await requireRole(['owner', 'admin'])

    const searchParams = req.nextUrl.searchParams
    const orgId = searchParams.get('orgId') || organizationId

    if (orgId !== organizationId) {
      throw new AppError('Unauthorized', 403)
    }

    const { data: webhooks, error } = await supabaseAdmin
      .from('webhook_subscriptions')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new AppError('Failed to fetch webhooks', 500, 'FETCH_ERROR', error)
    }

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
    const { userId, organizationId, role } = await requireRole(['owner', 'admin'])

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
    const { data: webhook, error: insertError } = await supabaseAdmin
      .from('webhook_subscriptions')
      .insert({
        organization_id: organizationId,
        url,
        event_types: eventTypes,
        secret,
        is_active: true,
        success_count: 0,
        failure_count: 0,
      })
      .select()
      .single()

    if (insertError) {
      throw new AppError('Failed to create webhook', 500, 'CREATE_ERROR', insertError)
    }

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
