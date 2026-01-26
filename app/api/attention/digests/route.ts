/**
 * GET/POST /api/attention/digests
 * List digests and trigger generation
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import pgClient from '@/lib/pgClient'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'


export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.orgId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)

        const res = await pgClient.query(`SELECT * FROM digests WHERE organization_id = $1 ORDER BY generated_at DESC LIMIT $2`, [session.user.orgId, limit])
        return NextResponse.json({ success: true, digests: res?.rows || [] })
    } catch (err: unknown) {
        logger.error('Failed to list digests', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Failed to list digests' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.orgId || !session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        // Check admin role for manual trigger
        const membershipRes = await pgClient.query(`SELECT role FROM org_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1`, [session.user.orgId, session.user.id])
        const membership = membershipRes?.rows && membershipRes.rows.length ? membershipRes.rows[0] : null
        if (!membership || !['owner', 'admin'].includes(membership.role)) {
            return NextResponse.json({ success: false, error: 'Admin role required' }, { status: 403 })
        }

        const body = await req.json()
        const { digest_type, period_hours } = body

        const hours = period_hours || 24  // Default to last 24 hours
        const periodEnd = new Date()
        const periodStart = new Date(periodEnd.getTime() - hours * 60 * 60 * 1000)

        // Aggregate decisions in the period
        const decisionsRes = await pgClient.query(`SELECT * FROM attention_decisions WHERE organization_id = $1 AND created_at >= $2 AND created_at <= $3 ORDER BY created_at ASC`, [session.user.orgId, periodStart.toISOString(), periodEnd.toISOString()])
        const decisions = decisionsRes?.rows || []

        const escalated = decisions.filter((d: any) => d.decision === 'escalate').length
        const suppressed = decisions.filter((d: any) => d.decision === 'suppress').length
        const needsReview = decisions.filter((d: any) => d.decision === 'needs_review').length
        const inDigest = decisions.filter((d: any) => d.decision === 'include_in_digest').length

        const summaryParts: string[] = []
        if (escalated > 0) summaryParts.push(`${escalated} escalated`)
        if (needsReview > 0) summaryParts.push(`${needsReview} need review`)
        if (inDigest > 0) summaryParts.push(`${inDigest} in digest`)
        if (suppressed > 0) summaryParts.push(`${suppressed} suppressed`)

        const summaryText = summaryParts.length > 0 ? `${decisions.length} events: ${summaryParts.join(', ')}` : 'No events in this period'

        const digestId = uuidv4()
        await pgClient.query(`INSERT INTO digests (id, organization_id, digest_type, period_start, period_end, summary_text, total_events, escalated_count, suppressed_count, needs_review_count, generated_by, generated_by_user_id, generated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [digestId, session.user.orgId, digest_type || 'on_demand', periodStart.toISOString(), periodEnd.toISOString(), summaryText, decisions.length, escalated, suppressed, needsReview, session.user.id ? 'user-triggered' : 'system', session.user.id || null, new Date().toISOString()])

        const itemsToInclude = decisions.filter((d: any) => ['escalate', 'needs_review', 'include_in_digest'].includes(d.decision))
        for (let i = 0; i < itemsToInclude.length; i++) {
            await pgClient.query(`INSERT INTO digest_items (id, digest_id, attention_decision_id, item_order, is_highlighted) VALUES ($1,$2,$3,$4,$5)`, [uuidv4(), digestId, itemsToInclude[i].id, i + 1, itemsToInclude[i].decision === 'escalate'])
        }

        logger.info('Digest generated on demand', { digestId, hours })

        return NextResponse.json({ success: true, digest_id: digestId, message: `Digest generated for last ${hours} hours` })
    } catch (err: unknown) {
        logger.error('Digest generation failed', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Generation failed' }, { status: 500 })
    }
}
