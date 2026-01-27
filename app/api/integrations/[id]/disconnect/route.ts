/**
 * POST /api/integrations/[id]/disconnect
 * Disconnect a CRM integration (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import pgClient from '@/lib/pgClient'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

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

        // Check admin role
        const membershipRes = await pgClient.query(`SELECT role FROM org_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1`, [session.user.orgId, session.user.id])
        const membership = membershipRes?.rows && membershipRes.rows.length ? membershipRes.rows[0] : null

        if (!membership || !['owner', 'admin'].includes(membership.role)) {
            return NextResponse.json({ success: false, error: 'Admin role required' }, { status: 403 })
        }

        // Verify integration belongs to this org
        const intRes = await pgClient.query(`SELECT * FROM integrations WHERE id = $1 LIMIT 1`, [integrationId])
        const integration = intRes?.rows && intRes.rows.length ? intRes.rows[0] : null

        if (!integration || integration.organization_id !== session.user.orgId) {
            return NextResponse.json({ success: false, error: 'Integration not found' }, { status: 404 })
        }

        // Delete tokens
        await pgClient.query(`DELETE FROM oauth_tokens WHERE integration_id = $1`, [integrationId])

        // Update integration status to disconnected
        await pgClient.query(`UPDATE integrations SET status = $1, disconnected_at = $2, updated_at = $3 WHERE id = $4`, ['disconnected', new Date().toISOString(), new Date().toISOString(), integrationId])

        // Log sync operation
        await pgClient.query(`INSERT INTO crm_sync_log (id, organization_id, integration_id, operation, status, created_at) VALUES ($1,$2,$3,$4,$5,$6)`, [uuidv4(), integration.organization_id, integrationId, 'oauth_disconnect', 'success', new Date().toISOString()])

        // Audit log
        await pgClient.query(`INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [uuidv4(), integration.organization_id, session.user.id, 'integration', integrationId, 'disconnect', new Date().toISOString()])

        logger.info('Integration disconnected', { integrationId, provider: integration.provider })

        return NextResponse.json({ success: true, message: 'Integration disconnected' })
    } catch (err: unknown) {
        logger.error('Disconnect failed', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Disconnect failed' }, { status: 500 })
    }
}
