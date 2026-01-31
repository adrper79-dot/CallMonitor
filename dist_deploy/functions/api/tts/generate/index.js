import { neon } from '@neondatabase/serverless'
import { v4 as uuidv4 } from 'uuid'

export async function onRequestPost({ request, env }) {
  const sql = neon(env.NEON_CONNECTION_STRING)

  try {
    // TODO: Implement authentication
    // const auth = await verifyAuth(request)
    // if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const body = await request.json()
    const { text, voice_id, language } = body

    if (!text) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!env.ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: 'ElevenLabs service unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (text.length > 5000) {
      return new Response(JSON.stringify({ error: 'Text too long (max 5000 characters)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // TODO: Get organization_id from auth
    const organization_id = 'placeholder-org-id' // auth.orgId

    const audioStream = await generateSpeech(text, language, voice_id, env.ELEVENLABS_API_KEY)

    const chunks = []
    const reader = audioStream.getReader()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }

    const audioBuffer = Buffer.concat(chunks)

    const fileName = `${uuidv4()}.mp3`
    const filePath = `tts/${organization_id}/${fileName}`

    // TODO: Upload to R2
    // await uploadToR2(env.RECORDINGS_BUCKET, filePath, audioBuffer)

    // For now, return success without upload
    const audioUrl = `https://example.com/${filePath}` // placeholder

    await sql`
      INSERT INTO ai_runs (id, call_id, system_id, model, status, started_at, completed_at, produced_by, is_authoritative, output)
      VALUES (${uuidv4()}, null, null, 'elevenlabs-tts', 'completed', NOW(), NOW(), 'model', true, ${JSON.stringify({
        text, voice_id, language, audio_url: audioUrl, storage_path: filePath, character_count: text.length, organization_id
      })})
    `

    return new Response(JSON.stringify({
      success: true,
      audio_url: audioUrl,
      storage_path: filePath,
      expires_in: 3600,
      character_count: text.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('TTS generation error', error)
    return new Response(JSON.stringify({ error: error.message || 'Generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function generateSpeech(text, targetLanguage = 'en', customVoiceId, apiKey) {
  const voiceId = customVoiceId || (targetLanguage === 'en'
    ? 'EXAVITQu4vr4xnSDxMaL'
    : 'pNInz6obpgDQGcFmaJgB')

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`
  const body = {
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    throw new Error(`ElevenLabs API error: ${res.status}`)
  }

  return res.body
}