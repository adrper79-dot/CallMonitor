import { neon } from '@neondatabase/serverless'

export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const sql = neon(env.NEON_CONNECTION_STRING)
    const payload = await request.json()

    const transcriptId = payload.transcript_id
    const status = payload.status
    const text = payload.text
    const words = payload.words
    const confidence = payload.confidence
    const languageCode = payload.language_code || payload.language_detection?.language_code

    console.log('AssemblyAI webhook received:', {
      transcriptId: transcriptId ? '[REDACTED]' : null,
      status,
      hasText: !!text
    })

    if (!transcriptId || status !== 'completed') {
      if (status === 'error') {
        // Update ai_run to failed status
        try {
          const aiRows = await sql`
            SELECT id, output FROM ai_runs
            WHERE model IN ('assemblyai-v1', 'assemblyai-upload')
            AND output @> ${JSON.stringify({ job_id: transcriptId })}::jsonb
            LIMIT 1`

          if (aiRows.length > 0) {
            const existingOutput = aiRows[0].output
            await sql`
              UPDATE ai_runs SET status = 'failed', completed_at = NOW(), output = ${JSON.stringify({ ...existingOutput, error: payload.error, status: 'error' })} WHERE id = ${aiRows[0].id}`
          }
        } catch (e) {
          console.error('Failed to update failed ai_run:', e)
        }
      }
      return new Response('OK', { status: 200 })
    }

    // Find the ai_run by transcript_id
    const aiRows = await sql`
      SELECT id, call_id, output FROM ai_runs
      WHERE model IN ('assemblyai-v1', 'assemblyai-upload')
      AND output @> ${JSON.stringify({ job_id: transcriptId })}::jsonb
      LIMIT 1`

    if (aiRows.length === 0) {
      console.warn('ai_run not found for transcript_id:', transcriptId)
      return new Response('OK', { status: 200 })
    }

    const aiRun = aiRows[0]
    const aiRunId = aiRun.id
    const callId = aiRun.call_id

    // Find recording by call_id
    const recRows = await sql`
      SELECT id, organization_id FROM recordings WHERE call_id = ${callId} LIMIT 1`

    let recordingId = null
    let organizationId = null

    if (recRows.length > 0) {
      recordingId = recRows[0].id
      organizationId = recRows[0].organization_id
    }

    // Build transcript JSON
    const transcriptJson = {
      text,
      words: words || [],
      confidence: confidence || null,
      transcript_id: transcriptId,
      language_code: languageCode || null,
      completed_at: new Date().toISOString()
    }

    // Update ai_run with completed status
    const newOutput = {
      ...(typeof aiRun.output === 'object' ? aiRun.output : {}),
      transcript: transcriptJson,
      status: 'completed'
    }

    await sql`
      UPDATE ai_runs SET status = 'completed', completed_at = NOW(), is_authoritative = true, produced_by = 'model', output = ${JSON.stringify(newOutput)} WHERE id = ${aiRunId}`

    // Update recording with transcript if found
    if (recordingId) {
      await sql`
        UPDATE recordings SET transcript_json = ${JSON.stringify(transcriptJson)}, updated_at = NOW() WHERE id = ${recordingId}`
    }

    console.log('AssemblyAI webhook processed successfully:', { aiRunId, callId, recordingId })

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('AssemblyAI webhook error:', error)
    return new Response('Error', { status: 500 })
  }
}