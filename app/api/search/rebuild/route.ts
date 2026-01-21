/**
 * POST /api/search/rebuild
 * 
 * Rebuild search index for organization.
 * Admin only. Creates new versions (append-only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { SearchBuilder } from '@/lib/services/searchBuilder'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

        logger.info('Search rebuild initiated', { orgId: session.user.orgId, userId: session.user.id })

        const builder = new SearchBuilder(supabaseAdmin)
        const result = await builder.rebuildForOrganization(session.user.orgId, session.user.id)

        return NextResponse.json({
            success: true,
            message: 'Search index rebuilt',
            totalIndexed: result.totalIndexed,
            note: 'Old document versions retained for audit trail.'
        })
    } catch (err: unknown) {
        logger.error('Search rebuild failed', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Rebuild failed' }, { status: 500 })
    }
}
