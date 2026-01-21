/**
 * GET /api/external-entities/[id]
 * Get entity details with timeline
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { ExternalEntityService } from '@/lib/services/externalEntityService'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
        const { data: entity, error } = await supabaseAdmin
            .from('external_entities')
            .select(`
        *,
        external_entity_identifiers(id, identifier_type, identifier_value, observation_count, is_verified, first_observed_at, last_observed_at)
      `)
            .eq('id', entityId)
            .eq('organization_id', orgId)
            .single()

        if (error || !entity) {
            return NextResponse.json({ success: false, error: 'Entity not found' }, { status: 404 })
        }

        // Fetch timeline
        const service = new ExternalEntityService(supabaseAdmin)
        const timeline = await service.getEntityTimeline(orgId, entityId)

        // Fetch unlinked identifiers with similar phone prefix (for suggestions)
        const { data: observed } = await supabaseAdmin
            .from('external_entity_identifiers')
            .select('id, identifier_type, identifier_value, observation_count')
            .eq('organization_id', orgId)
            .is('entity_id', null)
            .order('observation_count', { ascending: false })
            .limit(10)

        // Fetch links for this entity
        const { data: links } = await supabaseAdmin
            .from('external_entity_links')
            .select('id, link_type, reason, created_at, created_by, is_active')
            .eq('organization_id', orgId)
            .or(`source_entity_id.eq.${entityId},target_entity_id.eq.${entityId}`)
            .order('created_at', { ascending: false })

        return NextResponse.json({
            success: true,
            entity,
            linked: entity.external_entity_identifiers || [],  // Linked identifiers
            observed: observed || [],                          // Unlinked identifiers for UI suggestion
            timeline,
            links: links || []
        })
    } catch (err: unknown) {
        logger.error('Entity fetch failed', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Fetch failed' }, { status: 500 })
    }
}
