import { neon } from '@neondatabase/serverless'

export async function onRequestPost(context) {
  const { env, request } = context

  try {
    const sql = neon(env.NEON_CONNECTION_STRING)

    // Parse the request body (SignalWire webhook format)
    const payload = await request.json()
    const callSid = payload.CallSid || payload.call_sid
    const callStatus = payload.CallStatus || payload.call_status
    const recordingSid = payload.RecordingSid || payload.recording_sid
    const recordingUrl = payload.RecordingUrl || payload.recording_url
    const recordingDuration = payload.RecordingDuration || payload.recording_duration
    const callDuration = payload.CallDuration || payload.call_duration

    console.log('SignalWire webhook received:', {
      callSid: callSid?.substring(0, 10) + '...',
      callStatus,
      recordingSid: recordingSid?.substring(0, 10) + '...',
      hasRecordingUrl: !!recordingUrl
    })

    // Handle call status updates
    if (callSid && callStatus) {
      // Find call by call_sid
      const callResult = await sql`
        SELECT id, organization_id, status FROM calls WHERE call_sid = ${callSid} LIMIT 1
      `

      if (callResult.length > 0) {
        const call = callResult[0]
        const now = new Date().toISOString()

        // Update call status
        let updateData = { status: callStatus, updated_at: now }

        if (callStatus === 'completed' && callDuration) {
          updateData.duration_seconds = parseInt(callDuration)
          updateData.ended_at = now
        } else if (['ringing', 'in-progress'].includes(callStatus) && !call.started_at) {
          updateData.started_at = now
        }

        await sql`
          UPDATE calls SET ${sql(updateData)} WHERE id = ${call.id}
        `

        // Create audit log
        const auditId = crypto.randomUUID()
        await sql`
          INSERT INTO audit_logs (id, organization_id, action, resource_type, resource_id, actor_type, actor_label, after, created_at)
          VALUES (${auditId}, ${call.organization_id}, 'call_status_update', 'call', ${call.id}, 'vendor', 'signalwire', ${JSON.stringify({
            call_sid: callSid,
            status: callStatus,
            duration_seconds: callDuration
          })}, ${now})
        `
      }
    }

    // Handle recording status updates
    if (recordingSid && recordingUrl) {
      // Find recording by recording_sid
      const recResult = await sql`
        SELECT id, call_id, organization_id FROM recordings WHERE recording_sid = ${recordingSid} LIMIT 1
      `

      if (recResult.length > 0) {
        const recording = recResult[0]
        const now = new Date().toISOString()

        // Update recording with URL and metadata
        await sql`
          UPDATE recordings SET
            recording_url = ${recordingUrl},
            duration_seconds = ${recordingDuration ? parseInt(recordingDuration) : null},
            status = 'completed',
            updated_at = ${now}
          WHERE id = ${recording.id}
        `

        // Create audit log
        const auditId = crypto.randomUUID()
        await sql`
          INSERT INTO audit_logs (id, organization_id, action, resource_type, resource_id, actor_type, actor_label, after, created_at)
          VALUES (${auditId}, ${recording.organization_id}, 'recording_completed', 'recording', ${recording.id}, 'vendor', 'signalwire', ${JSON.stringify({
            recording_sid: recordingSid,
            recording_url: recordingUrl,
            duration_seconds: recordingDuration
          })}, ${now})
        `

        // Trigger AI transcription if configured
        const vcResult = await sql`
          SELECT transcribe FROM voice_configs WHERE organization_id = ${recording.organization_id} LIMIT 1
        `
        const voiceConfig = vcResult[0]

        if (voiceConfig?.transcribe) {
          // Create AI run for transcription
          const aiRunId = crypto.randomUUID()
          const sysResult = await sql`SELECT id FROM systems WHERE key = 'system-ai' LIMIT 1`
          const systemId = sysResult[0]?.id

          if (systemId) {
            await sql`
              INSERT INTO ai_runs (id, call_id, system_id, model, status, started_at, produced_by, is_authoritative, output)
              VALUES (${aiRunId}, ${recording.call_id}, ${systemId}, 'assemblyai-v1', 'pending', ${now}, 'system', true, ${JSON.stringify({
                recording_id: recording.id,
                recording_url: recordingUrl
              })})
            `
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true, processed: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('SignalWire webhook error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}