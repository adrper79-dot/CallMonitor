
export type EventType =
    | 'call_completed'
    | 'alert_triggered'
    | 'webhook_failed'
    | 'carrier_degraded'
    | 'campaign_ended'
    | 'evidence_generated'
    | 'system_error'

export type PolicyType =
    | 'quiet_hours'
    | 'threshold'
    | 'recurring_suppress'
    | 'keyword_escalate'
    | 'custom'

export type DecisionType =
    | 'escalate'
    | 'suppress'
    | 'include_in_digest'
    | 'needs_review'

export interface AttentionEvent {
    id: string
    organization_id: string
    event_type: EventType
    source_table: string
    source_id: string
    occurred_at: string
    payload_snapshot: Record<string, any>
    input_refs: Array<{ table: string, id: string }>
    created_at?: string
}

export interface AttentionPolicy {
    id: string
    organization_id: string
    name: string
    description?: string
    policy_type: PolicyType
    policy_config: Record<string, any>
    priority: number
    is_enabled: boolean
}

export interface AttentionDecision {
    id: string
    organization_id: string
    attention_event_id: string
    decision: DecisionType
    reason: string
    policy_id?: string
    confidence?: number
    uncertainty_notes?: string
    produced_by: 'system' | 'human' | 'model'
    produced_by_model?: string
    input_refs: Array<{ table: string, id: string }>
    created_at?: string
}

export interface EventParams {
    organizationId: string
    eventType: EventType
    sourceTable: string
    sourceId: string
    payload: Record<string, any>
    inputRefs?: Array<{ table: string, id: string }>
    occurredAt?: string
}
