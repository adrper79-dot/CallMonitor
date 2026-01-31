import { neon } from '@neondatabase/serverless'

const FALLBACK_SWML = {
  version: '1.0.0',
  sections: { main: [{ answer: {} }, { hangup: {} }] }
}

export async function onRequestPost({ request, env }) {
  const sql = neon(env.NEON_CONNECTION_STRING)

  try {
    const payload = await request.json()

    const from = payload.From ?? payload.from
    const to = payload.To ?? payload.to
    const callSid = payload.CallSid ?? payload.call_sid

    const url = new URL(request.url)
    const callId = url.searchParams.get('callId')

    console.log('SWML outbound webhook', { from: from ? '[REDACTED]' : null, to: to ? '[REDACTED]' : null, callId })

    let organizationId = null
    let voiceConfig = null

    if (callSid) {
      const rows = await sql`SELECT organization_id FROM calls WHERE call_sid = ${callSid} LIMIT 1`
      if (rows?.[0]) {
        organizationId = rows[0].organization_id
      }
    } else if (callId) {
      const rows = await sql`SELECT organization_id FROM calls WHERE id = ${callId} LIMIT 1`
      if (rows?.[0]) {
        organizationId = rows[0].organization_id
      }
    }

    if (!organizationId) {
      console.warn('SWML outbound: could not find organization_id', { callId })
      return new Response(JSON.stringify(FALLBACK_SWML), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const vcRows = await sql`SELECT record, live_translate, translate_from, translate_to FROM voice_configs WHERE organization_id = ${organizationId} LIMIT 1`

    voiceConfig = vcRows?.[0] || null

    if (!voiceConfig?.live_translate || !voiceConfig?.translate_from || !voiceConfig?.translate_to) {
      console.warn('SWML outbound: translation not enabled', { organizationId })
      return new Response(JSON.stringify(FALLBACK_SWML), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (env.TRANSLATION_LIVE_ASSIST_PREVIEW !== 'true') {
      console.warn('SWML outbound: feature flag disabled', { organizationId })
      return new Response(JSON.stringify(FALLBACK_SWML), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const finalCallId = callId || callSid || `swml-${Date.now()}`
    const swmlConfig = buildSWML(
      {
        callId: finalCallId,
        organizationId,
        translationFrom: voiceConfig.translate_from,
        translationTo: voiceConfig.translate_to
      },
      voiceConfig.record === true
    )

    console.log('SWML outbound: generated SWML', { organizationId, callId: finalCallId })

    return new Response(JSON.stringify(swmlConfig), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('SWML outbound error', err)
    return new Response(JSON.stringify(FALLBACK_SWML), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export async function onRequestGet() {
  return new Response(JSON.stringify({
    ok: true, route: '/api/voice/swml/outbound',
    method: 'Use POST for SWML generation',
    description: 'SWML endpoint for live translation calls'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

// Simplified buildSWML - placeholder
function buildSWML(input, recordCall = true) {
  const mainSection = []

  mainSection.push({ answer: {} })

  const aiConfig = {
    prompt: {
      text: `You are a translation assistant. Translate between ${input.translationFrom} and ${input.translationTo}.`
    },
    languages: [
      {
        name: 'English',
        code: input.translationFrom,
        voice: 'rime.spore'
      }
    ],
    model: 'gpt-4',
    temperature: 0.7,
    max_tokens: 150
  }

  if (input.translationTo !== input.translationFrom) {
    aiConfig.languages.push({
      name: 'Spanish',
      code: input.translationTo,
      voice: 'rime.alberto'
    })
  }

  mainSection.push({ ai: aiConfig })

  if (recordCall) {
    const appUrl = 'https://wordisbond.pages.dev'
    mainSection.push({
      record_call: {
        format: 'mp3',
        stereo: false,
        recording_status_callback: `${appUrl}/api/webhooks/signalwire`
      }
    })
  }

  return {
    version: '1.0.0',
    sections: {
      main: mainSection
    }
  }
}