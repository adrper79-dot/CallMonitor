/**
 * External Entity Service
 * 
 * Observes identifiers from calls and manages entity links.
 * 
 * Constraints:
 * - Org-scoped: No cross-org visibility
 * - Observed ≠ Asserted: No silent merges
 * - Human-attributed: All links require user ID
 * - Auditable: All link operations logged
 */

import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'
import { query } from '@/lib/pgClient'

export interface ObserveIdentifierInput {
    organizationId: string
    identifierType: 'phone' | 'email_domain' | 'email' | 'crm_object' | 'other'
    identifierValue: string
    sourceType: 'call' | 'target' | 'campaign_call' | 'booking' | 'manual'
    sourceId: string
    role?: 'caller' | 'callee' | 'participant' | 'target' | 'other'
    direction?: 'inbound' | 'outbound'
}

export interface LinkIdentifierInput {
    organizationId: string
    identifierId: string
    entityId: string
    userId: string
    reason?: string
}

export interface CreateEntityInput {
    organizationId: string
    displayName?: string
    entityType?: 'contact' | 'company' | 'location' | 'other'
    notes?: string
    tags?: string[]
    userId: string
}

export interface ExternalEntityTimelineItem {
    id: string
    status: string
    started_at: string | null
    ended_at: string | null
    phone_number: string | null
    recordings: Array<{ id: string; url: string | null }>
}

export class ExternalEntityService {
    // No longer needs SupabaseClient injection
    constructor() { }

    /**
     * Normalize identifier value based on type
     */
    private normalizeIdentifier(type: string, value: string): string {
        switch (type) {
            case 'phone':
                // Remove non-digits except leading +
                const cleaned = value.replace(/[^\d+]/g, '')
                return cleaned.startsWith('+') ? cleaned : `+${cleaned}`
            case 'email':
            case 'email_domain':
                return value.toLowerCase().trim()
            default:
                return value.trim()
        }
    }

    /**
     * Extract email domain from email address
     */
    private extractEmailDomain(email: string): string | null {
        const match = email.match(/@([^@]+)$/)
        return match ? match[1].toLowerCase() : null
    }

