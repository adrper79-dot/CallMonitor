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
import { voiceRateLimit, telnyxVoiceRateLimit } from '../lib/rate-limit'
import { getTranslationConfig } from '../lib/translation-processor'

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

    // Map DB column live_translate (boolean) → frontend translate_mode ('live'|'post_call')
    const enrichedConfig = {
      ...config,
      translate_mode: config.live_translate ? 'live' : 'post_call',
    }

    return c.json({
      success: true,
      config: enrichedConfig,
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
    // Map frontend translate_mode ('live'|'post_call') → DB live_translate (boolean)
    if (modulations.translate_mode !== undefined) {
      setClauses.push(`live_translate = $${paramIndex++}`)
      values.push(modulations.translate_mode === 'live')
    }
    if (modulations.live_translate !== undefined) {
      setClauses.push(`live_translate = $${paramIndex++}`)
      values.push(modulations.live_translate)
    }
    if (modulations.voice_to_voice !== undefined) {
      setClauses.push(`voice_to_voice = $${paramIndex++}`)
      values.push(modulations.voice_to_voice)
    }
    if (modulations.elevenlabs_voice_id !== undefined) {
      setClauses.push(`elevenlabs_voice_id = $${paramIndex++}`)
      values.push(modulations.elevenlabs_voice_id)
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
          survey, synthetic_caller, use_voice_cloning, voice_to_voice, elevenlabs_voice_id, updated_at
        ) VALUES ($1, false, false, false, NULL, NULL, false, false, false, false, NULL, NOW())
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
      newValue: modulations,
    })

    // Map live_translate boolean back to translate_mode for frontend
    const responseConfig = result.rows[0]
      ? {
          ...result.rows[0],
          translate_mode: result.rows[0].live_translate ? 'live' : 'post_call',
        }
      : {}

    return c.json({
      success: true,
      config: responseConfig,
    })
  } catch (err: any) {
    logger.error('PUT /api/voice/config error', { error: err?.message })
    return c.json({ error: 'Failed to update voice config' }, 500)
  } finally {
    await db.end()
  }
})

