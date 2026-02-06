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
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'
import { validateBody } from '../lib/validate'
import { CreateCampaignSchema, UpdateCampaignSchema } from '../lib/schemas'
import { getDb } from '../lib/db'

export const campaignsRoutes = new Hono<{ Bindings: Env }>()

// Get campaigns for organization
campaignsRoutes.get('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    if (!session.organization_id) {
      return c.json({ success: true, campaigns: [] })
    }

    const db = getDb(c.env)

    const tableCheck = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'campaigns'
      ) as exists`
    )

    if (!tableCheck.rows[0].exists) {
      return c.json({ success: true, campaigns: [] })
    }

    const result = await db.query(
      `SELECT * FROM campaigns
      WHERE organization_id = $1
      ORDER BY created_at DESC`,
      [session.organization_id]
    )

    return c.json({ success: true, campaigns: result.rows })
  } catch (err: any) {
    console.error('GET /api/campaigns error:', err?.message)
    return c.json({ error: 'Failed to get campaigns' }, 500)
  }
})

// Create campaign
campaignsRoutes.post('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const parsed = await validateBody(c, CreateCampaignSchema)
    if (!parsed.success) return parsed.response
    const { name, description, scenario, status } = parsed.data

    const db = getDb(c.env)

    // Ensure table exists
    await db.query(
      `CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        scenario TEXT,
        status TEXT DEFAULT 'draft',
        total_targets INT DEFAULT 0,
        completed_calls INT DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`
    )

    const result = await db.query(
      `INSERT INTO campaigns (organization_id, name, description, scenario, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [session.organization_id, name, description || '', scenario || '', status || 'draft']
    )

    return c.json({ success: true, campaign: result.rows[0] }, 201)
  } catch (err: any) {
    console.error('POST /api/campaigns error:', err?.message)
    return c.json({ error: 'Failed to create campaign' }, 500)
  }
})

// Get single campaign
campaignsRoutes.get('/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const campaignId = c.req.param('id')

    // Skip if it's the 'stats' path — let the stats route handle it
    if (campaignId === 'stats') {
      return c.json({ error: 'Not found' }, 404)
    }

    const db = getDb(c.env)

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
    console.error('GET /api/campaigns/:id error:', err?.message)
    return c.json({ error: 'Failed to get campaign' }, 500)
  }
})

// Get campaign stats
campaignsRoutes.get('/:id/stats', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const campaignId = c.req.param('id')
    const db = getDb(c.env)

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
    } catch { /* campaign_id column might not exist */ }

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
        progress_percent: callStats.total > 0
          ? Math.round((callStats.completed / callStats.total) * 100)
          : 0,
      },
    })
  } catch (err: any) {
    console.error('GET /api/campaigns/:id/stats error:', err?.message)
    return c.json({ error: 'Failed to get campaign stats' }, 500)
  }
})

// Update campaign
campaignsRoutes.put('/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const campaignId = c.req.param('id')
    const parsed = await validateBody(c, UpdateCampaignSchema)
    if (!parsed.success) return parsed.response
    const { name, description, scenario, status } = parsed.data

    const db = getDb(c.env)

    const result = await db.query(
      `UPDATE campaigns
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          scenario = COALESCE($3, scenario),
          status = COALESCE($4, status),
          updated_at = NOW()
      WHERE id = $5 AND organization_id = $6
      RETURNING *`,
      [name || null, description || null, scenario || null, status || null, campaignId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    return c.json({ success: true, campaign: result.rows[0] })
  } catch (err: any) {
    console.error('PUT /api/campaigns/:id error:', err?.message)
    return c.json({ error: 'Failed to update campaign' }, 500)
  }
})

// Delete campaign
campaignsRoutes.delete('/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const campaignId = c.req.param('id')
    const db = getDb(c.env)

    const result = await db.query(
      `DELETE FROM campaigns
      WHERE id = $1 AND organization_id = $2
      RETURNING id`,
      [campaignId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    return c.json({ success: true, message: 'Campaign deleted' })
  } catch (err: any) {
    console.error('DELETE /api/campaigns/:id error:', err?.message)
    return c.json({ error: 'Failed to delete campaign' }, 500)
  }
})