/**
 * AI Config Routes - Manage AI agent configuration (real DB)
 *
 * Endpoints:
 *   GET /  - Get AI config for org
 *   PUT /  - Update AI config for org
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const aiConfigRoutes = new Hono<{ Bindings: Env }>()

async function getSQL(c: any) {
  const { neon } = await import('@neondatabase/serverless')
  const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
  return neon(connectionString)
}

const DEFAULT_CONFIG = {
  enabled: false,
  model: 'gpt-4',
  temperature: 0.7,
  max_tokens: 2048,
  system_prompt: '',
  sentiment_analysis: true,
  auto_summarize: true,
  language: 'en',
}

async function ensureTable(sql: any) {
  await sql`
    CREATE TABLE IF NOT EXISTS ai_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL UNIQUE,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

// GET / — Get AI configuration
aiConfigRoutes.get('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const sql = await getSQL(c)
    await ensureTable(sql)

    const rows = await sql`
      SELECT config, updated_at
      FROM ai_configs
      WHERE organization_id = ${session.organization_id}
    `

    const config = rows.length > 0
      ? { ...DEFAULT_CONFIG, ...rows[0].config }
      : { ...DEFAULT_CONFIG }

    return c.json({
      success: true,
      config,
      updated_at: rows[0]?.updated_at || null,
    })
  } catch (err: any) {
    console.error('GET /api/ai-config error:', err?.message)
    return c.json({ error: 'Failed to get AI config' }, 500)
  }
})

// PUT / — Update AI configuration
aiConfigRoutes.put('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const sql = await getSQL(c)
    await ensureTable(sql)

    const body = await c.req.json()
    const merged = { ...DEFAULT_CONFIG, ...body }

    const [result] = await sql`
      INSERT INTO ai_configs (organization_id, config, updated_by)
      VALUES (${session.organization_id}, ${JSON.stringify(merged)}::jsonb, ${session.user_id})
      ON CONFLICT (organization_id) DO UPDATE SET
        config = ${JSON.stringify(merged)}::jsonb,
        updated_by = ${session.user_id},
        updated_at = NOW()
      RETURNING config, updated_at
    `

    return c.json({
      success: true,
      config: result.config,
      updated_at: result.updated_at,
    })
  } catch (err: any) {
    console.error('PUT /api/ai-config error:', err?.message)
    return c.json({ error: 'Failed to update AI config' }, 500)
  }
})
