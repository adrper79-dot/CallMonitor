/**
 * GET /api/external-entities
 * List external entities with filters
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
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

        const orgId = session.user.orgId
        const { searchParams } = new URL(req.url)
        const entityType = searchParams.get('type')
        const search = searchParams.get('q')
        const includeObserved = searchParams.get('include_observed') === 'true'
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
        const offset = parseInt(searchParams.get('offset') || '0')

        let query = supabaseAdmin
            .from('external_entities')
            .select(`
        id, display_name, entity_type, tags, is_active, created_at,
        external_entity_identifiers(id, identifier_type, identifier_value, observation_count, is_verified)
      `, { count: 'exact' })
            .eq('organization_id', orgId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (entityType) query = query.eq('entity_type', entityType)
        if (search) query = query.ilike('display_name', `%${search}%`)

        const { data: entities, error, count } = await query

        if (error) {
            logger.error('Failed to fetch external entities', error)
            return NextResponse.json({ success: false, error: 'Query failed' }, { status: 500 })
        }

        // Optionally include unlinked observed identifiers
        let observed: Array<{
            id: string
            identifier_type: string
            identifier_value: string
            observation_count: number
        }> = []

        if (includeObserved) {
            const { data: observedData } = await supabaseAdmin
                .from('external_entity_identifiers')
                .select('id, identifier_type, identifier_value, observation_count')
                .eq('organization_id', orgId)
                .is('entity_id', null)
                .order('observation_count', { ascending: false })
                .limit(20)

            observed = observedData || []
        }

        return NextResponse.json({
            success: true,
            entities,
            observed,
            meta: { limit, offset, total: count }
        })
    } catch (err: unknown) {
        logger.error('External entities error', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Unexpected error' }, { status: 500 })
    }
}
