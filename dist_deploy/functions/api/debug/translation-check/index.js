import { neon } from '@neondatabase/serverless'

export async function onRequestGet({ request, env }) {
  const sql = neon(env.NEON_CONNECTION_STRING)

  try {
    // TODO: Implement authentication
    // const auth = await verifyAuth(request)
    // if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    // TODO: Get orgId from auth
    const orgId = 'placeholder-org-id' // auth.orgId

    // Get voice config
    const vcRows = await sql`SELECT * FROM voice_configs WHERE organization_id = ${orgId} LIMIT 1`
    const voiceConfig = vcRows[0]

    // Check for recent calls
    const recentCalls = await sql`
      SELECT id, status, started_at, ended_at FROM calls
      WHERE organization_id = ${orgId}
      ORDER BY started_at DESC
      LIMIT 5
    `

    // Check for ai_runs
    const callIds = recentCalls.map(c => c.id)
    const aiRuns = callIds.length > 0 ? await sql`
      SELECT id, call_id, model, status, output, completed_at FROM ai_runs
      WHERE call_id = ANY(${callIds})
      ORDER BY started_at DESC
      LIMIT 10
    ` : []

    // Check for recordings
    const recordings = await sql`
      SELECT id, call_sid, recording_url, transcript_json, status FROM recordings
      WHERE organization_id = ${orgId}
      ORDER BY created_at DESC
      LIMIT 5
    `

    // Environment check
    const envCheck = {
      OPENAI_API_KEY: !!env.OPENAI_API_KEY ? '✅ SET' : '❌ MISSING',
      ASSEMBLYAI_API_KEY: !!env.ASSEMBLYAI_API_KEY ? '✅ SET' : '❌ MISSING',
      ELEVENLABS_API_KEY: !!env.ELEVENLABS_API_KEY ? '✅ SET (audio)' : '⚠️ MISSING (no audio)',
    }

    // Translation status
    const translationStatus = {
      enabled: voiceConfig?.translate === true ? '✅ ENABLED' : '❌ DISABLED',
      from_language: voiceConfig?.translate_from || '❌ NOT SET',
      to_language: voiceConfig?.translate_to || '❌ NOT SET',
      plan_supports: ['global', 'enterprise', 'business', 'pro', 'standard', 'active'].includes('placeholder-plan') // TODO: get plan
        ? '✅ SUPPORTED'
        : '❌ Plan not supported'
    }

    // Issue diagnosis
    const issues = []

    if (!env.OPENAI_API_KEY) {
      issues.push('❌ OPENAI_API_KEY not set - translation cannot work')
    }

    if (!env.ASSEMBLYAI_API_KEY) {
      issues.push('❌ ASSEMBLYAI_API_KEY not set - transcription cannot work')
    }

    if (!voiceConfig?.translate) {
      issues.push('❌ Translation not enabled in voice config')
    }

    if (!voiceConfig?.translate_from) {
      issues.push('❌ translate_from not set in voice config')
    }

    if (!voiceConfig?.translate_to) {
      issues.push('❌ translate_to not set in voice config')
    }

    if (aiRuns.length === 0) {
      issues.push('⚠️ No recent AI runs found - check if calls are being processed')
    }

    if (recordings.length === 0) {
      issues.push('⚠️ No recent recordings found - check if calls are being recorded')
    }

    return new Response(JSON.stringify({
      status: 'debug_info',
      organization_id: orgId,
      voice_config: voiceConfig,
      recent_calls: recentCalls,
      ai_runs: aiRuns,
      recordings: recordings,
      environment: envCheck,
      translation: translationStatus,
      issues: issues,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Translation check error', error)
    return new Response(JSON.stringify({ error: error.message || 'Check failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}