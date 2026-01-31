import { neon } from '@neondatabase/serverless'

export async function onRequestGet({ request, env }) {
  const sql = neon(env.NEON_CONNECTION_STRING)

  // Feature flag check
  if (env.TRANSLATION_LIVE_ASSIST_PREVIEW !== 'true') {
    console.warn('[SWML Bridge] Live translation preview disabled')
    return new Response(JSON.stringify({
      version: '1.0.0',
      sections: {
        main: [
          { answer: {} },
          { say: { text: 'Live translation is not available for your plan.' } },
          { hangup: {} }
        ]
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const url = new URL(request.url)
    const callId = url.searchParams.get('callId')
    const conferenceName = url.searchParams.get('conferenceName')
    let leg = url.searchParams.get('leg')

    if (!callId || !conferenceName || !leg) {
      return new Response(JSON.stringify({
        version: '1.0.0',
        sections: {
          main: [
            { answer: {} },
            { say: { text: 'Invalid call parameters. Hanging up.' } },
            { hangup: {} }
          ]
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const isAgentLeg = leg === '1' || leg === 'agent' || leg === 'first'

    let call = null
    try {
      const rows = await sql`SELECT organization_id FROM calls WHERE id = ${callId} LIMIT 1`
      call = rows[0]
    } catch (callErr) {
      console.warn('[SWML Bridge] Call not found or no org', { callId, error: callErr?.message })
    }

    let translationEnabled = false
    let fromLang = 'en-US'
    let toLang = 'es'

    if (call?.organization_id) {
      const voiceConfigRows = await sql`SELECT live_translate, translate_from, translate_to FROM voice_configs WHERE organization_id = ${call.organization_id} LIMIT 1`
      const voiceConfig = voiceConfigRows?.[0]

      translationEnabled = !!voiceConfig?.live_translate &&
        !!voiceConfig?.translate_from &&
        !!voiceConfig?.translate_to

      if (translationEnabled && voiceConfig) {
        fromLang = voiceConfig.translate_from
        toLang = voiceConfig.translate_to
      }
    }

    console.log('[SWML Bridge] Generating SWML', {
      callId,
      conferenceName,
      leg,
      isAgentLeg,
      translationEnabled,
      languages: translationEnabled ? `${fromLang} → ${toLang}` : 'none'
    })

    const appUrl = 'https://wordisbond.pages.dev'
    const webhookUrl = `${appUrl}/api/webhooks/signalwire?callId=${callId}&type=live_translate`

    const sections = []

    sections.push({ answer: {} })

    if (translationEnabled) {
      const aiConfig = {
        prompt: {
          text: `You are a translation assistant for a ${isAgentLeg ? 'customer service' : 'customer'} call. Translate between ${fromLang} and ${toLang}.`
        },
        languages: [
          {
            name: 'English',
            code: fromLang,
            voice: 'rime.spore'
          }
        ],
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 150
      }

      if (toLang !== fromLang) {
        aiConfig.languages.push({
          name: 'Spanish',
          code: toLang,
          voice: 'rime.alberto'
        })
      }

      sections.push({ ai: aiConfig })
    }

    sections.push({
      conference: {
        name: conferenceName,
        wait_url: webhookUrl,
        end_conference_on_exit: false
      }
    })

    return new Response(JSON.stringify({
      version: '1.0.0',
      sections: {
        main: sections
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('[SWML Bridge] Error', err)
    return new Response(JSON.stringify({
      version: '1.0.0',
      sections: {
        main: [
          { answer: {} },
          { say: { text: 'System error. Hanging up.' } },
          { hangup: {} }
        ]
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}