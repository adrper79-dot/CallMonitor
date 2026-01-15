/**
 * Call Notes API
 * 
 * GET /api/calls/[id]/notes - Get all notes for a call
 * POST /api/calls/[id]/notes - Add a note to a call
 * 
 * Per MASTER_ARCHITECTURE: Call is root object
 * Notes are structured (checkboxes + short text), not freeform
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { CallNoteTag, CALL_NOTE_TAGS } from '@/types/tier1-features'

export const dynamic = 'force-dynamic'

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
      .select('organization_id, role')
      .eq('user_id', userId)
      .single()
    
    if (memberError || !member) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization membership not found' } },
        { status: 403 }
      )
    }
    
    // Verify call belongs to user's org
    const { data: call, error: callError } = await supabaseAdmin
      .from('calls')
      .select('id')
      .eq('id', callId)
      .eq('organization_id', member.organization_id)
      .single()
    
    if (callError || !call) {
      return NextResponse.json(
        { success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } },
        { status: 404 }
      )
    }
    
    // Get notes with creator info
    const { data: notes, error: notesError } = await supabaseAdmin
      .from('call_notes')
      .select(`
        id,
        call_id,
        organization_id,
        tags,
        note,
        created_by,
        created_at,
        updated_at,
        users:created_by (
          email
        )
      `)
      .eq('call_id', callId)
      .order('created_at', { ascending: false })
    
    if (notesError) {
      console.error('[notes GET] Error fetching notes:', notesError)
      return NextResponse.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch notes' } },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      notes: notes || []
    })
  } catch (error: any) {
    console.error('[notes GET] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
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
    const { tags, note } = body
    
    // Validate tags
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'TAGS_REQUIRED', message: 'At least one tag is required' } },
        { status: 400 }
      )
    }
    
    // Validate each tag
    const invalidTags = tags.filter((tag: string) => !CALL_NOTE_TAGS.includes(tag as CallNoteTag))
    if (invalidTags.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_TAGS', 
            message: `Invalid tags: ${invalidTags.join(', ')}. Valid tags are: ${CALL_NOTE_TAGS.join(', ')}` 
          } 
        },
        { status: 400 }
      )
    }
    
    // Validate note length (max 500 chars)
    if (note && note.length > 500) {
      return NextResponse.json(
        { success: false, error: { code: 'NOTE_TOO_LONG', message: 'Note must be 500 characters or less' } },
        { status: 400 }
      )
    }
    
    // Get user's organization and role
    const { data: member, error: memberError } = await supabaseAdmin
      .from('org_members')
      .select('organization_id, role')
      .eq('user_id', userId)
      .single()
    
    if (memberError || !member) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization membership not found' } },
        { status: 403 }
      )
    }
    
    // Check RBAC: Owner, Admin, Operator can add notes
    if (!['owner', 'admin', 'operator'].includes(member.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners, admins, and operators can add notes' } },
        { status: 403 }
      )
    }
    
    // Verify call belongs to user's org
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
    
    // Insert note
    const { data: newNote, error: insertError } = await supabaseAdmin
      .from('call_notes')
      .insert({
        call_id: callId,
        organization_id: member.organization_id,
        tags: tags,
        note: note || null,
        created_by: userId
      })
      .select()
      .single()
    
    if (insertError) {
      console.error('[notes POST] Insert error:', insertError)
      return NextResponse.json(
        { success: false, error: { code: 'INSERT_FAILED', message: 'Failed to create note' } },
        { status: 500 }
      )
    }
    
    // Log to audit (fire and forget)
    ;(async () => {
      try {
        await supabaseAdmin.from('audit_logs').insert({
          id: crypto.randomUUID(),
          organization_id: member.organization_id,
          user_id: userId,
          resource_type: 'call_note',
          resource_id: newNote.id,
          action: 'create',
          after: { tags, note }
        })
      } catch (err) {
        console.error('[notes POST] Audit log error:', err)
      }
    })()
    
    return NextResponse.json({
      success: true,
      note: newNote
    }, { status: 201 })
  } catch (error: any) {
    console.error('[notes POST] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
