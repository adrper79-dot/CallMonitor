/**
 * Notifications Routes — Slack & Microsoft Teams webhook integration
 *
 * Allows customers to configure notification channels (Slack/Teams webhooks)
 * for real-time alerts on call events, sentiment, compliance, and more.
 *
 * Endpoints:
 *   GET    /channels        - List configured notification channels
 *   POST   /channels        - Create a notification channel
 *   PUT    /channels/:id    - Update a channel
 *   DELETE /channels/:id    - Delete a channel
 *   POST   /channels/:id/test - Send a test notification
 *   GET    /history         - Recent notification delivery history
 *
 * Exported utilities:
 *   sendNotification()  - Trigger notifications to all matching channels
 *   formatSlackMessage() - Build Slack Block Kit payload
 *   formatTeamsMessage() - Build Teams Adaptive Card payload
 *
 * DB tables:
 *   notification_channels   (id, organization_id, provider, name, webhook_url, events, is_active, created_at, updated_at)
 *   notification_deliveries (id, channel_id, event_type, payload, status_code, success, created_at)
 *
 * @see ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv, Env } from '../index'
import { requireAuth, requireRole } from '../lib/auth'
import { getDb } from '../lib/db'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { logger } from '../lib/logger'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/** Supported notification providers */
const ProviderEnum = z.enum(['slack', 'teams'])

/** Supported event types that can trigger notifications */
const EventTypeEnum = z.enum([
  'call.completed',
  'sentiment.alert',
  'compliance.violation',
  'agent.alert',
  'campaign.completed',
  'scorecard.completed',
  'system.error',
])

/** Schema for creating a notification channel */
const CreateChannelSchema = z.object({
  provider: ProviderEnum,
  name: z.string().min(1).max(100),
  webhook_url: z.string().url().max(2048),
  events: z.array(EventTypeEnum).min(1),
  is_active: z.boolean().optional().default(true),
})

/** Schema for updating a notification channel */
const UpdateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  webhook_url: z.string().url().max(2048).optional(),
  events: z.array(EventTypeEnum).min(1).optional(),
  is_active: z.boolean().optional(),
})

/** Shape of notification data sent to channels */
export interface NotificationData {
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  fields?: Array<{ name: string; value: string }>
  actionUrl?: string
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const notificationsRoutes = new Hono<AppEnv>()

// ---------------------------------------------------------------------------
// GET /channels — list configured notification channels for the org
// ---------------------------------------------------------------------------

/**
 * List all notification channels for the authenticated organization.
 * Supports optional `?provider=slack|teams` query filter.
 */
notificationsRoutes.get('/channels', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const provider = c.req.query('provider')
    let sql = `SELECT id, provider, name, webhook_url, events, is_active, created_at, updated_at
               FROM notification_channels
               WHERE organization_id = $1`
    const params: unknown[] = [session.organization_id]

    if (provider) {
      sql += ` AND provider = $2`
      params.push(provider)
    }

    sql += ` ORDER BY created_at DESC`

    const result = await db.query(sql, params)
    return c.json({ success: true, channels: result.rows })
  } catch (err: any) {
    logger.error('GET /notifications/channels error', { error: err?.message })
    return c.json({ error: 'Failed to list notification channels' }, 500)
  } finally {
    await db.end()
  }
})

// ---------------------------------------------------------------------------
// POST /channels — create a new notification channel
// ---------------------------------------------------------------------------

/**
 * Create a notification channel (Slack or Teams webhook).
 *
 * @body { provider, name, webhook_url, events, is_active? }
 */
