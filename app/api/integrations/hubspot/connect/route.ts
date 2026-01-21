/**
 * GET /api/integrations/hubspot/connect
 * Initiate HubSpot OAuth flow (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getAuthorizationUrl } from '@/lib/services/crmProviders/hubspot'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
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

        // Generate secure state parameter (encodes org ID and user ID for callback)
        const stateData = {
            orgId: session.user.orgId,
            userId: session.user.id,
            nonce: randomBytes(16).toString('hex'),
            ts: Date.now()
        }
        const state = Buffer.from(JSON.stringify(stateData)).toString('base64url')

        // Get authorization URL
        const authUrl = getAuthorizationUrl(state)

        // Redirect to HubSpot
        return NextResponse.redirect(authUrl)
    } catch (err: unknown) {
        return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : 'OAuth initialization failed'
        }, { status: 500 })
    }
}
