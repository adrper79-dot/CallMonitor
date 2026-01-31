/**
 * GET /api/attention/events
 * List attention events with their latest decisions
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { DecisionType } from '@/lib/services/attentionService'
import { logger } from '@/lib/logger'
import pgClient from '@/lib/pgClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'


export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.orgId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
        const decisionFilter = searchParams.get('decision') as DecisionType | null

        const res = await pgClient.query(`
        SELECT ae.*, ad.id as decision_id, ad.decision as decision_decision, ad.reason as decision_reason, ad.policy_id as decision_policy_id, ad.confidence as decision_confidence, ad.produced_by as decision_produced_by, ad.produced_by_model as decision_produced_by_model, ad.produced_by_user_id as decision_produced_by_user_id
        FROM attention_events ae
        LEFT JOIN LATERAL (
          SELECT * FROM attention_decisions ad WHERE ad.attention_event_id = ae.id ORDER BY ad.created_at DESC LIMIT 1
        ) ad ON true
        WHERE ae.organization_id = $1
        ORDER BY ae.occurred_at DESC
        LIMIT $2
        `, [session.user.orgId, limit])

        const rows = res?.rows || []
        const events = rows.map((r: any) => {
            const decision = r.decision_id ? {
                id: r.decision_id,
                decision: r.decision_decision,
                reason: r.decision_reason,
                policy_id: r.decision_policy_id,
                confidence: r.decision_confidence,
                produced_by: r.decision_produced_by,
                produced_by_model: r.decision_produced_by_model,
                produced_by_user_id: r.decision_produced_by_user_id
            } : undefined

            // strip prefixed decision_* fields
            const { decision_id, decision_decision, decision_reason, decision_policy_id, decision_confidence, decision_produced_by, decision_produced_by_model, decision_produced_by_user_id, ...eventFields } = r

            return { ...eventFields, decision }
        })

        const filtered = decisionFilter ? events.filter((e: any) => e.decision?.decision === decisionFilter) : events

        return NextResponse.json({ success: true, events: filtered })
    } catch (err: unknown) {
        logger.error('Failed to list attention events', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Failed to list events' }, { status: 500 })
    }
}
