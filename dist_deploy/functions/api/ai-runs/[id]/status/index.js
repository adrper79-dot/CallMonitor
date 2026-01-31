import { neon } from '@neondatabase/serverless'

export async function onRequestGet({ request, env }) {
  const sql = neon(env.NEON_CONNECTION_STRING)

  try {
    // TODO: Implement authentication
    // const ctx = await requireAuth()

    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const idIndex = pathParts.indexOf('ai-runs') + 1
    const id = pathParts[idIndex]

    if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      return new Response(JSON.stringify({ error: 'Invalid AI run ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Fetch ai_run record
    const aiRuns = await sql`
      SELECT id, call_id, model, status, started_at, completed_at, output
      FROM ai_runs
      WHERE id = ${id}
    `

    if (aiRuns.length === 0) {
      return new Response(JSON.stringify({ error: 'AI run not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const aiRun = aiRuns[0]

    // TODO: Verify ownership via call or output.organization_id
    // For now, skip

    const output = aiRun.output

    // Build response based on model type
    let response = {
      id: aiRun.id,
      model: aiRun.model,
      status: aiRun.status,
      started_at: aiRun.started_at,
      completed_at: aiRun.completed_at
    }

    // Add model-specific fields
    if (aiRun.model === 'assemblyai-translation') {
      response.from_language = output?.from_language
      response.to_language = output?.to_language

      if (aiRun.status === 'completed') {
        response.translated_text = output?.translated_text
        response.audio_url = output?.translated_audio_url
        response.voice_cloning_used = output?.voice_cloning_used || false
      }

      if (aiRun.status === 'failed') {
        response.error = output?.error
      }
    } else if (aiRun.model?.includes('assemblyai')) {
      // Transcription
      if (aiRun.status === 'completed') {
        response.transcript = output?.transcript?.text
        response.confidence = output?.transcript?.confidence
        response.language_code = output?.transcript?.language_code
      }

      if (aiRun.status === 'failed') {
        response.error = output?.error
      }
    } else {
      // Generic ai_run
      if (aiRun.status === 'completed' || aiRun.status === 'failed') {
        response.output = output
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Status fetch error', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}