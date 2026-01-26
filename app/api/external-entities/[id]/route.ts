/**
 * GET /api/external-entities/[id]
 * Get entity details with timeline
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import pgClient from '@/lib/pgClient'

export const dynamic = 'force-dynamic'


export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.orgId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const { id: entityId } = await params
        const orgId = session.user.orgId

        // Fetch entity with identifiers
        const entRes = await pgClient.query(`
          SELECT e.*, COALESCE(json_agg(json_build_object('id', ei.id, 'identifier_type', ei.identifier_type, 'identifier_value', ei.identifier_value, 'observation_count', ei.observation_count, 'is_verified', ei.is_verified) ORDER BY ei.observation_count DESC) FILTER (WHERE ei.id IS NOT NULL), '[]') AS external_entity_identifiers
          FROM external_entities e
          LEFT JOIN external_entity_identifiers ei ON ei.entity_id = e.id
          WHERE e.id = $1 AND e.organization_id = $2
          GROUP BY e.id
          LIMIT 1`, [entityId, orgId])

        const entity = entRes?.rows && entRes.rows.length ? entRes.rows[0] : null
        if (!entity) return NextResponse.json({ success: false, error: 'Entity not found' }, { status: 404 })

        // Timeline: find identifiers, observations, calls, recordings
        const idsRes = await pgClient.query(`SELECT id FROM external_entity_identifiers WHERE organization_id = $1 AND entity_id = $2`, [orgId, entityId])
        const identifierIds = idsRes?.rows?.map((r: any) => r.id) || []
        let timeline: any[] = []
        if (identifierIds.length) {
            const obsRes = await pgClient.query(`SELECT source_type, source_id, role, direction, observed_at FROM external_entity_observations WHERE organization_id = $1 AND identifier_id = ANY($2::uuid[]) ORDER BY observed_at DESC`, [orgId, identifierIds])
            const callIds = Array.from(new Set((obsRes?.rows || []).filter((o: any) => o.source_type === 'call').map((o: any) => o.source_id)))
            if (callIds.length) {
                const callsRes = await pgClient.query(`SELECT id, status, started_at, ended_at, phone_number FROM calls WHERE organization_id = $1 AND id = ANY($2::uuid[]) ORDER BY started_at DESC`, [orgId, callIds])
                const calls = callsRes?.rows || []
                for (const call of calls) {
                    const recRes = await pgClient.query(`SELECT id, url FROM recordings WHERE call_id = $1`, [call.id])
                    timeline.push({ id: call.id, status: call.status, started_at: call.started_at, ended_at: call.ended_at, phone_number: call.phone_number, recordings: recRes?.rows || [] })
                }
            }
        }

        // Unlinked observed identifiers
        const observedRes = await pgClient.query(`SELECT id, identifier_type, identifier_value, observation_count FROM external_entity_identifiers WHERE organization_id = $1 AND entity_id IS NULL ORDER BY observation_count DESC LIMIT 10`, [orgId])

        // Links for this entity
        const linksRes = await pgClient.query(`SELECT id, link_type, reason, created_at, created_by, is_active FROM external_entity_links WHERE organization_id = $1 AND (source_entity_id = $2 OR target_entity_id = $2) ORDER BY created_at DESC`, [orgId, entityId])

        return NextResponse.json({ success: true, entity, linked: entity.external_entity_identifiers || [], observed: observedRes?.rows || [], timeline, links: linksRes?.rows || [] })
    } catch (err: unknown) {
        logger.error('Entity fetch failed', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Fetch failed' }, { status: 500 })
    }
}
