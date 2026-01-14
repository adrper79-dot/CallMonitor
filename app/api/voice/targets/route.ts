import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { getRBACContext } from '@/lib/middleware/rbac'
import { AppError } from '@/types/app-error'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'

// Force dynamic rendering - uses headers via getServerSession
export const dynamic = 'force-dynamic'

/**
 * Voice Targets API
 * 
 * GET /api/voice/targets - List voice targets for organization
 * POST /api/voice/targets - Create a new voice target
 * DELETE /api/voice/targets - Delete a voice target
 * Per MASTER_ARCHITECTURE.txt UI→API→Table contract
 */
export async function GET(req: Request) {
  let organizationId: string | null = null
  let userId: string | null = null
  
  try {
    const session = await getServerSession(authOptions)
    userId = (session?.user as any)?.id ?? null

    if (!userId) {
      const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Authentication required', user_message: 'Authentication required', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    const url = new URL(req.url)
    organizationId = url.searchParams.get('orgId') || url.searchParams.get('organization_id')

    if (!organizationId) {
      const err = new AppError({ code: 'ORG_REQUIRED', message: 'Organization ID required', user_message: 'Organization ID required', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
    }

    // RBAC check
    const rbacContext = await getRBACContext(organizationId, userId)
    if (!rbacContext) {
      const err = new AppError({ code: 'UNAUTHORIZED', message: 'Not authorized', user_message: 'Not authorized for this organization', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    // Fetch voice targets
    const { data: targets, error: targetsErr } = await supabaseAdmin
      .from('voice_targets')
      .select('id, phone_number, name, description, is_active, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (targetsErr) {
      logger.error('Failed to fetch voice_targets', targetsErr, { organizationId, userId })
      const err = new AppError({ code: 'DB_QUERY_FAILED', message: 'Failed to fetch voice targets', user_message: 'Could not retrieve voice targets', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      targets: targets || []
    })
  } catch (err: any) {
    logger.error('GET /api/voice/targets failed', err, { organizationId, userId })
    const e = err instanceof AppError ? err : new AppError({ code: 'VOICE_TARGETS_ERROR', message: err?.message ?? 'Unexpected', user_message: 'Failed to fetch voice targets', severity: 'HIGH' })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } }, { status: 500 })
  }
}

/**
 * POST /api/voice/targets - Create a new voice target
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null

    if (!userId) {
      const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Authentication required', user_message: 'Authentication required', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    const body = await req.json()
    const { organization_id, phone_number, name, description } = body

    if (!organization_id) {
      const err = new AppError({ code: 'ORG_REQUIRED', message: 'Organization ID required', user_message: 'Organization ID required', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
    }

    if (!phone_number) {
      const err = new AppError({ code: 'VALIDATION_ERROR', message: 'Phone number required', user_message: 'Phone number is required', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
    }

    // Validate E.164 format
    const e164Regex = /^\+[1-9]\d{1,14}$/
    if (!e164Regex.test(phone_number)) {
      const err = new AppError({ code: 'VALIDATION_ERROR', message: 'Invalid phone format', user_message: 'Phone number must be in E.164 format (e.g., +12025551234)', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
    }

    // RBAC check - require owner or admin
    const rbacContext = await getRBACContext(organization_id, userId)
    if (!rbacContext) {
      const err = new AppError({ code: 'UNAUTHORIZED', message: 'Not authorized', user_message: 'Not authorized for this organization', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    if (!['owner', 'admin'].includes(rbacContext.role)) {
      const err = new AppError({ code: 'FORBIDDEN', message: 'Insufficient permissions', user_message: 'Only owners and admins can add targets', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 403 })
    }

    // Create voice target
    const targetId = uuidv4()
    const { data: target, error: insertErr } = await supabaseAdmin
      .from('voice_targets')
      .insert({
        id: targetId,
        organization_id,
        phone_number,
        name: name || null,
        description: description || null,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertErr) {
      logger.error('Failed to create voice target', insertErr)
      const err = new AppError({ code: 'DB_INSERT_FAILED', message: 'Failed to create voice target', user_message: 'Could not create voice target', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      target
    })
  } catch (err: any) {
    const e = err instanceof AppError ? err : new AppError({ code: 'VOICE_TARGETS_ERROR', message: err?.message ?? 'Unexpected', user_message: 'Failed to create voice target', severity: 'HIGH' })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } }, { status: 500 })
  }
}

/**
 * DELETE /api/voice/targets - Delete a voice target
 */
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null

    if (!userId) {
      const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Authentication required', user_message: 'Authentication required', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    const url = new URL(req.url)
    const targetId = url.searchParams.get('id')
    const organizationId = url.searchParams.get('orgId') || url.searchParams.get('organization_id')

    if (!targetId || !organizationId) {
      const err = new AppError({ code: 'VALIDATION_ERROR', message: 'Target ID and Organization ID required', user_message: 'Missing required parameters', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
    }

    // RBAC check - require owner or admin
    const rbacContext = await getRBACContext(organizationId, userId)
    if (!rbacContext) {
      const err = new AppError({ code: 'UNAUTHORIZED', message: 'Not authorized', user_message: 'Not authorized for this organization', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    if (!['owner', 'admin'].includes(rbacContext.role)) {
      const err = new AppError({ code: 'FORBIDDEN', message: 'Insufficient permissions', user_message: 'Only owners and admins can delete targets', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 403 })
    }

    // Delete voice target
    const { error: deleteErr } = await supabaseAdmin
      .from('voice_targets')
      .delete()
      .eq('id', targetId)
      .eq('organization_id', organizationId)

    if (deleteErr) {
      logger.error('Failed to delete voice target', deleteErr)
      const err = new AppError({ code: 'DB_DELETE_FAILED', message: 'Failed to delete voice target', user_message: 'Could not delete voice target', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }

    return NextResponse.json({
      success: true
    })
  } catch (err: any) {
    const e = err instanceof AppError ? err : new AppError({ code: 'VOICE_TARGETS_ERROR', message: err?.message ?? 'Unexpected', user_message: 'Failed to delete voice target', severity: 'HIGH' })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } }, { status: 500 })
  }
}
