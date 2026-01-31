/**
 * GET /api/external-entities
 * List external entities with filters
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import pgClient from '@/lib/pgClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'


export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.orgId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const orgId = session.user.orgId
        const { searchParams } = new URL(req.url)
        const entityType = searchParams.get('type')
        const search = searchParams.get('q')
        const includeObserved = searchParams.get('include_observed') === 'true'
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
        const offset = parseInt(searchParams.get('offset') || '0')

        // Build SQL with optional filters
        const params: any[] = [orgId]
        let where = `e.organization_id = $1 AND e.is_active = true`
        if (entityType) {
            params.push(entityType)
            where += ` AND e.entity_type = $${params.length}`
        }
        if (search) {
            params.push(`%${search}%`)
            where += ` AND e.display_name ILIKE $${params.length}`
        }

        // Fetch entities with aggregated identifiers
        params.push(limit, offset)
        const query = `
          SELECT e.id, e.display_name, e.entity_type, e.tags, e.is_active, e.created_at,
                 COALESCE(json_agg(json_build_object('id', ei.id, 'identifier_type', ei.identifier_type, 'identifier_value', ei.identifier_value, 'observation_count', ei.observation_count, 'is_verified', ei.is_verified) ORDER BY ei.observation_count DESC) FILTER (WHERE ei.id IS NOT NULL), '[]') AS external_entity_identifiers,
                 count(*) OVER() AS total_count
          FROM external_entities e
          LEFT JOIN external_entity_identifiers ei ON ei.entity_id = e.id
          WHERE ${where}
          GROUP BY e.id
          ORDER BY e.created_at DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}
        `

        const res = await pgClient.query(query, params)
        const entities = res?.rows || []
        const total = entities.length ? Number(entities[0].total_count || 0) : 0

        // Optionally include unlinked observed identifiers
        let observed: Array<{ id: string; identifier_type: string; identifier_value: string; observation_count: number }> = []
        if (includeObserved) {
            const obsRes = await pgClient.query(`SELECT id, identifier_type, identifier_value, observation_count FROM external_entity_identifiers WHERE organization_id = $1 AND entity_id IS NULL ORDER BY observation_count DESC LIMIT 20`, [orgId])
            observed = obsRes?.rows || []
        }

        return NextResponse.json({ success: true, entities, observed, meta: { limit, offset, total } })
    } catch (err: unknown) {
        logger.error('External entities error', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Unexpected error' }, { status: 500 })
    }
}
