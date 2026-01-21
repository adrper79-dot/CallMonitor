/**
 * POST /api/integrations/[id]/disconnect
 * Disconnect a CRM integration (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { CRMService } from '@/lib/services/crmService'
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

        const { id: integrationId } = await params

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

        // Verify integration belongs to this org
        const crmService = new CRMService(supabaseAdmin)
        const integration = await crmService.getIntegration(integrationId)

        if (!integration || integration.organization_id !== session.user.orgId) {
            return NextResponse.json({ success: false, error: 'Integration not found' }, { status: 404 })
        }

        // Disconnect
        const result = await crmService.disconnectIntegration(integrationId, session.user.id)

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 })
        }

        logger.info('Integration disconnected', { integrationId, provider: integration.provider })

        return NextResponse.json({ success: true, message: 'Integration disconnected' })
    } catch (err: unknown) {
        logger.error('Disconnect failed', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Disconnect failed' }, { status: 500 })
    }
}