// Place a voice call via Telnyx Call Control API
voiceRoutes.post('/call', telnyxVoiceRateLimit, voiceRateLimit, async (c) => {
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

    logger.info('POST /api/voice/call request', {
      to_number: to_number || '(empty)',
      from_number: from_number || '(empty)',
      target_id: target_id || '(empty)',
      flow_type: flow_type || '(empty)',
      has_modulations: !!modulations,
    })

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
      logger.warn('No destination number - to_number and target_id both empty', {
        to_number: to_number || '(empty)',
        target_id: target_id || '(empty)',
        from_number: from_number || '(empty)',
      })
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

    if (!c.env.TELNYX_CALL_CONTROL_APP_ID) {
      return c.json(
        { error: 'Telnyx Call Control Application ID not configured (TELNYX_CALL_CONTROL_APP_ID)' },
        500
      )
    }

    // Use Telnyx Call Control API to create the call
    logger.info('Creating call', {
      flow_type: flow_type || 'direct',
      appId: c.env.TELNYX_CALL_CONTROL_APP_ID?.slice(0, 8) + '...',
      destination: destinationNumber,
    })

    const callPayload: Record<string, any> = {
      connection_id: c.env.TELNYX_CALL_CONTROL_APP_ID,
      to: destinationNumber,
      from: callerNumber,
      answering_machine_detection: 'detect',
      answering_machine_detection_config: {
        after_greeting_silence_millis: 800,
        greeting_duration_millis: 3500,
        total_analysis_time_millis: 5000,
      },
    }

    // Get voice config to determine recording and transcription settings
    const voiceConfigResult = await db.query(
      `SELECT record, transcribe, translate, translate_from, translate_to, live_translate, voice_to_voice
       FROM voice_configs
       WHERE organization_id = $1
       LIMIT 1`,
      [session.organization_id]
    )
    const voiceConfig = voiceConfigResult.rows[0]

    // Enable recording if configured
    if (voiceConfig?.record) {
      callPayload.record = 'record-from-answer'
      callPayload.record_channels = 'dual'
      callPayload.record_format = 'mp3'
      logger.info('Call recording enabled (dual-channel)')
    }

    // Enable transcription for live translation, voice-to-voice, OR regular transcription
    const enableTranscription =
      voiceConfig?.live_translate || voiceConfig?.voice_to_voice || voiceConfig?.transcribe
    if (enableTranscription) {
      callPayload.transcription = true
      callPayload.transcription_config = {
        transcription_engine: 'B',
        transcription_tracks: 'both',
      }
      logger.info('Transcription enabled for voice call', {
        live_translate: voiceConfig?.live_translate,
        voice_to_voice: voiceConfig?.voice_to_voice,
        transcribe: voiceConfig?.transcribe,
      })
    }

    // If bridge call, the from_number is the agent's phone that gets called first
    if (flow_type === 'bridge' && from_number) {
      // Validate from_number E.164 format for bridge calls
      if (!/^\+[1-9]\d{1,14}$/.test(from_number)) {
        return c.json(
          {
            error: `Invalid from_number format for bridge call (must be E.164): ${from_number}`,
          },
          400
        )
      }
      // For bridge calls: call the agent first, webhook will bridge to customer on answer
      callPayload.to = from_number // Call the agent's phone first
      // Disable AMD for bridge calls — we're calling a known agent, not an unknown number.
      // AMD 'detect' mode delays the call.answered webhook which breaks the bridge flow.
      delete callPayload.answering_machine_detection
      logger.info('Bridge call: calling agent first (AMD disabled)', {
        agentNumber: from_number,
        customerNumber: destinationNumber,
      })
    }

    // Add webhook URL for call status updates
    const webhookUrl = c.env.API_BASE_URL || 'https://wordisbond-api.adrper79.workers.dev'
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
      const status = callResponse.status

      // Handle Telnyx rate limiting
      if (status === 429) {
        logger.warn('Telnyx rate limit exceeded', {
          endpoint: '/v2/calls',
          appId: c.env.TELNYX_CALL_CONTROL_APP_ID?.slice(0, 8) + '...',
        })
        return c.json(
          {
            error: 'Call service rate limit exceeded. Please try again in 1 minute.',
            code: 'TELNYX_RATE_LIMIT',
            retry_after: 60,
          },
          429
        )
      }

      // Handle insufficient balance or account issues
      if (status === 402) {
        logger.error('Telnyx account payment issue', {
          response: errorText.slice(0, 200),
        })
        return c.json(
          {
            error: 'Voice service temporarily unavailable. Please contact support.',
            code: 'TELNYX_PAYMENT_REQUIRED',
          },
          503
        )
      }

      logger.error('Telnyx call creation failed', {
        status: callResponse.status,
        appId: c.env.TELNYX_CALL_CONTROL_APP_ID?.slice(0, 8) + '...',
        response: errorText.slice(0, 300),
      })
      let errorMessage = 'Failed to create call'
      try {
        const errorJson = JSON.parse(errorText)
        const detail = errorJson.errors?.[0]?.detail || errorJson.message || errorText
        // Add guidance if connection_id is the problem
        if (detail.includes('connection_id') || detail.includes('Call Control App')) {
          errorMessage = `Invalid TELNYX_CALL_CONTROL_APP_ID — verify the Application ID in Telnyx Portal > Call Control > Applications. Current ID starts with: ${c.env.TELNYX_CALL_CONTROL_APP_ID?.slice(0, 8)}...`
        } else {
          errorMessage = detail
        }
      } catch {
        errorMessage = errorText
      }
      return c.json({ error: errorMessage }, 500)
    }

    const callData = (await callResponse.json()) as any
    const telnyxCallControlId = callData.data?.call_control_id
    const telnyxCallSessionId = callData.data?.call_session_id || callData.data?.id

    // Insert call record into database
    // Check if calls table exists, create basic record
    const callRecord = await db.query(
      `INSERT INTO calls (
        organization_id, 
        created_by, 
        status, 
        call_sid,
        call_control_id,
        to_number,
        from_number,
        caller_id_used,
        flow_type,
        started_at,
        amd_status,
        created_at
      ) VALUES (
        $1, $2, 'initiating', $3, $4, $5, $6, $7, $8, NOW(), NULL, NOW()
      )
      RETURNING id`,
      [
        session.organization_id,
        session.user_id,
        telnyxCallSessionId,
        telnyxCallControlId,
        destinationNumber,
        from_number || null,
        callerNumber,
        flow_type || 'direct',
      ]
    )

    const callId = callRecord.rows[0]?.id

    logger.info('Call created', { callId, telnyxCallControlId })

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'calls',
      resourceId: callId,
      action: AuditAction.CALL_STARTED,
      newValue: {
        to: destinationNumber,
        from: callerNumber,
        telnyx_call_id: telnyxCallControlId,
        flow_type: flow_type || 'direct',
      },
    })

    return c.json({
      success: true,
      call_id: callId,
      telnyx_call_id: telnyxCallControlId,
      to: destinationNumber,
      from: callerNumber,
      flow_type: flow_type || 'direct',
    })
  } catch (err: any) {
    logger.error('POST /api/voice/call error', { error: err?.message, stack: err?.stack })
    return c.json({ error: err?.message || 'Failed to place call' }, 500)
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
      newValue: { phone_number, name },
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
      oldValue: result.rows[0],
    })

    return c.json({ success: true, message: 'Target deleted' })
  } catch (err: any) {
    logger.error('DELETE /api/voice/targets/:id error', { error: err?.message })
    return c.json({ error: 'Failed to delete voice target' }, 500)
  } finally {
    await db.end()
  }
})
