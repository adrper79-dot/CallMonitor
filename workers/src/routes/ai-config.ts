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
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { UpdateAIConfigSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { aiConfigRateLimit } from '../lib/rate-limit'

export const aiConfigRoutes = new Hono<AppEnv>()

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

// GET / — Get AI configuration
aiConfigRoutes.get('/', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

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
aiConfigRoutes.put('/', aiConfigRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

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

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'ai_config',
      resourceId: session.organization_id,
      action: AuditAction.AI_CONFIG_UPDATED,
      newValue: result.rows[0].config,
    })

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

