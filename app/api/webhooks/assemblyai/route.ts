import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { verifyAssemblyAISignature } from '@/lib/webhookSecurity'

/**
 * AssemblyAI Webhook Handler
 * 
 * Processes transcription completion webhooks from AssemblyAI.
 * 
 * Per MASTER_ARCHITECTURE.txt sequence diagram:
 * - Updates recordings.transcript_json with full transcript
 * - Updates ai_runs table: status=completed, output=transcript JSON
 * - If translation enabled, triggers translation pipeline
 * - If survey enabled, extracts survey responses from transcript
 * - Triggers evidence manifest generation if all artifacts complete
 * 
 * Returns 200 OK immediately, processes asynchronously
 * 
 * Security: Validates webhook signature if ASSEMBLYAI_API_KEY is configured
 */
export async function POST(req: Request) {
  // Validate webhook signature if API key is configured
  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (apiKey) {
    const signature = req.headers.get('X-AssemblyAI-Signature') || 
                     req.headers.get('X-Signature') ||
                     req.headers.get('Signature')
    
    if (signature) {
      // Get raw body for signature verification
      const rawBody = await req.text()
      const isValid = verifyAssemblyAISignature(rawBody, signature, apiKey)
      
      if (!isValid) {
        // eslint-disable-next-line no-console
        console.error('assemblyai webhook: invalid signature', { 
          signature: signature.substring(0, 10) + '...' 
        })
        return NextResponse.json(
          { success: false, error: { code: 'WEBHOOK_SIGNATURE_INVALID', message: 'Invalid webhook signature' } },
          { status: 401 }
        )
      }
      
      // Reconstruct request with body for processing
      req = new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: rawBody
      })
    } else {
      // Signature header missing but API key configured - log warning but allow in development
      if (process.env.NODE_ENV === 'production') {
        // eslint-disable-next-line no-console
        console.warn('assemblyai webhook: signature header missing in production')
        return NextResponse.json(
          { success: false, error: { code: 'WEBHOOK_SIGNATURE_MISSING', message: 'Webhook signature required' } },
          { status: 401 }
        )
      }
    }
  }

  // Return 200 OK immediately - AssemblyAI requires quick response
  // Process webhook asynchronously
  void processWebhookAsync(req).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('assemblyai webhook async processing error', { error: err?.message ?? String(err) })
  })

  return NextResponse.json({ ok: true, received: true })
}

