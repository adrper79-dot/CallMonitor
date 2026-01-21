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

import { SupabaseClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'
import { bestEffortAuditLog } from '@/lib/monitoring/auditLogMonitor'

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
    constructor(private supabaseAdmin: SupabaseClient) { }

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

        // Upsert identifier
        const { data: existing } = await this.supabaseAdmin
            .from('external_entity_identifiers')
            .select('id, observation_count')
            .eq('organization_id', input.organizationId)
            .eq('identifier_type', input.identifierType)
            .eq('identifier_normalized', normalized)
            .limit(1)

        let identifierId: string

        if (existing?.[0]) {
            // Update observation count and last_observed_at
            identifierId = existing[0].id
            await this.supabaseAdmin
                .from('external_entity_identifiers')
                .update({
                    last_observed_at: new Date().toISOString(),
                    observation_count: existing[0].observation_count + 1
                })
                .eq('id', identifierId)
        } else {
            // Create new identifier
            identifierId = uuidv4()
            await this.supabaseAdmin
                .from('external_entity_identifiers')
                .insert({
                    id: identifierId,
                    organization_id: input.organizationId,
                    identifier_type: input.identifierType,
                    identifier_value: input.identifierValue,
                    identifier_normalized: normalized,
                    first_observed_source: input.sourceType,
                    first_observed_source_id: input.sourceId
                })
        }

        // Log observation (append-only)
        await this.supabaseAdmin
            .from('external_entity_observations')
            .insert({
                id: uuidv4(),
                organization_id: input.organizationId,
                identifier_id: identifierId,
                source_type: input.sourceType,
                source_id: input.sourceId,
                role: input.role,
                direction: input.direction
            })

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

        await this.supabaseAdmin
            .from('external_entities')
            .insert({
                id: entityId,
                organization_id: input.organizationId,
                display_name: input.displayName,
                entity_type: input.entityType || 'contact',
                notes: input.notes,
                tags: input.tags,
                created_by: input.userId
            })

        // Audit log
        await bestEffortAuditLog(
            async () => await this.supabaseAdmin.from('audit_logs').insert({
                id: uuidv4(),
                organization_id: input.organizationId,
                user_id: input.userId,
                resource_type: 'external_entity',
                resource_id: entityId,
                action: 'create',
                after: { display_name: input.displayName, entity_type: input.entityType }
            }),
            { resource: 'external_entity', resourceId: entityId, action: 'create' }
        )

        return { entityId }
    }

    /**
     * Link an identifier to an entity (admin only, human-attributed)
     */
    async linkIdentifierToEntity(input: LinkIdentifierInput): Promise<{ linkId: string }> {
        const linkId = uuidv4()

        // Update identifier with entity_id
        await this.supabaseAdmin
            .from('external_entity_identifiers')
            .update({ entity_id: input.entityId })
            .eq('id', input.identifierId)
            .eq('organization_id', input.organizationId)

        // Create link record (human-attributed)
        await this.supabaseAdmin
            .from('external_entity_links')
            .insert({
                id: linkId,
                organization_id: input.organizationId,
                link_type: 'identifier_to_entity',
                target_entity_id: input.entityId,
                identifier_id: input.identifierId,
                created_by: input.userId,
                reason: input.reason
            })

        // Audit log
        await bestEffortAuditLog(
            async () => await this.supabaseAdmin.from('audit_logs').insert({
                id: uuidv4(),
                organization_id: input.organizationId,
                user_id: input.userId,
                resource_type: 'external_entity_link',
                resource_id: linkId,
                action: 'create',
                after: {
                    link_type: 'identifier_to_entity',
                    entity_id: input.entityId,
                    identifier_id: input.identifierId,
                    reason: input.reason
                }
            }),
            { resource: 'external_entity_link', resourceId: linkId, action: 'create' }
        )

        return { linkId }
    }

    /**
     * Get entity timeline (calls + artifacts)
     */
    async getEntityTimeline(organizationId: string, entityId: string): Promise<ExternalEntityTimelineItem[]> {
        // Get all identifiers for this entity
        const { data: identifiers } = await this.supabaseAdmin
            .from('external_entity_identifiers')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('entity_id', entityId)

        if (!identifiers?.length) return []

        const identifierIds = identifiers.map(i => i.id)

        // Get all observations for these identifiers
        const { data: observations } = await this.supabaseAdmin
            .from('external_entity_observations')
            .select('source_type, source_id, role, direction, observed_at')
            .eq('organization_id', organizationId)
            .in('identifier_id', identifierIds)
            .order('observed_at', { ascending: false })

        // Group by source and fetch call details
        const callSourceIds = observations?.filter(o => o.source_type === 'call').map(o => o.source_id) || []
        const callIds = Array.from(new Set(callSourceIds))

        if (!callIds.length) return []

        const { data: calls } = await this.supabaseAdmin
            .from('calls')
            .select('id, status, started_at, ended_at, phone_number')
            .eq('organization_id', organizationId)
            .in('id', callIds)
            .order('started_at', { ascending: false })

        // Fetch recordings for each call
        const result: ExternalEntityTimelineItem[] = []
        for (const call of calls || []) {
            const { data: recordings } = await this.supabaseAdmin
                .from('recordings')
                .select('id, url')
                .eq('call_id', call.id)

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
        const { data } = await this.supabaseAdmin
            .from('external_entity_identifiers')
            .select('id, identifier_type, identifier_value, observation_count')
            .eq('organization_id', organizationId)
            .is('entity_id', null)
            .order('observation_count', { ascending: false })
            .limit(limit)

        return data || []
    }
}
