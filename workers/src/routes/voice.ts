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
      WHERE organization_id = ${session.organization_id}
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

    // Use neon client
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    // Get voice config from database
    const result = await sql`
      SELECT * FROM voice_configs 
      WHERE organization_id = ${session.organization_id}
      ORDER BY updated_at DESC 
      LIMIT 1
    `

    const config = result[0] || {
      record: false,
      transcribe: false,
      translate: false,
      survey: false,
      synthetic_caller: false
    }

    return c.json({
      success: true,
      config
    })
  } catch (err: any) {
    console.error('GET /api/voice/config error:', err)
    return c.json({ error: 'Failed to get voice config' }, 500)
  }
})

// Update voice configuration
voiceRoutes.put('/config', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const body = await c.req.json()
    const { orgId, modulations } = body

    if (!orgId || orgId !== session.organization_id) {
      return c.json({ error: 'Invalid organization' }, 400)
    }

    // Use neon client
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    // Check if voice_configs table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'voice_configs'
      ) as exists
    `

    if (!tableCheck[0].exists) {
      console.warn('Voice configs table does not exist, creating...')
      await sql`
        CREATE TABLE voice_configs (
          id SERIAL PRIMARY KEY,
          organization_id UUID NOT NULL UNIQUE,
          record BOOLEAN DEFAULT false,
          transcribe BOOLEAN DEFAULT false,
          translate BOOLEAN DEFAULT false,
          translate_from TEXT,
          translate_to TEXT,
          survey BOOLEAN DEFAULT false,
          synthetic_caller BOOLEAN DEFAULT false,
          survey_id UUID,
          script_id UUID,
          use_voice_cloning BOOLEAN DEFAULT false,
          cloned_voice_id UUID,
          survey_prompts TEXT[],
          survey_question_types JSONB,
          survey_prompts_locales JSONB,
          survey_voice TEXT,
          survey_webhook_email TEXT,
          survey_inbound_number TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `
    }

    // Upsert voice config
    const result = await sql`
      INSERT INTO voice_configs (
        organization_id, record, transcribe, translate, translate_from, translate_to,
        survey, synthetic_caller, survey_id, script_id, use_voice_cloning, cloned_voice_id,
        survey_prompts, survey_question_types, survey_prompts_locales, survey_voice,
        survey_webhook_email, survey_inbound_number, updated_at
      ) VALUES (
        ${session.organization_id}, 
        ${modulations.record ?? false}, 
        ${modulations.transcribe ?? false}, 
        ${modulations.translate ?? false}, 
        ${modulations.translate_from}, 
        ${modulations.translate_to}, 
        ${modulations.survey ?? false}, 
        ${modulations.synthetic_caller ?? false}, 
        ${modulations.survey_id}, 
        ${modulations.script_id}, 
        ${modulations.use_voice_cloning ?? false}, 
        ${modulations.cloned_voice_id}, 
        ${modulations.survey_prompts}, 
        ${modulations.survey_question_types}, 
        ${modulations.survey_prompts_locales}, 
        ${modulations.survey_voice}, 
        ${modulations.survey_webhook_email}, 
        ${modulations.survey_inbound_number}, 
        NOW()
      )
      ON CONFLICT (organization_id) 
      DO UPDATE SET
        record = EXCLUDED.record,
        transcribe = EXCLUDED.transcribe,
        translate = EXCLUDED.translate,
        translate_from = EXCLUDED.translate_from,
        translate_to = EXCLUDED.translate_to,
        survey = EXCLUDED.survey,
        synthetic_caller = EXCLUDED.synthetic_caller,
        survey_id = EXCLUDED.survey_id,
        script_id = EXCLUDED.script_id,
        use_voice_cloning = EXCLUDED.use_voice_cloning,
        cloned_voice_id = EXCLUDED.cloned_voice_id,
        survey_prompts = EXCLUDED.survey_prompts,
        survey_question_types = EXCLUDED.survey_question_types,
        survey_prompts_locales = EXCLUDED.survey_prompts_locales,
        survey_voice = EXCLUDED.survey_voice,
        survey_webhook_email = EXCLUDED.survey_webhook_email,
        survey_inbound_number = EXCLUDED.survey_inbound_number,
        updated_at = NOW()
      RETURNING *
    `

    return c.json({
      success: true,
      config: result[0]
    })
  } catch (err: any) {
    console.error('PUT /api/voice/config error:', err)
    return c.json({ error: 'Failed to update voice config' }, 500)
  }
})

// Place a voice call via Telnyx Call Control API
voiceRoutes.post('/call', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const body = await c.req.json()
    const { to_number, from_number, organization_id, target_id, campaign_id, modulations, flow_type } = body

    if (organization_id !== session.organization_id) {
      return c.json({ error: 'Invalid organization' }, 400)
    }

    // Resolve the target number
    let destinationNumber = to_number
    if (!destinationNumber && target_id) {
      const { neon } = await import('@neondatabase/serverless')
      const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
      const sql = neon(connectionString)
      const targets = await sql`SELECT phone_number FROM voice_targets WHERE id = ${target_id} AND organization_id = ${session.organization_id}`
      if (targets.length === 0) {
        return c.json({ error: 'Target not found' }, 404)
      }
      destinationNumber = targets[0].phone_number
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
    console.log(`[Voice] Creating call: ${callerNumber} -> ${destinationNumber}, flow: ${flow_type || 'direct'}`)

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
        'Authorization': `Bearer ${c.env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(callPayload),
    })

    if (!callResponse.ok) {
      const errorText = await callResponse.text()
      console.error('[Voice] Telnyx call creation failed:', callResponse.status, errorText)
      let errorMessage = 'Failed to create call'
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.errors?.[0]?.detail || errorJson.message || errorText
      } catch {
        errorMessage = errorText
      }
      return c.json({ error: errorMessage }, 500)
    }

    const callData = await callResponse.json() as any
    const telnyxCallId = callData.data?.call_control_id || callData.data?.id

    // Insert call record into database
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    // Check if calls table exists, create basic record
    const callRecord = await sql`
      INSERT INTO calls (
        organization_id, 
        created_by, 
        status, 
        call_sid,
        started_at,
        created_at
      ) VALUES (
        ${session.organization_id},
        ${session.user_id},
        'initiating',
        ${telnyxCallId},
        NOW(),
        NOW()
      )
      RETURNING id
    `

    const callId = callRecord[0]?.id

    console.log(`[Voice] Call created: ${callId} (telnyx: ${telnyxCallId})`)

    return c.json({
      success: true,
      call_id: callId,
      telnyx_call_id: telnyxCallId,
      to: destinationNumber,
      from: callerNumber,
      flow_type: flow_type || 'direct',
    })
  } catch (err: any) {
    console.error('POST /api/voice/call error:', err)
    return c.json({ error: err.message || 'Failed to place call' }, 500)
  }
})

