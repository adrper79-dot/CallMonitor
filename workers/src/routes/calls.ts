/**
 * Calls API Routes
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { getDb } from '../lib/db'
import { requireAuth, requireRole } from '../lib/auth'
import { isValidUUID } from '../lib/utils'
import { validateBody } from '../lib/validate'
import {
  StartCallSchema,
  CallOutcomeSchema,
  CallOutcomeUpdateSchema,
  GenerateSummarySchema,
  CallNoteSchema,
  DispositionSchema,
  ConfirmationSchema,
  EmailCallSchema,
} from '../lib/schemas'
import { logger } from '../lib/logger'
import { idempotent } from '../lib/idempotency'
import { writeAuditLog, AuditAction } from '../lib/audit'

export const callsRoutes = new Hono<{ Bindings: Env }>()

// List calls for organization
callsRoutes.get('/', async (c) => {
  try {
    // Authenticate
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const { organization_id, user_id } = session

    // Handle case where user has no organization
    if (!organization_id) {
      logger.info('User has no organization')
      return c.json({
        success: true,
        calls: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0,
        },
      })
    }

    // Parse query params
    const url = new URL(c.req.url)
    const status = url.searchParams.get('status')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const db = getDb(c.env)

    // Build query
    let sql = `
      SELECT 
        id, organization_id, system_id, status, started_at, ended_at, 
        created_by, call_sid, COUNT(*) OVER() as total_count
      FROM calls
      WHERE organization_id = $1
    `
    const params: any[] = [organization_id]

    if (status && status !== 'all') {
      if (status === 'active') {
        sql += ` AND status IN ('in_progress', 'ringing')`
      } else {
        sql += ` AND status = $${params.length + 1}`
        params.push(status)
      }
    }

    sql += ` ORDER BY started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await db.query(sql, params)
    const rows = result.rows || []

    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0
    const calls = rows.map((row: any) => {
      const { total_count, ...call } = row
      return call
    })

    return c.json({
      success: true,
      calls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err: any) {
    logger.error('GET /api/calls error', { error: err?.message })
    return c.json({ error: 'Failed to fetch calls' }, 500)
  }
})

// Get single call
callsRoutes.get('/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const callId = c.req.param('id')
    const db = getDb(c.env)

    const result = await db.query(`SELECT * FROM calls WHERE id = $1 AND organization_id = $2`, [
      callId,
      session.organization_id,
    ])

    if (!result.rows || result.rows.length === 0) {
      return c.json({ error: 'Call not found' }, 404)
    }

    return c.json({ success: true, call: result.rows[0] })
  } catch (err: any) {
    logger.error('GET /api/calls/:id error', { error: err?.message })
    return c.json({ error: 'Failed to fetch call' }, 500)
  }
})

// Start a new call
callsRoutes.post('/start', idempotent(), async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const parsed = await validateBody(c, StartCallSchema)
    if (!parsed.success) return parsed.response
    const { phone_number, caller_id, system_id } = parsed.data

    const db = getDb(c.env)

    // Create call record - matching actual schema columns
    // Schema has: id, organization_id, system_id, status, started_at, created_by, call_sid, caller_id_used
    const result = await db.query(
      `INSERT INTO calls (organization_id, system_id, status, started_at, created_by, caller_id_used)
       VALUES ($1, $2, 'pending', NOW(), $3, $4)
       RETURNING *`,
      [session.organization_id, system_id, session.user_id, caller_id || phone_number]
    )

    const call = result.rows[0]

    // Audit log: call initiated
    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'calls',
      resourceId: call.id,
      action: AuditAction.CALL_STARTED,
      after: { phone: caller_id || phone_number, system_id, status: 'pending' },
    })

    // TODO: Trigger actual call via Telnyx
    // This would be: await telnyxClient.calls.create({ ... })

    return c.json({ success: true, call }, 201)
  } catch (err: any) {
    logger.error('POST /api/calls/start error', { error: err?.message })
    return c.json({ error: 'Failed to start call' }, 500)
  }
})

// End a call
callsRoutes.post('/:id/end', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const callId = c.req.param('id')
    const db = getDb(c.env)

    const result = await db.query(
      `UPDATE calls 
       SET status = 'completed', ended_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [callId, session.organization_id]
    )

    if (!result.rows || result.rows.length === 0) {
      return c.json({ error: 'Call not found' }, 404)
    }

    const endedCall = result.rows[0]

    // Audit log: call ended
    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'calls',
      resourceId: callId,
      action: AuditAction.CALL_ENDED,
      after: { status: 'completed', ended_at: endedCall.ended_at },
    })

    // TODO: Trigger actual call hangup via Telnyx

    return c.json({ success: true, call: endedCall })
  } catch (err: any) {
    logger.error('POST /api/calls/:id/end error', { error: err?.message })
    return c.json({ error: 'Failed to end call' }, 500)
  }
})

// Validation schemas for outcomes
const VALID_OUTCOME_STATUSES = [
  'agreed',
  'declined',
  'partial',
  'inconclusive',
  'follow_up_required',
  'cancelled',
] as const

const VALID_CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'uncertain'] as const

const VALID_SUMMARY_SOURCES = ['human', 'ai_generated', 'ai_confirmed'] as const

// GET /api/calls/[id]/outcome
callsRoutes.get('/:id/outcome', async (c) => {
  try {
    const session = await requireRole(c, 'viewer')
    if (!session) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }

    const callId = c.req.param('id')
    const { organization_id } = session

    // Validate UUID format
    if (
      !callId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callId)
    ) {
      return c.json(
        { success: false, error: { code: 'INVALID_CALL_ID', message: 'Invalid call ID format' } },
        400
      )
    }

    const db = getDb(c.env)

    // Verify call belongs to organization
    const { rows: calls } = await db.query(
      `SELECT id FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, organization_id]
    )

    if (calls.length === 0) {
      return c.json(
        { success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } },
        404
      )
    }

    // Get outcome
    const { rows: outcomes } = await db.query(
      `SELECT
        o.id,
        o.call_id,
        o.outcome_status,
        o.confidence_level,
        o.agreed_items,
        o.declined_items,
        o.ambiguities,
        o.follow_up_actions,
        o.summary_text,
        o.summary_source,
        o.readback_confirmed,
        o.readback_timestamp,
        o.declared_by_user_id,
        o.revision_number,
        o.created_at,
        o.updated_at,
        json_build_object('email', u.email) as declared_by_user
       FROM call_outcomes o
       LEFT JOIN users u ON o.declared_by_user_id = u.id
       WHERE o.call_id = $1`,
      [callId]
    )
    const outcome = outcomes[0]

    // Get outcome history if outcome exists
    let history: any[] = []
    if (outcome) {
      const { rows: historyRows } = await db.query(
        `SELECT id, outcome_status, summary_text, revision_number, created_at, changed_by_user_id
         FROM call_outcome_history
         WHERE call_outcome_id = $1
         ORDER BY revision_number DESC
         LIMIT 10`,
        [outcome.id]
      )
      history = historyRows || []
    }

    return c.json({
      success: true,
      data: {
        call_id: callId,
        outcome: outcome || null,
        history,
        has_outcome: !!outcome,
      },
    })
  } catch (error: any) {
    if (error.code === '42P01') {
      // table undefined
      return c.json({
        success: true,
        data: {
          call_id: c.req.param('id'),
          outcome: null,
          history: [],
          has_outcome: false,
          message: 'Feature not configured',
        },
      })
    }
    logger.error('Outcome GET error', { error: error?.message })
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
      },
      500
    )
  }
})

// POST /api/calls/[id]/outcome
callsRoutes.post('/:id/outcome', async (c) => {
  try {
    const session = await requireRole(c, 'operator')
    if (!session) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }

    const callId = c.req.param('id')
    const { organization_id, user_id } = session

    // Validate UUID format
    if (
      !callId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callId)
    ) {
      return c.json(
        { success: false, error: { code: 'INVALID_CALL_ID', message: 'Invalid call ID format' } },
        400
      )
    }

    const db = getDb(c.env)

    // Parse + validate request body
    const parsed = await validateBody(c, CallOutcomeSchema)
    if (!parsed.success) return parsed.response
    const {
      outcome_status,
      confidence_level,
      agreed_items,
      declined_items,
      ambiguities,
      follow_up_actions,
      summary_text,
      summary_source,
      readback_confirmed,
    } = parsed.data

    // Verify call belongs to organization
    const { rows: calls } = await db.query(
      `SELECT id FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, organization_id]
    )
    if (calls.length === 0) {
      return c.json(
        { success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } },
        404
      )
    }

    // Check if outcome already exists
    const { rows: existingOutcomes } = await db.query(
      `SELECT id FROM call_outcomes WHERE call_id = $1`,
      [callId]
    )

    if (existingOutcomes.length > 0) {
      return c.json(
        {
          success: false,
          error: { code: 'OUTCOME_EXISTS', message: 'Outcome already exists. Use PUT to update.' },
        },
        409
      )
    }

    // Create outcome
    const { rows: newOutcomes } = await db.query(
      `INSERT INTO call_outcomes (
        call_id, organization_id, outcome_status, confidence_level, agreed_items, declined_items,
        ambiguities, follow_up_actions, summary_text, summary_source, readback_confirmed,
        readback_timestamp, declared_by_user_id, revision_number
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1)
       RETURNING *`,
      [
        callId,
        organization_id,
        outcome_status,
        confidence_level,
        JSON.stringify(agreed_items),
        JSON.stringify(declined_items),
        JSON.stringify(ambiguities),
        JSON.stringify(follow_up_actions),
        summary_text,
        summary_source,
        readback_confirmed,
        readback_confirmed ? new Date().toISOString() : null,
        user_id,
      ]
    )
    const outcome = newOutcomes[0]

    logger.info('Outcome declared', {
      callId,
      outcomeId: outcome.id,
      status: outcome_status,
    })

    // Audit log: outcome declared
    writeAuditLog(db, {
      organizationId: organization_id,
      userId: user_id,
      resourceType: 'call_outcomes',
      resourceId: outcome.id,
      action: AuditAction.CALL_OUTCOME_DECLARED,
      after: { call_id: callId, outcome_status, confidence_level },
    })

    return c.json(
      {
        success: true,
        data: {
          outcome,
          message: 'Outcome declared successfully',
        },
      },
      201
    )
  } catch (error: any) {
    logger.error('Outcome POST error', { error: error?.message })
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
      },
      500
    )
  }
})

// PUT /api/calls/[id]/outcome
callsRoutes.put('/:id/outcome', async (c) => {
  try {
    const session = await requireRole(c, 'operator')
    if (!session) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }

    const callId = c.req.param('id')
    const { organization_id, user_id } = session

    // Validate UUID format
    if (
      !callId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callId)
    ) {
      return c.json(
        { success: false, error: { code: 'INVALID_CALL_ID', message: 'Invalid call ID format' } },
        400
      )
    }

    const db = getDb(c.env)

    // Parse + validate request body
    const parsed = await validateBody(c, CallOutcomeUpdateSchema)
    if (!parsed.success) return parsed.response
    const {
      outcome_status,
      confidence_level,
      agreed_items,
      declined_items,
      ambiguities,
      follow_up_actions,
      summary_text,
      summary_source,
      readback_confirmed,
    } = parsed.data

    // Verify call belongs to organization
    const { rows: calls } = await db.query(
      `SELECT id FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, organization_id]
    )
    if (calls.length === 0) {
      return c.json(
        { success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } },
        404
      )
    }

    // Get existing outcome
    const { rows: existingOutcomes } = await db.query(
      `SELECT * FROM call_outcomes WHERE call_id = $1`,
      [callId]
    )
    const existingOutcome = existingOutcomes[0]

    if (!existingOutcome) {
      return c.json(
        {
          success: false,
          error: { code: 'OUTCOME_NOT_FOUND', message: 'Outcome not found. Use POST to create.' },
        },
        404
      )
    }

    // Prepare update
    let readbackTimestamp = existingOutcome.readback_timestamp
    if (
      readback_confirmed !== undefined &&
      readback_confirmed &&
      !existingOutcome.readback_confirmed
    ) {
      readbackTimestamp = new Date().toISOString()
    }

    const { rows: updatedOutcomes } = await db.query(
      `UPDATE call_outcomes
         SET outcome_status = COALESCE($1, outcome_status),
             confidence_level = COALESCE($2, confidence_level),
             agreed_items = COALESCE($3, agreed_items),
             declined_items = COALESCE($4, declined_items),
             ambiguities = COALESCE($5, ambiguities),
             follow_up_actions = COALESCE($6, follow_up_actions),
             summary_text = COALESCE($7, summary_text),
             summary_source = COALESCE($8, summary_source),
             readback_confirmed = COALESCE($9, readback_confirmed),
             readback_timestamp = $10,
             revision_number = revision_number + 1,
             updated_at = NOW(),
             last_updated_by_user_id = $11
         WHERE id = $12
         RETURNING *`,
      [
        outcome_status,
        confidence_level,
        agreed_items ? JSON.stringify(agreed_items) : null,
        declined_items ? JSON.stringify(declined_items) : null,
        ambiguities ? JSON.stringify(ambiguities) : null,
        follow_up_actions ? JSON.stringify(follow_up_actions) : null,
        summary_text,
        summary_source,
        readback_confirmed,
        readbackTimestamp,
        user_id,
        existingOutcome.id,
      ]
    )
    const outcome = updatedOutcomes[0]

    logger.info('Outcome updated', {
      callId,
      outcomeId: outcome.id,
      revision: outcome.revision_number,
    })

    return c.json({
      success: true,
      data: {
        outcome,
        message: 'Outcome updated successfully',
        revision: outcome.revision_number,
      },
    })
  } catch (error: any) {
    logger.error('Outcome PUT error', { error: error?.message })
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
      },
      500
    )
  }
})

// POST /api/calls/[id]/summary
callsRoutes.post('/:id/summary', async (c) => {
  try {
    const session = await requireRole(c, 'viewer')
    if (!session) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }

    const callId = c.req.param('id')
    const { organization_id, user_id } = session

    // Validate UUID format
    if (
      !callId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callId)
    ) {
      return c.json(
        { success: false, error: { code: 'INVALID_CALL_ID', message: 'Invalid call ID format' } },
        400
      )
    }

    const db = getDb(c.env)

    // Parse + validate request body
    const parsed = await validateBody(c, GenerateSummarySchema)
    if (!parsed.success) return parsed.response
    const { use_call_transcript, include_structured_extraction, custom_transcript } = parsed.data

    // Get call with transcript
    const { rows: calls } = await db.query(
      `SELECT
            id, organization_id, direction, status, ai_summary, transcription,
            caller_phone_number, destination_phone_number, started_at, ended_at
         FROM calls
         WHERE id = $1 AND organization_id = $2`,
      [callId, organization_id]
    )
    const call = calls[0]

    if (!call) {
      return c.json(
        { success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } },
        404
      )
    }

    // Get transcript text
    let transcriptText = custom_transcript || ''

    if (use_call_transcript && !custom_transcript) {
      if (call.transcription) {
        // Handle different transcription formats
        if (typeof call.transcription === 'string') {
          transcriptText = call.transcription
        } else if (call.transcription.text) {
          transcriptText = call.transcription.text
        } else if (call.transcription.transcript) {
          transcriptText = call.transcription.transcript
        } else if (Array.isArray(call.transcription)) {
          // Array of utterances
          transcriptText = call.transcription
            .map((u: any) => `${u.speaker || 'Unknown'}: ${u.text || ''}`)
            .join('\n')
        }
      }
    }

    if (!transcriptText || transcriptText.trim().length < 20) {
      return c.json(
        {
          success: false,
          error: {
            code: 'NO_TRANSCRIPT',
            message: 'Insufficient transcript content. A minimum of 20 characters is required.',
          },
        },
        400
      )
    }

    // Check for OpenAI API key
    const openaiKey = c.env.OPENAI_API_KEY
    if (!openaiKey) {
      logger.error('AI Summary failed: OPENAI_API_KEY not configured', { callId })
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFIG_ERROR',
            message: 'AI summarization is not configured. Please contact your administrator.',
          },
        },
        503
      )
    }

    // Build the AI prompt
    const systemPrompt = include_structured_extraction
      ? `You are an expert call analyst. Analyze the following call transcript and provide:
1. A concise summary (2-4 sentences) of what was discussed and any decisions made
2. A list of specific items/topics that were AGREED upon (if any)
3. A list of concerns or objections raised (if any)
4. Recommended follow-up actions (if any)

Format your response as JSON with these keys:
- "summary_text": string (the summary)
- "topics_discussed": string[] (main topics)
- "potential_agreements": string[] (things that seemed agreed upon)
- "potential_concerns": string[] (concerns, objections, or unclear items)
- "recommended_followup": string[] (suggested next steps)
- "sentiment": "positive" | "neutral" | "negative" | "mixed"

IMPORTANT: You are analyzing, not deciding. The human operator will review and confirm all extracted items. Be conservative - if something is unclear, note it as a concern rather than an agreement.`
      : `You are an expert call analyst. Provide a concise summary (2-4 sentences) of the following call transcript. Focus on what was discussed and any decisions or commitments made. Be factual and neutral.`

    // Call OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Call Transcript:\n\n${transcriptText.slice(0, 12000)}` },
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: include_structured_extraction ? { type: 'json_object' } : undefined,
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      logger.error('OpenAI API error', { callId, status: openaiResponse.status })
      return c.json(
        {
          success: false,
          error: {
            code: 'AI_ERROR',
            message: 'Failed to generate AI summary. Please try again.',
          },
        },
        502
      )
    }

    const openaiData = (await openaiResponse.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const aiContent = openaiData.choices?.[0]?.message?.content?.trim()

    if (!aiContent) {
      return c.json(
        {
          success: false,
          error: {
            code: 'AI_EMPTY',
            message: 'AI returned an empty response. Please try again.',
          },
        },
        502
      )
    }

    // Parse the AI response
    let summaryResult: any

    if (include_structured_extraction) {
      try {
        summaryResult = JSON.parse(aiContent)
      } catch {
        // If JSON parsing fails, treat as plain text
        summaryResult = {
          summary_text: aiContent,
          topics_discussed: [],
          potential_agreements: [],
          potential_concerns: [],
          recommended_followup: [],
          sentiment: 'neutral',
        }
      }
    } else {
      summaryResult = {
        summary_text: aiContent,
        topics_discussed: [],
        potential_agreements: [],
        potential_concerns: [],
        recommended_followup: [],
        sentiment: 'neutral',
      }
    }

    // Store in ai_summaries table for audit
    let aiSummary: any = null
    try {
      const { rows: inserted } = await db.query(
        `INSERT INTO ai_summaries (
                call_id, organization_id, summary_text, topics_discussed, potential_agreements,
                potential_concerns, recommended_followup, confidence_score, model_used,
                generated_by_user_id, review_status, input_length
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id`,
        [
          callId,
          organization_id,
          summaryResult.summary_text,
          JSON.stringify(summaryResult.topics_discussed || []),
          JSON.stringify(summaryResult.potential_agreements || []),
          JSON.stringify(summaryResult.potential_concerns || []),
          JSON.stringify(summaryResult.recommended_followup || []),
          0.85,
          'gpt-4-turbo-preview',
          user_id,
          'pending',
          transcriptText.length,
        ]
      )
      aiSummary = inserted[0]
    } catch (insertError) {
      logger.error('Failed to store AI summary', { callId, error: (insertError as any)?.message })
      // Continue anyway
    }

    logger.info('AI summary generated', {
      callId,
      aiSummaryId: aiSummary?.id,
      summaryLength: summaryResult.summary_text?.length,
    })

    return c.json({
      success: true,
      data: {
        ...summaryResult,
        ai_summary_id: aiSummary?.id,
        review_status: 'pending',
        _ai_role_notice:
          'This summary was generated by AI and requires human review before confirmation.',
      },
    })
  } catch (error: any) {
    logger.error('Summary POST error', { error: error?.message || error })
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      500
    )
  }
})

// GET /api/calls/:id/timeline — call timeline events
callsRoutes.get('/:id/timeline', async (c) => {
  try {
    const session = await requireRole(c, 'viewer')
    if (!session) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const callId = c.req.param('id')
    if (!isValidUUID(callId)) {
      return c.json({ success: false, error: 'Invalid call ID' }, 400)
    }

    const db = getDb(c.env)

    // Verify call belongs to org
    const { rows: calls } = await db.query(
      `SELECT id FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, session.organization_id]
    )
    if (calls.length === 0) return c.json({ success: false, error: 'Call not found' }, 404)

    // Fetch timeline events
    const { rows: events } = await db.query(
      `SELECT id, call_id, event_type, event_data, created_at
       FROM call_timeline_events
       WHERE call_id = $1
       ORDER BY created_at ASC`,
      [callId]
    )

    return c.json({ success: true, events })
  } catch (error: any) {
    if (error.code === '42P01') {
      return c.json({ success: true, events: [], message: 'Timeline not configured' })
    }
    logger.error('GET timeline error', { error: error?.message })
    return c.json({ success: false, error: 'Internal server error' }, 500)
  }
})

// GET /api/calls/:id/notes — call notes
callsRoutes.get('/:id/notes', async (c) => {
  try {
    const session = await requireRole(c, 'viewer')
    if (!session) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const callId = c.req.param('id')
    if (!isValidUUID(callId)) {
      return c.json({ success: false, error: 'Invalid call ID' }, 400)
    }

    const db = getDb(c.env)

    const { rows: calls } = await db.query(
      `SELECT id FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, session.organization_id]
    )
    if (calls.length === 0) return c.json({ success: false, error: 'Call not found' }, 404)

    const { rows: notes } = await db.query(
      `SELECT cn.id, cn.call_id, cn.content, cn.created_by, cn.created_at,
              u.email as author_email, u.name as author_name
       FROM call_notes cn
       LEFT JOIN users u ON u.id = cn.created_by
       WHERE cn.call_id = $1
       ORDER BY cn.created_at DESC`,
      [callId]
    )

    return c.json({ success: true, notes })
  } catch (error: any) {
    if (error.code === '42P01') {
      return c.json({ success: true, notes: [], message: 'Notes not configured' })
    }
    logger.error('GET notes error', { error: error?.message })
    return c.json({ success: false, error: 'Internal server error' }, 500)
  }
})

// POST /api/calls/:id/notes — add a note
callsRoutes.post('/:id/notes', async (c) => {
  try {
    const session = await requireRole(c, 'operator')
    if (!session) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const callId = c.req.param('id')
    if (!isValidUUID(callId)) {
      return c.json({ success: false, error: 'Invalid call ID' }, 400)
    }

    const parsed = await validateBody(c, CallNoteSchema)
    if (!parsed.success) return parsed.response
    const { content } = parsed.data

    const db = getDb(c.env)

    // Verify call belongs to org
    const { rows: calls } = await db.query(
      `SELECT id FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, session.organization_id]
    )
    if (calls.length === 0) return c.json({ success: false, error: 'Call not found' }, 404)

    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS call_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)

    const { rows: inserted } = await db.query(
      `INSERT INTO call_notes (call_id, content, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [callId, content.trim(), session.user_id]
    )

    return c.json({ success: true, note: inserted[0] }, 201)
  } catch (error: any) {
    logger.error('POST notes error', { error: error?.message })
    return c.json({ success: false, error: 'Internal server error' }, 500)
  }
})

// PUT /api/calls/:id/disposition — set call disposition
callsRoutes.put('/:id/disposition', async (c) => {
  try {
    const session = await requireRole(c, 'operator')
    if (!session) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const callId = c.req.param('id')
    if (!isValidUUID(callId)) {
      return c.json({ success: false, error: 'Invalid call ID' }, 400)
    }

    const parsed = await validateBody(c, DispositionSchema)
    if (!parsed.success) return parsed.response
    const { disposition, disposition_notes } = parsed.data

    const db = getDb(c.env)

    const { rows: updated } = await db.query(
      `UPDATE calls 
       SET disposition = $3, disposition_notes = $4
       WHERE id = $1 AND organization_id = $2
       RETURNING id, disposition, disposition_notes`,
      [callId, session.organization_id, disposition, disposition_notes || null]
    )

    if (updated.length === 0) {
      return c.json({ success: false, error: 'Call not found' }, 404)
    }

    // Audit log: disposition updated
    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'calls',
      resourceId: callId,
      action: AuditAction.CALL_DISPOSITION_SET,
      after: { disposition, disposition_notes },
    })

    return c.json({ success: true, call: updated[0] })
  } catch (error: any) {
    // If disposition column doesn't exist, add it dynamically
    if (error.code === '42703') {
      try {
        const db = getDb(c.env)
        await db.query(`ALTER TABLE calls ADD COLUMN IF NOT EXISTS disposition TEXT`)
        await db.query(`ALTER TABLE calls ADD COLUMN IF NOT EXISTS disposition_notes TEXT`)
        return c.json({ success: false, error: 'Schema updated. Please retry.' }, 503)
      } catch {
        /* fall through */
      }
    }
    logger.error('PUT disposition error', { error: error?.message })
    return c.json({ success: false, error: 'Internal server error' }, 500)
  }
})

