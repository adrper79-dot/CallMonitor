/**
 * POST /api/voice/numbers/retire
 * Retire a caller ID number (admin only)
 * Preserves historical call records
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
        const { caller_id_number_id, reason } = body

        if (!caller_id_number_id) {
            return ApiErrors.badRequest('caller_id_number_id required')
        }

        // Verify caller ID belongs to this org
        const { data: callerId } = await supabaseAdmin
            .from('caller_id_numbers')
            .select('id, organization_id, phone_number')
            .eq('id', caller_id_number_id)
            .eq('organization_id', session.user.orgId)
            .single()

        if (!callerId) {
            return ApiErrors.notFound('Caller ID not found')
        }

        const callerIdService = new CallerIdService(supabaseAdmin)
        const result = await callerIdService.retireNumber(
            caller_id_number_id,
            session.user.id,
            reason
        )

        if (!result.success) {
            return ApiErrors.badRequest(result.error)
        }

        logger.info('Caller ID number retired', {
            callerIdNumberId: caller_id_number_id,
            phone: '[REDACTED]',
            retiredBy: session.user.id
        })

        return NextResponse.json({
            success: true,
            message: 'Caller ID retired successfully. Historical call records preserved.'
        })
    } catch (err: unknown) {
        logger.error('Failed to retire caller ID', err instanceof Error ? err : new Error(String(err)))
        return ApiErrors.internal('Failed to retire caller ID')
    }
}
