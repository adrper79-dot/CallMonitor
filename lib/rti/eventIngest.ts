
import supabaseAdmin from '@/lib/supabaseAdmin'
import { EventParams, AttentionEvent } from './types'
import { v4 as uuidv4 } from 'uuid'
import { evaluatePoliciesForEvent } from './policyEngine'
import { logger } from '@/lib/logger'

export async function captureAttentionEvent(params: EventParams): Promise<AttentionEvent> {
    const eventId = uuidv4()
    const occurredAt = params.occurredAt || new Date().toISOString()

    const event: AttentionEvent = {
        id: eventId,
        organization_id: params.organizationId,
        event_type: params.eventType,
        source_table: params.sourceTable,
        source_id: params.sourceId,
        occurred_at: occurredAt,
        payload_snapshot: params.payload,
        input_refs: params.inputRefs || [],
        created_at: new Date().toISOString()
    }

    // 1. Persist Event (Append-Only)
    // Note: we use explicit column mapping to match DB schema
    const { error } = await supabaseAdmin
        .from('attention_events')
        .insert({
            id: event.id,
            organization_id: event.organization_id,
            event_type: event.event_type,
            source_table: event.source_table,
            source_id: event.source_id,
            occurred_at: event.occurred_at,
            payload_snapshot: event.payload_snapshot,
            input_refs: event.input_refs
        })

    if (error) {
        logger.error('Failed to persist attention_event', { error, params })
        throw error
    }

    // 2. Trigger Policy Engine (Async-ish)
    try {
        // In v1, we await to guarantee logic runs before response context closes
        await evaluatePoliciesForEvent(event)
    } catch (evalErr) {
        // We catch here so ingestion succeeds even if evaluation logic bugs out
        logger.error('Policy evaluation failed during ingest', { error: evalErr, eventId })
    }

    return event
}