// POST /api/calls/:id/confirmations — record an in-call confirmation event
callsRoutes.post('/:id/confirmations', async (c) => {
  try {
    const session = await requireRole(c, 'operator')
    if (!session) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const callId = c.req.param('id')
    if (!isValidUUID(callId)) {
      return c.json({ success: false, error: 'Invalid call ID' }, 400)
    }

    const parsed = await validateBody(c, ConfirmationSchema)
    if (!parsed.success) return parsed.response
    const { confirmation_type, details, confirmed_by } = parsed.data

    const db = getDb(c.env)

    // Verify call belongs to org
    const { rows: calls } = await db.query(
      `SELECT id FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, session.organization_id]
    )
    if (calls.length === 0) return c.json({ success: false, error: 'Call not found' }, 404)

    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS call_confirmations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
        confirmation_type TEXT NOT NULL,
        details JSONB,
        confirmed_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)

    const { rows: inserted } = await db.query(
      `INSERT INTO call_confirmations (call_id, confirmation_type, details, confirmed_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [callId, confirmation_type, JSON.stringify(details || {}), confirmed_by || session.user_id]
    )

    return c.json({ success: true, confirmation: inserted[0] }, 201)
  } catch (error: any) {
    logger.error('POST confirmations error', { error: error?.message })
    return c.json({ success: false, error: 'Internal server error' }, 500)
  }
})

// GET /api/calls/:id/export — export call data as JSON
callsRoutes.get('/:id/export', async (c) => {
  try {
    const session = await requireRole(c, 'viewer')
    if (!session) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const callId = c.req.param('id')
    if (!isValidUUID(callId)) {
      return c.json({ success: false, error: 'Invalid call ID' }, 400)
    }

    const db = getDb(c.env)

    // Get call with all related data
    const { rows: calls } = await db.query(
      `SELECT * FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, session.organization_id]
    )
    if (calls.length === 0) return c.json({ success: false, error: 'Call not found' }, 404)

    const call = calls[0]

    // Get recordings
    let recordings: any[] = []
    try {
      const res = await db.query(
        `SELECT id, recording_url, duration_seconds, status, created_at FROM recordings WHERE call_id = $1`,
        [callId]
      )
      recordings = res.rows || []
    } catch {
      /* table might not exist */
    }

    // Get outcome
    let outcome = null
    try {
      const res = await db.query(`SELECT * FROM call_outcomes WHERE call_id = $1`, [callId])
      outcome = res.rows?.[0] || null
    } catch {
      /* table might not exist */
    }

    // Get notes
    let notes: any[] = []
    try {
      const res = await db.query(
        `SELECT * FROM call_notes WHERE call_id = $1 ORDER BY created_at`,
        [callId]
      )
      notes = res.rows || []
    } catch {
      /* table might not exist */
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      call,
      recordings,
      outcome,
      notes,
    }

    const format = c.req.query('format')
    if (format === 'zip') {
      // For ZIP format, return JSON as downloadable file
      c.header('Content-Type', 'application/json')
      c.header('Content-Disposition', `attachment; filename="call-${callId}.json"`)
      return c.body(JSON.stringify(exportData, null, 2))
    }

    return c.json({ success: true, export: exportData })
  } catch (error: any) {
    logger.error('GET export error', { error: error?.message })
    return c.json({ success: false, error: 'Internal server error' }, 500)
  }
})

// POST /api/calls/:id/email — email call artifacts (placeholder)
callsRoutes.post('/:id/email', async (c) => {
  try {
    const session = await requireRole(c, 'operator')
    if (!session) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const callId = c.req.param('id')
    const parsed = await validateBody(c, EmailCallSchema)
    if (!parsed.success) return parsed.response
    const { recipients } = parsed.data

    // TODO: Integrate with Resend API to actually send emails
    // For now, return success stub
    logger.info('Email requested', { callId, recipientCount: recipients.length })

    return c.json({
      success: true,
      message: `Email queued for ${recipients.length} recipient(s)`,
      recipients,
    })
  } catch (error: any) {
    logger.error('POST email error', { error: error?.message })
    return c.json({ success: false, error: 'Internal server error' }, 500)
  }
})
