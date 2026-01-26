/**
 * POST /api/attention/decisions/[id]/override
 * Human override of an attention decision
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { DecisionType } from '@/lib/services/attentionService'
import { logger } from '@/lib/logger'
import pgClient from '@/lib/pgClient'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'


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

        // Verify event belongs to org and fetch input_refs
        const eventRes = await pgClient.query(`SELECT organization_id, input_refs FROM attention_events WHERE id = $1 LIMIT 1`, [eventId])
        const event = eventRes?.rows && eventRes.rows.length ? eventRes.rows[0] : null

        if (!event || event.organization_id !== session.user.orgId) {
            return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
        }

        // Create new decision (append-only)
        const decisionId = uuidv4()
        await pgClient.query(`INSERT INTO attention_decisions (id, organization_id, attention_event_id, decision, reason, policy_id, confidence, uncertainty_notes, produced_by, produced_by_model, produced_by_user_id, input_refs, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [decisionId, session.user.orgId, eventId, decision, reason, null, 100, null, 'human', null, session.user.id, event.input_refs, new Date().toISOString()])

        // If escalate, write audit log (best-effort)
        if (decision === 'escalate') {
            try {
                await pgClient.query(`INSERT INTO audit_logs (id, organization_id, resource_type, resource_id, action, actor_type, actor_label, after, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [uuidv4(), session.user.orgId, 'attention_decision', decisionId, 'escalate', 'human', session.user.id, { event_id: eventId, reason, policy_id: null }, new Date().toISOString()])
            } catch (e) {
                logger.warn('Failed to write audit log for escalation', e instanceof Error ? e : new Error(String(e)))
            }
        }

        logger.info('Human override on attention event', { eventId, decision, userId: session.user.id })

        return NextResponse.json({ success: true, decision_id: decisionId, message: 'Override applied' })
    } catch (err: unknown) {
        logger.error('Override failed', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Override failed' }, { status: 500 })
    }
}
