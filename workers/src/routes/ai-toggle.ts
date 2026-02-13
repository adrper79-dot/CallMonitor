/**
 * AI Toggle Routes — Hybrid AI/Human call mode switching
 *
 * Routes:
 *   POST /activate           — Activate AI mode on a live call
 *   POST /deactivate         — Switch back to human mode (takeover)
 *   GET  /status/:callId     — Get current AI/human mode for a call
 *   PUT  /prompt-config      — Update org AI agent prompt configuration
 *   GET  /prompt-config      — Get org AI agent prompt configuration
 *
 * @see ARCH_DOCS/FEATURE_IMPLEMENTATION_PLAN.md — Phase 3
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth, requireRole } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { AIToggleSchema, AIPromptConfigSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { aiToggleRateLimit } from '../lib/rate-limit'
import { startAICall, stopAICall } from '../lib/ai-call-engine'

export const aiToggleRoutes = new Hono<AppEnv>()

// Activate AI mode on a live call
aiToggleRoutes.post('/activate', aiToggleRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, AIToggleSchema)
  if (!parsed.success) return parsed.response

  if (parsed.data.mode !== 'ai') {
    return c.json({ error: 'Use /deactivate to switch to human mode' }, 400)
  }

  const db = getDb(c.env, session.organization_id)
  try {
    // Find the call and its control ID
    const callResult = await db.query(
      `SELECT c.id, c.call_control_id, c.status,
              vc.ai_agent_prompt, vc.ai_agent_model, vc.ai_agent_temperature,
              vc.ai_features_enabled
       FROM calls c
       LEFT JOIN voice_configs vc ON vc.organization_id = c.organization_id
       WHERE c.id = $1 AND c.organization_id = $2
       LIMIT 1`,
      [parsed.data.call_id, session.organization_id]
    )

    if (callResult.rows.length === 0) {
      return c.json({ error: 'Call not found' }, 404)
    }

    const call = callResult.rows[0]

    if (!call.call_control_id) {
      return c.json({ error: 'No call control ID — call may not be active' }, 400)
    }

    if (!call.ai_features_enabled) {
      return c.json({ error: 'AI features are not enabled for this organization' }, 403)
    }

    const prompt =
      call.ai_agent_prompt ||
      'You are a helpful call center assistant. Be concise and professional.'

    await startAICall(c.env, db, call.call_control_id, call.id, session.organization_id, {
      prompt,
      model: call.ai_agent_model || 'gpt-4o-mini',
      temperature: call.ai_agent_temperature ?? 0.3,
    })

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      action: AuditAction.AI_MODE_ACTIVATED,
      resourceType: 'call',
      resourceId: call.id,
      oldValue: { mode: 'human' },
      newValue: { mode: 'ai', model: call.ai_agent_model || 'gpt-4o-mini' },
    })

    return c.json({ success: true, mode: 'ai', call_id: call.id })
  } catch (err: any) {
    logger.error('POST /api/ai-toggle/activate error', { error: err?.message })
    return c.json({ error: 'Failed to activate AI mode' }, 500)
  } finally {
    await db.end()
  }
})

// Deactivate AI mode — human takeover
aiToggleRoutes.post('/deactivate', aiToggleRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, AIToggleSchema)
  if (!parsed.success) return parsed.response

  const db = getDb(c.env, session.organization_id)
  try {
    const callResult = await db.query(
      `SELECT id, call_control_id FROM calls
       WHERE id = $1 AND organization_id = $2`,
      [parsed.data.call_id, session.organization_id]
    )

    if (callResult.rows.length === 0) {
      return c.json({ error: 'Call not found' }, 404)
    }

    const call = callResult.rows[0]

    if (call.call_control_id) {
      await stopAICall(c.env, call.call_control_id)
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      action: AuditAction.AI_MODE_HUMAN_TAKEOVER,
      resourceType: 'call',
      resourceId: call.id,
      oldValue: { mode: 'ai' },
      newValue: { mode: 'human', reason: parsed.data.reason },
    })

    return c.json({ success: true, mode: 'human', call_id: call.id })
  } catch (err: any) {
    logger.error('POST /api/ai-toggle/deactivate error', { error: err?.message })
    return c.json({ error: 'Failed to deactivate AI mode' }, 500)
  } finally {
    await db.end()
  }
})

// Get AI/human mode status for a call
aiToggleRoutes.get('/status/:callId', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const callId = c.req.param('callId')

  const db = getDb(c.env, session.organization_id)
  try {
    const callResult = await db.query(
      `SELECT id, call_control_id, status FROM calls
       WHERE id = $1 AND organization_id = $2`,
      [callId, session.organization_id]
    )

    if (callResult.rows.length === 0) {
      return c.json({ error: 'Call not found' }, 404)
    }

    const call = callResult.rows[0]

    // Check KV for AI state
    let aiActive = false
    if (call.call_control_id && c.env.KV) {
      try {
        const stateRaw = await c.env.KV.get(`AI_CALL_STATE:${call.call_control_id}`)
        aiActive = !!stateRaw
      } catch {
        // KV read failure is non-critical — default to human mode
      }
    }

    return c.json({
      success: true,
      call_id: call.id,
      mode: aiActive ? 'ai' : 'human',
      call_status: call.status,
    })
  } catch (err: any) {
    logger.error('GET /api/ai-toggle/status error', { error: err?.message })
    return c.json({ error: 'Failed to get AI mode status' }, 500)
  } finally {
    await db.end()
  }
})

// Update AI prompt configuration
aiToggleRoutes.put('/prompt-config', aiToggleRateLimit, async (c) => {
  const session = await requireRole(c, 'manager')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, AIPromptConfigSchema)
  if (!parsed.success) return parsed.response

  const db = getDb(c.env, session.organization_id)
  try {
    const { ai_agent_prompt, ai_agent_model, ai_agent_temperature, ai_features_enabled } =
      parsed.data

    const result = await db.query(
      `UPDATE voice_configs
       SET ai_agent_prompt = $2,
           ai_agent_model = $3,
           ai_agent_temperature = $4,
           ai_features_enabled = $5,
           updated_at = NOW()
       WHERE organization_id = $1
       RETURNING ai_agent_prompt, ai_agent_model, ai_agent_temperature, ai_features_enabled`,
      [
        session.organization_id,
        ai_agent_prompt,
        ai_agent_model,
        ai_agent_temperature,
        ai_features_enabled,
      ]
    )

    if (result.rows.length === 0) {
      // Insert if not exists
      await db.query(
        `INSERT INTO voice_configs (organization_id, ai_agent_prompt, ai_agent_model, ai_agent_temperature, ai_features_enabled)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          session.organization_id,
          ai_agent_prompt,
          ai_agent_model,
          ai_agent_temperature,
          ai_features_enabled,
        ]
      )
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      action: AuditAction.AI_SCRIPT_EXECUTED,
      resourceType: 'voice_configs',
      resourceId: session.organization_id,
      oldValue: null,
      newValue: parsed.data,
    })

    return c.json({ success: true, config: parsed.data })
  } catch (err: any) {
    logger.error('PUT /api/ai-toggle/prompt-config error', { error: err?.message })
    return c.json({ error: 'Failed to update AI prompt config' }, 500)
  } finally {
    await db.end()
  }
})

// Get AI prompt configuration
aiToggleRoutes.get('/prompt-config', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const result = await db.query(
      `SELECT ai_agent_prompt, ai_agent_model, ai_agent_temperature,
              ai_features_enabled, ai_agent_id
       FROM voice_configs
       WHERE organization_id = $1
       LIMIT 1`,
      [session.organization_id]
    )

    const config = result.rows[0] || {
      ai_agent_prompt: '',
      ai_agent_model: 'gpt-4o-mini',
      ai_agent_temperature: 0.3,
      ai_features_enabled: false,
    }

    return c.json({ success: true, config })
  } catch (err: any) {
    logger.error('GET /api/ai-toggle/prompt-config error', { error: err?.message })
    return c.json({ error: 'Failed to get AI prompt config' }, 500)
  } finally {
    await db.end()
  }
})