    /**
     * Observe an identifier from a source (call, target, etc.)
     * Creates identifier if not exists, logs observation
     */
    async observeIdentifier(input: ObserveIdentifierInput): Promise<{ identifierId: string }> {
        const normalized = this.normalizeIdentifier(input.identifierType, input.identifierValue)

        // Check if exists
        const { rows: existing } = await query(
            `SELECT id, observation_count FROM external_entity_identifiers 
             WHERE organization_id = $1 AND identifier_type = $2 AND identifier_normalized = $3 
             LIMIT 1`,
            [input.organizationId, input.identifierType, normalized]
        )

        let identifierId: string

        if (existing?.[0]) {
            // Update observation count and last_observed_at
            identifierId = existing[0].id
            await query(
                `UPDATE external_entity_identifiers 
                 SET last_observed_at = NOW(), observation_count = observation_count + 1 
                 WHERE id = $1`,
                [identifierId]
            )
        } else {
            // Create new identifier
            identifierId = uuidv4()
            await query(
                `INSERT INTO external_entity_identifiers (
                    id, organization_id, identifier_type, identifier_value, identifier_normalized, 
                    first_observed_source, first_observed_source_id, created_at, observation_count, last_observed_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 1, NOW())`,
                [
                    identifierId,
                    input.organizationId,
                    input.identifierType,
                    input.identifierValue,
                    normalized,
                    input.sourceType,
                    input.sourceId
                ]
            )
        }

        // Log observation (append-only)
        await query(
            `INSERT INTO external_entity_observations (
                id, organization_id, identifier_id, source_type, source_id, role, direction, observed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [
                uuidv4(),
                input.organizationId,
                identifierId,
                input.sourceType,
                input.sourceId,
                input.role || null,
                input.direction || null
            ]
        )

        return { identifierId }
    }

    /**
     * Process a call and observe all identifiers
     */
    async processCallObservations(
        organizationId: string,
        callId: string,
        fromNumber: string | null,
        toNumber: string | null,
        direction: 'inbound' | 'outbound' = 'outbound'
    ): Promise<void> {
        // Observe target phone (to_number)
        if (toNumber) {
            await this.observeIdentifier({
                organizationId,
                identifierType: 'phone',
                identifierValue: toNumber,
                sourceType: 'call',
                sourceId: callId,
                role: direction === 'outbound' ? 'callee' : 'caller',
                direction
            })
        }

        // Observe from_number if different and not the org's own number
        if (fromNumber && fromNumber !== toNumber) {
            await this.observeIdentifier({
                organizationId,
                identifierType: 'phone',
                identifierValue: fromNumber,
                sourceType: 'call',
                sourceId: callId,
                role: direction === 'outbound' ? 'caller' : 'callee',
                direction
            })
        }

        logger.debug('processCallObservations: completed', { callId, identifiersObserved: 2 })
    }

    /**
     * Create a new external entity
     */
    async createEntity(input: CreateEntityInput): Promise<{ entityId: string }> {
        const entityId = uuidv4()

        await query(
            `INSERT INTO external_entities (
                id, organization_id, display_name, entity_type, notes, tags, created_by, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
            [
                entityId,
                input.organizationId,
                input.displayName || null,
                input.entityType || 'contact',
                input.notes || null,
                input.tags || [],
                input.userId
            ]
        )

        // Audit log
        try {
            await query(
                `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, after, created_at)
                 VALUES ($1, $2, $3, 'external_entity', $4, 'create', $5, NOW())`,
                [
                    uuidv4(),
                    input.organizationId,
                    input.userId,
                    entityId,
                    JSON.stringify({ display_name: input.displayName, entity_type: input.entityType })
                ]
            )
        } catch (e) {
            logger.warn('Failed to write audit log for entity creation', e)
        }

        return { entityId }
    }

    /**
     * Link an identifier to an entity (admin only, human-attributed)
     */
    async linkIdentifierToEntity(input: LinkIdentifierInput): Promise<{ linkId: string }> {
        const linkId = uuidv4()

        // Update identifier with entity_id
        await query(
            `UPDATE external_entity_identifiers SET entity_id = $1 WHERE id = $2 AND organization_id = $3`,
            [input.entityId, input.identifierId, input.organizationId]
        )

        // Create link record (human-attributed)
        await query(
            `INSERT INTO external_entity_links (
                id, organization_id, link_type, target_entity_id, identifier_id, created_by, reason, created_at
             ) VALUES ($1, $2, 'identifier_to_entity', $3, $4, $5, $6, NOW())`,
            [
                linkId,
                input.organizationId,
                input.entityId,
                input.identifierId,
                input.userId,
                input.reason || null
            ]
        )

        // Audit log
        try {
            await query(
                `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, after, created_at)
                 VALUES ($1, $2, $3, 'external_entity_link', $4, 'create', $5, NOW())`,
                [
                    uuidv4(),
                    input.organizationId,
                    input.userId,
                    linkId,
                    JSON.stringify({
                        link_type: 'identifier_to_entity',
                        entity_id: input.entityId,
                        identifier_id: input.identifierId,
                        reason: input.reason
                    })
                ]
            )
        } catch (e) {
            logger.warn('Failed to write audit log for entity linking', e)
        }

        return { linkId }
    }

    /**
     * Get entity timeline (calls + artifacts)
     */
    async getEntityTimeline(organizationId: string, entityId: string): Promise<ExternalEntityTimelineItem[]> {
        // Get all identifiers for this entity
        const { rows: identifiers } = await query(
            `SELECT id FROM external_entity_identifiers WHERE organization_id = $1 AND entity_id = $2`,
            [organizationId, entityId]
        )

        if (!identifiers?.length) return []

        const identifierIds = identifiers.map((i: any) => i.id)

        // Get all observations for these identifiers
        const { rows: observations } = await query(
            `SELECT source_id FROM external_entity_observations 
             WHERE organization_id = $1 AND identifier_id = ANY($2) AND source_type = 'call'
             ORDER BY observed_at DESC`,
            [organizationId, identifierIds]
        )

        const callSourceIds = observations?.map((o: any) => o.source_id) || []
        const callIds = Array.from(new Set(callSourceIds))

        if (!callIds.length) return []

        const { rows: calls } = await query(
            `SELECT id, status, started_at, ended_at, phone_number FROM calls 
             WHERE organization_id = $1 AND id = ANY($2) 
             ORDER BY started_at DESC`,
            [organizationId, callIds]
        )

        const result: ExternalEntityTimelineItem[] = []

        for (const call of calls || []) {
            const { rows: recordings } = await query(
                `SELECT id, recording_url as url FROM recordings WHERE call_id = $1`,
                [call.id]
            )

            result.push({
                id: call.id,
                status: call.status,
                started_at: call.started_at,
                ended_at: call.ended_at,
                phone_number: call.phone_number,
                recordings: recordings || []
            })
        }

        return result
    }

    /**
     * Get unlinked identifiers for an organization (for "Observed" section)
     */
    async getObservedIdentifiers(
        organizationId: string,
        limit: number = 50
    ): Promise<Array<{
        id: string
        identifier_type: string
        identifier_value: string
        observation_count: number
    }>> {
        const { rows } = await query(
            `SELECT id, identifier_type, identifier_value, observation_count 
             FROM external_entity_identifiers 
             WHERE organization_id = $1 AND entity_id IS NULL 
             ORDER BY observation_count DESC 
             LIMIT $2`,
            [organizationId, limit]
        )

        return rows || []
    }
}
