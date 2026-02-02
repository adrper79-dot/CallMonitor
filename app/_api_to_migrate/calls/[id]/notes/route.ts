/**
 * Call Notes API
 * 
 * GET /api/calls/[id]/notes - Get all notes for a call
 * POST /api/calls/[id]/notes - Add a note to a call
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { CallNoteTag, CALL_NOTE_TAGS } from '@/types/tier1-features'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Validation schema for POST request
const addNoteSchema = z.object({
  tags: z.array(
    z.enum(['complaint', 'follow_up', 'escalation', 'positive_feedback', 'technical_issue', 'billing_question', 'general'] as const, {
      errorMap: () => ({ message: `Valid tags are: ${CALL_NOTE_TAGS.join(', ')}` })
    })
  ).min(1, { message: 'At least one tag is required' }),
  note: z.string().max(500, { message: 'Note must be 500 characters or less' }).optional().nullable(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/calls/[id]/notes
 * Get all notes for a call
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: callId } = await params

    // Authenticate and get organization
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

    // Verify call belongs to user's org
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

    // Get notes with creator info
    const { rows: notes } = await query(
      `SELECT n.id, n.call_id, n.organization_id, n.tags, n.note, n.created_by, n.created_at, n.updated_at,
              json_build_object('email', u.email) as users
       FROM call_notes n
       LEFT JOIN users u ON n.created_by = u.id
       WHERE n.call_id = $1
       ORDER BY n.created_at DESC`,
      [callId]
    )

    return NextResponse.json({
      success: true,
      notes: notes || []
    })
  } catch (error: any) {
    logger.error('[notes GET] Error', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/calls/[id]/notes
 * Add a note to a call
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: callId } = await params

    // Authenticate and get organization
    const session = await requireRole('operator') // Requires operator+ for writing
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
    const parsed = addNoteSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: parsed.error.message } },
        { status: 400 }
      )
    }

    const { tags, note } = parsed.data

    // Verify call belongs to user's org
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

    // Insert note
    const noteId = uuidv4()
    const { rows: insertedNotes } = await query(
      `INSERT INTO call_notes (id, call_id, organization_id, tags, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [noteId, callId, organizationId, JSON.stringify(tags), note || null, userId]
    )
    const newNote = insertedNotes[0]

      // Log to audit (fire and forget)
      ; (async () => {
        try {
          await query(
            `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, actor_type, after, created_at)
                 VALUES ($1, $2, $3, 'call_note', $4, 'create', 'human', $5, NOW())`,
            [uuidv4(), organizationId, userId, newNote.id, JSON.stringify({ tags, note })]
          )
        } catch (err) {
          logger.error('[notes POST] Audit log error', err, { noteId: newNote.id })
        }
      })()

    return NextResponse.json({
      success: true,
      note: newNote
    }, { status: 201 })
  } catch (error: any) {
    logger.error('[notes POST] Error', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' } },
      { status: 500 }
    )
  }
}
