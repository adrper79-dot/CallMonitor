/**
 * POST /api/external-entities/link
 * Create a human-attributed link (admin only)
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

export async function POST(req: NextRequest) {
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

        const body = await req.json()
        const { identifierId, entityId, reason, createEntity, displayName, entityType } = body

        const service = new ExternalEntityService(supabaseAdmin)

        let targetEntityId = entityId

        // If creating a new entity
        if (createEntity && !entityId) {
            const { entityId: newId } = await service.createEntity({
                organizationId: session.user.orgId,
                displayName,
                entityType: entityType || 'contact',
                userId: session.user.id
            })
            targetEntityId = newId
        }

        if (!identifierId || !targetEntityId) {
            return NextResponse.json({
                success: false,
                error: 'identifierId and entityId (or createEntity) required'
            }, { status: 400 })
        }

        const { linkId } = await service.linkIdentifierToEntity({
            organizationId: session.user.orgId,
            identifierId,
            entityId: targetEntityId,
            userId: session.user.id,
            reason
        })

        logger.info('Entity link created', { linkId, entityId: targetEntityId, identifierId })

        return NextResponse.json({
            success: true,
            linkId,
            entityId: targetEntityId,
            message: 'Link created successfully'
        })
    } catch (err: unknown) {
        logger.error('Link creation failed', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Link failed' }, { status: 500 })
    }
}
