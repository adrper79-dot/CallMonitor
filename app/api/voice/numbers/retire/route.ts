/**
 * POST /api/voice/numbers/retire
 * Retire a caller ID number (admin only)
 * Preserves historical call records
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/pgClient'
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
        const memRes = await query('SELECT role FROM org_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1', [session.user.orgId, session.user.id])
        const membership = memRes.rows?.[0]
        if (!membership || !['owner', 'admin'].includes(membership.role)) {
            return ApiErrors.forbidden()
        }

        const body = await req.json()
        const { caller_id_number_id, reason } = body

        if (!caller_id_number_id) {
            return ApiErrors.badRequest('caller_id_number_id required')
        }

        // Verify caller ID belongs to this org
        const cidRes = await query('SELECT id, organization_id, phone_number FROM caller_id_numbers WHERE id = $1 AND organization_id = $2 LIMIT 1', [caller_id_number_id, session.user.orgId])
        const callerId = cidRes.rows?.[0]
        if (!callerId) return ApiErrors.notFound('Caller ID not found')

        try {
            await query('UPDATE caller_id_numbers SET status = $1, updated_at = $2 WHERE id = $3', ['retired', new Date().toISOString(), caller_id_number_id])

            // Deactivate permissions for this caller id
            await query('UPDATE caller_id_permissions SET is_active = FALSE, revoked_at = $1 WHERE caller_id_number_id = $2', [new Date().toISOString(), caller_id_number_id])

            // Audit log (best-effort)
            void query(
                `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, actor_type, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [require('uuid').v4(), session.user.orgId, session.user.id, 'caller_id_number', caller_id_number_id, 'retire', 'human', new Date().toISOString()]
            ).catch((e: any) => logger.warn('Failed to write audit log', e))

            logger.info('Caller ID number retired', {
                callerIdNumberId: caller_id_number_id,
                phone: '[REDACTED]',
                retiredBy: session.user.id
            })

            return NextResponse.json({ success: true, message: 'Caller ID retired successfully. Historical call records preserved.' })
        } catch (e: any) {
            logger.error('Failed to retire caller ID', e)
            return ApiErrors.internal('Failed to retire caller ID')
        }
    } catch (err: unknown) {
        logger.error('Failed to retire caller ID', err instanceof Error ? err : new Error(String(err)))
        return ApiErrors.internal('Failed to retire caller ID')
    }
}