// Create voice target
voiceRoutes.post('/targets', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const body = await c.req.json()
    const { organization_id, phone_number, name } = body

    if (!phone_number) {
      return c.json({ error: 'Phone number required' }, 400)
    }

    if (organization_id !== session.organization_id) {
      return c.json({ error: 'Invalid organization' }, 400)
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
      console.warn('Voice targets table does not exist, creating...')
      await sql`
        CREATE TABLE voice_targets (
          id SERIAL PRIMARY KEY,
          organization_id UUID NOT NULL,
          phone_number TEXT NOT NULL,
          name TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `
    }

    // Insert new target
    const result = await sql`
      INSERT INTO voice_targets (organization_id, phone_number, name)
      VALUES (${session.organization_id}, ${phone_number}, ${name})
      RETURNING *
    `

    return c.json({
      success: true,
      target: result[0]
    })
  } catch (err: any) {
    console.error('POST /api/voice/targets error:', err)
    return c.json({ error: 'Failed to create voice target' }, 500)
  }
})

// Delete voice target
voiceRoutes.delete('/targets/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const targetId = c.req.param('id')

    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    const result = await sql`
      DELETE FROM voice_targets
      WHERE id = ${targetId} AND organization_id = ${session.organization_id}
      RETURNING id
    `

    if (result.length === 0) {
      return c.json({ error: 'Target not found' }, 404)
    }

    return c.json({ success: true, message: 'Target deleted' })
  } catch (err: any) {
    console.error('DELETE /api/voice/targets/:id error:', err)
    return c.json({ error: 'Failed to delete voice target' }, 500)
  }
})