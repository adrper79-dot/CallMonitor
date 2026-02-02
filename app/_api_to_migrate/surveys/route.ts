import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/pgClient'
import { getRBACContext } from '@/lib/middleware/rbac'
import { AppError } from '@/types/app-error'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'

// Force dynamic rendering - uses headers via getServerSession
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Surveys API
 * 
 * GET /api/surveys - List surveys for organization
 * POST /api/surveys - Create or update a survey
 * DELETE /api/surveys - Delete a survey
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

    // Check plan - surveys require Insights plan (also allow business/enterprise)
    if (!['insights', 'global', 'business', 'enterprise'].includes(rbacContext.plan)) {
      const err = new AppError({ code: 'PLAN_LIMIT_EXCEEDED', message: 'Plan does not support surveys', user_message: 'This feature requires Insights plan or higher', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 403 })
    }

    // Fetch surveys
    const { rows: surveys } = await query(
      `SELECT id, name, description, questions, is_active, created_at 
       FROM surveys 
       WHERE organization_id = $1 
       ORDER BY created_at DESC`,
      [organizationId]
    )

    return NextResponse.json({
      success: true,
      surveys: surveys || []
    })
  } catch (err: any) {
    logger.error('GET /api/surveys failed', err, { organizationId, userId })
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

    let survey
    const now = new Date().toISOString()

    if (id) {
      // Update existing survey
      const { rows } = await query(
        `UPDATE surveys 
         SET name = $1, description = $2, questions = $3, is_active = $4, updated_at = $5
         WHERE id = $6 AND organization_id = $7
         RETURNING *`,
        [name, description || null, JSON.stringify(questions || []), is_active ?? true, now, id, organization_id]
      )

      if (!rows || rows.length === 0) {
        throw new Error('Survey not found or not owned by organization')
      }
      survey = rows[0]
    } else {
      // Create new survey
      const surveyId = uuidv4()
      const { rows } = await query(
        `INSERT INTO surveys (id, organization_id, name, description, questions, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         RETURNING *`,
        [
          surveyId,
          organization_id,
          name,
          description || null,
          JSON.stringify(questions || []),
          is_active ?? true,
          now
        ]
      )

      survey = rows[0]
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
    await query(
      `DELETE FROM surveys WHERE id = $1 AND organization_id = $2`,
      [surveyId, organizationId]
    )

    return NextResponse.json({
      success: true
    })
  } catch (err: any) {
    const e = err instanceof AppError ? err : new AppError({ code: 'SURVEYS_ERROR', message: err?.message ?? 'Unexpected', user_message: 'Failed to delete survey', severity: 'HIGH' })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } }, { status: 500 })
  }
}
