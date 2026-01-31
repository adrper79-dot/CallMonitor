
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'

export async function generateDailyDigest(organizationId: string): Promise<string> {
    const today = new Date()
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

    // 1. Fetch relevant decisions from last 24h
    // We focus on 'suppress' (silence) and 'include_in_digest'
    const { data: decisions, error } = await supabaseAdmin
        .from('attention_decisions')
        .select('decision, policy_id, reason, event:attention_event_id(event_type)')
        .eq('organization_id', organizationId)
        .gt('created_at', yesterday.toISOString())
        .in('decision', ['suppress', 'include_in_digest'])

    if (error) throw error

    const decisionList = decisions || []
    const totalEvents = decisionList.length

    if (totalEvents === 0) {
        return createEmptyDigest(organizationId, yesterday, today)
    }

    // 2. Aggregate Stats
    const suppressedCount = decisionList.filter(d => d.decision === 'suppress').length
    const digestItemsCount = decisionList.filter(d => d.decision === 'include_in_digest').length

    // Group by Reason/Policy for summary
    const reasoningCounts: Record<string, number> = {}
    decisionList.forEach(d => {
        const key = d.reason || 'Unknown reason'
        reasoningCounts[key] = (reasoningCounts[key] || 0) + 1
    })

    // 3. Construct Summary Text
    const topReasons = Object.entries(reasoningCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([reason, count]) => `- ${count}x ${reason}`)
        .join('\n')

    const summaryText = `
RTI Daily Digest (${yesterday.toLocaleDateString()})
Total Traffic Processed: ${totalEvents}
Suppressed (Silence): ${suppressedCount}
Items for Review: ${digestItemsCount}

Top Suppression Reasons:
${topReasons}
`.trim()

    // 4. Persist Digest
    const digestId = uuidv4()
    await supabaseAdmin.from('digests').insert({
        id: digestId,
        organization_id: organizationId,
        digest_type: 'overnight',
        period_start: yesterday.toISOString(),
        period_end: today.toISOString(),
        summary_text: summaryText,
        total_events: totalEvents,
        suppressed_count: suppressedCount,
        escalated_count: 0, // Need to fetch these too if we want full verification
        needs_review_count: 0,
        generated_at: new Date().toISOString()
    })

    return digestId
}

async function createEmptyDigest(orgId: string, start: Date, end: Date) {
    const id = uuidv4()
    await supabaseAdmin.from('digests').insert({
        id,
        organization_id: orgId,
        digest_type: 'overnight',
        period_start: start.toISOString(),
        period_end: end.toISOString(),
        summary_text: "No return traffic detected in this period.",
        total_events: 0,
        suppressed_count: 0,
        escalated_count: 0,
        needs_review_count: 0
    })
    return id
}