notificationsRoutes.post('/channels', async (c) => {
  const session = await requireRole(c, 'operator')
  if (!session) return c.json({ error: 'Unauthorized or insufficient role' }, 403)

  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400)

  const parsed = CreateChannelSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  }

  const { provider, name, webhook_url, events, is_active } = parsed.data
  const db = getDb(c.env, session.organization_id)

  try {
    const result = await db.query(
      `INSERT INTO notification_channels
         (organization_id, provider, name, webhook_url, events, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [session.organization_id, provider, name, webhook_url, events, is_active]
    )

    const channel = result.rows[0]

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'notification_channels',
      resourceId: channel.id,
      action: AuditAction.NOTIFICATION_CHANNEL_CREATED,
      oldValue: null,
      newValue: channel,
    })

    return c.json({ success: true, channel }, 201)
  } catch (err: any) {
    logger.error('POST /notifications/channels error', { error: err?.message })
    return c.json({ error: 'Failed to create notification channel' }, 500)
  } finally {
    await db.end()
  }
})

// ---------------------------------------------------------------------------
// PUT /channels/:id — update an existing notification channel
// ---------------------------------------------------------------------------

/**
 * Update a notification channel's config (name, webhook_url, events, is_active).
 */
notificationsRoutes.put('/channels/:id', async (c) => {
  const session = await requireRole(c, 'operator')
  if (!session) return c.json({ error: 'Unauthorized or insufficient role' }, 403)

  const channelId = c.req.param('id')

  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400)

  const parsed = UpdateChannelSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  }

  const db = getDb(c.env, session.organization_id)
  try {
    // Fetch existing channel (multi-tenant guard)
    const existing = await db.query(
      `SELECT * FROM notification_channels WHERE id = $1 AND organization_id = $2`,
      [channelId, session.organization_id]
    )
    if (existing.rows.length === 0) {
      return c.json({ error: 'Channel not found' }, 404)
    }

    const oldChannel = existing.rows[0]

    // Build dynamic SET clause from provided fields
    const updates: string[] = []
    const values: unknown[] = []
    let idx = 3 // $1 = id, $2 = organization_id

    const data = parsed.data
    if (data.name !== undefined) {
      updates.push(`name = $${idx}`)
      values.push(data.name)
      idx++
    }
    if (data.webhook_url !== undefined) {
      updates.push(`webhook_url = $${idx}`)
      values.push(data.webhook_url)
      idx++
    }
    if (data.events !== undefined) {
      updates.push(`events = $${idx}`)
      values.push(data.events)
      idx++
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${idx}`)
      values.push(data.is_active)
      idx++
    }

    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400)
    }

    updates.push('updated_at = NOW()')

    const result = await db.query(
      `UPDATE notification_channels
       SET ${updates.join(', ')}
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [channelId, session.organization_id, ...values]
    )

    const updated = result.rows[0]

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'notification_channels',
      resourceId: channelId,
      action: AuditAction.NOTIFICATION_CHANNEL_UPDATED,
      oldValue: oldChannel,
      newValue: updated,
    })

    return c.json({ success: true, channel: updated })
  } catch (err: any) {
    logger.error('PUT /notifications/channels/:id error', { error: err?.message })
    return c.json({ error: 'Failed to update notification channel' }, 500)
  } finally {
    await db.end()
  }
})

// ---------------------------------------------------------------------------
// DELETE /channels/:id — delete a notification channel
// ---------------------------------------------------------------------------

/**
 * Delete a notification channel by ID. Scoped to the caller's org.
 */
notificationsRoutes.delete('/channels/:id', async (c) => {
  const session = await requireRole(c, 'operator')
  if (!session) return c.json({ error: 'Unauthorized or insufficient role' }, 403)

  const channelId = c.req.param('id')
  const db = getDb(c.env, session.organization_id)

  try {
    const existing = await db.query(
      `SELECT * FROM notification_channels WHERE id = $1 AND organization_id = $2`,
      [channelId, session.organization_id]
    )
    if (existing.rows.length === 0) {
      return c.json({ error: 'Channel not found' }, 404)
    }

    await db.query(
      `DELETE FROM notification_channels WHERE id = $1 AND organization_id = $2`,
      [channelId, session.organization_id]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'notification_channels',
      resourceId: channelId,
      action: AuditAction.NOTIFICATION_CHANNEL_DELETED,
      oldValue: existing.rows[0],
      newValue: null,
    })

    return c.json({ success: true })
  } catch (err: any) {
    logger.error('DELETE /notifications/channels/:id error', { error: err?.message })
    return c.json({ error: 'Failed to delete notification channel' }, 500)
  } finally {
    await db.end()
  }
})

// ---------------------------------------------------------------------------
// POST /channels/:id/test — send a test notification
// ---------------------------------------------------------------------------

/**
 * Send a test notification to verify the webhook URL is reachable.
 */
notificationsRoutes.post('/channels/:id/test', async (c) => {
  const session = await requireRole(c, 'operator')
  if (!session) return c.json({ error: 'Unauthorized or insufficient role' }, 403)

  const channelId = c.req.param('id')
  const db = getDb(c.env, session.organization_id)

  try {
    const result = await db.query(
      `SELECT * FROM notification_channels WHERE id = $1 AND organization_id = $2`,
      [channelId, session.organization_id]
    )
    if (result.rows.length === 0) {
      return c.json({ error: 'Channel not found' }, 404)
    }

    const channel = result.rows[0]

    const testData: NotificationData = {
      title: 'Test Notification',
      message: 'This is a test notification from Word Is Bond. If you see this, your webhook is configured correctly!',
      severity: 'info',
      fields: [
        { name: 'Channel', value: channel.name },
        { name: 'Provider', value: channel.provider },
        { name: 'Sent At', value: new Date().toISOString() },
      ],
      actionUrl: 'https://wordis-bond.com/settings',
    }

    const payload =
      channel.provider === 'slack'
        ? formatSlackMessage(testData)
        : formatTeamsMessage(testData)

    const response = await fetch(channel.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const success = response.ok

    // Record delivery
    await db.query(
      `INSERT INTO notification_deliveries
         (channel_id, event_type, payload, status_code, success, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [channelId, 'test', JSON.stringify(testData), response.status, success]
    )

    return c.json({ success, status_code: response.status })
  } catch (err: any) {
    logger.error('POST /notifications/channels/:id/test error', { error: err?.message })
    return c.json({ error: 'Failed to send test notification' }, 500)
  } finally {
    await db.end()
  }
})

