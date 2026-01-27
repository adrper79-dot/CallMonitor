/**
 * POST /api/voice/numbers/assign
 * Assign caller ID permission to a user (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/pgClient'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'


export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.orgId || !session?.user?.id) {
            return ApiErrors.unauthorized()
        }

        // Check admin role
        const memRes = await query(
            'SELECT role FROM org_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1',
            [session.user.orgId, session.user.id]
        )
        const membership = memRes.rows?.[0]
        if (!membership || !['owner', 'admin'].includes(membership.role)) {
            return ApiErrors.forbidden()
        }

        const body = await req.json()
        const { caller_id_number_id, user_id, permission_type } = body

        if (!caller_id_number_id || !user_id) {
            return ApiErrors.badRequest('caller_id_number_id and user_id required')
        }

        // Verify caller ID belongs to this org
        const cidRes = await query(
            'SELECT id, organization_id FROM caller_id_numbers WHERE id = $1 AND organization_id = $2 LIMIT 1',
            [caller_id_number_id, session.user.orgId]
        )
        const callerId = cidRes.rows?.[0]
        if (!callerId) return ApiErrors.notFound('Caller ID not found')

        // Verify target user is in org
        const targetRes = await query(
            'SELECT user_id FROM org_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1',
            [session.user.orgId, user_id]
        )
        const targetMembership = targetRes.rows?.[0]
        if (!targetMembership) return ApiErrors.badRequest('User not in organization')

        // Grant permission (upsert)
        const permissionId = uuidv4()
        try {
            const upsertSql = `INSERT INTO caller_id_permissions (id, organization_id, caller_id_number_id, user_id, permission_type, is_active, granted_by, granted_at, revoked_at, revoked_by)
                VALUES ($1,$2,$3,$4,$5,true,$6,$7,NULL,NULL)
                ON CONFLICT (organization_id, caller_id_number_id, user_id)
                DO UPDATE SET permission_type = EXCLUDED.permission_type, is_active = TRUE, granted_by = EXCLUDED.granted_by, granted_at = EXCLUDED.granted_at, revoked_at = NULL, revoked_by = NULL
                RETURNING id`

            const upsertRes = await query(upsertSql, [
                permissionId,
                session.user.orgId,
                caller_id_number_id,
                user_id,
                permission_type || 'use',
                session.user.id,
                new Date().toISOString()
            ])

            const created = upsertRes.rows?.[0]
            if (!created) throw new Error('Failed to upsert permission')

            // Audit log (best-effort)
            void query(
                `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, actor_type, after, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [uuidv4(), session.user.orgId, session.user.id, 'caller_id_permission', created.id, 'grant', 'human', JSON.stringify({ target_user_id: user_id, caller_id_number_id, permission_type: permission_type || 'use' }), new Date().toISOString()]
            ).catch((e: any) => logger.warn('Failed to write audit log', e))

            logger.info('Caller ID permission granted', {
                callerIdNumberId: caller_id_number_id,
                targetUserId: user_id,
                grantedBy: session.user.id
            })

            return NextResponse.json({ success: true, permission_id: created.id, message: 'Permission granted successfully' })
        } catch (e: any) {
            logger.error('Failed to grant permission', e)
            return ApiErrors.badRequest('Failed to grant permission')
        }
    } catch (err: unknown) {
        logger.error('Failed to assign caller ID', err instanceof Error ? err : new Error(String(err)))
        return ApiErrors.internal('Failed to assign caller ID')
    }
}
