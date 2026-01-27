/**
 * GET /api/integrations/hubspot/connect
 * Initiate HubSpot OAuth flow (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getAuthorizationUrl } from '@/lib/services/crmProviders/hubspot'
import { randomBytes } from 'crypto'
import pgClient from '@/lib/pgClient'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'


export async function GET(req: NextRequest) {
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