// ---------------------------------------------------------------------------
// GET /history — recent notification delivery history
// ---------------------------------------------------------------------------

/**
 * Return recent notification delivery history for the org.
 * Supports `?limit=N` (default 50, max 200) and `?channel_id=UUID` filter.
 */
notificationsRoutes.get('/history', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200)
    const channelIdFilter = c.req.query('channel_id')

    let sql = `
      SELECT d.id, d.channel_id, d.event_type, d.payload, d.status_code, d.success, d.created_at,
             ch.name AS channel_name, ch.provider
      FROM notification_deliveries d
      JOIN notification_channels ch ON ch.id = d.channel_id
      WHERE ch.organization_id = $1`
    const params: unknown[] = [session.organization_id]

    if (channelIdFilter) {
      sql += ` AND d.channel_id = $2`
      params.push(channelIdFilter)
    }

    sql += ` ORDER BY d.created_at DESC LIMIT $${params.length + 1}`
    params.push(limit)

    const result = await db.query(sql, params)
    return c.json({ success: true, deliveries: result.rows })
  } catch (err: any) {
    logger.error('GET /notifications/history error', { error: err?.message })
    return c.json({ error: 'Failed to fetch notification history' }, 500)
  } finally {
    await db.end()
  }
})

// ---------------------------------------------------------------------------
// Utility: sendNotification
// ---------------------------------------------------------------------------

/**
 * Send a notification to all active channels whose `events` array includes
 * the given `eventType`. This is the primary entry point for other routes
 * to trigger real-time alerts.
 *
 * @param env    - Worker environment bindings
 * @param orgId  - Organization ID (multi-tenant scope)
 * @param eventType - One of the supported event types (e.g. 'call.completed')
 * @param data   - Notification payload (title, message, severity, optional fields & actionUrl)
 *
 * @example
 * ```ts
 * import { sendNotification } from './notifications'
 *
 * await sendNotification(c.env, session.organization_id, 'sentiment.alert', {
 *   title: 'Negative Sentiment Detected',
 *   message: `Call ${callId} scored ${score} sentiment.`,
 *   severity: 'warning',
 *   fields: [{ name: 'Agent', value: agentName }],
 *   actionUrl: `https://wordis-bond.com/voice/${callId}`,
 * })
 * ```
 */
