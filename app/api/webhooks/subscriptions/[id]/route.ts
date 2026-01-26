/**
 * Webhook Subscription Management API
 * 
 * PATCH /api/webhooks/subscriptions/[id] - Update a webhook subscription
 * DELETE /api/webhooks/subscriptions/[id] - Delete a webhook subscription
 * 
 * Per MASTER_ARCHITECTURE: Webhooks enable BYO integrations
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/pgClient'
import { WebhookEventType, WEBHOOK_EVENT_TYPES, WebhookRetryPolicy } from '@/types/tier1-features'
import crypto from 'crypto'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * PATCH /api/webhooks/subscriptions/[id]
 * Update an existing webhook subscription
 */
export async function PATCH(
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

    // Only owners and admins can update webhooks
    if (!['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners and admins can update webhooks' } },
        { status: 403 }
      )
    }

    // Verify webhook exists and belongs to organization
    const { rows: webhooks } = await query(
      `SELECT * FROM webhook_subscriptions WHERE id = $1 AND organization_id = $2 LIMIT 1`,
      [webhookId, member.organization_id]
    )
    const existingWebhook = webhooks[0]

    if (!existingWebhook) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const updates: any = {}

    // Validate and prepare updates
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 100) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_NAME', message: 'Name must be 1-100 characters' } },
          { status: 400 }
        )
      }
      updates.name = body.name
    }

    if (body.url !== undefined) {
      if (!isValidUrl(body.url)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_URL', message: 'Valid HTTPS URL is required' } },
          { status: 400 }
        )
      }

      // Check for duplicate URL (excluding this webhook)
      const { rows: duplicates } = await query(
        `SELECT id FROM webhook_subscriptions WHERE organization_id = $1 AND url = $2 AND id != $3 LIMIT 1`,
        [member.organization_id, body.url, webhookId]
      )

      if (duplicates.length > 0) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_URL', message: 'A webhook for this URL already exists' } },
          { status: 409 }
        )
      }

      updates.url = body.url
    }

    if (body.events !== undefined) {
      if (!Array.isArray(body.events) || body.events.length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'EVENTS_REQUIRED', message: 'At least one event type is required' } },
          { status: 400 }
        )
      }

      // Validate event types
      const invalidEvents = body.events.filter((e: string) => !WEBHOOK_EVENT_TYPES.includes(e as WebhookEventType))
      if (invalidEvents.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_EVENTS',
              message: `Invalid events: ${invalidEvents.join(', ')}`
            }
          },
          { status: 400 }
        )
      }

      updates.events = body.events
    }

    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ACTIVE', message: 'Active must be a boolean' } },
          { status: 400 }
        )
      }
      updates.active = body.active
    }

    if (body.retry_policy !== undefined) {
      if (!['none', 'fixed', 'exponential'].includes(body.retry_policy)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_RETRY_POLICY', message: 'Invalid retry policy' } },
          { status: 400 }
        )
      }
      updates.retry_policy = body.retry_policy
    }

    if (body.max_retries !== undefined) {
      const maxRetries = parseInt(body.max_retries)
      if (isNaN(maxRetries) || maxRetries < 0 || maxRetries > 10) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_MAX_RETRIES', message: 'Max retries must be 0-10' } },
          { status: 400 }
        )
      }
      updates.max_retries = maxRetries
    }

    if (body.timeout_ms !== undefined) {
      const timeout = parseInt(body.timeout_ms)
      if (isNaN(timeout) || timeout < 1000 || timeout > 60000) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_TIMEOUT', message: 'Timeout must be 1000-60000ms' } },
          { status: 400 }
        )
      }
      updates.timeout_ms = timeout
    }

    if (body.headers !== undefined) {
      if (typeof body.headers !== 'object' || Array.isArray(body.headers)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_HEADERS', message: 'Headers must be an object' } },
          { status: 400 }
        )
      }
      updates.headers = body.headers
    }

    // If no updates provided
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_UPDATES', message: 'No valid updates provided' } },
        { status: 400 }
      )
    }

    // Add updated_at
    updates.updated_at = new Date().toISOString()

    // Map keys for SQL update
    // 'events' in body maps to 'event_types' in DB
    if (updates.events) {
      updates.event_types = JSON.stringify(updates.events) // Stringify for JSONB
      delete updates.events
    }
    if (updates.headers) {
      updates.headers = JSON.stringify(updates.headers) // Stringify for JSONB
    }
    if (updates.active !== undefined) {
      updates.is_active = updates.active
      delete updates.active
    }

    // Construct dynamic update query
    const keys = Object.keys(updates)
    const values = Object.values(updates)
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')

    let updatedWebhook: any
    try {
      const { rows } = await query(
        `UPDATE webhook_subscriptions SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
        [...values, webhookId]
      )
      updatedWebhook = rows[0]
    } catch (updateError) {
      logger.error('Webhook PATCH update error', updateError, { webhookId })
      return NextResponse.json(
        { success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to update webhook' } },
        { status: 500 }
      )
    }

    // Log to audit (fire and forget)
    ; (async () => {
      try {
        await query(
          `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, actor_type, actor_label, before, after)
            VALUES ($1, $2, $3, 'webhook_subscription', $4, 'update', 'human', $5, $6, $7)`,
          [crypto.randomUUID(), member.organization_id, userId, webhookId, userId, JSON.stringify(existingWebhook), JSON.stringify(updatedWebhook)]
        )
      } catch (err) {
        logger.error('Webhook PATCH audit log error', err, { webhookId })
      }
    })()

    // Mask secret before returning
    const responseWebhook = {
      ...updatedWebhook,
      secret: `whsec_...${updatedWebhook.secret.slice(-4)}`
    }

    return NextResponse.json({
      success: true,
      subscription: responseWebhook
    })
  } catch (error: any) {
    logger.error('Webhook PATCH error', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/webhooks/subscriptions/[id]
 * Delete a webhook subscription
 */
export async function DELETE(
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

    // Only owners and admins can delete webhooks
    if (!['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners and admins can delete webhooks' } },
        { status: 403 }
      )
    }

    // Verify webhook exists and belongs to organization
    const { rows: webhooks } = await query(
      `SELECT * FROM webhook_subscriptions WHERE id = $1 AND organization_id = $2 LIMIT 1`,
      [webhookId, member.organization_id]
    )
    const existingWebhook = webhooks[0]

    if (!existingWebhook) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
        { status: 404 }
      )
    }

    // Delete webhook
    try {
      await query(`DELETE FROM webhook_subscriptions WHERE id = $1`, [webhookId])
    } catch (deleteError) {
      logger.error('Webhook DELETE error', deleteError, { webhookId })
      return NextResponse.json(
        { success: false, error: { code: 'DELETE_FAILED', message: 'Failed to delete webhook' } },
        { status: 500 }
      )
    }

    // Log to audit (fire and forget)
    ; (async () => {
      try {
        await query(
          `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, actor_type, actor_label, before)
            VALUES ($1, $2, $3, 'webhook_subscription', $4, 'delete', 'human', $5, $6)`,
          [crypto.randomUUID(), member.organization_id, userId, webhookId, userId, JSON.stringify(existingWebhook)]
        )
      } catch (err) {
        logger.error('Webhook DELETE audit log error', err, { webhookId })
      }
    })()

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully'
    })
  } catch (error: any) {
    logger.error('Webhook DELETE error', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
