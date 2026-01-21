/**
 * GET/POST /api/attention/policies
 * List and create attention policies (admin only for create)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

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

        const { data: policies } = await supabaseAdmin
            .from('attention_policies')
            .select('*')
            .eq('organization_id', session.user.orgId)
            .order('priority', { ascending: true })

        return NextResponse.json({
            success: true,
            policies: policies || []
        })
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
        const { data: membership } = await supabaseAdmin
            .from('org_members')
            .select('role')
            .eq('organization_id', session.user.orgId)
            .eq('user_id', session.user.id)
            .single()

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
        const { error } = await supabaseAdmin
            .from('attention_policies')
            .insert({
                id: policyId,
                organization_id: session.user.orgId,
                name,
                description,
                policy_type,
                policy_config,
                priority: priority || 100,
                is_enabled: true,
                created_by: session.user.id
            })

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 })
        }

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
