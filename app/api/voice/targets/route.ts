import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/pgClient'
import { getRBACContext } from '@/lib/middleware/rbac'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'

// Force dynamic rendering - uses headers via getServerSession
export const dynamic = 'force-dynamic'
export const runtime = 'edge'

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
      return ApiErrors.unauthorized()
    }

    const url = new URL(req.url)
    organizationId = url.searchParams.get('orgId') || url.searchParams.get('organization_id')

    if (!organizationId) {
      return ApiErrors.badRequest('Organization ID required')
    }

    // RBAC check
    const rbacContext = await getRBACContext(organizationId, userId)
    if (!rbacContext) {
      return ApiErrors.unauthorized()
    }

    // Fetch voice targets
    // Note: voice_targets table may not exist yet - return empty array if missing
    let targets: any[] = []
    try {
      const { rows } = await query(
        `SELECT id, phone_number, name, description, is_active, created_at 
             FROM voice_targets 
             WHERE organization_id = $1 
             ORDER BY created_at DESC`,
        [organizationId]
      )
      targets = rows
    } catch (targetsErr: any) {
      // If table doesn't exist (42P01 error), return empty array instead of failing
      if (targetsErr.code === '42P01' || targetsErr.message?.includes('does not exist')) {
        logger.info('voice_targets table does not exist yet, returning empty array', { organizationId })
        return NextResponse.json({
          success: true,
          targets: []
        })
      }

      logger.error('Failed to fetch voice_targets', targetsErr, { organizationId, userId })
      return ApiErrors.internal('Failed to fetch voice targets')
    }

    return NextResponse.json({
      success: true,
      targets: targets || []
    })
  } catch (err: any) {
    logger.error('GET /api/voice/targets failed', err, { organizationId, userId })
    return ApiErrors.internal('Internal server error')
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
      return ApiErrors.unauthorized()
    }

    const body = await req.json()
    const { organization_id, phone_number, name, description } = body

    if (!organization_id) {
      return ApiErrors.badRequest('Organization ID required')
    }

    if (!phone_number) {
      return ApiErrors.badRequest('Phone number is required')
    }

    // Validate E.164 format
    const e164Regex = /^\+[1-9]\d{1,14}$/
    if (!e164Regex.test(phone_number)) {
      return ApiErrors.badRequest('Phone number must be in E.164 format (e.g., +12025551234)')
    }

    // RBAC check - require owner or admin
    const rbacContext = await getRBACContext(organization_id, userId)
    if (!rbacContext) {
      return ApiErrors.unauthorized()
    }

    if (!['owner', 'admin'].includes(rbacContext.role)) {
      return ApiErrors.forbidden()
    }

    // Create voice target
    const targetId = uuidv4()
    let target: any = null

    try {
      const { rows } = await query(
        `INSERT INTO voice_targets (id, organization_id, phone_number, name, description, is_active, created_at)
             VALUES ($1, $2, $3, $4, $5, true, NOW())
             RETURNING *`,
        [targetId, organization_id, phone_number, name || null, description || null]
      )
      target = rows[0]
    } catch (insertErr: any) {
      logger.error('Failed to create voice target', insertErr)
      return ApiErrors.internal('Failed to create voice target')
    }

    return NextResponse.json({
      success: true,
      target
    })
  } catch (err: any) {
    return ApiErrors.internal(err)
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
      return ApiErrors.unauthorized()
    }

    const url = new URL(req.url)
    const targetId = url.searchParams.get('id')
    const organizationId = url.searchParams.get('orgId') || url.searchParams.get('organization_id')

    if (!targetId || !organizationId) {
      return ApiErrors.badRequest('Target ID and Organization ID required')
    }

    // RBAC check - require owner or admin
    const rbacContext = await getRBACContext(organizationId, userId)
    if (!rbacContext) {
      return ApiErrors.unauthorized()
    }

    if (!['owner', 'admin'].includes(rbacContext.role)) {
      return ApiErrors.forbidden()
    }

    // Delete voice target
    try {
      await query(
        `DELETE FROM voice_targets WHERE id = $1 AND organization_id = $2`,
        [targetId, organizationId]
      )
    } catch (deleteErr: any) {
      logger.error('Failed to delete voice target', deleteErr)
      return ApiErrors.internal('Failed to delete voice target')
    }

    return NextResponse.json({
      success: true
    })
  } catch (err: any) {
    return ApiErrors.internal(err)
  }
}
