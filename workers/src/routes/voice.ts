/**
 * Voice Routes - Voice configuration and capabilities
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const voiceRoutes = new Hono<{ Bindings: Env }>()

// Get voice targets
voiceRoutes.get('/targets', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Use neon client
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    // Check if voice_targets table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'voice_targets'
      ) as exists
    `

    if (!tableCheck[0].exists) {
      console.warn('Voice targets table does not exist')
      return c.json({
        success: true,
        targets: []
      })
    }

    const result = await sql`
      SELECT *
      FROM voice_targets
      WHERE organization_id = ${session.organizationId}
      ORDER BY created_at DESC
    `

    return c.json({
      success: true,
      targets: result
    })
  } catch (err: any) {
    console.error('GET /api/voice/targets error:', err)
    return c.json({ error: 'Failed to get voice targets' }, 500)
  }
})

// Get voice configuration
voiceRoutes.get('/config', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Return default voice config
    return c.json({
      success: true,
      config: {
        enabled: true,
        provider: 'telnyx',
        features: ['outbound', 'inbound', 'recording'],
        limits: {
          concurrentCalls: 10,
          dailyMinutes: 1000
        }
      }
    })
  } catch (err: any) {
    console.error('GET /api/voice/config error:', err)
    return c.json({ error: 'Failed to get voice config' }, 500)
  }
})