/**
 * Call Outcome API
 * 
 * GET /api/calls/[id]/outcome - Get outcome for a call
 * POST /api/calls/[id]/outcome - Create outcome declaration
 * PUT /api/calls/[id]/outcome - Update outcome declaration
 * 
 * Per AI Role Policy (ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md):
 * - Humans declare outcomes, not AI
 * - System records what the human declares
 * - "The system records what happened. The human declares the meaning."
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

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
  try {
    const { id: callId } = await params

    // Authenticate
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Validate UUID format
    if (!callId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CALL_ID', message: 'Invalid call ID format' } },
        { status: 400 }
      )
    }

    // Get user's organization
    const { data: member, error: memberError } = await supabaseAdmin
      .from('org_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single()

    if (memberError || !member) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization membership not found' } },
        { status: 403 }
      )
    }

    // Verify call belongs to organization
    const { data: call, error: callError } = await supabaseAdmin
      .from('calls')
      .select('id, organization_id')
      .eq('id', callId)
      .eq('organization_id', member.organization_id)
      .single()

    if (callError || !call) {
      return NextResponse.json(
        { success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } },
        { status: 404 }
      )
    }

    // Get outcome
    const { data: outcome, error: outcomeError } = await supabaseAdmin
      .from('call_outcomes')
      .select(`
        id,
        call_id,
        outcome_status,
        confidence_level,
        agreed_items,
        declined_items,
        ambiguities,
        follow_up_actions,
        summary_text,
        summary_source,
        readback_confirmed,
        readback_timestamp,
        declared_by_user_id,
        revision_number,
        created_at,
        updated_at,
        declared_by_user:users!call_outcomes_declared_by_user_id_fkey (email)
      `)
      .eq('call_id', callId)
      .single()

    // Handle missing table gracefully (PGRST205 = table not found)
    if (outcomeError && outcomeError.code === 'PGRST205') {
      return NextResponse.json({
        success: true,
        data: {
          callId,
          outcome: null,
          history: [],
          hasOutcome: false,
          featureAvailable: false,
          message: 'Call outcomes feature is not yet configured for this account.'
        },
      })
    }

    if (outcomeError && outcomeError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is valid for new calls
      logger.error('Failed to fetch outcome', { callId, error: outcomeError })
      return NextResponse.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch outcome' } },
        { status: 500 }
      )
    }

    // Get outcome history if outcome exists
    let history: any[] = []
    if (outcome) {
      const { data: historyData } = await supabaseAdmin
        .from('call_outcome_history')
        .select('id, outcome_status, summary_text, revision_number, created_at, changed_by_user_id')
        .eq('call_outcome_id', outcome.id)
        .order('revision_number', { ascending: false })
        .limit(10)

      history = historyData || []
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

  } catch (error) {
    logger.error('Outcome GET error', { error })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
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

    // Authenticate
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

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

    // Get user's organization
    const { data: member, error: memberError } = await supabaseAdmin
      .from('org_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single()

    if (memberError || !member) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization membership not found' } },
        { status: 403 }
      )
    }

    // Verify call belongs to organization
    const { data: call, error: callError } = await supabaseAdmin
      .from('calls')
      .select('id, organization_id, status')
      .eq('id', callId)
      .eq('organization_id', member.organization_id)
      .single()

    if (callError || !call) {
      return NextResponse.json(
        { success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } },
        { status: 404 }
      )
    }

    // Check if outcome already exists
    const { data: existingOutcome } = await supabaseAdmin
      .from('call_outcomes')
      .select('id')
      .eq('call_id', callId)
      .single()

    if (existingOutcome) {
      return NextResponse.json(
        { success: false, error: { code: 'OUTCOME_EXISTS', message: 'Outcome already exists. Use PUT to update.' } },
        { status: 409 }
      )
    }

    // Create outcome
    const { data: outcome, error: insertError } = await supabaseAdmin
      .from('call_outcomes')
      .insert({
        call_id: callId,
        organization_id: member.organization_id,
        outcome_status,
        confidence_level,
        agreed_items,
        declined_items,
        ambiguities,
        follow_up_actions,
        summary_text,
        summary_source,
        readback_confirmed,
        readback_timestamp: readback_confirmed ? new Date().toISOString() : null,
        declared_by_user_id: userId,
        revision_number: 1,
      })
      .select()
      .single()

    // Handle missing table gracefully
    if (insertError && insertError.code === 'PGRST205') {
      return NextResponse.json(
        { success: false, error: { code: 'FEATURE_UNAVAILABLE', message: 'Call outcomes feature is not yet configured. Contact support to enable.' } },
        { status: 501 }
      )
    }

    if (insertError) {
      logger.error('Failed to create outcome', { callId, error: insertError })
      return NextResponse.json(
        { success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create outcome' } },
        { status: 500 }
      )
    }

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

  } catch (error) {
    logger.error('Outcome POST error', { error })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
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
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

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

    // Validate outcome_status if provided
    if (outcome_status && !VALID_OUTCOME_STATUSES.includes(outcome_status)) {
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

    // Validate confidence_level if provided
    if (confidence_level && !VALID_CONFIDENCE_LEVELS.includes(confidence_level)) {
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

    // Validate summary_source if provided
    if (summary_source && !VALID_SUMMARY_SOURCES.includes(summary_source)) {
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

    // Get user's organization
    const { data: member, error: memberError } = await supabaseAdmin
      .from('org_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single()

    if (memberError || !member) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization membership not found' } },
        { status: 403 }
      )
    }

    // Verify call belongs to organization
    const { data: call, error: callError } = await supabaseAdmin
      .from('calls')
      .select('id, organization_id')
      .eq('id', callId)
      .eq('organization_id', member.organization_id)
      .single()

    if (callError || !call) {
      return NextResponse.json(
        { success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } },
        { status: 404 }
      )
    }

    // Get existing outcome
    const { data: existingOutcome, error: existingError } = await supabaseAdmin
      .from('call_outcomes')
      .select('*')
      .eq('call_id', callId)
      .single()

    if (existingError || !existingOutcome) {
      return NextResponse.json(
        { success: false, error: { code: 'OUTCOME_NOT_FOUND', message: 'Outcome not found. Use POST to create.' } },
        { status: 404 }
      )
    }

    // Build update object (only include provided fields)
    const updateFields: any = {
      revision_number: existingOutcome.revision_number + 1,
      updated_at: new Date().toISOString(),
      last_updated_by_user_id: userId,
    }

    if (outcome_status !== undefined) updateFields.outcome_status = outcome_status
    if (confidence_level !== undefined) updateFields.confidence_level = confidence_level
    if (agreed_items !== undefined) updateFields.agreed_items = agreed_items
    if (declined_items !== undefined) updateFields.declined_items = declined_items
    if (ambiguities !== undefined) updateFields.ambiguities = ambiguities
    if (follow_up_actions !== undefined) updateFields.follow_up_actions = follow_up_actions
    if (summary_text !== undefined) updateFields.summary_text = summary_text
    if (summary_source !== undefined) updateFields.summary_source = summary_source
    if (readback_confirmed !== undefined) {
      updateFields.readback_confirmed = readback_confirmed
      if (readback_confirmed && !existingOutcome.readback_confirmed) {
        updateFields.readback_timestamp = new Date().toISOString()
      }
    }

    // Update outcome (history is created via trigger)
    const { data: outcome, error: updateError } = await supabaseAdmin
      .from('call_outcomes')
      .update(updateFields)
      .eq('id', existingOutcome.id)
      .select()
      .single()

    if (updateError) {
      logger.error('Failed to update outcome', { callId, outcomeId: existingOutcome.id, error: updateError })
      return NextResponse.json(
        { success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update outcome' } },
        { status: 500 }
      )
    }

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

  } catch (error) {
    logger.error('Outcome PUT error', { error })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
