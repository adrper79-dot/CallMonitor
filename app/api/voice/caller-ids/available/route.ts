/**
 * GET /api/voice/caller-ids/available
 * List caller IDs available to the current user
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { CallerIdService } from '@/lib/services/callerIdService'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.orgId || !session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const callerIdService = new CallerIdService(supabaseAdmin)
        const available = await callerIdService.getAvailableCallerIds(
            session.user.orgId,
            session.user.id
        )

        // Get default for this user
        const defaultCallerId = await callerIdService.getDefaultCallerId(
            session.user.orgId,
            session.user.id
        )

        return NextResponse.json({
            success: true,
            caller_ids: available,
            default_caller_id: defaultCallerId
        })
    } catch (err: unknown) {
        logger.error('Failed to list available caller IDs', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Failed to list caller IDs' }, { status: 500 })
    }
}
