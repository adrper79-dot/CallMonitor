/**
 * GET/POST /api/attention/policies
 * List and create attention policies (admin only for create)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'
import pgClient from '@/lib/pgClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'


export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.orgId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const res = await pgClient.query(`SELECT * FROM attention_policies WHERE organization_id = $1 ORDER BY priority ASC`, [session.user.orgId])
        return NextResponse.json({ success: true, policies: res?.rows || [] })
    } catch (err: unknown) {
        logger.error('Failed to list policies', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Failed to list policies' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.orgId || !session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        // Check admin role
        const membershipRes = await pgClient.query(`SELECT role FROM org_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1`, [session.user.orgId, session.user.id])
        const membership = membershipRes?.rows && membershipRes.rows.length ? membershipRes.rows[0] : null
        if (!membership || !['owner', 'admin'].includes(membership.role)) {
            return NextResponse.json({ success: false, error: 'Admin role required' }, { status: 403 })
        }

        const body = await req.json()
        const { name, description, policy_type, policy_config, priority } = body

        if (!name || !policy_type || !policy_config) {
            return NextResponse.json({
                success: false,
                error: 'name, policy_type, and policy_config required'
            }, { status: 400 })
        }

        const validTypes = ['quiet_hours', 'threshold', 'recurring_suppress', 'keyword_escalate', 'custom']
        if (!validTypes.includes(policy_type)) {
            return NextResponse.json({
                success: false,
                error: 'Invalid policy_type'
            }, { status: 400 })
        }

        const policyId = uuidv4()
        await pgClient.query(`INSERT INTO attention_policies (id, organization_id, name, description, policy_type, policy_config, priority, is_enabled, created_by, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [policyId, session.user.orgId, name, description, policy_type, policy_config, priority || 100, true, session.user.id, new Date().toISOString()])

        logger.info('Attention policy created', { policyId, type: policy_type })

        return NextResponse.json({
            success: true,
            policy_id: policyId,
            message: 'Policy created'
        })
    } catch (err: unknown) {
        logger.error('Failed to create policy', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Failed to create policy' }, { status: 500 })
    }
}
