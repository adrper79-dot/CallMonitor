/**
 * AI Config Routes - Manage AI agent configuration (real DB)
 *
 * Endpoints:
 *   GET /  - Get AI config for org
 *   PUT /  - Update AI config for org
 *
 * P2-2: Uses centralized getDb() — no inline neon imports
 * H1: Zod-validated request bodies via validateBody()
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { UpdateAIConfigSchema } from '../lib/schemas'
import { logger } from '../lib/logger'

export const aiConfigRoutes = new Hono<{ Bindings: Env }>()

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

async function ensureTable(db: ReturnType<typeof getDb>) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL UNIQUE,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

// GET / — Get AI configuration
aiConfigRoutes.get('/', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    await ensureTable(db)

    const result = await db.query(
      `SELECT config, updated_at
       FROM ai_configs
       WHERE organization_id = $1`,
      [session.organization_id]
    )

    const config =
      result.rows.length > 0
        ? { ...DEFAULT_CONFIG, ...result.rows[0].config }
        : { ...DEFAULT_CONFIG }

    return c.json({
      success: true,
      config,
      updated_at: result.rows[0]?.updated_at || null,
    })
  } catch (err: any) {
    logger.error('GET /api/ai-config error', { error: err?.message })
    return c.json({ error: 'Failed to get AI config' }, 500)
  } finally {
    await db.end()
  }
})

// PUT / — Update AI configuration
aiConfigRoutes.put('/', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    await ensureTable(db)

    const parsed = await validateBody(c, UpdateAIConfigSchema)
    if (!parsed.success) return parsed.response
    const merged = { ...DEFAULT_CONFIG, ...parsed.data }

    const result = await db.query(
      `INSERT INTO ai_configs (organization_id, config, updated_by)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (organization_id) DO UPDATE SET
         config = $2::jsonb,
         updated_by = $3,
         updated_at = NOW()
       RETURNING config, updated_at`,
      [session.organization_id, JSON.stringify(merged), session.user_id]
    )

    return c.json({
      success: true,
      config: result.rows[0].config,
      updated_at: result.rows[0].updated_at,
    })
  } catch (err: any) {
    logger.error('PUT /api/ai-config error', { error: err?.message })
    return c.json({ error: 'Failed to update AI config' }, 500)
  } finally {
    await db.end()
  }
})
