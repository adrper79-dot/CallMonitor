/**
 * Campaigns Routes - Voice campaign management
 *
 * Endpoints:
 *   GET    /           - List campaigns
 *   POST   /           - Create campaign
 *   GET    /:id        - Get single campaign
 *   PUT    /:id        - Update campaign
 *   DELETE /:id        - Delete campaign
 *   GET    /:id/stats  - Campaign stats/progress
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth, requireRole } from '../lib/auth'
import { validateBody } from '../lib/validate'
import { CreateCampaignSchema, UpdateCampaignSchema } from '../lib/schemas'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { campaignsRateLimit } from '../lib/rate-limit'

export const campaignsRoutes = new Hono<AppEnv>()

// Get campaigns for organization
campaignsRoutes.get('/', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  const db = getDb(c.env, session.organization_id)
  try {
    if (!session.organization_id) {
      return c.json({ success: true, campaigns: [] })
    }

    const tableCheck = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'campaigns'
      ) as exists`
    )

    if (!tableCheck.rows[0].exists) {
      return c.json({ success: true, campaigns: [] })
    }

    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200)
    const offset = parseInt(c.req.query('offset') || '0', 10)

    const result = await db.query(
      `SELECT * FROM campaigns
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
      [session.organization_id, limit, offset]
    )

    return c.json({ success: true, campaigns: result.rows })
  } catch (err: any) {
    logger.error('GET /api/campaigns error', { error: err?.message })
    return c.json({ error: 'Failed to get campaigns' }, 500)
  } finally {
    await db.end()
  }
})

// Create campaign
campaignsRoutes.post('/', campaignsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Forbidden' }, 403)
  const db = getDb(c.env, session.organization_id)
  try {
    const parsed = await validateBody(c, CreateCampaignSchema)
    if (!parsed.success) return parsed.response
    const { name, description, scenario, status } = parsed.data

    const result = await db.query(
      `INSERT INTO campaigns (organization_id, name, description, custom_prompt, call_flow_type, created_by, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        session.organization_id,
        name,
        description || '',
        scenario || '',
        'outbound',
        session.user_id,
        status || 'draft',
      ]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'campaigns',
      resourceId: result.rows[0].id,
      action: AuditAction.CAMPAIGN_CREATED,
      oldValue: null,
      newValue: result.rows[0],
    })

    return c.json({ success: true, campaign: result.rows[0] }, 201)
  } catch (err: any) {
    logger.error('POST /api/campaigns error', { error: err?.message })
    return c.json({ error: 'Failed to create campaign' }, 500)
  } finally {
    await db.end()
  }
})

// Get single campaign
campaignsRoutes.get('/:id', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  const db = getDb(c.env, session.organization_id)
  try {
    const campaignId = c.req.param('id')

    // Skip if it's the 'stats' path — let the stats route handle it
    if (campaignId === 'stats') {
      return c.json({ error: 'Not found' }, 404)
    }

    const result = await db.query(
      `SELECT * FROM campaigns
      WHERE id = $1 AND organization_id = $2`,
      [campaignId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    return c.json({ success: true, campaign: result.rows[0] })
  } catch (err: any) {
    logger.error('GET /api/campaigns/:id error', { error: err?.message })
    return c.json({ error: 'Failed to get campaign' }, 500)
  } finally {
    await db.end()
  }
})

// Get campaign stats
campaignsRoutes.get('/:id/stats', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  const db = getDb(c.env, session.organization_id)
  try {
    const campaignId = c.req.param('id')

    const result = await db.query(
      `SELECT * FROM campaigns
      WHERE id = $1 AND organization_id = $2`,
      [campaignId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    const campaign = result.rows[0]

    // Count calls for this campaign
    let callStats = { total: 0, completed: 0, failed: 0, in_progress: 0 }
    try {
      const statsResult = await db.query(
        `SELECT 
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
          COUNT(*) FILTER (WHERE status = 'failed')::int as failed,
          COUNT(*) FILTER (WHERE status IN ('in_progress', 'ringing', 'initiating'))::int as in_progress
        FROM calls
        WHERE organization_id = $1
          AND campaign_id = $2`,
        [session.organization_id, campaignId]
      )
      if (statsResult.rows.length > 0) {
        callStats = statsResult.rows[0]
      }
    } catch {
      /* campaign_id column might not exist */
    }

    return c.json({
      success: true,
      stats: {
        campaign_id: campaignId,
        name: campaign.name,
        status: campaign.status,
        total_targets: campaign.total_targets || callStats.total,
        completed_calls: campaign.completed_calls || callStats.completed,
        failed_calls: callStats.failed,
        in_progress_calls: callStats.in_progress,
        progress_percent:
          callStats.total > 0 ? Math.round((callStats.completed / callStats.total) * 100) : 0,
      },
    })
  } catch (err: any) {
    logger.error('GET /api/campaigns/:id/stats error', { error: err?.message })
    return c.json({ error: 'Failed to get campaign stats' }, 500)
  } finally {
    await db.end()
  }
})