async function processWebhookAsync(req: Request) {
  try {
    const payload = await req.json()

    // AssemblyAI webhook payload structure
    const transcriptId = payload.transcript_id
    const status = payload.status // 'completed', 'error', 'processing'
    const text = payload.text // Full transcript text
    const words = payload.words // Word-level timestamps
    const confidence = payload.confidence // Overall confidence score
    const audioUrl = payload.audio_url // Original audio URL

    // eslint-disable-next-line no-console
    console.log('assemblyai webhook processing', { 
      transcriptId: transcriptId ? '[REDACTED]' : null, 
      status,
      hasText: !!text 
    })

    if (!transcriptId) {
      // eslint-disable-next-line no-console
      console.warn('assemblyai webhook: missing transcript_id, skipping')
      return
    }

    if (status !== 'completed') {
      if (status === 'error') {
        // eslint-disable-next-line no-console
        console.error('assemblyai webhook: transcription failed', { transcriptId: '[REDACTED]', error: payload.error })
        
        // Find and update ai_run to failed status
        const { data: aiRows } = await supabaseAdmin
          .from('ai_runs')
          .select('id, call_id')
          .eq('model', 'assemblyai-v1')
          .contains('output', { job_id: transcriptId })
          .limit(1)

        if (aiRows && aiRows.length > 0) {
          await supabaseAdmin
            .from('ai_runs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              output: { ...aiRows[0].output, error: payload.error, status: 'error' }
            })
            .eq('id', aiRows[0].id)
        }
      }
      return
    }

    // Find the ai_run by transcript_id (stored in output.job_id)
    const { data: aiRows, error: aiErr } = await supabaseAdmin
      .from('ai_runs')
      .select('id, call_id, output')
      .eq('model', 'assemblyai-v1')
      .contains('output', { job_id: transcriptId })
      .limit(1)

    if (aiErr) {
      // eslint-disable-next-line no-console
      console.error('assemblyai webhook: failed to find ai_run', { error: aiErr.message, transcriptId: '[REDACTED]' })
      return
    }

    const aiRun = aiRows?.[0]
    if (!aiRun) {
      // eslint-disable-next-line no-console
      console.warn('assemblyai webhook: ai_run not found', { transcriptId: '[REDACTED]' })
      return
    }

    const aiRunId = aiRun.id
    const callId = aiRun.call_id

    // Find the recording for this call
    const { data: recRows, error: recErr } = await supabaseAdmin
      .from('recordings')
      .select('id, organization_id, call_sid')
      .eq('call_sid', (await getCallSidFromCallId(callId)) || '')
      .limit(1)

    if (recErr || !recRows || recRows.length === 0) {
      // eslint-disable-next-line no-console
      console.warn('assemblyai webhook: recording not found for call', { callId })
      // Continue anyway - we can still update ai_run
    }

    const recordingId = recRows?.[0]?.id
    const organizationId = recRows?.[0]?.organization_id

    // Build transcript JSON structure
    const transcriptJson = {
      text,
      words: words || [],
      confidence: confidence || null,
      transcript_id: transcriptId,
      completed_at: new Date().toISOString()
    }

    // Update ai_run with completed status and transcript
    const { error: updateAiErr } = await supabaseAdmin
      .from('ai_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        output: {
          ...(typeof aiRun.output === 'object' ? aiRun.output : {}),
          transcript: transcriptJson,
          status: 'completed'
        }
      })
      .eq('id', aiRunId)

    if (updateAiErr) {
      // eslint-disable-next-line no-console
      console.error('assemblyai webhook: failed to update ai_run', { error: updateAiErr.message, aiRunId })
    } else {
      // eslint-disable-next-line no-console
      console.log('assemblyai webhook: updated ai_run', { aiRunId, callId })
      
      // Audit log: transcription completed
      try {
        await supabaseAdmin.from('audit_logs').insert({
          id: uuidv4(),
          organization_id: organizationId || null,
          user_id: null, // System action
          system_id: null,
          resource_type: 'ai_runs',
          resource_id: aiRunId,
          action: 'update',
          before: { status: 'queued' },
          after: { status: 'completed', transcript_id: transcriptId },
          created_at: new Date().toISOString()
        })
      } catch (auditErr) {
        // Best-effort
      }
    }

    // Update recording with transcript if recording found
    if (recordingId) {
      const { error: updateRecErr } = await supabaseAdmin
        .from('recordings')
        .update({
          transcript_json: transcriptJson,
          updated_at: new Date().toISOString()
        })
        .eq('id', recordingId)

      if (updateRecErr) {
        // eslint-disable-next-line no-console
        console.error('assemblyai webhook: failed to update recording', { error: updateRecErr.message, recordingId })
      } else {
        // eslint-disable-next-line no-console
        console.log('assemblyai webhook: updated recording transcript', { recordingId })
      }

      // Check if translation is enabled and trigger if needed
      if (organizationId) {
        await checkAndTriggerTranslation(callId, organizationId, text)
      }

      // Check if survey is enabled and process if needed
      if (organizationId) {
        await checkAndProcessSurvey(callId, organizationId, text, recordingId)
      }

      // Trigger evidence manifest generation if all artifacts are complete
      if (organizationId && recordingId) {
        const { checkAndGenerateManifest } = await import('@/app/services/evidenceManifest')
        await checkAndGenerateManifest(callId, recordingId, organizationId)
      }
    }

  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('assemblyai webhook processing error', { error: err?.message ?? String(err) })
  }
}

/**
 * Get call_sid from call_id
 */
async function getCallSidFromCallId(callId: string): Promise<string | null> {
  const { data: callRows } = await supabaseAdmin
    .from('calls')
    .select('call_sid')
    .eq('id', callId)
    .limit(1)

  return callRows?.[0]?.call_sid || null
}

/**
 * Check if translation is enabled and trigger translation pipeline
 */
async function checkAndTriggerTranslation(callId: string, organizationId: string, transcriptText: string) {
  try {
    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('translate, translate_from, translate_to')
      .eq('organization_id', organizationId)
      .limit(1)

    const config = vcRows?.[0]
    if (!config?.translate || !config.translate_from || !config.translate_to) {
      return
    }

    // Get AI system ID
    const { data: systemsRows } = await supabaseAdmin
      .from('systems')
      .select('id')
      .eq('key', 'system-ai')
      .limit(1)

    const systemAiId = systemsRows?.[0]?.id
    if (!systemAiId) {
      return
    }

    // Create translation ai_run entry
    const translationRunId = uuidv4()
    await supabaseAdmin
      .from('ai_runs')
      .insert({
        id: translationRunId,
        call_id: callId,
        system_id: systemAiId,
        model: 'assemblyai-translation',
        status: 'queued',
        started_at: new Date().toISOString(),
        output: {
          from_language: config.translate_from,
          to_language: config.translate_to,
          source_text: transcriptText
        }
      })

    // Trigger translation via translation service
    const { translateText } = await import('@/app/services/translation')
    await translateText({
      callId,
      translationRunId,
      text: transcriptText,
      fromLanguage: config.translate_from,
      toLanguage: config.translate_to,
      organizationId
    })

  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('assemblyai webhook: translation trigger error', { error: err?.message, callId })
  }
}

