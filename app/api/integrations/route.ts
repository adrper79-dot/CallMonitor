/**
 * GET /api/integrations
 * List all CRM integrations for the organization
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import pgClient from '@/lib/pgClient'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'


export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.orgId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const res = await pgClient.query(`SELECT id, provider, provider_account_name, status, sync_enabled, connected_at, error_message FROM integrations WHERE organization_id = $1 ORDER BY created_at DESC`, [session.user.orgId])
        const integrations = res?.rows || []
        const sanitized = integrations.map((int: any) => ({
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
