/**
 * GET/POST /api/attention/digests
 * List digests and trigger generation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { AttentionService } from '@/lib/services/attentionService'
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
        const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)

        const attentionService = new AttentionService(supabaseAdmin)
        const digests = await attentionService.getDigests(session.user.orgId, limit)

        return NextResponse.json({
            success: true,
            digests
        })
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
        const { digest_type, period_hours } = body

        const hours = period_hours || 24  // Default to last 24 hours
        const periodEnd = new Date()
        const periodStart = new Date(periodEnd.getTime() - hours * 60 * 60 * 1000)

        const attentionService = new AttentionService(supabaseAdmin)
        const result = await attentionService.generateDigest(
            session.user.orgId,
            digest_type || 'on_demand',
            periodStart,
            periodEnd,
            session.user.id
        )

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 })
        }

        logger.info('Digest generated on demand', { digestId: result.digestId, hours })

        return NextResponse.json({
            success: true,
            digest_id: result.digestId,
            message: `Digest generated for last ${hours} hours`
        })
    } catch (err: unknown) {
        logger.error('Digest generation failed', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Generation failed' }, { status: 500 })
    }
}
