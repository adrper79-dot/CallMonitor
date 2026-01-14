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
 * Surveys API
 * 
 * GET /api/surveys - List surveys for organization
 * POST /api/surveys - Create or update a survey
 * DELETE /api/surveys - Delete a survey
 * Per MASTER_ARCHITECTURE.txt UI→API→Table contract
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null

    if (!userId) {
      const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Authentication required', user_message: 'Authentication required', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    const url = new URL(req.url)
    const organizationId = url.searchParams.get('orgId') || url.searchParams.get('organization_id')

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

    // Check plan - surveys require Insights plan (also allow business/enterprise)
    if (!['insights', 'global', 'business', 'enterprise'].includes(rbacContext.plan)) {
      const err = new AppError({ code: 'PLAN_LIMIT_EXCEEDED', message: 'Plan does not support surveys', user_message: 'This feature requires Insights plan or higher', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 403 })
    }

    // Fetch surveys
    const { data: surveys, error: surveysErr } = await supabaseAdmin
      .from('surveys')
      .select('id, name, description, questions, is_active, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (surveysErr) {
      const err = new AppError({ code: 'DB_QUERY_FAILED', message: 'Failed to fetch surveys', user_message: 'Could not retrieve surveys', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      surveys: surveys || []
    })
  } catch (err: any) {
    const e = err instanceof AppError ? err : new AppError({ code: 'SURVEYS_ERROR', message: err?.message ?? 'Unexpected', user_message: 'Failed to fetch surveys', severity: 'HIGH' })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } }, { status: 500 })
  }
}

/**
 * POST /api/surveys - Create or update a survey
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
    const { id, organization_id, name, description, questions, is_active } = body

    if (!organization_id) {
      const err = new AppError({ code: 'ORG_REQUIRED', message: 'Organization ID required', user_message: 'Organization ID required', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
    }

    if (!name) {
      const err = new AppError({ code: 'VALIDATION_ERROR', message: 'Survey name required', user_message: 'Survey name is required', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
    }

    // RBAC check - require owner or admin
    const rbacContext = await getRBACContext(organization_id, userId)
    if (!rbacContext) {
      const err = new AppError({ code: 'UNAUTHORIZED', message: 'Not authorized', user_message: 'Not authorized for this organization', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    if (!['owner', 'admin'].includes(rbacContext.role)) {
      const err = new AppError({ code: 'FORBIDDEN', message: 'Insufficient permissions', user_message: 'Only owners and admins can manage surveys', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 403 })
    }

    // Check plan - surveys require Insights plan
    if (!['insights', 'global', 'business', 'enterprise'].includes(rbacContext.plan)) {
      const err = new AppError({ code: 'PLAN_LIMIT_EXCEEDED', message: 'Plan does not support surveys', user_message: 'This feature requires Insights plan or higher', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 403 })
    }

    const surveyData = {
      organization_id,
      name,
      description: description || null,
      questions: questions || [],
      is_active: is_active ?? true,
      updated_at: new Date().toISOString()
    }

    let survey
    if (id) {
      // Update existing survey
      const { data, error: updateErr } = await supabaseAdmin
        .from('surveys')
        .update(surveyData)
        .eq('id', id)
        .eq('organization_id', organization_id)
        .select()
        .single()

      if (updateErr) {
        logger.error('Failed to update survey', updateErr)
        const err = new AppError({ code: 'DB_UPDATE_FAILED', message: 'Failed to update survey', user_message: 'Could not update survey', severity: 'HIGH' })
        return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
      }
      survey = data
    } else {
      // Create new survey
      const surveyId = uuidv4()
      const { data, error: insertErr } = await supabaseAdmin
        .from('surveys')
        .insert({
          id: surveyId,
          ...surveyData,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (insertErr) {
        logger.error('Failed to create survey', insertErr)
        const err = new AppError({ code: 'DB_INSERT_FAILED', message: 'Failed to create survey', user_message: 'Could not create survey', severity: 'HIGH' })
        return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
      }
      survey = data
    }

    return NextResponse.json({
      success: true,
      survey
    })
  } catch (err: any) {
    const e = err instanceof AppError ? err : new AppError({ code: 'SURVEYS_ERROR', message: err?.message ?? 'Unexpected', user_message: 'Failed to save survey', severity: 'HIGH' })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } }, { status: 500 })
  }
}

/**
 * DELETE /api/surveys - Delete a survey
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
    const surveyId = url.searchParams.get('id')
    const organizationId = url.searchParams.get('orgId') || url.searchParams.get('organization_id')

    if (!surveyId || !organizationId) {
      const err = new AppError({ code: 'VALIDATION_ERROR', message: 'Survey ID and Organization ID required', user_message: 'Missing required parameters', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
    }

    // RBAC check - require owner or admin
    const rbacContext = await getRBACContext(organizationId, userId)
    if (!rbacContext) {
      const err = new AppError({ code: 'UNAUTHORIZED', message: 'Not authorized', user_message: 'Not authorized for this organization', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    if (!['owner', 'admin'].includes(rbacContext.role)) {
      const err = new AppError({ code: 'FORBIDDEN', message: 'Insufficient permissions', user_message: 'Only owners and admins can delete surveys', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 403 })
    }

    // Delete survey
    const { error: deleteErr } = await supabaseAdmin
      .from('surveys')
      .delete()
      .eq('id', surveyId)
      .eq('organization_id', organizationId)

    if (deleteErr) {
      logger.error('Failed to delete survey', deleteErr)
      const err = new AppError({ code: 'DB_DELETE_FAILED', message: 'Failed to delete survey', user_message: 'Could not delete survey', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }

    return NextResponse.json({
      success: true
    })
  } catch (err: any) {
    const e = err instanceof AppError ? err : new AppError({ code: 'SURVEYS_ERROR', message: err?.message ?? 'Unexpected', user_message: 'Failed to delete survey', severity: 'HIGH' })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } }, { status: 500 })
  }
}
