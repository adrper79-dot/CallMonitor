/**
 * Campaigns Routes - Voice campaign management
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const campaignsRoutes = new Hono<{ Bindings: Env }>()

// Get campaigns for organization
campaignsRoutes.get('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    if (!session.organization_id) {
      return c.json({
        success: true,
        campaigns: []
      })
    }

    // Use neon client
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    // Check if table exists first
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'campaigns'
      ) as exists
    `

    if (!tableCheck[0].exists) {
      console.warn('Campaigns table does not exist')
      return c.json({
        success: true,
        campaigns: []
      })
    }

    const result = await sql`
      SELECT *
      FROM campaigns
      WHERE organization_id = ${session.organization_id}
      ORDER BY created_at DESC
    `

    return c.json({
      success: true,
      campaigns: result
    })
  } catch (err: any) {
    console.error('GET /api/campaigns error:', err)
    return c.json({ error: 'Failed to get campaigns' }, 500)
  }
})

// Create campaign
campaignsRoutes.post('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const body = await c.req.json()
    const { name, description, scenario } = body

    if (!name || !scenario) {
      return c.json({ error: 'Name and scenario are required' }, 400)
    }

    // Use neon client
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    const result = await sql`
      INSERT INTO campaigns (organization_id, name, description, scenario, created_at)
      VALUES (${session.organization_id}, ${name}, ${description || ''}, ${scenario}, NOW())
      RETURNING *
    `

    return c.json({
      success: true,
      campaign: result[0]
    })
  } catch (err: any) {
    console.error('POST /api/campaigns error:', err)
    return c.json({ error: 'Failed to create campaign' }, 500)
  }
})