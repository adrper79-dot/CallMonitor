/**
 * Attention Service - Return-Traffic Intelligence
 * 
 * Per LAW-RTI:
 * - Append-only event and decision tables
 * - All decisions include provenance (input_refs, produced_by)
 * - Never mutates canonical artifacts
 * - Explainability required for escalate/suppress
 */

import { Pool } from 'pg'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'
import { bestEffortAuditLog } from '@/lib/monitoring/auditLogMonitor'

// =============================================================================
// TYPES
// =============================================================================

export type EventType =
    | 'call_completed'
    | 'alert_triggered'
    | 'webhook_failed'
    | 'carrier_degraded'
    | 'campaign_ended'
    | 'evidence_generated'
    | 'system_error'

export type DecisionType = 'escalate' | 'suppress' | 'include_in_digest' | 'needs_review'
export type ProducerType = 'system' | 'human' | 'model'

export type PolicyType =
    | 'quiet_hours'
    | 'threshold'
    | 'recurring_suppress'
    | 'keyword_escalate'
    | 'custom'

export interface AttentionEvent {
    id: string
    organization_id: string
    event_type: EventType
    source_table: string
    source_id: string
    occurred_at: string
    payload_snapshot: Record<string, unknown>
    input_refs: Array<{ table: string; id: string }>
    created_at: string
}

export interface AttentionPolicy {
    id: string
    organization_id: string
    name: string
    description: string | null
    policy_type: PolicyType
    policy_config: PolicyConfig
    priority: number
    is_enabled: boolean
}

export interface PolicyConfig {
    // quiet_hours
    start_hour?: number  // 0-23
    end_hour?: number
    timezone?: string

    // threshold
    severity_minimum?: number  // 1-10

    // recurring_suppress
    event_types_to_suppress?: EventType[]
    suppress_if_acknowledged?: boolean

    // keyword_escalate
    keywords?: string[]
    case_sensitive?: boolean
}

export interface AttentionDecision {
    id: string
    organization_id: string
    attention_event_id: string
    decision: DecisionType
    reason: string
    policy_id: string | null
    confidence: number | null
    uncertainty_notes: string | null
    produced_by: ProducerType
    produced_by_model: string | null
    produced_by_user_id: string | null
    input_refs: Array<{ table: string; id: string }>
}

export interface DigestSummary {
    id: string
    digest_type: 'overnight' | 'weekly' | 'on_demand'
    period_start: string
    period_end: string
    summary_text: string
    total_events: number
    escalated_count: number
    suppressed_count: number
    needs_review_count: number
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

export class AttentionService {
    constructor(private pool: Pool) { }

    // ---------------------------------------------------------------------------
    // EVENT EMISSION
    // ---------------------------------------------------------------------------

