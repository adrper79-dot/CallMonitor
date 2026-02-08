/**
 * Voice Routes - Voice configuration and capabilities
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { VoiceConfigSchema, CreateCallSchema, VoiceTargetSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { voiceRateLimit } from '../lib/rate-limit'

export const voiceRoutes = new Hono<AppEnv>()

// Get voice targets
voiceRoutes.get('/targets', async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const db = getDb(c.env)
  try {
    const result = await db.query(
      `SELECT *
       FROM voice_targets
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [session.organization_id]
    )

    return c.json({
      success: true,
      targets: result.rows,
    })
  } catch (err: any) {
    logger.error('GET /api/voice/targets error', { error: err?.message })
    return c.json({ error: 'Failed to get voice targets' }, 500)
  } finally {
    await db.end()
  }
})

// Get voice configuration
voiceRoutes.get('/config', async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const db = getDb(c.env)
  try {
    // Get voice config from database
    const result = await db.query(
      `SELECT * FROM voice_configs 
       WHERE organization_id = $1
       ORDER BY updated_at DESC 
       LIMIT 1`,
      [session.organization_id]
    )

    const config = result.rows[0] || {
      record: false,
      transcribe: false,
      translate: false,
      survey: false,
      synthetic_caller: false,
    }

    return c.json({
      success: true,
      config,
    })
  } catch (err: any) {
    logger.error('GET /api/voice/config error', { error: err?.message })
    return c.json({ error: 'Failed to get voice config' }, 500)
  } finally {
    await db.end()
  }
})

// Update voice configuration
voiceRoutes.put('/config', voiceRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const db = getDb(c.env)
  try {
    const parsed = await validateBody(c, VoiceConfigSchema)
    if (!parsed.success) return parsed.response
    const { orgId, modulations } = parsed.data

    // Accept orgId from body but fall back to session — frontend always sends orgId
    const effectiveOrgId = orgId || session.organization_id
    if (!effectiveOrgId || (orgId && orgId !== session.organization_id)) {
      return c.json({ error: 'Invalid organization' }, 400)
    }

    // If no modulations provided, nothing to update
    if (!modulations || Object.keys(modulations).length === 0) {
      const existing = await db.query(
        'SELECT * FROM voice_configs WHERE organization_id = $1 LIMIT 1',
        [session.organization_id]
      )
      return c.json({ success: true, config: existing.rows[0] || {} })
    }

    // Build dynamic SET clause — only update fields that were explicitly sent
    const setClauses: string[] = []
    const values: any[] = [session.organization_id]
    let paramIndex = 2

    if (modulations.record !== undefined) {
      setClauses.push(`record = $${paramIndex++}`)
      values.push(modulations.record)
    }
    if (modulations.transcribe !== undefined) {
      setClauses.push(`transcribe = $${paramIndex++}`)
      values.push(modulations.transcribe)
    }
    if (modulations.translate !== undefined) {
      setClauses.push(`translate = $${paramIndex++}`)
      values.push(modulations.translate)
    }
    if (modulations.translate_from !== undefined) {
      setClauses.push(`translate_from = $${paramIndex++}`)
      values.push(modulations.translate_from)
    }
    if (modulations.translate_to !== undefined) {
      setClauses.push(`translate_to = $${paramIndex++}`)
      values.push(modulations.translate_to)
    }
    if (modulations.survey !== undefined) {
      setClauses.push(`survey = $${paramIndex++}`)
      values.push(modulations.survey)
    }
    if (modulations.synthetic_caller !== undefined) {
      setClauses.push(`synthetic_caller = $${paramIndex++}`)
      values.push(modulations.synthetic_caller)
    }
    if (modulations.use_voice_cloning !== undefined) {
      setClauses.push(`use_voice_cloning = $${paramIndex++}`)
      values.push(modulations.use_voice_cloning)
    }

    let result
    if (setClauses.length === 0) {
      // No known fields changed — return existing config
      result = await db.query('SELECT * FROM voice_configs WHERE organization_id = $1 LIMIT 1', [
        session.organization_id,
      ])
    } else {
      // Upsert: INSERT with defaults, UPDATE only the sent fields
      result = await db.query(
        `INSERT INTO voice_configs (
          organization_id, record, transcribe, translate, translate_from, translate_to,
          survey, synthetic_caller, use_voice_cloning, updated_at
        ) VALUES ($1, false, false, false, NULL, NULL, false, false, false, NOW())
        ON CONFLICT (organization_id)
        DO UPDATE SET ${setClauses.join(', ')}, updated_at = NOW()
        RETURNING *`,
        values
      )
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'voice_configs',
      resourceId: session.organization_id,
      action: AuditAction.VOICE_CONFIG_UPDATED,
      after: modulations,
    })

    return c.json({
      success: true,
      config: result.rows[0],
    })
  } catch (err: any) {
    logger.error('PUT /api/voice/config error', { error: err?.message })
    return c.json({ error: 'Failed to update voice config' }, 500)
  } finally {
    await db.end()
  }
})

// Place a voice call via Telnyx Call Control API
voiceRoutes.post('/call', voiceRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const db = getDb(c.env)
  try {
    const parsed = await validateBody(c, CreateCallSchema)
    if (!parsed.success) return parsed.response
    const {
      to_number,
      from_number,
      organization_id,
      target_id,
      campaign_id,
      modulations,
      flow_type,
    } = parsed.data

    if (organization_id && organization_id !== session.organization_id) {
      return c.json({ error: 'Invalid organization' }, 400)
    }

    // Resolve the target number
    let destinationNumber = to_number
    if (!destinationNumber && target_id) {
      const targets = await db.query(
        'SELECT phone_number FROM voice_targets WHERE id = $1 AND organization_id = $2',
        [target_id, session.organization_id]
      )
      if (targets.rows.length === 0) {
        return c.json({ error: 'Target not found' }, 404)
      }
      destinationNumber = targets.rows[0].phone_number
    }

    if (!destinationNumber) {
      return c.json({ error: 'No destination number specified' }, 400)
    }

    // Validate E.164 format
    if (!/^\+[1-9]\d{1,14}$/.test(destinationNumber)) {
      return c.json({ error: 'Invalid phone number format (must be E.164)' }, 400)
    }

    const callerNumber = c.env.TELNYX_NUMBER
    if (!callerNumber) {
      return c.json({ error: 'Telnyx caller number not configured' }, 500)
    }

    if (!c.env.TELNYX_API_KEY) {
      return c.json({ error: 'Telnyx API key not configured' }, 500)
    }

    // Use Telnyx Call Control API to create the call
    logger.info('Creating call', { flow_type: flow_type || 'direct' })

    const callPayload: Record<string, any> = {
      connection_id: c.env.TELNYX_CONNECTION_ID,
      to: destinationNumber,
      from: callerNumber,
      answering_machine_detection: 'detect',
    }

    // If bridge call, the from_number is the agent's phone that gets called first
    if (flow_type === 'bridge' && from_number) {
      // For bridge calls: call the agent first, then bridge to the target
      callPayload.to = from_number // Call the agent's phone first
      callPayload.custom_headers = [
        { name: 'X-Bridge-To', value: destinationNumber },
        { name: 'X-Flow-Type', value: 'bridge' },
      ]
    }

    // Add webhook URL for call status updates
    const webhookUrl = c.env.NEXT_PUBLIC_APP_URL || 'https://wordisbond-api.adrper79.workers.dev'
    callPayload.webhook_url = `${webhookUrl}/api/webhooks/telnyx`
    callPayload.webhook_url_method = 'POST'

    const callResponse = await fetch('https://api.telnyx.com/v2/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(callPayload),
    })

    if (!callResponse.ok) {
      const errorText = await callResponse.text()
      logger.error('Telnyx call creation failed', { status: callResponse.status })
      let errorMessage = 'Failed to create call'
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.errors?.[0]?.detail || errorJson.message || errorText
      } catch {
        errorMessage = errorText
      }
      return c.json({ error: errorMessage }, 500)
    }

    const callData = (await callResponse.json()) as any
    const telnyxCallId = callData.data?.call_control_id || callData.data?.id

    // Insert call record into database
    // Check if calls table exists, create basic record
    const callRecord = await db.query(
      `INSERT INTO calls (
        organization_id, 
        created_by, 
        status, 
        call_sid,
        started_at,
        created_at
      ) VALUES (
        $1, $2, 'initiating', $3, NOW(), NOW()
      )
      RETURNING id`,
      [session.organization_id, session.user_id, telnyxCallId]
    )

    const callId = callRecord.rows[0]?.id

    logger.info('Call created', { callId, telnyxCallId })

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'calls',
      resourceId: callId,
      action: AuditAction.CALL_STARTED,
      after: {
        to: destinationNumber,
        telnyx_call_id: telnyxCallId,
        flow_type: flow_type || 'direct',
      },
    })

    return c.json({
      success: true,
      call_id: callId,
      telnyx_call_id: telnyxCallId,
      to: destinationNumber,
      from: callerNumber,
      flow_type: flow_type || 'direct',
    })
  } catch (err: any) {
    logger.error('POST /api/voice/call error', { error: err?.message })
    return c.json({ error: 'Failed to place call' }, 500)
  } finally {
    await db.end()
  }
})

// Create voice target
voiceRoutes.post('/targets', voiceRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const db = getDb(c.env)
  try {
    const parsed = await validateBody(c, VoiceTargetSchema)
    if (!parsed.success) return parsed.response
    const { organization_id, phone_number, name } = parsed.data

    // Accept organization_id from body but verify against session
    if (organization_id && organization_id !== session.organization_id) {
      return c.json({ error: 'Invalid organization' }, 400)
    }

    // Insert new target
    const result = await db.query(
      `INSERT INTO voice_targets (organization_id, phone_number, name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [session.organization_id, phone_number, name]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'voice_targets',
      resourceId: result.rows[0].id,
      action: AuditAction.VOICE_TARGET_CREATED,
      after: { phone_number, name },
    })

    return c.json({
      success: true,
      target: result.rows[0],
    })
  } catch (err: any) {
    logger.error('POST /api/voice/targets error', { error: err?.message })
    return c.json({ error: 'Failed to create voice target' }, 500)
  } finally {
    await db.end()
  }
})

// Delete voice target
voiceRoutes.delete('/targets/:id', voiceRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const db = getDb(c.env)
  try {
    const targetId = c.req.param('id')

    const result = await db.query(
      `DELETE FROM voice_targets
       WHERE id = $1 AND organization_id = $2
       RETURNING id, phone_number, name`,
      [targetId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Target not found' }, 404)
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'voice_targets',
      resourceId: targetId,
      action: AuditAction.VOICE_TARGET_DELETED,
      before: result.rows[0],
    })

    return c.json({ success: true, message: 'Target deleted' })
  } catch (err: any) {
    logger.error('DELETE /api/voice/targets/:id error', { error: err?.message })
    return c.json({ error: 'Failed to delete voice target' }, 500)
  } finally {
    await db.end()
  }
})
