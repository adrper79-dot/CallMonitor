
import supabaseAdmin from '@/lib/supabaseAdmin'
import { AttentionEvent, AttentionPolicy, AttentionDecision, DecisionType } from './types'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'

// Main Entry Point
export async function evaluatePoliciesForEvent(event: AttentionEvent): Promise<AttentionDecision> {
    try {
        // 1. Fetch Active Policies for Organization
        const { data: policies, error } = await supabaseAdmin
            .from('attention_policies')
            .select('*')
            .eq('organization_id', event.organization_id)
            .eq('is_enabled', true)
            .order('priority', { ascending: true })

        if (error) throw error

        let finalDecision: DecisionType = 'needs_review' // Default
        let finalReason = 'No decisive policy matched; defaulting to review.'
        let matchedPolicyId: string | undefined

        // 2. Iterate Policies (First decisive match wins)
        for (const policy of (policies as AttentionPolicy[])) {
            const result = await evaluateSinglePolicy(event, policy)
            if (result) {
                finalDecision = result.decision
                finalReason = result.reason
                matchedPolicyId = policy.id
                break // Stop on first match
            }
        }

        // 3. Construct and Persist Decision
        const decisionRecord: AttentionDecision = {
            id: uuidv4(),
            organization_id: event.organization_id,
            attention_event_id: event.id,
            decision: finalDecision,
            reason: finalReason,
            policy_id: matchedPolicyId,
            produced_by: 'system',
            input_refs: [],
            created_at: new Date().toISOString()
        }

        await supabaseAdmin.from('attention_decisions').insert(decisionRecord)

        // 4. Trigger Side Effects (if Escalation)
        if (finalDecision === 'escalate') {
            await executeEscalation(decisionRecord, event)
        }

        return decisionRecord

    } catch (err) {
        logger.error('RTI Policy Evaluation Failed', { error: err, eventId: event.id })
        // Fallback decision
        const fallback: AttentionDecision = {
            id: uuidv4(),
            organization_id: event.organization_id,
            attention_event_id: event.id,
            decision: 'needs_review',
            reason: 'System error during evaluation',
            produced_by: 'system',
            input_refs: [],
            created_at: new Date().toISOString()
        }
        await supabaseAdmin.from('attention_decisions').insert(fallback)
        return fallback
    }
}

// Evaluator
async function evaluateSinglePolicy(event: AttentionEvent, policy: AttentionPolicy): Promise<{ decision: DecisionType, reason: string } | null> {
    const config = policy.policy_config || {}

    switch (policy.policy_type) {
        case 'quiet_hours':
            if (isInQuietHours(config)) {
                // Check if Severity overrides Quiet Hours? 
                // Policy says: "suppress all non-critical events".
                const severity = event.payload_snapshot?.severity || 'info'
                if (severity === 'critical') {
                    return null // Pass through to next policy (Escalation Threshold likely)
                }
                return { decision: 'suppress', reason: `Suppressed by Quiet Hours (${config.start} to ${config.end})` }
            }
            break

        case 'recurring_suppress':
            if (await isRecurringNoise(event, config)) {
                return { decision: 'suppress', reason: `Suppressed as recurring noise (>${config.count} times in ${config.window_hours}h)` }
            }
            break

        case 'threshold':
            // Simple severity check
            const eventSeverity = event.payload_snapshot?.severity || 'info'
            if (eventSeverity === 'critical' || eventSeverity === 'high') {
                return { decision: 'escalate', reason: `Escalated due to high severity (${eventSeverity})` }
            }
            // Or check explicit config
            if (config.min_severity && config.min_severity === eventSeverity) {
                return { decision: 'escalate', reason: `Escalated due to matching severity rule` }
            }
            break

        case 'keyword_escalate':
            // Check payload for keywords
            const keywords = (config.keywords as string[]) || []
            const payloadStr = JSON.stringify(event.payload_snapshot).toLowerCase()
            if (keywords.some(k => payloadStr.includes(k.toLowerCase()))) {
                return { decision: 'escalate', reason: `Escalated due to keyword match` }
            }
            break
    }
    return null
}

// Helpers
function isInQuietHours(config: any): boolean {
    if (!config.start_hour || !config.end_hour) return false
    const now = new Date()
    const currentHour = now.getUTCHours() // Assuming UTC for v1 simplicity
    // Handle wrapping (e.g. 22 to 08)
    if (config.start_hour > config.end_hour) {
        return currentHour >= config.start_hour || currentHour < config.end_hour
    } else {
        return currentHour >= config.start_hour && currentHour < config.end_hour
    }
}

async function isRecurringNoise(event: AttentionEvent, config: any): Promise<boolean> {
    const countThreshold = config.count || 3
    const windowHours = config.window_hours || 24

    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()

    // Query events with same source_id and event_type
    const { count } = await supabaseAdmin
        .from('attention_events')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', event.organization_id)
        .eq('source_id', event.source_id)
        .eq('event_type', event.event_type)
        .gte('occurred_at', windowStart)

    return (count || 0) >= countThreshold
}

async function executeEscalation(decision: AttentionDecision, event: AttentionEvent) {
    // Determine notification channel?
    // For v1, maybe just log or create an alert record?
    // We already have 'alerts' table.
    // If original event WAS an alert, we don't want to create another alert.
    // We might trigger an external webhook or email.
    // For now, assume this connects to `lib/notifications` (if exists) or just logs.
    logger.info('RTI ESCALATION TRIGGERED', { decisionId: decision.id, eventId: event.id })
}
