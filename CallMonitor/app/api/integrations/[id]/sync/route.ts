/**
 * POST /api/integrations/[id]/sync
 * Trigger evidence bundle push to CRM for a specific call
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import pgClient from '@/lib/pgClient'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'


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
        const body = await req.json()
        const { callId, exportBundleId } = body

        if (!callId) {
            return NextResponse.json({ success: false, error: 'callId required' }, { status: 400 })
        }

        // Verify integration belongs to this org
        const intRes = await pgClient.query('SELECT * FROM integrations WHERE id = $1 LIMIT 1', [integrationId])
        const integration = intRes.rows?.[0]
        if (!integration || integration.organization_id !== session.user.orgId) {
            return NextResponse.json({ success: false, error: 'Integration not found' }, { status: 404 })
        }

        if (integration.status !== 'active') {
            return NextResponse.json({ success: false, error: 'Integration is not active' }, { status: 400 })
        }

        // Fetch call and export bundle
        const callRes = await pgClient.query('SELECT id, phone_number, from_number, started_at, organization_id FROM calls WHERE id = $1 AND organization_id = $2 LIMIT 1', [callId, session.user.orgId])
        const call = callRes.rows?.[0]
        if (!call) return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 })

        // Get export bundle URL (evidence bundle)
        let bundleUrl: string | null = null
        if (exportBundleId) {
            const bundleRes = await pgClient.query('SELECT storage_path FROM call_export_bundles WHERE id = $1 AND organization_id = $2 LIMIT 1', [exportBundleId, session.user.orgId])
            bundleUrl = bundleRes.rows?.[0]?.storage_path
        }

        // If no bundle provided, look for latest
        if (!bundleUrl) {
            const latestRes = await pgClient.query('SELECT storage_path FROM call_export_bundles WHERE call_id = $1 ORDER BY created_at DESC LIMIT 1', [callId])
            bundleUrl = latestRes.rows?.[0]?.storage_path
        }

        if (!bundleUrl) {
            return NextResponse.json({
                success: false,
                error: 'No evidence bundle found. Export the call first.'
            }, { status: 400 })
        }

        // Push to CRM based on provider
        // NOTE: provider-specific services must be refactored to use pgClient; returning 501 until implemented
        return NextResponse.json({ success: false, error: 'Provider integration not yet converted to Neon (work in progress)' }, { status: 501 })
    } catch (err: unknown) {
        logger.error('Sync failed', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Sync failed' }, { status: 500 })
    }
}