/**
 * Check if survey is enabled and process survey responses
 */
async function checkAndProcessSurvey(callId: string, organizationId: string, transcriptText: string, recordingId: string) {
  try {
    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('survey')
      .eq('organization_id', organizationId)
      .limit(1)

    const config = vcRows?.[0]
    if (!config?.survey) {
      return
    }

    // Find survey ai_run entries for this call
    const { data: surveyRows } = await supabaseAdmin
      .from('ai_runs')
      .select('id, output')
      .eq('call_id', callId)
      .eq('model', 'assemblyai-survey')
      .eq('status', 'queued')
      .limit(1)

    if (!surveyRows || surveyRows.length === 0) {
      // No survey response recorded yet
      return
    }

    const surveyRun = surveyRows[0]

    // Process survey using AssemblyAI NLP to extract answers from transcript
    // Use AssemblyAI's summarization or custom prompts to extract survey responses
    const surveyResults = await processSurveyWithNLP(transcriptText, surveyRun.output)

    // Update survey ai_run with results
    await supabaseAdmin
      .from('ai_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        output: {
          ...surveyRun.output,
          transcript: transcriptText,
          survey_results: surveyResults,
          completed_at: new Date().toISOString()
        }
      })
      .eq('id', surveyRun.id)

    // Store survey in evidence manifest (will be included when manifest is generated)
    // eslint-disable-next-line no-console
    console.log('assemblyai webhook: survey processed', { surveyRunId: surveyRun.id, callId, recordingId })

  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('assemblyai webhook: survey processing error', { error: err?.message, callId })
  }
}

/**
 * Process survey responses using NLP
 */
async function processSurveyWithNLP(transcriptText: string, surveyData: any): Promise<any> {
  // Use AssemblyAI or OpenAI to extract survey answers from transcript
  // For now, we'll use a simple pattern matching approach
  // In production, this would use AssemblyAI's summarization or custom prompts

  const results: any = {
    responses: [],
    score: null,
    sentiment: null
  }

  // If DTMF response exists, use that
  if (surveyData?.dtmf_response) {
    const rating = parseInt(surveyData.dtmf_response, 10)
    if (!isNaN(rating) && rating >= 1 && rating <= 5) {
      results.responses.push({
        question: 'satisfaction_rating',
        answer: rating,
        type: 'numeric'
      })
      results.score = rating
    }
  }

  // Extract additional answers from transcript using keyword matching
  // This is a simple implementation - in production, use AssemblyAI NLP
  const lowerText = transcriptText.toLowerCase()
  
  // Look for satisfaction keywords
  if (lowerText.includes('very satisfied') || lowerText.includes('extremely happy')) {
    results.sentiment = 'very_positive'
  } else if (lowerText.includes('satisfied') || lowerText.includes('happy')) {
    results.sentiment = 'positive'
  } else if (lowerText.includes('dissatisfied') || lowerText.includes('unhappy')) {
    results.sentiment = 'negative'
  } else {
    results.sentiment = 'neutral'
  }

  // If OpenAI is available, use it for better extraction
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
              content: 'Extract survey responses from the following call transcript. Return a JSON object with satisfaction_rating (1-5), key_feedback (array of strings), and overall_sentiment (positive/neutral/negative).'
            },
            {
              role: 'user',
              content: transcriptText
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        })
      })

      if (openaiRes.ok) {
        const openaiData = await openaiRes.json()
        const extracted = openaiData.choices?.[0]?.message?.content
        if (extracted) {
          try {
            const parsed = JSON.parse(extracted)
            if (parsed.satisfaction_rating) {
              results.score = parsed.satisfaction_rating
            }
            if (parsed.key_feedback) {
              results.responses.push({
                question: 'key_feedback',
                answer: parsed.key_feedback,
                type: 'text'
              })
            }
            if (parsed.overall_sentiment) {
              results.sentiment = parsed.overall_sentiment
            }
          } catch {
            // JSON parse failed, use simple extraction
          }
        }
      }
    } catch (err) {
      // OpenAI failed, use simple extraction
    }
  }

  return results
}


