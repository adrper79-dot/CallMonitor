/**
 * GET /api/voice/caller-ids/available
 * List caller IDs available to the current user
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/pgClient'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.orgId || !session?.user?.id) {
            return ApiErrors.unauthorized()
        }

        // Determine if user is admin
        const memRes = await query('SELECT role FROM org_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1', [session.user.orgId, session.user.id])
        const membership = memRes.rows?.[0]
        const isAdmin = !!membership && ['owner', 'admin'].includes(membership.role)

        let available: any[] = []
        if (isAdmin) {
            const res = await query(
                `SELECT id, phone_number, display_name, is_default
                 FROM caller_id_numbers
                 WHERE organization_id = $1 AND status = 'active' AND is_verified = TRUE
                 ORDER BY is_default DESC`,
                [session.user.orgId]
            )
            available = (res.rows || []).map((r: any) => ({ ...r, permission_type: 'full' }))
        } else {
            const res = await query(
                `SELECT p.permission_type, c.id, c.phone_number, c.display_name, c.is_default
                 FROM caller_id_permissions p
                 JOIN caller_id_numbers c ON c.id = p.caller_id_number_id
                 WHERE p.organization_id = $1 AND p.user_id = $2 AND p.is_active = TRUE`,
                [session.user.orgId, session.user.id]
            )
            available = (res.rows || []).filter((p: any) => p.status !== 'retired').map((p: any) => ({ id: p.id, phone_number: p.phone_number, display_name: p.display_name, is_default: p.is_default, permission_type: p.permission_type }))
        }

        // Resolve default caller id (simple heuristic)
        let defaultCallerId: any = null
        try {
            // Check rules first
            const ruleRes = await query(
                `SELECT r.id, c.id as cid, c.phone_number
                 FROM caller_id_default_rules r
                 JOIN caller_id_numbers c ON c.id = r.caller_id_number_id
                 WHERE r.organization_id = $1 AND r.is_active = TRUE AND (r.user_id = $2 OR r.scope_type = 'organization' OR r.role_scope = (SELECT role FROM org_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1))
                 ORDER BY r.priority ASC LIMIT 1`,
                [session.user.orgId, session.user.id]
            )
            if (ruleRes.rows?.[0]) {
                defaultCallerId = { id: ruleRes.rows[0].cid, phone_number: ruleRes.rows[0].phone_number }
            } else {
                const legacyRes = await query(`SELECT id, phone_number FROM caller_id_numbers WHERE organization_id = $1 AND is_default = TRUE AND status = 'active' AND is_verified = TRUE LIMIT 1`, [session.user.orgId])
                if (legacyRes.rows?.[0]) defaultCallerId = legacyRes.rows[0]
            }
        } catch (e) {
            logger.warn('Failed to resolve default caller id', { error: e })
        }

        return NextResponse.json({ success: true, caller_ids: available, default_caller_id: defaultCallerId })
    } catch (err: unknown) {
        logger.error('Failed to list available caller IDs', err instanceof Error ? err : new Error(String(err)))
        return ApiErrors.internal('Failed to list caller IDs')
    }
}
