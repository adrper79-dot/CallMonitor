/**
 * POST /api/attention/decisions/[id]/override
 * Human override of an attention decision
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

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.orgId || !session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const { id: eventId } = await params
        const body = await req.json()
        const { decision, reason } = body

        if (!decision || !reason) {
            return NextResponse.json({
                success: false,
                error: 'decision and reason required'
            }, { status: 400 })
        }

        const validDecisions: DecisionType[] = ['escalate', 'suppress', 'include_in_digest', 'needs_review']
        if (!validDecisions.includes(decision)) {
            return NextResponse.json({
                success: false,
                error: 'Invalid decision type'
            }, { status: 400 })
        }

        // Verify event belongs to org
        const { data: event } = await supabaseAdmin
            .from('attention_events')
            .select('organization_id')
            .eq('id', eventId)
            .single()

        if (!event || event.organization_id !== session.user.orgId) {
            return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
        }

        const attentionService = new AttentionService(supabaseAdmin)
        const result = await attentionService.humanOverride(
            session.user.orgId,
            eventId,
            decision,
            reason,
            session.user.id
        )

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 })
        }

        logger.info('Human override on attention event', { eventId, decision, userId: session.user.id })

        return NextResponse.json({
            success: true,
            decision_id: result.decisionId,
            message: 'Override applied'
        })
    } catch (err: unknown) {
        logger.error('Override failed', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Override failed' }, { status: 500 })
    }
}
