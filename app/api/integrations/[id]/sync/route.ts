/**
 * POST /api/integrations/[id]/sync
 * Trigger evidence bundle push to CRM for a specific call
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { CRMService } from '@/lib/services/crmService'
import { HubSpotService } from '@/lib/services/crmProviders/hubspot'
import { SalesforceService } from '@/lib/services/crmProviders/salesforce'
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
        const body = await req.json()
        const { callId, exportBundleId } = body

        if (!callId) {
            return NextResponse.json({ success: false, error: 'callId required' }, { status: 400 })
        }

        // Verify integration belongs to this org
        const crmService = new CRMService(supabaseAdmin)
        const integration = await crmService.getIntegration(integrationId)

        if (!integration || integration.organization_id !== session.user.orgId) {
            return NextResponse.json({ success: false, error: 'Integration not found' }, { status: 404 })
        }

        if (integration.status !== 'active') {
            return NextResponse.json({ success: false, error: 'Integration is not active' }, { status: 400 })
        }

        // Fetch call and export bundle
        const { data: call } = await supabaseAdmin
            .from('calls')
            .select('id, phone_number, from_number, started_at, organization_id')
            .eq('id', callId)
            .eq('organization_id', session.user.orgId)
            .single()

        if (!call) {
            return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 })
        }

        // Get export bundle URL (evidence bundle)
        let bundleUrl: string | null = null
        if (exportBundleId) {
            const { data: bundle } = await supabaseAdmin
                .from('call_export_bundles')
                .select('storage_path')
                .eq('id', exportBundleId)
                .eq('organization_id', session.user.orgId)
                .single()

            bundleUrl = bundle?.storage_path
        }

        // If no bundle provided, look for latest
        if (!bundleUrl) {
            const { data: latestBundle } = await supabaseAdmin
                .from('call_export_bundles')
                .select('storage_path')
                .eq('call_id', callId)
                .order('created_at', { ascending: false })
                .limit(1)

            bundleUrl = latestBundle?.[0]?.storage_path
        }

        if (!bundleUrl) {
            return NextResponse.json({
                success: false,
                error: 'No evidence bundle found. Export the call first.'
            }, { status: 400 })
        }

        // Push to CRM based on provider
        let result: { success: boolean; error?: string }

        if (integration.provider === 'hubspot') {
            const hubspot = new HubSpotService(supabaseAdmin)
            result = await hubspot.pushEvidenceBundle(
                integrationId,
                callId,
                bundleUrl,
                call.phone_number,
                new Date(call.started_at),
                session.user.id
            )
        } else if (integration.provider === 'salesforce') {
            const salesforce = new SalesforceService(supabaseAdmin)
            result = await salesforce.pushEvidenceBundle(
                integrationId,
                callId,
                bundleUrl,
                call.phone_number,
                new Date(call.started_at),
                session.user.id
            )
        } else {
            return NextResponse.json({
                success: false,
                error: `Provider ${integration.provider} not supported`
            }, { status: 400 })
        }

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 })
        }

        return NextResponse.json({
            success: true,
            message: `Evidence bundle synced to ${integration.provider}`
        })
    } catch (err: unknown) {
        logger.error('Sync failed', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Sync failed' }, { status: 500 })
    }
}
