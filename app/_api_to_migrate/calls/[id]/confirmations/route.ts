/**
 * Call Confirmations API
 * 
 * GET /api/calls/[id]/confirmations - Get all confirmations for a call
 * POST /api/calls/[id]/confirmations - Record a new confirmation
 * 
 * Per AI Role Policy (ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md):
 * - Operators capture confirmations, not AI
 * - Confirmations are linked to recording timestamps
 * - Human declares, system records
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
const VALID_CONFIRMATION_TYPES = [
  'disclosure_accepted',
  'recording_consent',
  'terms_agreed',
  'price_confirmed',
  'scope_confirmed',
  'identity_verified',
  'authorization_given',
  'understanding_confirmed',
  'custom',
] as const

const VALID_CONFIRMER_ROLES = [
  'customer',
  'operator',
  'third_party',
  'both',
] as const

const VALID_VERIFICATION_METHODS = [
  'verbal',
  'keypress',
  'biometric',
  'document',
  'other',
] as const

/**
 * GET /api/calls/[id]/confirmations
 * Get all confirmations for a call
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: callId } = await params

    // Authenticate (viewer+)
    const session = await requireRole('viewer')
    const organizationId = session.user.organizationId

    // Validate UUID format
    if (!callId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CALL_ID', message: 'Invalid call ID format' } },
        { status: 400 }
      )
    }

    // Verify call belongs to organization
    const { rows: callRows } = await query(
      `SELECT id FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, organizationId]
    )

    if (callRows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } },
        { status: 404 }
      )
    }

    // Get confirmations
    const { rows: confirmations } = await query(
      `SELECT
        c.id,
        c.confirmation_type,
        c.confirmation_label,
        c.prompt_text,
        c.confirmer_role,
        c.confirmed_at,
        c.recording_timestamp_seconds,
        c.captured_by,
        c.captured_by_user_id,
        c.verification_method,
        c.notes,
        c.created_at,
        json_build_object('email', u.email) as captured_by_user
       FROM call_confirmations c
       LEFT JOIN users u ON c.captured_by_user_id = u.id
       WHERE c.call_id = $1
       ORDER BY c.confirmed_at ASC`,
      [callId]
    )

    return NextResponse.json({
      success: true,
      data: {
        callId,
        confirmations: confirmations || [],
        count: confirmations?.length || 0,
      },
    })

  } catch (error) {
    logger.error('Confirmations GET error', { error })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/calls/[id]/confirmations
 * Record a new confirmation
 * 
 * Per AI Role Policy: Only humans can capture confirmations
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: callId } = await params

    // Authenticate (operator+)
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
      confirmation_type,
      confirmation_label,
      prompt_text,
      confirmer_role,
      recording_timestamp_seconds,
      verification_method,
      notes,
    } = body

    // Validate required fields
    if (!confirmation_type || !prompt_text || !confirmer_role) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'confirmation_type, prompt_text, and confirmer_role are required',
          },
        },
        { status: 400 }
      )
    }

    // Validate confirmation_type
    if (!VALID_CONFIRMATION_TYPES.includes(confirmation_type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid confirmation_type. Must be one of: ${VALID_CONFIRMATION_TYPES.join(', ')}`,
          },
        },
        { status: 400 }
      )
    }

    // Validate confirmer_role
    if (!VALID_CONFIRMER_ROLES.includes(confirmer_role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid confirmer_role. Must be one of: ${VALID_CONFIRMER_ROLES.join(', ')}`,
          },
        },
        { status: 400 }
      )
    }

    // Validate verification_method if provided
    if (verification_method && !VALID_VERIFICATION_METHODS.includes(verification_method)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid verification_method. Must be one of: ${VALID_VERIFICATION_METHODS.join(', ')}`,
          },
        },
        { status: 400 }
      )
    }

    // Verify call belongs to organization
    const { rows: callRows } = await query(
      `SELECT id FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, organizationId]
    )

    if (callRows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } },
        { status: 404 }
      )
    }

    // Insert confirmation
    const { rows: inserted } = await query(
      `INSERT INTO call_confirmations
       (call_id, organization_id, confirmation_type, confirmation_label, prompt_text, confirmer_role, confirmed_at, recording_timestamp_seconds, captured_by, captured_by_user_id, verification_method, notes)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, 'human', $8, $9, $10)
       RETURNING *`,
      [
        callId,
        organizationId,
        confirmation_type,
        confirmation_label || null,
        prompt_text,
        confirmer_role,
        recording_timestamp_seconds ?? null,
        userId,
        verification_method || 'verbal',
        notes || null
      ]
    )

    const confirmation = inserted[0]

    // Log to audit trail
    logger.info('Confirmation captured', {
      callId,
      confirmationId: confirmation.id,
      type: confirmation_type,
      confirmerRole: confirmer_role,
      capturedBy: userId,
      recordingTimestamp: recording_timestamp_seconds,
    })

    return NextResponse.json({
      success: true,
      data: {
        confirmation,
        message: 'Confirmation captured successfully',
      },
    }, { status: 201 })

  } catch (error: any) {
    logger.error('Confirmations POST error', { error })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
