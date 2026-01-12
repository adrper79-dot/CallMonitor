import supabaseAdmin from '@/lib/supabaseAdmin'
import { AppError } from '@/types/app-error'
import { generateSpeech } from './elevenlabs'

/**
 * Translation Service
 * 
 * Translates transcript text using available translation providers.
 * Per MASTER_ARCHITECTURE.txt: Translation is a call modulation.
 * 
 * Enhanced with ElevenLabs TTS for audio playback of translations.
 */

export interface TranslationInput {
  callId: string
  translationRunId: string
  text: string
  fromLanguage: string
  toLanguage: string
  organizationId: string
}

/**
 * Translate text using available translation service
 * 
 * Priority:
 * 1. AssemblyAI (if translation API available)
 * 2. OpenAI (fallback)
 * 3. Google Translate API (fallback)
 */
export async function translateText(input: TranslationInput): Promise<void> {
  const { callId, translationRunId, text, fromLanguage, toLanguage, organizationId } = input

  try {
    // Check organization plan - translation requires Global plan
    const { data: orgRows } = await supabaseAdmin
      .from('organizations')
      .select('plan')
      .eq('id', organizationId)
      .limit(1)

    const orgPlan = orgRows?.[0]?.plan?.toLowerCase()
    if (orgPlan !== 'global' && orgPlan !== 'enterprise') {
      // eslint-disable-next-line no-console
      console.warn('translation: plan does not support translation', { organizationId, plan: orgPlan })
      await supabaseAdmin
        .from('ai_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          output: { error: 'Plan does not support translation', plan: orgPlan }
        }).eq('id', translationRunId)
      return
    }

    // Try AssemblyAI translation first (if they support it)
    // For now, AssemblyAI doesn't have a direct translation API,
    // so we'll use OpenAI as the translation provider
    
    let translatedText: string | null = null
    let translationError: string | null = null

    // Use OpenAI for translation (if available)
    if (process.env.OPENAI_API_KEY) {
      try {
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: (fromLanguage === 'auto' || toLanguage === 'auto')
                  ? `You are a professional translator. First detect the language of the following text. Then translate it to the most appropriate target language. If the text is in English, translate to Spanish. If the text is in Spanish, translate to English. If the text is in another language, translate to English. Only return the translated text, no explanations or language labels.`
                  : `You are a professional translator. Translate the following text from ${fromLanguage} to ${toLanguage}. Only return the translated text, no explanations.`
              },
              {
                role: 'user',
                content: text
              }
            ],
            temperature: 0.3,
            max_tokens: 2000
          })
        })

        if (openaiRes.ok) {
          const openaiData = await openaiRes.json()
          translatedText = openaiData.choices?.[0]?.message?.content?.trim() || null
          
          if (translatedText) {
            // eslint-disable-next-line no-console
            console.log('translation: OpenAI translation successful', { translationRunId, callId })
          }
        } else {
          const errorText = await openaiRes.text()
          translationError = `OpenAI API error: ${openaiRes.status} - ${errorText}`
        }
      } catch (err: any) {
        translationError = `OpenAI translation failed: ${err?.message || 'Unknown error'}`
      }
    } else {
      // Fallback: Simple placeholder translation (for development)
      // In production, this should use a real translation service
      translationError = 'No translation provider configured (OPENAI_API_KEY not set)'
    }

    // Update ai_run with translation result
    if (translatedText) {
      let audioUrl: string | null = null
      
      // Generate audio with ElevenLabs (if API key is configured)
      if (process.env.ELEVENLABS_API_KEY) {
        try {
          // eslint-disable-next-line no-console
          console.log('translation: generating audio with ElevenLabs', { translationRunId, chars: translatedText.length })
          
          const audioStream = await generateSpeech(translatedText, toLanguage)
          
          // Convert stream to buffer
          const reader = audioStream.getReader()
          const chunks: Uint8Array[] = []
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
          }
          const audioBuffer = Buffer.concat(chunks)
          
          // Upload to Supabase storage
          const audioFileName = `translations/${translationRunId}.mp3`
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('recordings')
            .upload(audioFileName, audioBuffer, {
              contentType: 'audio/mpeg',
              upsert: true
            })
          
          if (uploadError) {
            console.error('translation: audio upload failed', { error: uploadError.message, translationRunId })
          } else {
            // Get public URL
            const { data: { publicUrl } } = supabaseAdmin.storage
              .from('recordings')
              .getPublicUrl(audioFileName)
            
            audioUrl = publicUrl
            // eslint-disable-next-line no-console
            console.log('translation: audio generated and uploaded', { translationRunId, audioUrl })
          }
        } catch (audioError: any) {
          // eslint-disable-next-line no-console
          console.error('translation: ElevenLabs audio generation failed', { 
            error: audioError?.message, 
            translationRunId 
          })
          // Continue without audio - translation text is still valid
        }
      }
      
      await supabaseAdmin
        .from('ai_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          output: {
            from_language: fromLanguage,
            to_language: toLanguage,
            source_text: text,
            translated_text: translatedText,
            translated_audio_url: audioUrl, // ← New: Audio URL from ElevenLabs
            provider: 'openai',
            tts_provider: audioUrl ? 'elevenlabs' : null,
            completed_at: new Date().toISOString()
          }
        }).eq('id', translationRunId)

      // eslint-disable-next-line no-console
      console.log('translation: completed', { 
        translationRunId, 
        callId, 
        fromLanguage, 
        toLanguage,
        hasAudio: !!audioUrl 
      })
    } else {
      await supabaseAdmin
        .from('ai_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          output: {
            from_language: fromLanguage,
            to_language: toLanguage,
            source_text: text,
            error: translationError || 'Translation failed',
            failed_at: new Date().toISOString()
          }
        })
        .eq('id', translationRunId)

      // eslint-disable-next-line no-console
      console.error('translation: failed', { translationRunId, callId, error: translationError })
    }

  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('translation: service error', { error: err?.message, translationRunId, callId })
    
    await supabaseAdmin
      .from('ai_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        output: {
          error: err?.message || 'Translation service error',
          failed_at: new Date().toISOString()
        }
      }).eq('id', translationRunId)
  }
}
