/**
 * POST /api/voice/numbers/revoke
 * Revoke caller ID permission from a user (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/pgClient'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'


export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.orgId || !session?.user?.id) {
            return ApiErrors.unauthorized()
        }

        // Check admin role
        const memRes = await query('SELECT role FROM org_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1', [session.user.orgId, session.user.id])
        const membership = memRes.rows?.[0]
        if (!membership || !['owner', 'admin'].includes(membership.role)) {
            return ApiErrors.forbidden()
        }

        const body = await req.json()
        const { caller_id_number_id, user_id, reason } = body

        if (!caller_id_number_id || !user_id) {
            return ApiErrors.badRequest('caller_id_number_id and user_id required')
        }

        // Revoke permission
        try {
            const updateRes = await query(
                `UPDATE caller_id_permissions SET is_active = FALSE, revoked_at = $1, revoked_by = $2
                 WHERE organization_id = $3 AND caller_id_number_id = $4 AND user_id = $5 RETURNING id`,
                [new Date().toISOString(), session.user.id, session.user.orgId, caller_id_number_id, user_id]
            )

            if (!updateRes.rows || updateRes.rows.length === 0) {
                return ApiErrors.badRequest('Permission not found')
            }

            // Audit log (best-effort)
            void query(
                `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, actor_type, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [require('uuid').v4(), session.user.orgId, session.user.id, 'caller_id_permission', updateRes.rows[0].id, 'revoke', 'human', new Date().toISOString()]
            ).catch((e: any) => logger.warn('Failed to write audit log', e))

            logger.info('Caller ID permission revoked', {
                callerIdNumberId: caller_id_number_id,
                targetUserId: user_id,
                revokedBy: session.user.id
            })

            return NextResponse.json({ success: true, message: 'Permission revoked successfully' })
        } catch (e: any) {
            logger.error('Failed to revoke permission', e)
            return ApiErrors.internal('Failed to revoke permission')
        }
    } catch (err: unknown) {
        logger.error('Failed to revoke caller ID', err instanceof Error ? err : new Error(String(err)))
        return ApiErrors.internal('Failed to revoke caller ID')
    }
}
