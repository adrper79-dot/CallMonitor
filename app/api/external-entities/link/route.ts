/**
 * POST /api/external-entities/link
 * Create a human-attributed link (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import pgClient from '@/lib/pgClient'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'


export async function POST(req: NextRequest) {
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

        const body = await req.json()
        const { identifierId, entityId, reason, createEntity, displayName, entityType } = body

        let targetEntityId = entityId

        // If creating a new entity
        if (createEntity && !entityId) {
            targetEntityId = uuidv4()
            await pgClient.query(`INSERT INTO external_entities (id, organization_id, display_name, entity_type, notes, tags, created_by, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [targetEntityId, session.user.orgId, displayName, entityType || 'contact', null, null, session.user.id, new Date().toISOString()])
            await pgClient.query(`INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, after, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [uuidv4(), session.user.orgId, session.user.id, 'external_entity', targetEntityId, 'create', JSON.stringify({ display_name: displayName, entity_type: entityType }), new Date().toISOString()])
        }

        if (!identifierId || !targetEntityId) {
            return NextResponse.json({ success: false, error: 'identifierId and entityId (or createEntity) required' }, { status: 400 })
        }

        // Update identifier with entity_id
        await pgClient.query(`UPDATE external_entity_identifiers SET entity_id = $1 WHERE id = $2 AND organization_id = $3`, [targetEntityId, identifierId, session.user.orgId])

        // Create link record
        const linkId = uuidv4()
        await pgClient.query(`INSERT INTO external_entity_links (id, organization_id, link_type, target_entity_id, identifier_id, created_by, reason, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [linkId, session.user.orgId, 'identifier_to_entity', targetEntityId, identifierId, session.user.id, reason || null, new Date().toISOString()])

        // Audit log
        await pgClient.query(`INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, after, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [uuidv4(), session.user.orgId, session.user.id, 'external_entity_link', linkId, 'create', JSON.stringify({ link_type: 'identifier_to_entity', entity_id: targetEntityId, identifier_id: identifierId, reason }), new Date().toISOString()])

        logger.info('Entity link created', { linkId, entityId: targetEntityId, identifierId })

        return NextResponse.json({ success: true, linkId, entityId: targetEntityId, message: 'Link created successfully' })
    } catch (err: unknown) {
        logger.error('Link creation failed', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Link failed' }, { status: 500 })
    }
}
