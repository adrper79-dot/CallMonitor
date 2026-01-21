import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { verifyAssemblyAISignature } from '@/lib/webhookSecurity'
import { logger } from '@/lib/logger'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'

// Force dynamic rendering - webhooks must be processed dynamically
export const dynamic = 'force-dynamic'

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
 * Security: 
 * - Validates webhook signature if ASSEMBLYAI_API_KEY is configured
 * - Rate limited: 1000 requests/minute per source (DoS protection)
 */
async function handleWebhook(req: Request) {
  // Validate webhook signature if API key is configured
  const apiKey = process.env.ASSEMBLYAI_API_KEY
  // Allow skipping validation for debugging or if signature checks fail persistently
  const skipValidation = process.env.ASSEMBLYAI_SKIP_SIGNATURE_VALIDATION === 'true'

  if (apiKey && !skipValidation) {
    const signature = req.headers.get('X-AssemblyAI-Signature') ||
      req.headers.get('X-Signature') ||
      req.headers.get('Signature')

    if (signature) {
      // Get raw body for signature verification
      const rawBody = await req.text()
      const isValid = verifyAssemblyAISignature(rawBody, signature, apiKey)

      if (!isValid) {
        logger.error('AssemblyAI webhook: Invalid signature - potential spoofing attempt', undefined, {
          signaturePrefix: signature.substring(0, 10),
          source: 'assemblyai-webhook'
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
        logger.warn('AssemblyAI webhook: Signature header missing in production', {
          source: 'assemblyai-webhook',
          environment: 'production'
        })
        return NextResponse.json(
          { success: false, error: { code: 'WEBHOOK_SIGNATURE_MISSING', message: 'Webhook signature required' } },
          { status: 401 }
        )
      }
    }
  }

  // Process webhook - AWAIT execution to prevent Serverless freeze
  try {
    await processWebhookAsync(req)
  } catch (err) {
    logger.error('AssemblyAI webhook async processing failed', err, {
      source: 'assemblyai-webhook',
      phase: 'async-processing'
    })
  }

  return NextResponse.json({ ok: true, received: true })
}

async function processWebhookAsync(req: Request) {
  try {
    const payload = await req.json()

    // AssemblyAI webhook payload structure
    const transcriptId = payload.transcript_id
    let status = payload.status // 'completed', 'error', 'processing'
    let text = payload.text // Full transcript text
    let words = payload.words // Word-level timestamps
    let confidence = payload.confidence // Overall confidence score
    const audioUrl = payload.audio_url // Original audio URL
    let languageCode = payload.language_code || payload.language_detection?.language_code

    // Fallback: If status is completed but text is missing, fetch full transcript
    if (status === 'completed' && (!text || text === undefined) && transcriptId) {
      logger.warn('AssemblyAI webhook: Payload missing text, fetching from API', { transcriptId })
      try {
        const apiKey = process.env.ASSEMBLYAI_API_KEY
        if (apiKey) {
          const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
            headers: { 'Authorization': apiKey }
          })
          if (response.ok) {
            const fullTranscript = await response.json()
            text = fullTranscript.text
            words = fullTranscript.words
            confidence = fullTranscript.confidence
            languageCode = fullTranscript.language_code
            // If status was somehow different, trust the API
            status = fullTranscript.status
            logger.info('AssemblyAI webhook: Successfully fetched missing transcript data', { transcriptId, hasText: !!text })
          } else {
            logger.error('AssemblyAI webhook: Failed to fetch transcript fallback', undefined, { status: response.status })
          }
        }
      } catch (fetchErr) {
        logger.error('AssemblyAI webhook: Fetch fallback exception', fetchErr)
      }
    }

    // Analytics features (enabled in transcription request)
    const sentimentAnalysis = payload.sentiment_analysis_results // Array of {text, start, end, sentiment, confidence}
    const entities = payload.entities // Array of {entity_type, text, start, end}
    const chapters = payload.chapters // Array of {headline, summary, start, end}
    const contentSafety = payload.content_safety_labels // {status, results, summary}
    const iabCategories = payload.iab_categories_result // {status, results, summary}
    const utterances = payload.utterances // Speaker-labeled segments

    logger.info('AssemblyAI webhook received', {
      transcriptId: transcriptId ? '[REDACTED]' : null,
      status,
      hasText: !!text,
      source: 'assemblyai-webhook',
      artifactType: 'transcript'
    })

    if (!transcriptId) {
      logger.warn('AssemblyAI webhook: Missing transcript_id, skipping', {
        source: 'assemblyai-webhook'
      })
      return
    }

    if (status !== 'completed') {
      if (status === 'error') {
        logger.error('AssemblyAI webhook: Transcription failed', undefined, {
          transcriptId: '[REDACTED]',
          error: payload.error,
          source: 'assemblyai-webhook'
        })

        // Find and update ai_run to failed status (check both models)
        const { data: aiRows } = await supabaseAdmin
          .from('ai_runs')
          .select('id, call_id, output')
          .in('model', ['assemblyai-v1', 'assemblyai-upload'])
          .contains('output', { job_id: transcriptId })
          .limit(1)

        if (aiRows && aiRows.length > 0) {
          const existingOutput = typeof aiRows[0].output === 'object' ? aiRows[0].output : {}
          await supabaseAdmin
            .from('ai_runs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              output: { ...existingOutput, error: payload.error, status: 'error' }
            }).eq('id', aiRows[0].id)
        }
      }
      return
    }

    // Find the ai_run by transcript_id (stored in output.job_id)
    // Check both call-based (assemblyai-v1) and upload-based (assemblyai-upload) models
    const { data: aiRows, error: aiErr } = await supabaseAdmin
      .from('ai_runs')
      .select('id, call_id, output')
      .in('model', ['assemblyai-v1', 'assemblyai-upload'])
      .contains('output', { job_id: transcriptId })
      .limit(1)

    if (aiErr) {
      logger.error('AssemblyAI webhook: Failed to find ai_run', aiErr, {
        transcriptId: '[REDACTED]',
        source: 'assemblyai-webhook'
      })
      return
    }

    const aiRun = aiRows?.[0]
    if (!aiRun) {
      logger.warn('AssemblyAI webhook: ai_run not found', {
        transcriptId: '[REDACTED]',
        source: 'assemblyai-webhook'
      })
      return
    }

    const aiRunId = aiRun.id
    const callId = aiRun.call_id

    // Find the recording for this call - try call_id first (per migration), fallback to call_sid
    let recordingId: string | undefined
    let organizationId: string | undefined

    // First try by call_id (the FK relationship per 20260118_schema_alignment.sql)
    const { data: recByCallId } = await supabaseAdmin
      .from('recordings')
      .select('id, organization_id')
      .eq('call_id', callId)
      .limit(1)

    if (recByCallId && recByCallId.length > 0) {
      recordingId = recByCallId[0].id
      organizationId = recByCallId[0].organization_id
    } else {
      // Fallback to call_sid for older recordings
      const callSid = await getCallSidFromCallId(callId)
      if (callSid) {
        const { data: recByCallSid } = await supabaseAdmin
          .from('recordings')
          .select('id, organization_id')
          .eq('call_sid', callSid)
          .limit(1)

        if (recByCallSid && recByCallSid.length > 0) {
          recordingId = recByCallSid[0].id
          organizationId = recByCallSid[0].organization_id
        }
      }
    }

    // If still no organization_id, get it from the call directly
    if (!organizationId && callId) {
      const { data: callRows } = await supabaseAdmin
        .from('calls')
        .select('organization_id')
        .eq('id', callId)
        .limit(1)
      organizationId = callRows?.[0]?.organization_id
    }

    if (!recordingId) {
      logger.warn('AssemblyAI webhook: Recording not found for call', { callId })
      // Continue anyway - we can still update ai_run
    }

    // Build transcript JSON structure (first-class artifact per architecture)
    // Includes full analytics from AssemblyAI
    const transcriptJson: Record<string, any> = {
      text,
      words: words || [],
      confidence: confidence || null,
      transcript_id: transcriptId,
      language_code: languageCode || null,
      completed_at: new Date().toISOString(),
      // Analytics
      sentiment_analysis: sentimentAnalysis || null,
      entities: entities || null,
      chapters: chapters || null,
      content_safety: contentSafety || null,
      iab_categories: iabCategories || null,
      utterances: utterances || null  // Speaker-labeled segments
    }

    // Compute overall sentiment summary
    if (sentimentAnalysis && Array.isArray(sentimentAnalysis) && sentimentAnalysis.length > 0) {
      const sentiments = sentimentAnalysis.map((s: any) => s.sentiment)
      const positive = sentiments.filter((s: string) => s === 'POSITIVE').length
      const negative = sentiments.filter((s: string) => s === 'NEGATIVE').length
      const neutral = sentiments.filter((s: string) => s === 'NEUTRAL').length
      const total = sentiments.length

      transcriptJson.sentiment_summary = {
        overall: positive > negative ? 'POSITIVE' : negative > positive ? 'NEGATIVE' : 'NEUTRAL',
        positive_percent: Math.round((positive / total) * 100),
        negative_percent: Math.round((negative / total) * 100),
        neutral_percent: Math.round((neutral / total) * 100),
        segment_count: total
      }
    }

    // Update ai_run with completed status and transcript
    const { error: updateAiErr } = await supabaseAdmin
      .from('ai_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        is_authoritative: true,  // AssemblyAI is authoritative per ARCH_DOCS
        produced_by: 'model',
        output: {
          ...(typeof aiRun.output === 'object' ? aiRun.output : {}),
          transcript: transcriptJson,
          status: 'completed'
        }
      }).eq('id', aiRunId)

    if (updateAiErr) {
      logger.error('AssemblyAI webhook: Failed to update ai_run', updateAiErr, { aiRunId })
    } else {
      logger.info('AssemblyAI webhook: Updated ai_run with transcript', {
        aiRunId,
        callId,
        source: 'assemblyai-webhook',
        artifactType: 'transcript'
      })

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
          created_at: new Date().toISOString(),
          actor_type: 'vendor',
          actor_label: 'assemblyai-webhook'
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
        logger.error('AssemblyAI webhook: Failed to update recording', updateRecErr, { recordingId })
      } else {
        logger.info('AssemblyAI webhook: Updated recording with transcript', {
          recordingId,
          source: 'assemblyai-webhook',
          artifactType: 'recording-transcript'
        })
      }

      // Check if translation is enabled and trigger if needed
      if (organizationId) {
        // Get recording URL for voice cloning
        const { data: recUrlRows } = await supabaseAdmin
          .from('recordings')
          .select('recording_url')
          .eq('id', recordingId)
          .limit(1)
        const recordingUrl = recUrlRows?.[0]?.recording_url || undefined

        await checkAndTriggerTranslation(callId, organizationId, text, languageCode, recordingUrl)
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

      // Auto-email artifacts to user when transcription completes
      if (organizationId && callId) {
        await sendArtifactsToUserEmail(callId, organizationId)
      }
    }

  } catch (err: any) {
    logger.error('AssemblyAI webhook processing error', err, {
      source: 'assemblyai-webhook'
    })
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
 * 
 * Auto-detection logic:
 * - If translate_from is 'auto', use AssemblyAI's detected language
 * - If translate_to is 'auto', infer target (en→es, es→en, other→en)
 */
async function checkAndTriggerTranslation(callId: string, organizationId: string, transcriptText: string, detectedLanguage?: string, recordingUrl?: string) {
  try {
    // ARCH_DOCS Plan Tier Gating: Translation requires Global, Business, or Enterprise plan
    const { data: orgRows } = await supabaseAdmin
      .from('organizations')
      .select('plan')
      .eq('id', organizationId)
      .limit(1)

    const orgPlan = orgRows?.[0]?.plan?.toLowerCase() || 'free'
    const translationPlans = ['global', 'business', 'enterprise']
    if (!translationPlans.includes(orgPlan)) {
      logger.debug('AssemblyAI webhook: Translation skipped - plan does not support translation', {
        callId, organizationId, plan: orgPlan, requiredPlans: translationPlans
      })
      return
    }

    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('live_translate, translate_from, translate_to, use_voice_cloning')
      .eq('organization_id', organizationId)
      .limit(1)

    const config = vcRows?.[0]
    if (!config?.live_translate) {
      logger.debug('AssemblyAI webhook: Translation not enabled in voice_configs', { callId, organizationId })
      return
    }

    // Check for OPENAI_API_KEY early - it's required for translation
    if (!process.env.OPENAI_API_KEY) {
      logger.error('POST_CALL_TRANSLATION_FAILED: OPENAI_API_KEY not configured', undefined, {
        callId,
        organizationId,
        resolution: 'Set OPENAI_API_KEY environment variable'
      })
      return
    }

    // Handle auto-detection: if translate_from or translate_to is 'auto', use detected language
    let fromLanguage = config.translate_from
    let toLanguage = config.translate_to

    // For bridge calls, we need to handle bidirectional translation
    const { data: callRows } = await supabaseAdmin
      .from('calls')
      .select('id, flow_type')
      .eq('id', callId)
      .limit(1)

    const isBridgeCall = callRows?.[0]?.flow_type === 'bridge'

    if (isBridgeCall) {
      if (detectedLanguage) {
        fromLanguage = detectedLanguage
      }

      // Get all recordings for this call to find the other leg
      const { data: recordingRows } = await supabaseAdmin
        .from('recordings')
        .select('id, transcript_json')
        .eq('call_id', callId)

      if (recordingRows && recordingRows.length >= 2) {
        const otherLeg = recordingRows.find(r => r.transcript_json?.language_code !== detectedLanguage)
        if (otherLeg?.transcript_json?.language_code) {
          toLanguage = otherLeg.transcript_json.language_code
        } else if (toLanguage === 'auto') {
          logger.info('AssemblyAI webhook: Waiting for other leg transcript', { callId })
          return
        }
      } else if (toLanguage === 'auto') {
        logger.info('AssemblyAI webhook: Waiting for both bridge legs', { callId })
        return
      }
    } else {
      // Single leg call: use detected language if auto
      if (fromLanguage === 'auto' && detectedLanguage) {
        fromLanguage = detectedLanguage
      } else if (fromLanguage === 'auto' && !detectedLanguage) {
        logger.warn('AssemblyAI webhook: translate_from is auto but no language detected', {
          callId,
          hint: 'AssemblyAI should detect language automatically - check transcript payload'
        })
        // Default to English if we can't detect
        fromLanguage = 'en'
      }

      // Auto-detect target language for single-leg calls
      if (toLanguage === 'auto') {
        // Infer target language: if source is English, translate to Spanish (most common)
        // If source is non-English, translate to English
        if (fromLanguage?.startsWith('en')) {
          toLanguage = 'es'  // English → Spanish
          logger.info('AssemblyAI webhook: Auto-detected target language', {
            callId, fromLanguage, toLanguage, reason: 'en→es default'
          })
        } else {
          toLanguage = 'en'  // Non-English → English
          logger.info('AssemblyAI webhook: Auto-detected target language', {
            callId, fromLanguage, toLanguage, reason: 'non-en→en default'
          })
        }
      }
    }

    if (!fromLanguage || !toLanguage || fromLanguage === 'auto' || toLanguage === 'auto') {
      logger.error('POST_CALL_TRANSLATION_FAILED: Language configuration incomplete', undefined, {
        callId,
        fromLanguage: fromLanguage || 'NOT_SET',
        toLanguage: toLanguage || 'NOT_SET',
        detectedLanguage: detectedLanguage || 'NOT_DETECTED',
        resolution: 'Configure translate_from and translate_to in voice_configs or ensure language detection works'
      })
      return
    }

    // Skip if source and target are the same
    if (fromLanguage === toLanguage) {
      logger.info('AssemblyAI webhook: Skipping translation - source and target languages are the same', {
        callId, language: fromLanguage
      })
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

    // Check for existing queued translation run (created by startCallHandler)
    const { data: existingTransRuns } = await supabaseAdmin
      .from('ai_runs')
      .select('id')
      .eq('call_id', callId)
      .in('model', ['assemblyai-translation', 'assemblyai-translation-v1'])
      .eq('status', 'queued')
      .limit(1)

    // Reuse existing ID if available, otherwise generate new one
    // Standardize model to 'assemblyai-translation-v1' to match startCallHandler
    const translationRunId = existingTransRuns?.[0]?.id || uuidv4()
    const isNew = !existingTransRuns?.[0]

    try {
      if (isNew) {
        // Intent capture for new runs
        await supabaseAdmin.from('audit_logs').insert({
          id: uuidv4(),
          organization_id: organizationId,
          user_id: null,
          system_id: systemAiId,
          resource_type: 'ai_runs',
          resource_id: translationRunId,
          action: 'intent:translation_requested',
          actor_type: 'vendor',
          actor_label: 'assemblyai-webhook',
          before: null,
          after: {
            call_id: callId,
            from_language: fromLanguage,
            to_language: toLanguage,
            provider: 'openai',
            declared_at: new Date().toISOString()
          },
          created_at: new Date().toISOString()
        })
      }
    } catch (__) { }

    // Upsert translation ai_run entry (Insert if new, Update if existing)
    // We use upsert logic or simple insert/update based on isNew
    if (isNew) {
      await supabaseAdmin
        .from('ai_runs')
        .insert({
          id: translationRunId,
          call_id: callId,
          system_id: systemAiId,
          model: 'assemblyai-translation-v1', // Standardized
          status: 'queued',
          started_at: new Date().toISOString(),
          output: {
            from_language: fromLanguage,
            to_language: toLanguage,
            source_text: transcriptText,
            detected_language: detectedLanguage,
            bridge_call: isBridgeCall
          }
        })
    } else {
      // Claim the existing run -> Update it with execution details
      await supabaseAdmin
        .from('ai_runs')
        .update({
          // Ensure model is standardized
          model: 'assemblyai-translation-v1',
          started_at: new Date().toISOString(),
          output: {
            from_language: fromLanguage,
            to_language: toLanguage,
            source_text: transcriptText,
            detected_language: detectedLanguage,
            bridge_call: isBridgeCall,
            claimed_by_webhook: true
          }
        })
        .eq('id', translationRunId)
    }

    // Get recording URL if voice cloning is enabled
    let finalRecordingUrl = recordingUrl
    if (config.use_voice_cloning && !finalRecordingUrl) {
      // Try to get recording URL from recordings table
      const { data: recRows } = await supabaseAdmin
        .from('recordings')
        .select('recording_url')
        .eq('call_id', callId)
        .limit(1)
      finalRecordingUrl = recRows?.[0]?.recording_url || undefined
    }

    // Trigger translation via translation service
    const { translateText } = await import('@/app/services/translation')
    await translateText({
      callId,
      translationRunId,
      text: transcriptText,
      fromLanguage: fromLanguage,
      toLanguage: toLanguage,
      organizationId,
      recordingUrl: finalRecordingUrl,
      useVoiceCloning: config.use_voice_cloning || false
    })

  } catch (err: any) {
    logger.error('AssemblyAI webhook: Translation trigger error', err, { callId })
  }
}

/**
 * Check if survey is enabled and process survey responses
 */
async function checkAndProcessSurvey(callId: string, organizationId: string, transcriptText: string, recordingId: string) {
  try {
    // ARCH_DOCS Plan Tier Gating: Survey requires Insights, Global, Business, or Enterprise plan
    const { data: orgRows } = await supabaseAdmin
      .from('organizations')
      .select('plan')
      .eq('id', organizationId)
      .limit(1)

    const orgPlan = orgRows?.[0]?.plan?.toLowerCase() || 'free'
    const surveyPlans = ['insights', 'global', 'business', 'enterprise']
    if (!surveyPlans.includes(orgPlan)) {
      logger.debug('AssemblyAI webhook: Survey skipped - plan does not support survey', {
        callId, organizationId, plan: orgPlan, requiredPlans: surveyPlans
      })
      return
    }

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
      return
    }

    const surveyRun = surveyRows[0]

    // Process survey using AssemblyAI NLP to extract answers from transcript
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
      }).eq('id', surveyRun.id)

    logger.info('AssemblyAI webhook: Survey processed', {
      surveyRunId: surveyRun.id,
      callId,
      recordingId,
      source: 'assemblyai-webhook'
    })

  } catch (err: any) {
    logger.error('AssemblyAI webhook: Survey processing error', err, { callId })
  }
}