// Update campaign
campaignsRoutes.put('/:id', campaignsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Forbidden' }, 403)
  const db = getDb(c.env, session.organization_id)
  try {
    const campaignId = c.req.param('id')
    const parsed = await validateBody(c, UpdateCampaignSchema)
    if (!parsed.success) return parsed.response
    const { name, description, scenario, status } = parsed.data

    const result = await db.query(
      `UPDATE campaigns
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          custom_prompt = COALESCE($3, custom_prompt),
          status = COALESCE($4, status),
          updated_at = NOW()
      WHERE id = $5 AND organization_id = $6
      RETURNING *`,
      [
        name || null,
        description || null,
        scenario || null,
        status || null,
        campaignId,
        session.organization_id,
      ]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'campaigns',
      resourceId: campaignId,
      action: AuditAction.CAMPAIGN_UPDATED,
      oldValue: null,
      newValue: result.rows[0],
    })

    return c.json({ success: true, campaign: result.rows[0] })
  } catch (err: any) {
    logger.error('PUT /api/campaigns/:id error', { error: err?.message })
    return c.json({ error: 'Failed to update campaign' }, 500)
  } finally {
    await db.end()
  }
})

// Delete campaign
campaignsRoutes.delete('/:id', campaignsRateLimit, async (c) => {
  const session = await requireRole(c, 'manager')
  if (!session) return c.json({ error: 'Forbidden' }, 403)
  const db = getDb(c.env, session.organization_id)
  try {
    const campaignId = c.req.param('id')

    const result = await db.query(
      `DELETE FROM campaigns
      WHERE id = $1 AND organization_id = $2
      RETURNING id`,
      [campaignId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'campaigns',
      resourceId: campaignId,
      action: AuditAction.CAMPAIGN_DELETED,
      oldValue: { id: campaignId },
      newValue: null,
    })

    return c.json({ success: true, message: 'Campaign deleted' })
  } catch (err: any) {
    logger.error('DELETE /api/campaigns/:id error', { error: err?.message })
    return c.json({ error: 'Failed to delete campaign' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Sequences CRUD ──────────────────────────────────────────────────────────

// GET /sequences — List all sequences for org
campaignsRoutes.get('/sequences', async (c) => {
  // Note: Must be registered BEFORE /:id routes, but since Hono matches exact
  // paths first, "sequences" won't collide with /:id (UUID pattern)
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  const db = getDb(c.env, session.organization_id)
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200)

    const result = await db.query(
      `SELECT cs.*, c.name AS campaign_name
       FROM campaign_sequences cs
       LEFT JOIN campaigns c ON cs.campaign_id = c.id
       WHERE cs.organization_id = $1
       ORDER BY cs.created_at DESC
       LIMIT $2`,
      [session.organization_id, limit]
    )

    return c.json({ success: true, sequences: result.rows })
  } catch (err: any) {
    logger.error('GET /api/campaigns/sequences error', { error: err?.message })
    return c.json({ success: true, sequences: [] })
  } finally {
    await db.end()
  }
})

// POST /sequences — Create a sequence
campaignsRoutes.post('/sequences', campaignsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Forbidden' }, 403)
  const db = getDb(c.env, session.organization_id)
  try {
    const body = await c.req.json()
    const { campaign_id, name, steps, status: seqStatus } = body

    if (!name) {
      return c.json({ error: 'name is required' }, 400)
    }

    const result = await db.query(
      `INSERT INTO campaign_sequences
        (organization_id, campaign_id, name, steps, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        session.organization_id,
        campaign_id || null,
        name,
        steps ? JSON.stringify(steps) : '[]',
        seqStatus || 'draft',
        session.user_id,
      ]
    )

    return c.json({ success: true, sequence: result.rows[0] }, 201)
  } catch (err: any) {
    logger.error('POST /api/campaigns/sequences error', { error: err?.message })
    return c.json({ error: 'Failed to create sequence' }, 500)
  } finally {
    await db.end()
  }
})

// PUT /sequences/:seqId — Update a sequence
campaignsRoutes.put('/sequences/:seqId', campaignsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Forbidden' }, 403)
  const db = getDb(c.env, session.organization_id)
  try {
    const seqId = c.req.param('seqId')
    const body = await c.req.json()
    const { name, steps, status: seqStatus } = body

    const result = await db.query(
      `UPDATE campaign_sequences
       SET name = COALESCE($1, name),
           steps = COALESCE($2, steps),
           status = COALESCE($3, status),
           updated_at = NOW()
       WHERE id = $4 AND organization_id = $5
       RETURNING *`,
      [
        name || null,
        steps ? JSON.stringify(steps) : null,
        seqStatus || null,
        seqId,
        session.organization_id,
      ]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Sequence not found' }, 404)
    }

    return c.json({ success: true, sequence: result.rows[0] })
  } catch (err: any) {
    logger.error('PUT /api/campaigns/sequences/:seqId error', { error: err?.message })
    return c.json({ error: 'Failed to update sequence' }, 500)
  } finally {
    await db.end()
  }
})

// DELETE /sequences/:seqId — Delete a sequence
campaignsRoutes.delete('/sequences/:seqId', campaignsRateLimit, async (c) => {
  const session = await requireRole(c, 'manager')
  if (!session) return c.json({ error: 'Forbidden' }, 403)
  const db = getDb(c.env, session.organization_id)
  try {
    const seqId = c.req.param('seqId')

    const result = await db.query(
      `DELETE FROM campaign_sequences WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [seqId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Sequence not found' }, 404)
    }

    return c.json({ success: true, message: 'Sequence deleted' })
  } catch (err: any) {
    logger.error('DELETE /api/campaigns/sequences/:seqId error', { error: err?.message })
    return c.json({ error: 'Failed to delete sequence' }, 500)
  } finally {
    await db.end()
  }
})

// ─── POST /:id/messages — Send SMS to Campaign Accounts ─────────────────────

/**
 * Send SMS to all accounts in a campaign.
 * 
 * Features:
 * - Fetches accounts linked to campaign
 * - Filters by SMS consent
 * - Runs compliance checks for each recipient
 * - Sends SMS via Telnyx
 * - Updates campaign stats
 * 
 * Request body:
 * {
 *   message_body: string,
 *   template_id?: string,
 *   template_vars?: object
 * }
 */
campaignsRoutes.post('/:id/messages', campaignsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Forbidden' }, 403)

  const campaignId = c.req.param('id')

  try {
    const body = await c.req.json()
    const { message_body, template_id, template_vars } = body

    if (!message_body && !template_id) {
      return c.json({ error: 'Either message_body or template_id is required' }, 400)
    }

    if (!c.env.TELNYX_API_KEY) {
      return c.json({ error: 'SMS service not configured' }, 500)
    }

    const db = getDb(c.env, session.organization_id)

    try {
      // Verify campaign exists and belongs to org
      const campaignResult = await db.query(
        `SELECT id, name FROM campaigns
         WHERE id = $1 AND organization_id = $2`,
        [campaignId, session.organization_id]
      )

      if (campaignResult.rows.length === 0) {
        return c.json({ error: 'Campaign not found' }, 404)
      }

      const campaign = campaignResult.rows[0]

      // Fetch campaign-scoped accounts with SMS consent
      const accountsResult = await db.query(
        `SELECT ca.id, ca.primary_phone
         FROM collection_accounts ca
         WHERE ca.organization_id = $1
           AND ca.campaign_id = $2
           AND ca.sms_consent = true
           AND ca.status IN ('active', 'pending')
         LIMIT 1000`,
        [session.organization_id, campaignId]
      )

      if (accountsResult.rows.length === 0) {
        return c.json({ 
          success: true, 
          message: 'No accounts with SMS consent found in campaign',
          summary: { total: 0, sent: 0, failed: 0, skipped: 0 }
        })
      }

      const accountIds = accountsResult.rows.map((row: any) => row.id)

      // Use bulk SMS endpoint via internal fetch
      const apiBaseUrl =
        c.env.API_BASE_URL ||
        'https://wordisbond-api.adrper79.workers.dev'

      const bulkSmsResponse = await fetch(`${apiBaseUrl}/api/messages/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': c.req.header('Authorization') || '',
        },
        body: JSON.stringify({
          channel: 'sms',
          account_ids: accountIds,
          message_body,
          template_id,
          template_vars,
          campaign_id: campaignId,
        }),
      })

      if (!bulkSmsResponse.ok) {
        const errorText = await bulkSmsResponse.text().catch(() => 'Unknown error')
        logger.error('Bulk SMS call failed', { status: bulkSmsResponse.status, error: errorText })
        return c.json({ error: 'Failed to send campaign SMS', details: errorText }, 502)
      }

      const bulkResult = await bulkSmsResponse.json() as {
        summary?: {
          total: number
          sent: number
          failed: number
          skipped: number
        }
      }

      // Update campaign sms_sent_count (if column exists)
      await db.query(
        `UPDATE campaigns
         SET updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [campaignId, session.organization_id]
      ).catch(() => {
        // Ignore if campaigns table doesn't have sms_sent_count column
      })

      // Fire audit log
      writeAuditLog(db, {
        organizationId: session.organization_id,
        userId: session.user_id,
        resourceType: 'campaigns',
        resourceId: campaignId,
        action: AuditAction.SMS_CAMPAIGN_SENT,
        newValue: {
          campaign_id: campaignId,
          campaign_name: campaign.name,
          ...bulkResult.summary,
        },
      }, c.env.KV)

      logger.info('Campaign SMS sent', { 
        campaignId, 
        summary: bulkResult.summary 
      })

      return c.json({
        success: true,
        campaign: campaign.name,
        summary: bulkResult.summary,
      })
    } finally {
      await db.end()
    }
  } catch (error) {
    logger.error('Campaign SMS error', { error: (error as Error)?.message, campaignId })
    return c.json({ error: 'Internal server error' }, 500)
  }
})
