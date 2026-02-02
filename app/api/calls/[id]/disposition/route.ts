/**
 * Call Disposition API
 * 
 * PUT /api/calls/[id]/disposition - Set call disposition
 * GET /api/calls/[id]/disposition - Get call disposition
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { emitDispositionSet } from '@/lib/webhookDelivery'
import { CallDisposition } from '@/types/tier1-features'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VALID_DISPOSITIONS: CallDisposition[] = [
  'sale',
  'no_answer',
  'voicemail',
  'not_interested',
  'follow_up',
  'wrong_number',
  'other'
]

// Validation schema for PUT request
const setDispositionSchema = z.object({
  disposition: z.enum(['sale', 'no_answer', 'voicemail', 'not_interested', 'follow_up', 'wrong_number', 'other'], {
    errorMap: () => ({ message: `Invalid disposition. Must be one of: ${VALID_DISPOSITIONS.join(', ')}` })
  }),
  disposition_notes: z.string().max(500, { message: 'Notes must be 500 characters or less' }).optional().nullable(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/calls/[id]/disposition
 * Get disposition for a specific call
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: callId } = await params

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

    // Get call with disposition (verify org access)
    const { rows: calls } = await query(
      `SELECT id, disposition, disposition_set_at, disposition_set_by, disposition_notes 
         FROM calls 
         WHERE id = $1 AND organization_id = $2`,
      [callId, organizationId]
    )
    const call = calls[0]

    if (!call) {
      return NextResponse.json(
        { success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      disposition: {
        call_id: call.id,
        disposition: call.disposition,
        disposition_set_at: call.disposition_set_at,
        disposition_set_by: call.disposition_set_by,
        disposition_notes: call.disposition_notes
      }
    })
  } catch (error: any) {
    logger.error('[disposition GET] Error', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/calls/[id]/disposition
 * Set or update call disposition
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: callId } = await params

    // Authenticate
    const session = await requireRole('operator') // Requires operator+
    const userId = session.user.id
    const organizationId = session.user.organizationId

    // Validate UUID format
    if (!callId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CALL_ID', message: 'Invalid call ID format' } },
        { status: 400 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const parsed = setDispositionSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: parsed.error.message } },
        { status: 400 }
      )
    }

    const { disposition, disposition_notes } = parsed.data

    // Verify call belongs to user's org
    const { rows: calls } = await query(
      `SELECT id, organization_id, status FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, organizationId]
    )
    const existingCall = calls[0]

    if (!existingCall) {
      return NextResponse.json(
        { success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } },
        { status: 404 }
      )
    }

    // Update disposition
    const { rows: updatedCalls } = await query(
      `UPDATE calls 
         SET disposition = $1, 
             disposition_notes = $2, 
             disposition_set_at = NOW(), 
             disposition_set_by = $3
         WHERE id = $4
         RETURNING id, disposition, disposition_set_at, disposition_set_by, disposition_notes`,
      [disposition, disposition_notes || null, userId, callId]
    )
    const updatedCall = updatedCalls[0]

      // Log to audit (fire and forget)
      ; (async () => {
        try {
          await query(
            `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, actor_type, before, after, created_at)
             VALUES ($1, $2, $3, 'call', $4, 'disposition_set', 'human', $5, $6, NOW())`,
            [
              uuidv4(),
              organizationId,
              userId,
              callId,
              JSON.stringify({ disposition: existingCall.status }), // Note: 'status' in before might not be exact mapping, but kept per original logic
              JSON.stringify({ disposition, disposition_notes })
            ]
          )
        } catch (err) {
          logger.error('[disposition PUT] Audit log error', err, { callId })
        }
      })()

      // Emit webhook event (fire and forget)
      ; (async () => {
        try {
          await emitDispositionSet({
            id: updatedCall.id,
            organization_id: organizationId,
            disposition: updatedCall.disposition,
            set_by: updatedCall.disposition_set_by || userId
          })
        } catch (err) {
          logger.error('[disposition PUT] Webhook emit error', err, { callId })
        }
      })()

    return NextResponse.json({
      success: true,
      disposition: {
        call_id: updatedCall.id,
        disposition: updatedCall.disposition,
        disposition_set_at: updatedCall.disposition_set_at,
        disposition_set_by: updatedCall.disposition_set_by,
        disposition_notes: updatedCall.disposition_notes
      }
    })
  } catch (error: any) {
    logger.error('[disposition PUT] Error', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' } },
      { status: 500 }
    )
  }
}
