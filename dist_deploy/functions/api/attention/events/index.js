import { neon } from '@neondatabase/serverless'

export async function onRequestGet({ request, env }) {
  const sql = neon(env.NEON_CONNECTION_STRING)

  try {
    // TODO: Implement authentication
    // const session = await getServerSession(authOptions)
    // if (!session?.user?.orgId) return new Response(...)

    const orgId = 'placeholder-org-id'

    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const decisionFilter = url.searchParams.get('decision')

    const rows = await sql`
      SELECT ae.*, ad.id as decision_id, ad.decision as decision_decision, ad.reason as decision_reason, ad.policy_id as decision_policy_id, ad.confidence as decision_confidence, ad.produced_by as decision_produced_by, ad.produced_by_model as decision_produced_by_model, ad.produced_by_user_id as decision_produced_by_user_id
      FROM attention_events ae
      LEFT JOIN LATERAL (
        SELECT * FROM attention_decisions ad WHERE ad.attention_event_id = ae.id ORDER BY ad.created_at DESC LIMIT 1
      ) ad ON true
      WHERE ae.organization_id = ${orgId}
      ORDER BY ae.occurred_at DESC
      LIMIT ${limit}
    `

    const events = rows.map((r) => {
      const decision = r.decision_id ? {
        id: r.decision_id,
        decision: r.decision_decision,
        reason: r.decision_reason,
        policy_id: r.decision_policy_id,
        confidence: r.decision_confidence,
        produced_by: r.decision_produced_by,
        produced_by_model: r.decision_produced_by_model,
        produced_by_user_id: r.decision_produced_by_user_id
      } : undefined

      // strip prefixed decision_* fields
      const { decision_id, decision_decision, decision_reason, decision_policy_id, decision_confidence, decision_produced_by, decision_produced_by_model, decision_produced_by_user_id, ...eventFields } = r

      return { ...eventFields, decision }
    })

    const filtered = decisionFilter ? events.filter((e) => e.decision?.decision === decisionFilter) : events

    return new Response(JSON.stringify({ success: true, events: filtered }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Failed to list attention events', error)
    return new Response(JSON.stringify({ success: false, error: 'Failed to list events' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}