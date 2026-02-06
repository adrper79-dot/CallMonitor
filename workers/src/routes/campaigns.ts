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

export const campaignsRoutes = new Hono<{ Bindings: Env }>()

/** Helper: get neon sql client */
async function getNeon(c: any) {
  const { neon } = await import('@neondatabase/serverless')
  const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
  return neon(connectionString)
}

// Get campaigns for organization
campaignsRoutes.get('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    if (!session.organization_id) {
      return c.json({ success: true, campaigns: [] })
    }

    const sql = await getNeon(c)

    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'campaigns'
      ) as exists
    `

    if (!tableCheck[0].exists) {
      return c.json({ success: true, campaigns: [] })
    }

    const result = await sql`
      SELECT * FROM campaigns
      WHERE organization_id = ${session.organization_id}
      ORDER BY created_at DESC
    `

    return c.json({ success: true, campaigns: result })
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

    const sql = await getNeon(c)

    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS campaigns (
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
      )
    `

    const result = await sql`
      INSERT INTO campaigns (organization_id, name, description, scenario, status)
      VALUES (${session.organization_id}, ${name}, ${description || ''}, ${scenario || ''}, ${status || 'draft'})
      RETURNING *
    `

    return c.json({ success: true, campaign: result[0] }, 201)
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

    const sql = await getNeon(c)

    const result = await sql`
      SELECT * FROM campaigns
      WHERE id = ${campaignId} AND organization_id = ${session.organization_id}
    `

    if (result.length === 0) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    return c.json({ success: true, campaign: result[0] })
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
    const sql = await getNeon(c)

    const result = await sql`
      SELECT * FROM campaigns
      WHERE id = ${campaignId} AND organization_id = ${session.organization_id}
    `

    if (result.length === 0) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    const campaign = result[0]

    // Count calls for this campaign
    let callStats = { total: 0, completed: 0, failed: 0, in_progress: 0 }
    try {
      const statsResult = await sql`
        SELECT 
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
          COUNT(*) FILTER (WHERE status = 'failed')::int as failed,
          COUNT(*) FILTER (WHERE status IN ('in_progress', 'ringing', 'initiating'))::int as in_progress
        FROM calls
        WHERE organization_id = ${session.organization_id}
          AND campaign_id = ${campaignId}
      `
      if (statsResult.length > 0) {
        callStats = statsResult[0]
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

    const sql = await getNeon(c)

    const result = await sql`
      UPDATE campaigns
      SET name = COALESCE(${name}, name),
          description = COALESCE(${description}, description),
          scenario = COALESCE(${scenario}, scenario),
          status = COALESCE(${status}, status),
          updated_at = NOW()
      WHERE id = ${campaignId} AND organization_id = ${session.organization_id}
      RETURNING *
    `

    if (result.length === 0) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    return c.json({ success: true, campaign: result[0] })
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
    const sql = await getNeon(c)

    const result = await sql`
      DELETE FROM campaigns
      WHERE id = ${campaignId} AND organization_id = ${session.organization_id}
      RETURNING id
    `

    if (result.length === 0) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    return c.json({ success: true, message: 'Campaign deleted' })
  } catch (err: any) {
    console.error('DELETE /api/campaigns/:id error:', err?.message)
    return c.json({ error: 'Failed to delete campaign' }, 500)
  }
})