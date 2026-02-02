/**
 * Call Outcome API
 * 
 * GET /api/calls/[id]/outcome - Get outcome for a call
 * POST /api/calls/[id]/outcome - Create outcome declaration
 * PUT /api/calls/[id]/outcome - Update outcome declaration
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Validation schemas
const VALID_OUTCOME_STATUSES = [
  'agreed',
  'declined',
  'partial',
  'inconclusive',
  'follow_up_required',
  'cancelled',
] as const

const VALID_CONFIDENCE_LEVELS = [
  'high',
  'medium',
  'low',
  'uncertain',
] as const

const VALID_SUMMARY_SOURCES = [
  'human',
  'ai_generated',
  'ai_confirmed',
] as const

/**
 * GET /api/calls/[id]/outcome
 * Get outcome for a call
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  let callId: string = ''
  try {
    const resolvedParams = await params
    callId = resolvedParams.id

    // Authenticate
    const session = await requireRole('viewer')
    const userId = session.user.id
    const organizationId = session.user.organizationId

    // Validate UUID format
    if (!callId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CALL_ID', message: 'Invalid call ID format' } },
        { status: 400 }
      )
    }

    // Verify call belongs to organization
    const { rows: calls } = await query(
      `SELECT id FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, organizationId]
    )

    if (calls.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } },
        { status: 404 }
      )
    }

    // Get outcome
    const { rows: outcomes } = await query(
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
      const { rows: historyRows } = await query(
        `SELECT id, outcome_status, summary_text, revision_number, created_at, changed_by_user_id
         FROM call_outcome_history
         WHERE call_outcome_id = $1
         ORDER BY revision_number DESC
         LIMIT 10`,
        [outcome.id]
      )
      history = historyRows || []
    }

    return NextResponse.json({
      success: true,
      data: {
        callId,
        outcome: outcome || null,
        history,
        hasOutcome: !!outcome,
      },
    })

  } catch (error: any) {
    if (error.code === '42P01') { // table undefined
      return NextResponse.json({
        success: true,
        data: { callId, outcome: null, history: [], hasOutcome: false, message: 'Feature not configured' }
      })
    }
    logger.error('Outcome GET error', { error })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/calls/[id]/outcome
 * Create outcome declaration
 * 
 * Per AI Role Policy: Only humans can declare outcomes
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: callId } = await params

    // Authenticate (Operators only)
    const session = await requireRole('operator')
    const userId = session.user.id
    const organizationId = session.user.organizationId

    // Validate UUID format
    if (!callId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CALL_ID', message: 'Invalid call ID format' } },
        { status: 400 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      outcome_status,
      confidence_level = 'high',
      agreed_items = [],
      declined_items = [],
      ambiguities = [],
      follow_up_actions = [],
      summary_text = '',
      summary_source = 'human',
      readback_confirmed = false,
    } = body

    // Validate outcome_status
    if (!outcome_status || !VALID_OUTCOME_STATUSES.includes(outcome_status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Invalid outcome status. Must be one of: ${VALID_OUTCOME_STATUSES.join(', ')}`
          }
        },
        { status: 400 }
      )
    }

    // Validate confidence_level
    if (!VALID_CONFIDENCE_LEVELS.includes(confidence_level)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CONFIDENCE',
            message: `Invalid confidence level. Must be one of: ${VALID_CONFIDENCE_LEVELS.join(', ')}`
          }
        },
        { status: 400 }
      )
    }

    // Validate summary_source
    if (!VALID_SUMMARY_SOURCES.includes(summary_source)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_SOURCE',
            message: `Invalid summary source. Must be one of: ${VALID_SUMMARY_SOURCES.join(', ')}`
          }
        },
        { status: 400 }
      )
    }

    // Verify call belongs to organization
    const { rows: calls } = await query(
      `SELECT id FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, organizationId]
    )
    if (calls.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } },
        { status: 404 }
      )
    }

    // Check if outcome already exists
    const { rows: existingOutcomes } = await query(
      `SELECT id FROM call_outcomes WHERE call_id = $1`,
      [callId]
    )

    if (existingOutcomes.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'OUTCOME_EXISTS', message: 'Outcome already exists. Use PUT to update.' } },
        { status: 409 }
      )
    }

    // Create outcome
    const { rows: newOutcomes } = await query(
      `INSERT INTO call_outcomes (
        call_id, organization_id, outcome_status, confidence_level, agreed_items, declined_items,
        ambiguities, follow_up_actions, summary_text, summary_source, readback_confirmed,
        readback_timestamp, declared_by_user_id, revision_number
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1)
       RETURNING *`,
      [
        callId, organizationId, outcome_status, confidence_level,
        JSON.stringify(agreed_items), JSON.stringify(declined_items),
        JSON.stringify(ambiguities), JSON.stringify(follow_up_actions),
        summary_text, summary_source, readback_confirmed,
        readback_confirmed ? new Date().toISOString() : null,
        userId
      ]
    )
    const outcome = newOutcomes[0]

    logger.info('Outcome declared', {
      callId,
      outcomeId: outcome.id,
      status: outcome_status,
      declaredBy: userId
    })

    return NextResponse.json({
      success: true,
      data: {
        outcome,
        message: 'Outcome declared successfully',
      },
    }, { status: 201 })

  } catch (error: any) {
    logger.error('Outcome POST error', { error })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/calls/[id]/outcome
 * Update outcome declaration
 * 
 * Per AI Role Policy: Updates are tracked for audit trail
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: callId } = await params

    // Authenticate
    const session = await requireRole('operator')
    const userId = session.user.id
    const organizationId = session.user.organizationId

    // Validate UUID format
    if (!callId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CALL_ID', message: 'Invalid call ID format' } },
        { status: 400 }
      )
    }

    // Parse request body
    const body = await request.json()
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
    } = body

    // Validation checks... (re-using valid statuses)
    if (outcome_status && !VALID_OUTCOME_STATUSES.includes(outcome_status)) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_STATUS', message: 'Invalid status' } }, { status: 400 })
    }

    // Verify call belongs to organization
    const { rows: calls } = await query(
      `SELECT id FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, organizationId]
    )
    if (calls.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } },
        { status: 404 }
      )
    }

    // Get existing outcome
    const { rows: existingOutcomes } = await query(
      `SELECT * FROM call_outcomes WHERE call_id = $1`,
      [callId]
    )
    const existingOutcome = existingOutcomes[0]

    if (!existingOutcome) {
      return NextResponse.json(
        { success: false, error: { code: 'OUTCOME_NOT_FOUND', message: 'Outcome not found. Use POST to create.' } },
        { status: 404 }
      )
    }

    // Prepare update
    let readbackTimestamp = existingOutcome.readback_timestamp
    if (readback_confirmed !== undefined && readback_confirmed && !existingOutcome.readback_confirmed) {
      readbackTimestamp = new Date().toISOString()
    }

    const { rows: updatedOutcomes } = await query(
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
        outcome_status, confidence_level,
        agreed_items ? JSON.stringify(agreed_items) : null,
        declined_items ? JSON.stringify(declined_items) : null,
        ambiguities ? JSON.stringify(ambiguities) : null,
        follow_up_actions ? JSON.stringify(follow_up_actions) : null,
        summary_text, summary_source, readback_confirmed,
        readbackTimestamp, userId, existingOutcome.id
      ]
    )
    const outcome = updatedOutcomes[0]

    logger.info('Outcome updated', {
      callId,
      outcomeId: outcome.id,
      revision: outcome.revision_number,
      updatedBy: userId
    })

    return NextResponse.json({
      success: true,
      data: {
        outcome,
        message: 'Outcome updated successfully',
        revision: outcome.revision_number,
      },
    })

  } catch (error: any) {
    logger.error('Outcome PUT error', { error })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' } },
      { status: 500 }
    )
  }
}
