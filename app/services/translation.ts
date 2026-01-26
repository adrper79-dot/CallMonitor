import supabaseAdmin from '@/lib/supabaseAdmin'
import storage from '@/lib/storage'
import { generateSpeech, cloneVoice, deleteClonedVoice } from './elevenlabs'
import { logger } from '@/lib/logger'

/**
 * Translation Service - Translates transcript text using OpenAI with ElevenLabs TTS.
 */

export interface TranslationInput {
  callId: string
  translationRunId: string
  text: string
  fromLanguage: string
  toLanguage: string
  organizationId: string
  recordingUrl?: string
  useVoiceCloning?: boolean
}

export async function translateText(input: TranslationInput): Promise<void> {
  const { callId, translationRunId, text, fromLanguage, toLanguage, organizationId, recordingUrl, useVoiceCloning } = input

  logger.info('translation: starting', { 
    callId, 
    translationRunId, 
    fromLanguage, 
    toLanguage, 
    textLength: text?.length || 0,
    hasRecordingUrl: !!recordingUrl,
    useVoiceCloning
  })

  try {
    const { data: orgRows } = await supabaseAdmin
      .from('organizations')
      .select('plan')
      .eq('id', organizationId)
      .limit(1)

    const orgPlan = orgRows?.[0]?.plan?.toLowerCase()
    const translationPlans = ['global', 'enterprise', 'business', 'pro', 'standard', 'active', 'free']
    if (!translationPlans.includes(orgPlan || '')) {
      logger.error('TRANSLATION_FAILED: Plan does not support translation', undefined, { 
        organizationId, 
        plan: orgPlan,
        allowedPlans: translationPlans.join(', ')
      })
      await supabaseAdmin.from('ai_runs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        produced_by: 'model',
        is_authoritative: false, // LLM translations are non-authoritative per ARTIFACT_AUTHORITY_CONTRACT
        output: { error: 'Plan does not support translation', plan: orgPlan }
      }).eq('id', translationRunId)
      return
    }

    let translatedText: string | null = null
    let translationError: string | null = null

    if (!process.env.OPENAI_API_KEY) {
      translationError = 'OPENAI_API_KEY not configured - translation requires OpenAI'
      logger.error('TRANSLATION_FAILED: OPENAI_API_KEY not set', undefined, {
        translationRunId,
        callId,
        resolution: 'Set OPENAI_API_KEY environment variable'
      })
    } else {
      try {
        // Add timeout protection for external API calls (30 second timeout)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)
        
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: (fromLanguage === 'auto' || toLanguage === 'auto')
                  ? `You are a professional translator. First detect the language of the following text. Then translate it to the most appropriate target language. If the text is in English, translate to Spanish. If the text is in Spanish, translate to English. If the text is in another language, translate to English. Only return the translated text, no explanations or language labels.`
                  : `You are a professional translator. Translate the following text from ${fromLanguage} to ${toLanguage}. Only return the translated text, no explanations.`
              },
              { role: 'user', content: text }
            ],
            temperature: 0.3,
            max_tokens: 2000
          })
        })
        
        clearTimeout(timeoutId)

        if (openaiRes.ok) {
          const openaiData = await openaiRes.json()
          translatedText = openaiData.choices?.[0]?.message?.content?.trim() || null
          if (translatedText) {
            logger.info('translation: OpenAI translation successful', { translationRunId, callId })
          }
        } else {
          const errorText = await openaiRes.text()
          translationError = `OpenAI API error: ${openaiRes.status} - ${errorText}`
        }
      } catch (err: any) {
        const errorMsg = err?.name === 'AbortError' 
          ? 'OpenAI translation timed out (30s)'
          : `OpenAI translation failed: ${err?.message || 'Unknown error'}`
        translationError = errorMsg
      }
    }

    if (translatedText) {
      let audioUrl: string | null = null
      let clonedVoiceId: string | null = null
      let usedVoiceCloning = false
      
      if (process.env.ELEVENLABS_API_KEY) {
        try {
          logger.debug('translation: generating audio with ElevenLabs', { 
            translationRunId, chars: translatedText.length, useVoiceCloning: !!useVoiceCloning
          })
          
          let voiceIdToUse: string | undefined = undefined
          
          if (useVoiceCloning && recordingUrl) {
            try {
              logger.debug('translation: attempting voice cloning from recording', { translationRunId })
              
              const recordingResponse = await fetch(recordingUrl)
              if (recordingResponse.ok) {
                const recordingBuffer = Buffer.from(await recordingResponse.arrayBuffer())
                
                if (recordingBuffer.length > 50000) {
                  const cloneResult = await cloneVoice(
                    recordingBuffer,
                    `call-${callId}-${Date.now()}`,
                    `Cloned voice for translation run ${translationRunId}`
                  )
                  clonedVoiceId = cloneResult.voiceId
                  voiceIdToUse = clonedVoiceId
                  usedVoiceCloning = true
                  logger.info('translation: voice cloned successfully', { translationRunId, clonedVoiceId })
                } else {
                  logger.warn('translation: recording too short for voice cloning', { translationRunId })
                }
              } else {
                logger.warn('translation: could not download recording for voice cloning', { 
                  translationRunId, status: recordingResponse.status
                })
              }
            } catch (cloneError: any) {
              logger.error('translation: voice cloning failed, falling back to default voice', cloneError, { translationRunId })
            }
          }
          
          const audioStream = await generateSpeech(translatedText, toLanguage, voiceIdToUse)
          
          const reader = audioStream.getReader()
          const chunks: Uint8Array[] = []
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
          }
          const audioBuffer = Buffer.concat(chunks)
          
          const audioFileName = `translations/${translationRunId}.mp3`
          try {
            await storage.upload('recordings', audioFileName, audioBuffer, 'audio/mpeg')
            try {
              const signed = await storage.createSignedUrl('recordings', audioFileName, 86400)
              audioUrl = signed?.signedUrl || signed
            } catch (e) {
              const pub = await storage.getPublicUrl('recordings', audioFileName)
              audioUrl = pub.publicURL || pub.publicUrl
            }
            logger.info('translation: audio generated and uploaded', { translationRunId, usedVoiceCloning })
          } catch (uploadErr: any) {
            logger.error('translation: audio upload failed', uploadErr, { translationRunId })
          }
          
          if (clonedVoiceId) {
            try {
              await deleteClonedVoice(clonedVoiceId)
              logger.debug('translation: cleaned up cloned voice', { translationRunId, clonedVoiceId })
            } catch (deleteError: any) {
              logger.warn('translation: could not delete cloned voice', { clonedVoiceId, error: deleteError?.message })
            }
          }
        } catch (audioError: any) {
          logger.error('translation: ElevenLabs audio generation failed', audioError, { translationRunId })
        }
      }
      
      await supabaseAdmin.from('ai_runs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        produced_by: 'model',
        is_authoritative: false, // LLM translations are non-authoritative per ARTIFACT_AUTHORITY_CONTRACT
        output: {
          from_language: fromLanguage, to_language: toLanguage,
          source_text: text, translated_text: translatedText,
          translated_audio_url: audioUrl, provider: 'openai',
          tts_provider: audioUrl ? 'elevenlabs' : null,
          voice_cloning_used: usedVoiceCloning,
          completed_at: new Date().toISOString()
        }
      }).eq('id', translationRunId)

      logger.info('translation: completed', { translationRunId, callId, fromLanguage, toLanguage, hasAudio: !!audioUrl, usedVoiceCloning })
    } else {
      await supabaseAdmin.from('ai_runs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        produced_by: 'model',
        is_authoritative: false, // LLM translations are non-authoritative per ARTIFACT_AUTHORITY_CONTRACT
        output: {
          from_language: fromLanguage, to_language: toLanguage,
          source_text: text, error: translationError || 'Translation failed',
          failed_at: new Date().toISOString()
        }
      }).eq('id', translationRunId)

      logger.error('translation: failed', undefined, { translationRunId, callId, error: translationError })
    }

  } catch (err: any) {
    logger.error('translation: service error', err, { translationRunId, callId })
    
    await supabaseAdmin.from('ai_runs').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      produced_by: 'model',
      is_authoritative: false, // LLM translations are non-authoritative per ARTIFACT_AUTHORITY_CONTRACT
      output: { error: err?.message || 'Translation service error', failed_at: new Date().toISOString() }
    }).eq('id', translationRunId)
  }
}