export async function sendNotification(
  env: Env,
  orgId: string,
  eventType: string,
  data: NotificationData
): Promise<void> {
  const db = getDb(env, orgId)
  try {
    // Find all active channels for this org that listen to the event type
    const result = await db.query(
      `SELECT id, provider, webhook_url
       FROM notification_channels
       WHERE organization_id = $1
         AND is_active = true
         AND $2 = ANY(events)`,
      [orgId, eventType]
    )

    if (result.rows.length === 0) return

    // Fan-out notifications concurrently
    const deliveryPromises = result.rows.map(async (channel) => {
      const payload =
        channel.provider === 'slack'
          ? formatSlackMessage(data)
          : formatTeamsMessage(data)

      let statusCode = 0
      let success = false

      try {
        const response = await fetch(channel.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        statusCode = response.status
        success = response.ok
      } catch (fetchErr: any) {
        logger.error('Notification delivery failed', {
          channelId: channel.id,
          provider: channel.provider,
          error: fetchErr?.message,
        })
      }

      // Record delivery attempt
      await db
        .query(
          `INSERT INTO notification_deliveries
             (channel_id, event_type, payload, status_code, success, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [channel.id, eventType, JSON.stringify(data), statusCode, success]
        )
        .catch((dbErr: any) => {
          logger.error('Failed to record notification delivery', { error: dbErr?.message })
        })
    })

    await Promise.allSettled(deliveryPromises)
  } catch (err: any) {
    logger.error('sendNotification error', { orgId, eventType, error: err?.message })
  } finally {
    await db.end()
  }
}

// ---------------------------------------------------------------------------
// Message formatters
// ---------------------------------------------------------------------------

/** Severity-to-emoji mapping for Slack */
const SEVERITY_EMOJI: Record<string, string> = {
  info: ':information_source:',
  warning: ':warning:',
  critical: ':rotating_light:',
}

/** Severity-to-color mapping for Teams Adaptive Cards */
const SEVERITY_COLOR: Record<string, string> = {
  info: 'default',
  warning: 'warning',
  critical: 'attention',
}

/**
 * Format a notification as a Slack Block Kit payload.
 *
 * Structure:
 *  - Header block with severity emoji
 *  - Section block with message text
 *  - Fields section with key-value pairs (if provided)
 *  - Actions block with a link button (if actionUrl provided)
 */
export function formatSlackMessage(data: NotificationData): object {
  const emoji = SEVERITY_EMOJI[data.severity] || ':bell:'

  const blocks: object[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} ${data.title}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: data.message,
      },
    },
  ]

  // Key-value fields as a section with fields layout
  if (data.fields && data.fields.length > 0) {
    blocks.push({
      type: 'section',
      fields: data.fields.map((f) => ({
        type: 'mrkdwn',
        text: `*${f.name}:*\n${f.value}`,
      })),
    })
  }

  // Action button
  if (data.actionUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View in Word Is Bond',
            emoji: true,
          },
          url: data.actionUrl,
          style: data.severity === 'critical' ? 'danger' : 'primary',
        },
      ],
    })
  }

  // Divider at the end
  blocks.push({ type: 'divider' })

  return { blocks }
}

/**
 * Format a notification as a Microsoft Teams Adaptive Card (v1.4).
 *
 * Structure:
 *  - TextBlock header with severity-based color
 *  - TextBlock body with message
 *  - FactSet for key-value fields (if provided)
 *  - Action.OpenUrl button (if actionUrl provided)
 */
export function formatTeamsMessage(data: NotificationData): object {
  const color = SEVERITY_COLOR[data.severity] || 'default'

  const bodyItems: object[] = [
    {
      type: 'TextBlock',
      size: 'Large',
      weight: 'Bolder',
      text: data.title,
      color,
      wrap: true,
    },
    {
      type: 'TextBlock',
      text: data.message,
      wrap: true,
    },
  ]

  // FactSet for fields
  if (data.fields && data.fields.length > 0) {
    bodyItems.push({
      type: 'FactSet',
      facts: data.fields.map((f) => ({
        title: f.name,
        value: f.value,
      })),
    })
  }

  const actions: object[] = []
  if (data.actionUrl) {
    actions.push({
      type: 'Action.OpenUrl',
      title: 'View in Word Is Bond',
      url: data.actionUrl,
    })
  }

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: bodyItems,
          ...(actions.length > 0 ? { actions } : {}),
        },
      },
    ],
  }
}
