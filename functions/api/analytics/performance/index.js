import { neon } from '@neondatabase/serverless'

export async function onRequestGet({ request, env }) {
  const sql = neon(env.NEON_CONNECTION_STRING)

  try {
    // TODO: Implement authentication and role check
    // const ctx = await requireRole(['owner', 'admin', 'analyst'])
    // if (!ctx) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const orgId = 'placeholder-org-id' // ctx.orgId

    // Fetch org call IDs
    const orgCalls = await sql`SELECT id FROM calls WHERE organization_id = ${orgId} LIMIT 2000`
    const callIds = orgCalls.map(c => c.id)
    const safeCallIds = callIds.length > 0 ? callIds : ['00000000-0000-0000-0000-000000000000']

    // Fetch webhook subscription IDs
    const orgSubs = await sql`SELECT id FROM webhook_subscriptions WHERE organization_id = ${orgId} LIMIT 500`
    const subIds = orgSubs.map(s => s.id)
    const safeSubIds = subIds.length > 0 ? subIds : ['00000000-0000-0000-0000-000000000000']

    // Parallel queries
    const [callsResult, recordingsResult, aiRunsResult, webhooksResult] = await Promise.all([
      // Get total calls count
      sql`SELECT COUNT(*) as count FROM calls WHERE organization_id = ${orgId}`,

      // Get recordings with transcription
      sql`SELECT call_id, transcript_json, created_at FROM recordings WHERE organization_id = ${orgId} AND transcript_json IS NOT NULL`,

      // Get AI runs
      sql`SELECT model, status, call_id FROM ai_runs WHERE call_id = ANY(${safeCallIds}) AND status = 'completed'`,

      // Get webhook deliveries count
      sql`SELECT COUNT(*) as count FROM webhook_deliveries WHERE subscription_id = ANY(${safeSubIds})`
    ])

    const totalCalls = parseInt(callsResult[0].count) || 0
    const recordings = recordingsResult
    const aiRuns = aiRunsResult
    const webhookCount = parseInt(webhooksResult[0].count) || 0

    // Calculate metrics
    const transcription_rate = totalCalls > 0 ? Math.round((recordings.length / totalCalls) * 100) : 0

    const translations = aiRuns.filter(run =>
      run.model === 'translation' || run.model === 'elevenlabs-translate'
    ).length
    const translation_rate = totalCalls > 0 ? Math.round((translations / totalCalls) * 100) : 0

    const avg_transcription_time_seconds = recordings.length > 0 ? 15 : 0
    const avg_recording_quality = 85

    const feature_usage = {
      voice_cloning: aiRuns.filter(run =>
        run.model === 'elevenlabs-clone' || run.model === 'voice-clone'
      ).length,
      surveys: aiRuns.filter(run =>
        run.model === 'laml-dtmf-survey' || run.model === 'signalwire-ai-survey'
      ).length,
      scorecards: aiRuns.filter(run =>
        run.model === 'scorecard' || run.model === 'quality-assessment'
      ).length,
      webhooks_sent: webhookCount
    }

    const metrics = {
      transcription_rate,
      translation_rate,
      avg_transcription_time_seconds,
      avg_recording_quality,
      feature_usage
    }

    return new Response(JSON.stringify({ success: true, data: { metrics } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Performance metrics error', error)
    return new Response(JSON.stringify({ success: false, error: error.message || 'Failed to compute metrics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}