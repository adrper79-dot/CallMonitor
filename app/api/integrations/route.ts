/**
 * GET /api/integrations
 * List all CRM integrations for the organization
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

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.orgId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const crmService = new CRMService(supabaseAdmin)
        const integrations = await crmService.getIntegrations(session.user.orgId)

        // Return without sensitive data
        const sanitized = integrations.map(int => ({
            id: int.id,
            provider: int.provider,
            provider_account_name: int.provider_account_name,
            status: int.status,
            sync_enabled: int.sync_enabled,
            connected_at: int.connected_at,
            error_message: int.error_message
        }))

        return NextResponse.json({
            success: true,
            integrations: sanitized
        })
    } catch (err: unknown) {
        logger.error('Failed to list integrations', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Failed to list integrations' }, { status: 500 })
    }
}
