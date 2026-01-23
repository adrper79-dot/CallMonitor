/**
 * POST /api/voice/numbers/revoke
 * Revoke caller ID permission from a user (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { CallerIdService } from '@/lib/services/callerIdService'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.orgId || !session?.user?.id) {
            return ApiErrors.unauthorized()
        }

        // Check admin role
        const { data: membership } = await supabaseAdmin
            .from('org_members')
            .select('role')
            .eq('organization_id', session.user.orgId)
            .eq('user_id', session.user.id)
            .single()

        if (!membership || !['owner', 'admin'].includes(membership.role)) {
            return ApiErrors.forbidden()
        }

        const body = await req.json()
        const { caller_id_number_id, user_id, reason } = body

        if (!caller_id_number_id || !user_id) {
            return ApiErrors.badRequest('caller_id_number_id and user_id required')
        }

        const callerIdService = new CallerIdService(supabaseAdmin)
        const result = await callerIdService.revokePermission(
            session.user.orgId,
            caller_id_number_id,
            user_id,
            session.user.id,
            reason
        )

        if (!result.success) {
            return ApiErrors.badRequest(result.error)
        }

        logger.info('Caller ID permission revoked', {
            callerIdNumberId: caller_id_number_id,
            targetUserId: user_id,
            revokedBy: session.user.id
        })

        return NextResponse.json({
            success: true,
            message: 'Permission revoked successfully'
        })
    } catch (err: unknown) {
        logger.error('Failed to revoke caller ID', err instanceof Error ? err : new Error(String(err)))
        return ApiErrors.internal('Failed to revoke caller ID')
    }
}
