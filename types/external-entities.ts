/**
 * External Entity Types - UI Contract
 * 
 * Per ARCH_DOCS: Observed ≠ Asserted, no silent merges
 */

export type EntityType = 'contact' | 'company' | 'location' | 'other'
export type IdentifierType = 'phone' | 'email_domain' | 'email' | 'crm_object' | 'other'
export type LinkType = 'identifier_to_entity' | 'entity_merge' | 'entity_split' | 'identifier_transfer'
export type SourceType = 'call' | 'target' | 'campaign_call' | 'booking' | 'manual'
export type ObservationRole = 'caller' | 'callee' | 'participant' | 'target' | 'other'

export interface ExternalEntity {
    id: string
    organization_id: string
    display_name: string | null
    entity_type: EntityType
    notes: string | null
    tags: string[] | null
    metadata: Record<string, unknown>
    is_active: boolean
    created_at: string
    updated_at: string
    created_by: string | null
}

export interface ExternalEntityIdentifier {
    id: string
    organization_id: string
    entity_id: string | null  // NULL = unlinked (observed only)
    identifier_type: IdentifierType
    identifier_value: string
    identifier_normalized: string
    first_observed_at: string
    last_observed_at: string
    observation_count: number
    first_observed_source: SourceType | null
    first_observed_source_id: string | null
    is_verified: boolean
    verified_at: string | null
    verified_by: string | null
    created_at: string
}

export interface ExternalEntityObservation {
    id: string
    organization_id: string
    identifier_id: string
    source_type: SourceType
    source_id: string
    role: ObservationRole | null
    direction: 'inbound' | 'outbound' | null
    observed_at: string
}

export interface ExternalEntityLink {
    id: string
    organization_id: string
    link_type: LinkType
    source_entity_id: string | null
    target_entity_id: string | null
    identifier_id: string | null
    created_by: string
    reason: string | null
    is_active: boolean
    revoked_at: string | null
    revoked_by: string | null
    revoke_reason: string | null
    created_at: string
}

// API Request Types

export interface CreateEntityRequest {
    displayName?: string
    entityType?: EntityType
    notes?: string
    tags?: string[]
}

export interface CreateLinkRequest {
    identifierId: string
    entityId?: string           // Existing entity
    createEntity?: boolean      // Create new entity if true
    displayName?: string        // For new entity
    entityType?: EntityType     // For new entity
    reason?: string             // Audit reason
}

// API Response Types

export interface ExternalEntityListResponse {
    success: boolean
    entities: (ExternalEntity & {
        external_entity_identifiers: Pick<ExternalEntityIdentifier,
            'id' | 'identifier_type' | 'identifier_value' | 'observation_count' | 'is_verified'
        >[]
    })[]
    observed: Pick<ExternalEntityIdentifier,
        'id' | 'identifier_type' | 'identifier_value' | 'observation_count'
    >[]
    meta: {
        limit: number
        offset: number
        total: number | null
    }
}

export interface ExternalEntityDetailResponse {
    success: boolean
    entity: ExternalEntity & {
        external_entity_identifiers: ExternalEntityIdentifier[]
    }
    linked: ExternalEntityIdentifier[]   // Identifiers linked to this entity
    observed: Pick<ExternalEntityIdentifier,
        'id' | 'identifier_type' | 'identifier_value' | 'observation_count'
    >[]  // Unlinked identifiers (for UI suggestion)
    timeline: CallTimelineItem[]
    links: Pick<ExternalEntityLink,
        'id' | 'link_type' | 'reason' | 'created_at' | 'created_by' | 'is_active'
    >[]
}

export interface CallTimelineItem {
    id: string
    status: string
    started_at: string | null
    ended_at: string | null
    phone_number: string | null
    recordings: Array<{ id: string; url: string | null }>
}

export interface CreateLinkResponse {
    success: boolean
    linkId: string
    entityId: string
    message: string
}

// Search Types

export interface SearchDocument {
    id: string
    organization_id: string
    source_type: 'call' | 'recording' | 'transcript' | 'evidence' | 'note'
    source_id: string
    version: number
    is_current: boolean
    superseded_by: string | null
    title: string | null
    content: string
    content_hash: string
    call_id: string | null
    phone_number: string | null
    domain: string | null
    tags: string[] | null
    source_created_at: string | null
    indexed_at: string
    indexed_by: string
    indexed_by_user_id: string | null
}

export interface SearchEvent {
    id: string
    organization_id: string
    event_type: 'indexed' | 'reindexed' | 'rebuild_started' | 'rebuild_completed'
    document_id: string | null
    source_type: string | null
    source_id: string | null
    metadata: Record<string, unknown> | null
    created_at: string
    actor_type: 'system' | 'human' | 'automation'
    actor_id: string | null
    actor_label: string | null
}

export interface SearchResponse {
    success: boolean
    results: Pick<SearchDocument,
        'id' | 'source_type' | 'source_id' | 'title' | 'call_id' | 'phone_number' | 'domain' | 'tags' | 'indexed_at' | 'version'
    >[]
    meta: {
        total: number | null
        limit: number
        offset: number
        query: string
        disclaimer: string  // Always present: "Search results are non-authoritative..."
    }
}

export interface SearchRebuildResponse {
    success: boolean
    message: string
    totalIndexed: number
    note: string
}
