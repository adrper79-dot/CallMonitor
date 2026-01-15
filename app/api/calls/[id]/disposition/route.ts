/**
 * Call Disposition API
 * 
 * PUT /api/calls/[id]/disposition - Set call disposition
 * GET /api/calls/[id]/disposition - Get call disposition
 * 
 * Per MASTER_ARCHITECTURE: Call is root object
 * Disposition is a call modulation, not a separate entity
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { CallDisposition } from '@/types/tier1-features'

export const dynamic = 'force-dynamic'

const VALID_DISPOSITIONS: CallDisposition[] = [
  'sale',
  'no_answer',
  'voicemail',
  'not_interested',
  'follow_up',
  'wrong_number',
  'callback_scheduled',
  'other'
]

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
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .single()
    
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      )
    }
    
    // Get call with disposition (verify org access)
    const { data: call, error: callError } = await supabaseAdmin
      .from('calls')
      .select('id, disposition, disposition_set_at, disposition_set_by, disposition_notes')
      .eq('id', callId)
      .eq('organization_id', user.organization_id)
      .single()
    
    if (callError || !call) {
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
    console.error('[disposition GET] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
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
    const { disposition, disposition_notes } = body
    
    // Validate disposition value
    if (!disposition || !VALID_DISPOSITIONS.includes(disposition)) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_DISPOSITION', 
            message: `Invalid disposition. Must be one of: ${VALID_DISPOSITIONS.join(', ')}` 
          } 
        },
        { status: 400 }
      )
    }
    
    // Validate notes length
    if (disposition_notes && disposition_notes.length > 500) {
      return NextResponse.json(
        { success: false, error: { code: 'NOTES_TOO_LONG', message: 'Notes must be 500 characters or less' } },
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
    
    // Check RBAC: Owner, Admin, Operator can set disposition
    if (!['owner', 'admin', 'operator'].includes(member.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners, admins, and operators can set disposition' } },
        { status: 403 }
      )
    }
    
    // Verify call belongs to user's org
    const { data: existingCall, error: existingError } = await supabaseAdmin
      .from('calls')
      .select('id, organization_id, status')
      .eq('id', callId)
      .eq('organization_id', member.organization_id)
      .single()
    
    if (existingError || !existingCall) {
      return NextResponse.json(
        { success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } },
        { status: 404 }
      )
    }
    
    // Update disposition
    const { data: updatedCall, error: updateError } = await supabaseAdmin
      .from('calls')
      .update({
        disposition,
        disposition_notes: disposition_notes || null,
        disposition_set_at: new Date().toISOString(),
        disposition_set_by: userId
      })
      .eq('id', callId)
      .select('id, disposition, disposition_set_at, disposition_set_by, disposition_notes')
      .single()
    
    if (updateError) {
      console.error('[disposition PUT] Update error:', updateError)
      return NextResponse.json(
        { success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to update disposition' } },
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
          resource_type: 'call',
          resource_id: callId,
          action: 'disposition_set',
          before: { disposition: existingCall.status },
          after: { disposition, disposition_notes }
        })
      } catch (err) {
        console.error('[disposition PUT] Audit log error:', err)
      }
    })()
    
    // TODO: Trigger webhook event call.disposition_set
    
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
    console.error('[disposition PUT] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
