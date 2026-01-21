/**
 * GET /api/attention/events
 * List attention events with their latest decisions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { AttentionService, DecisionType } from '@/lib/services/attentionService'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.orgId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
        const decisionFilter = searchParams.get('decision') as DecisionType | null

        const attentionService = new AttentionService(supabaseAdmin)
        const events = await attentionService.getRecentEvents(
            session.user.orgId,
            limit,
            decisionFilter || undefined
        )

        return NextResponse.json({
            success: true,
            events
        })
    } catch (err: unknown) {
        logger.error('Failed to list attention events', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Failed to list events' }, { status: 500 })
    }
}