/**
 * Process survey responses using NLP
 */
async function processSurveyWithNLP(transcriptText: string, surveyData: any): Promise<any> {
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
  const lowerText = transcriptText.toLowerCase()

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

/**
 * Auto-send artifacts to user's email when processing completes
 * Sends recording, transcript, and translation as attachments
 */
async function sendArtifactsToUserEmail(callId: string, organizationId: string) {
  try {
    // Get call creator's email
    const { data: callRows } = await supabaseAdmin
      .from('calls')
      .select('created_by')
      .eq('id', callId)
      .limit(1)

    const createdBy = callRows?.[0]?.created_by
    if (!createdBy) {
      logger.warn('AssemblyAI webhook: No creator found for call, skipping auto-email', { callId })
      return
    }

    // Get user's email
    const { data: userRows } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', createdBy)
      .limit(1)

    const userEmail = userRows?.[0]?.email
    if (!userEmail) {
      logger.warn('AssemblyAI webhook: No email found for user, skipping auto-email', { callId, userId: createdBy })
      return
    }

    // Check if Resend is configured
    if (!process.env.RESEND_API_KEY) {
      logger.warn('AssemblyAI webhook: RESEND_API_KEY not configured, skipping auto-email', { callId })
      return
    }

    // Send artifacts via email service
    const { sendArtifactEmail } = await import('@/app/services/emailService')
    const result = await sendArtifactEmail({
      callId,
      organizationId,
      recipientEmail: userEmail,
      includeRecording: true,
      includeTranscript: true,
      includeTranslation: true
    })

    if (result.success) {
      logger.info('AssemblyAI webhook: Auto-emailed artifacts to user', {
        callId,
        email: userEmail.substring(0, 3) + '***',
        source: 'assemblyai-webhook'
      })
    } else {
      logger.error('AssemblyAI webhook: Auto-email failed', undefined, {
        callId,
        error: result.error,
        source: 'assemblyai-webhook'
      })
    }
  } catch (err: any) {
    logger.error('AssemblyAI webhook: Auto-email error', err, { callId })
  }
}

// HIGH-1: Apply rate limiting per architecture: Security boundaries (1000/min per source)
export const POST = withRateLimit(handleWebhook, {
  identifier: (req) => {
    // Rate limit by source IP - AssemblyAI sends from known IPs
    return `webhook-assemblyai-${getClientIP(req)}`
  },
  config: {
    maxAttempts: 1000, // 1000 requests per minute
    windowMs: 60 * 1000, // 1 minute window
    blockMs: 5 * 60 * 1000 // 5 minute block on abuse
  }
})
