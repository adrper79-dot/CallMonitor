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
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

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

    // Get confirmations
    const { data: confirmations, error: confirmationsError } = await supabaseAdmin
      .from('call_confirmations')
      .select(`
        id,
        confirmation_type,
        confirmation_label,
        prompt_text,
        confirmer_role,
        confirmed_at,
        recording_timestamp_seconds,
        captured_by,
        captured_by_user_id,
        verification_method,
        notes,
        created_at,
        captured_by_user:users!call_confirmations_captured_by_user_id_fkey (email)
      `)
      .eq('call_id', callId)
      .order('confirmed_at', { ascending: true })

    if (confirmationsError) {
      logger.error('Failed to fetch confirmations', { callId, error: confirmationsError })
      return NextResponse.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch confirmations' } },
        { status: 500 }
      )
    }

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

    // Insert confirmation
    const { data: confirmation, error: insertError } = await supabaseAdmin
      .from('call_confirmations')
      .insert({
        call_id: callId,
        organization_id: member.organization_id,
        confirmation_type,
        confirmation_label: confirmation_label || null,
        prompt_text,
        confirmer_role,
        confirmed_at: new Date().toISOString(),
        recording_timestamp_seconds: recording_timestamp_seconds ?? null,
        captured_by: 'human', // Per AI Role Policy: only humans capture confirmations
        captured_by_user_id: userId,
        verification_method: verification_method || 'verbal',
        notes: notes || null,
      })
      .select()
      .single()

    if (insertError) {
      logger.error('Failed to insert confirmation', { callId, error: insertError })
      return NextResponse.json(
        { success: false, error: { code: 'INSERT_ERROR', message: 'Failed to save confirmation' } },
        { status: 500 }
      )
    }

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

  } catch (error) {
    logger.error('Confirmations POST error', { error })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