    /**
     * Emit an attention event from a canonical source
     * This is called by webhook handlers, completion hooks, etc.
     */
    async emitEvent(
        organizationId: string,
        eventType: EventType,
        sourceTable: string,
        sourceId: string,
        occurredAt: Date,
        payloadSnapshot: Record<string, unknown>,
        inputRefs: Array<{ table: string; id: string }>
    ): Promise<{ success: boolean; eventId?: string; error?: string }> {
        const eventId = uuidv4()

        try {
            await this.pool.query(`
                INSERT INTO attention_events (id, organization_id, event_type, source_table, source_id, occurred_at, payload_snapshot, input_refs)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [eventId, organizationId, eventType, sourceTable, sourceId, occurredAt.toISOString(), JSON.stringify(payloadSnapshot), JSON.stringify(inputRefs)])
        } catch (error) {
            return { success: false, error: (error as Error).message }
        }

        if (error) {
            logger.error('Failed to emit attention event', error)
            return { success: false, error: error.message }
        }

        // Immediately evaluate policies and create decision
        await this.evaluatePoliciesForEvent(organizationId, eventId)

        return { success: true, eventId }
    }

    // ---------------------------------------------------------------------------
    // POLICY EVALUATION ENGINE
    // ---------------------------------------------------------------------------

    /**
     * Evaluate all applicable policies for an event and create decision
     */
    async evaluatePoliciesForEvent(
        organizationId: string,
        eventId: string
    ): Promise<void> {
        // Get the event
        const eventResult = await this.pool.query('SELECT * FROM attention_events WHERE id = $1', [eventId])
        const event = eventResult.rows[0]

        if (!event) return

        // Get enabled policies ordered by priority
        const policiesResult = await this.pool.query('SELECT * FROM attention_policies WHERE organization_id = $1 AND is_enabled = true ORDER BY priority ASC', [organizationId])
        const policies = policiesResult.rows

        let decision: DecisionType = 'include_in_digest'  // Default
        let reason = 'No policy matched; included in digest'
        let matchedPolicyId: string | null = null
        let confidence = 100

        // Evaluate each policy
        for (const policy of (policies || [])) {
            const result = this.evaluatePolicy(policy, event)

            if (result.matched) {
                decision = result.decision
                reason = result.reason
                matchedPolicyId = policy.id
                confidence = result.confidence || 100
                break  // First matching policy wins
            }
        }

        // Create the decision
        await this.createDecision(
            organizationId,
            eventId,
            decision,
            reason,
            matchedPolicyId,
            confidence,
            null,  // uncertainty_notes
            'system',
            null,  // model
            null,  // user
            event.input_refs
        )
    }

    /**
     * Evaluate a single policy against an event
     */
    private evaluatePolicy(
        policy: AttentionPolicy,
        event: AttentionEvent
    ): { matched: boolean; decision: DecisionType; reason: string; confidence?: number } {
        const config = policy.policy_config as PolicyConfig

        switch (policy.policy_type) {
            case 'quiet_hours':
                return this.evaluateQuietHours(policy, config, event)

            case 'threshold':
                return this.evaluateThreshold(policy, config, event)

            case 'recurring_suppress':
                return this.evaluateRecurringSuppress(policy, config, event)

            case 'keyword_escalate':
                return this.evaluateKeywordEscalate(policy, config, event)

            default:
                return { matched: false, decision: 'include_in_digest', reason: '' }
        }
    }

    private evaluateQuietHours(
        policy: AttentionPolicy,
        config: PolicyConfig,
        event: AttentionEvent
    ): { matched: boolean; decision: DecisionType; reason: string } {
        const startHour = config.start_hour ?? 22
        const endHour = config.end_hour ?? 7
        const timezone = config.timezone || 'America/New_York'

        // Get hour in specified timezone
        const eventTime = new Date(event.occurred_at)
        const hour = parseInt(eventTime.toLocaleString('en-US', {
            hour: 'numeric',
            hour12: false,
            timeZone: timezone
        }))

        const isQuietTime = startHour > endHour
            ? (hour >= startHour || hour < endHour)  // Overnight
            : (hour >= startHour && hour < endHour)

        if (isQuietTime) {
            return {
                matched: true,
                decision: 'include_in_digest',
                reason: `Suppressed during quiet hours (${startHour}:00-${endHour}:00 ${timezone})`
            }
        }

        return { matched: false, decision: 'include_in_digest', reason: '' }
    }

    private evaluateThreshold(
        policy: AttentionPolicy,
        config: PolicyConfig,
        event: AttentionEvent
    ): { matched: boolean; decision: DecisionType; reason: string } {
        const minSeverity = config.severity_minimum ?? 5
        const eventSeverity = (event.payload_snapshot.severity as number) || 0

        if (eventSeverity >= minSeverity) {
            return {
                matched: true,
                decision: 'escalate',
                reason: `Severity ${eventSeverity} >= threshold ${minSeverity}`
            }
        }

        return { matched: false, decision: 'include_in_digest', reason: '' }
    }

    private evaluateRecurringSuppress(
        policy: AttentionPolicy,
        config: PolicyConfig,
        event: AttentionEvent
    ): { matched: boolean; decision: DecisionType; reason: string } {
        const typesToSuppress = config.event_types_to_suppress || []

        if (typesToSuppress.includes(event.event_type)) {
            return {
                matched: true,
                decision: 'suppress',
                reason: `Recurring event type ${event.event_type} suppressed by policy`
            }
        }

        return { matched: false, decision: 'include_in_digest', reason: '' }
    }

    private evaluateKeywordEscalate(
        policy: AttentionPolicy,
        config: PolicyConfig,
        event: AttentionEvent
    ): { matched: boolean; decision: DecisionType; reason: string } {
        const keywords = config.keywords || []
        const caseSensitive = config.case_sensitive ?? false

        const payloadString = JSON.stringify(event.payload_snapshot)
        const searchString = caseSensitive ? payloadString : payloadString.toLowerCase()

        for (const keyword of keywords) {
            const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase()
            if (searchString.includes(searchKeyword)) {
                return {
                    matched: true,
                    decision: 'escalate',
                    reason: `Keyword match: "${keyword}" found in event`
                }
            }
        }

        return { matched: false, decision: 'include_in_digest', reason: '' }
    }

    // ---------------------------------------------------------------------------
    // DECISION MANAGEMENT
    // ---------------------------------------------------------------------------

    /**
     * Create an attention decision (append-only)
     */
    async createDecision(
        organizationId: string,
        eventId: string,
        decision: DecisionType,
        reason: string,
        policyId: string | null,
        confidence: number | null,
        uncertaintyNotes: string | null,
        producedBy: ProducerType,
        producedByModel: string | null,
        producedByUserId: string | null,
        inputRefs: Array<{ table: string; id: string }>
    ): Promise<{ success: boolean; decisionId?: string; error?: string }> {
        const decisionId = uuidv4()

        try {
            await this.pool.query(`
                INSERT INTO attention_decisions (id, organization_id, attention_event_id, decision, reason, policy_id, confidence, uncertainty_notes, produced_by, produced_by_model, produced_by_user_id, input_refs)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [decisionId, organizationId, eventId, decision, reason, policyId, confidence, uncertaintyNotes, producedBy, producedByModel, producedByUserId, JSON.stringify(inputRefs)])
        } catch (error) {
            logger.error('Failed to create attention decision', error)
            return { success: false, error: (error as Error).message }
        }

        // Audit log for escalations
        if (decision === 'escalate') {
            await bestEffortAuditLog(
                async () => await this.pool.query(`
                    INSERT INTO audit_logs (id, organization_id, resource_type, resource_id, action, actor_type, actor_label, after)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [uuidv4(), organizationId, 'attention_decision', decisionId, 'escalate', producedBy === 'human' ? 'human' : 'system', producedBy === 'model' ? producedByModel : producedBy, JSON.stringify({ event_id: eventId, reason, policy_id: policyId })]),
                { resource: 'attention_decision', resourceId: decisionId, action: 'escalate' }
            )
        }

        return { success: true, decisionId }
    }

    /**
     * Human override of a decision (creates new decision, doesn't update)
     */
    async humanOverride(
        organizationId: string,
        eventId: string,
        newDecision: DecisionType,
        reason: string,
        userId: string
    ): Promise<{ success: boolean; decisionId?: string; error?: string }> {
        // Get original event's input_refs
        const eventResult = await this.pool.query('SELECT input_refs FROM attention_events WHERE id = $1', [eventId])
        const event = eventResult.rows[0]
            .single()

        if (!event) {
            return { success: false, error: 'Event not found' }
        }

        // Create new decision (append-only pattern)
        return this.createDecision(
            organizationId,
            eventId,
            newDecision,
            reason,
            null,  // No policy - human decision
            100,   // Full confidence for human decision
            null,
            'human',
            null,
            userId,
            event.input_refs
        )
    }

    // ---------------------------------------------------------------------------
    // DIGEST GENERATION
    // ---------------------------------------------------------------------------

    /**
     * Generate a digest for a time period
     */
    async generateDigest(
        organizationId: string,
        digestType: 'overnight' | 'weekly' | 'on_demand',
        periodStart: Date,
        periodEnd: Date,
        triggeredByUserId?: string
    ): Promise<{ success: boolean; digestId?: string; error?: string }> {
        const digestId = uuidv4()

        // Get decisions in period
        const decisionsResult = await this.pool.query(`
            SELECT * FROM attention_decisions
            WHERE organization_id = $1 AND created_at >= $2 AND created_at <= $3
            ORDER BY created_at ASC
        `, [organizationId, periodStart.toISOString(), periodEnd.toISOString()])
        const decisions = decisionsResult.rows

        if (!decisions) {
            return { success: false, error: 'Failed to fetch decisions' }
        }

        // Aggregate stats
        const escalated = decisions.filter(d => d.decision === 'escalate').length
        const suppressed = decisions.filter(d => d.decision === 'suppress').length
        const needsReview = decisions.filter(d => d.decision === 'needs_review').length
        const inDigest = decisions.filter(d => d.decision === 'include_in_digest').length

        // Generate summary text
        const summaryParts: string[] = []
        if (escalated > 0) summaryParts.push(`${escalated} escalated`)
        if (needsReview > 0) summaryParts.push(`${needsReview} need review`)
        if (inDigest > 0) summaryParts.push(`${inDigest} in digest`)
        if (suppressed > 0) summaryParts.push(`${suppressed} suppressed`)

        const summaryText = summaryParts.length > 0
            ? `${decisions.length} events: ${summaryParts.join(', ')}`
            : 'No events in this period'

        // Create digest
        try {
            await this.pool.query(`
                INSERT INTO digests (id, organization_id, digest_type, period_start, period_end, summary_text, total_events, escalated_count, suppressed_count, needs_review_count, generated_by, generated_by_user_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [digestId, organizationId, digestType, periodStart.toISOString(), periodEnd.toISOString(), summaryText, decisions.length, escalated, suppressed, needsReview, triggeredByUserId ? 'user-triggered' : 'system', triggeredByUserId])
        } catch (error) {
            return { success: false, error: (error as Error).message }
        }

        // Create digest items for included decisions
        const itemsToInclude = decisions.filter(d =>
            d.decision === 'escalate' ||
            d.decision === 'needs_review' ||
            d.decision === 'include_in_digest'
        )

        for (let i = 0; i < itemsToInclude.length; i++) {
            await this.pool.query(`
                INSERT INTO digest_items (id, digest_id, attention_decision_id, item_order, is_highlighted)
                VALUES ($1, $2, $3, $4, $5)
            `, [uuidv4(), digestId, itemsToInclude[i].id, i + 1, itemsToInclude[i].decision === 'escalate'])
        }

        logger.info('Digest generated', { digestId, type: digestType, totalEvents: decisions.length })

        return { success: true, digestId }
    }

    // ---------------------------------------------------------------------------
    // QUERYING
    // ---------------------------------------------------------------------------

    /**
     * Get recent attention events with decisions
     */
    async getRecentEvents(
        organizationId: string,
        limit: number = 50,
        decisionFilter?: DecisionType
    ): Promise<Array<AttentionEvent & { decision?: AttentionDecision }>> {
        let query = this.supabaseAdmin
            .from('attention_events')
            .select(`
        *,
        attention_decisions(*)
      `)
            .eq('organization_id', organizationId)
            .order('occurred_at', { ascending: false })
            .limit(limit)

        const { data } = await query

        if (!data) return []

        // Flatten and filter
        return data.map((event: unknown) => {
            const e = event as Record<string, unknown>
            const decisions = e.attention_decisions as Array<Record<string, unknown>> | undefined
            const latestDecision = decisions?.[decisions.length - 1]

            if (decisionFilter && latestDecision?.decision !== decisionFilter) {
                return null
            }

            return {
                ...e,
                decision: latestDecision
            }
        }).filter(Boolean) as Array<AttentionEvent & { decision?: AttentionDecision }>
    }

    /**
     * Get recent digests
     */
    async getDigests(
        organizationId: string,
        limit: number = 10
    ): Promise<DigestSummary[]> {
        const result = await this.pool.query(`
            SELECT * FROM digests
            WHERE organization_id = $1
            ORDER BY generated_at DESC
            LIMIT $2
        `, [organizationId, limit])

        return (result.rows || []) as DigestSummary[]
    }
}
