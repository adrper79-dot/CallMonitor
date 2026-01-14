import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { AppError } from '@/types/app-error'
import { verifySignalWireSignature } from '@/lib/webhookSecurity'
import { isLiveTranslationPreviewEnabled } from '@/lib/env-validation'
import { logger } from '@/lib/logger'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'

// Force dynamic rendering - webhooks must be processed dynamically
export const dynamic = 'force-dynamic'

function parseFormUrlEncoded(body: string) {
  return Object.fromEntries(new URLSearchParams(body))
}

/**
 * SignalWire Webhook Handler
 * 
 * Processes webhooks from SignalWire for:
 * - CallStatus events (completed, failed, no-answer, busy)
 * - RecordingStatus events (completed)
 * 
 * Per MASTER_ARCHITECTURE.txt sequence diagram:
 * - Updates calls table with status, ended_at, duration
 * - Creates/updates recordings table with recording metadata
 * - Triggers transcription if enabled in voice_configs
 * 
 * Returns 200 OK immediately, processes asynchronously
 * 
 * Security: 
 * - Validates webhook signature if SIGNALWIRE_TOKEN is configured
 * - Rate limited: 1000 requests/minute per source (DoS protection)
 */
async function handleWebhook(req: Request) {
  // Validate webhook signature if token is configured
  // NOTE: SignalWire signature validation can fail due to URL proxy/rewrite in serverless.
  // Set SIGNALWIRE_SKIP_SIGNATURE_VALIDATION=true if validation fails, and use rate limiting.
  const skipValidation = process.env.SIGNALWIRE_SKIP_SIGNATURE_VALIDATION === 'true'
  const authToken = process.env.SIGNALWIRE_TOKEN || process.env.SIGNALWIRE_API_TOKEN
  
  if (authToken && !skipValidation) {
    const signature = req.headers.get('X-SignalWire-Signature') || 
                     req.headers.get('X-Twilio-Signature') ||
                     req.headers.get('X-Signature') ||
                     req.headers.get('Signature')
    
    if (signature) {
      // Get raw body for signature verification
      const rawBody = await req.text()
      
      // Try validation with URL (standard Twilio/SignalWire approach)
      const webhookUrl = process.env.NEXT_PUBLIC_APP_URL 
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire`
        : req.url
      
      const isValid = verifySignalWireSignature(rawBody, signature, authToken, webhookUrl)
      
      if (!isValid) {
        // Log invalid signature attempt (security event)
        logger.error('SignalWire webhook: Invalid signature - potential spoofing attempt', undefined, { 
          signaturePrefix: signature.substring(0, 10),
          source: 'signalwire-webhook',
          hint: 'Set SIGNALWIRE_SKIP_SIGNATURE_VALIDATION=true if this is a false positive from URL proxy issues'
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
      // Signature header missing but token configured - log warning but allow in development
      if (process.env.NODE_ENV === 'production') {
        logger.warn('SignalWire webhook: Signature header missing in production', {
          source: 'signalwire-webhook',
          environment: 'production'
        })
        return NextResponse.json(
          { success: false, error: { code: 'WEBHOOK_SIGNATURE_MISSING', message: 'Webhook signature required' } },
          { status: 401 }
        )
      }
    }
  }

  // Return 200 OK immediately - SignalWire requires quick response
  // Process webhook asynchronously per architecture: SignalWire is execution plane
  void processWebhookAsync(req).catch((err) => {
    logger.error('SignalWire webhook async processing failed', err, { 
      source: 'signalwire-webhook',
      phase: 'async-processing'
    })
  })

  return NextResponse.json({ ok: true, received: true })
}

async function processWebhookAsync(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let payload: any = null
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text()
      payload = parseFormUrlEncoded(text)
    } else {
      try {
        payload = await req.json()
      } catch (_) {
        payload = await req.text()
      }
    }

    // Extract webhook event type and call information
    const callSid = payload.CallSid || payload.CallSid || payload.call_sid
    const callStatus = payload.CallStatus || payload.call_status
    const recordingSid = payload.RecordingSid || payload.RecordingSid || payload.recording_sid
    const recordingUrl = payload.RecordingUrl || payload.RecordingUrl || payload.recording_url
    const recordingDuration = payload.RecordingDuration || payload.RecordingDuration || payload.recording_duration
    const callDuration = payload.CallDuration || payload.CallDuration || payload.call_duration
    const eventType = payload.EventType || payload.event_type || (recordingSid ? 'recording' : 'call')
    const recordingStatus = payload.RecordingStatus || payload.recording_status

    // Log webhook processing per architecture: SignalWire = authoritative media plane
    // Note: SignalWire sends SEPARATE webhooks for call status and recording status
    // Call status callback comes first (completed), Recording callback comes later
    const isRecordingCallback = !!recordingSid || !!recordingUrl || recordingStatus
    logger.info('SignalWire webhook received', { 
      callSid: callSid ? '[REDACTED]' : null, 
      callStatus, 
      eventType,
      isRecordingCallback,
      hasRecording: !!recordingSid,
      hasRecordingUrl: !!recordingUrl,
      recordingStatus: recordingStatus || 'not-present',
      callbackSource: payload.CallbackSource || 'unknown',
      payloadKeys: Object.keys(payload).sort(),
      source: 'signalwire-webhook'
    })
    
    // DIAGNOSTIC: Log recording-related fields (call artifacts are first-class per architecture)
    if (recordingSid || recordingUrl || recordingStatus) {
      logger.info('SignalWire webhook: Recording artifact detected', {
        recordingSid: recordingSid ? '[REDACTED]' : 'MISSING',
        recordingUrlPrefix: recordingUrl ? recordingUrl.substring(0, 50) : 'MISSING',
        recordingDuration: recordingDuration || 'MISSING',
        recordingStatus: recordingStatus || 'MISSING',
        source: 'signalwire-webhook',
        artifactType: 'recording'
      })
    } else if (callStatus === 'completed') {
      // eslint-disable-next-line no-console
      console.warn('signalwire webhook: Call completed but NO RECORDING FIELDS in payload', {
        callSid: callSid ? '[REDACTED]' : null,
        payloadKeys: Object.keys(payload).sort(),
        // Log first 200 chars of payload for debugging
        payloadPreview: JSON.stringify(payload).substring(0, 200)
      })
    }

    if (!callSid) {
      // eslint-disable-next-line no-console
      console.warn('signalwire webhook: missing CallSid, skipping')
      return
    }

    // Extract callId from URL query parameter (definitive identifier)
    // This solves race conditions when multiple calls happen simultaneously
    const webhookUrl = new URL(req.url)
    const callIdFromUrl = webhookUrl.searchParams.get('callId')
    
    let call: any = null
    
    // Strategy 1: Use callId from URL (most reliable - no ambiguity)
    if (callIdFromUrl) {
      const { data: callRows, error: callErr } = await supabaseAdmin
        .from('calls')
        .select('id, organization_id, status, started_at, ended_at, call_sid')
        .eq('id', callIdFromUrl)
        .limit(1)
      
      if (!callErr && callRows?.[0]) {
        call = callRows[0]
        
        // Update call_sid if not set yet (first webhook)
        if (!call.call_sid && callSid) {
          await supabaseAdmin
            .from('calls')
            .update({ call_sid: callSid })
            .eq('id', call.id)
          
          console.log('signalwire webhook: linked call_sid via callId param', { 
            callId: call.id 
          })
        }
      }
    }
    
    // Strategy 2: Fallback to call_sid lookup (for older webhooks or if URL param missing)
    if (!call) {
      const { data: callRows, error: callErr } = await supabaseAdmin
        .from('calls')
        .select('id, organization_id, status, started_at, ended_at')
        .eq('call_sid', callSid)
        .limit(1)

      if (!callErr && callRows?.[0]) {
        call = callRows[0]
      }
    }
    
    if (!call) {
      // eslint-disable-next-line no-console
      console.warn('signalwire webhook: call not found', { 
        callSid: '[REDACTED]', 
        callIdFromUrl: callIdFromUrl || 'not-provided' 
      })
      return
    }

    const callId = call.id
    const organizationId = call.organization_id

    // Detect if this call used live translation (SWML endpoint with AI agent)
    // 
    // IMPORTANT: This is a HEURISTIC detection, not authoritative.
    // 
    // Rationale for v1:
    // - Live translation is enabled via routing logic in startCallHandler
    // - No explicit flag is stored in the `calls` table at call initiation
    // - We reconstruct the decision using the same logic: Business plan + feature flag + voice_configs
    // 
    // Limitations:
    // - If voice_configs change between call initiation and completion, detection may be incorrect
    // - If feature flag changes mid-call, detection may be incorrect
    // - Cannot distinguish between SWML calls that failed vs. LaML fallback
    // 
    // Future Enhancement (v2):
    // - Store explicit `use_live_translation` boolean in `calls` table at initiation
    // - Pass flag in webhook payload metadata (if SignalWire supports custom fields)
    // - Eliminates heuristic and provides authoritative source of truth
    // 
    // Accepted for v1 Preview:
    // - Heuristic is reasonable for capability-gated preview feature
    // - Risk is low: worst case is incorrect `has_live_translation` flag on recording
    // - Does not impact core call functionality, recording, or canonical transcription
    let hasLiveTranslation = false
    try {
      const { data: orgRows } = await supabaseAdmin
        .from('organizations')
        .select('plan')
        .eq('id', organizationId)
        .limit(1)

      const plan = String(orgRows?.[0]?.plan ?? '').toLowerCase()
      const isBusinessPlan = ['business', 'enterprise'].includes(plan)
      const isFeatureFlagEnabled = isLiveTranslationPreviewEnabled()

      if (isBusinessPlan && isFeatureFlagEnabled) {
        const { data: vcRows } = await supabaseAdmin
          .from('voice_configs')
          .select('translate, translate_from, translate_to')
          .eq('organization_id', organizationId)
          .limit(1)

        const voiceConfig = vcRows?.[0]
        if (voiceConfig?.translate === true && voiceConfig?.translate_from && voiceConfig?.translate_to) {
          hasLiveTranslation = true
        }
      }
    } catch (e) {
      // Best-effort: if check fails, default to false
      // eslint-disable-next-line no-console
      console.warn('signalwire webhook: failed to check live translation', { error: e })
    }

    // Handle CallStatus events
    if (eventType === 'call' || callStatus) {
      const statusMap: Record<string, string> = {
        'completed': 'completed',
        'failed': 'failed',
        'no-answer': 'failed',
        'busy': 'failed',
        'ringing': 'in_progress',
        'in-progress': 'in_progress',
        'queued': 'pending'
      }

      const mappedStatus = statusMap[callStatus?.toLowerCase()] || callStatus || 'unknown'
      const updateData: any = { status: mappedStatus }

      // Update ended_at if call completed or failed
      if (mappedStatus === 'completed' || mappedStatus === 'failed') {
        updateData.ended_at = new Date().toISOString()
      }

      // Update started_at if call is in progress and not set
      if ((mappedStatus === 'in_progress' || mappedStatus === 'completed') && !call.started_at) {
        updateData.started_at = new Date().toISOString()
      }

      const { error: updateErr } = await supabaseAdmin
        .from('calls')
        .update(updateData).eq('id', callId)

      if (updateErr) {
        // eslint-disable-next-line no-console
        console.error('signalwire webhook: failed to update call', { error: updateErr.message, callId })
      } else {
        // eslint-disable-next-line no-console
        console.log('signalwire webhook: updated call status', { callId, status: mappedStatus })
      }
    }

    // Handle RecordingStatus events
    if (recordingSid && recordingUrl) {
      // Check if recording already exists
      const { data: existingRecRows } = await supabaseAdmin
        .from('recordings')
        .select('id, status')
        .eq('recording_sid', recordingSid)
        .limit(1)

      const existingRec = existingRecRows?.[0]

      // Get organization's tool_id for recordings
      const { data: orgRows } = await supabaseAdmin
        .from('organizations')
        .select('tool_id')
        .eq('id', organizationId)
        .limit(1)

      const orgToolId = orgRows?.[0]?.tool_id

      if (!orgToolId) {
        // eslint-disable-next-line no-console
        console.warn('signalwire webhook: organization has no tool_id, cannot create recording', { organizationId })
      } else {
        const durationSeconds = recordingDuration 
          ? Math.round(parseInt(String(recordingDuration), 10) / 1000) 
          : callDuration 
            ? Math.round(parseInt(String(callDuration), 10)) 
            : null

        if (existingRec) {
          // Update existing recording
          const updateData: any = {
            recording_url: recordingUrl,
            duration_seconds: durationSeconds,
            status: 'completed',
            updated_at: new Date().toISOString()
          }

          // Set live translation flags if this call used live translation
          if (hasLiveTranslation) {
            updateData.has_live_translation = true
            updateData.live_translation_provider = 'signalwire'
          }

          const { error: updateRecErr } = await supabaseAdmin
            .from('recordings')
            .update(updateData).eq('id', existingRec.id)

          if (updateRecErr) {
            // eslint-disable-next-line no-console
            console.error('signalwire webhook: failed to update recording', { error: updateRecErr.message, recordingId: existingRec.id })
          } else {
            // eslint-disable-next-line no-console
            console.log('signalwire webhook: updated recording', { recordingId: existingRec.id })
            
    // Trigger transcription if enabled (pass recording ID and call ID)
    await triggerTranscriptionIfEnabled(callId, existingRec.id, organizationId, recordingSid)
          }
        } else {
          // Create new recording
          const recordingId = uuidv4()
          const insertData: any = {
            id: recordingId,
            organization_id: organizationId,
            call_sid: callSid,
            recording_sid: recordingSid,
            recording_url: recordingUrl,
            duration_seconds: durationSeconds,
            status: 'completed',
            tool_id: orgToolId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }

          // Set live translation flags if this call used live translation
          if (hasLiveTranslation) {
            insertData.has_live_translation = true
            insertData.live_translation_provider = 'signalwire'
          }

          const { error: insertRecErr } = await supabaseAdmin
            .from('recordings')
            .insert(insertData)

          if (insertRecErr) {
            // eslint-disable-next-line no-console
            console.error('signalwire webhook: failed to create recording', { error: insertRecErr.message, callId })
          } else {
            // eslint-disable-next-line no-console
            console.log('signalwire webhook: created recording', { recordingId, callId })
            
            // Audit log: recording created
            try {
              await supabaseAdmin.from('audit_logs').insert({
                id: uuidv4(),
                organization_id: organizationId,
                user_id: null, // System action
                system_id: null,
                resource_type: 'recordings',
                resource_id: recordingId,
                action: 'create',
                before: null,
                after: { call_id: callId, recording_sid: recordingSid, recording_url: recordingUrl },
                created_at: new Date().toISOString()
              })
            } catch (auditErr) {
              // Best-effort
            }
            
            // Store recording in Supabase Storage (async, non-blocking)
            void (async () => {
              try {
                const { storeRecording, ensureRecordingsBucket } = await import('@/app/services/recordingStorage')
                await ensureRecordingsBucket()
                await storeRecording(recordingUrl, organizationId, callId, recordingId)
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error('signalwire webhook: failed to store recording', { error: err, recordingId })
              }
            })()
            
            // Trigger transcription if enabled
            await triggerTranscriptionIfEnabled(callId, recordingId, organizationId, recordingSid)
          }
        }
      }
    }

  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('signalwire webhook processing error', { error: err?.message ?? String(err) })
  }
}

/**
 * Trigger transcription if enabled in voice_configs
 */
async function triggerTranscriptionIfEnabled(callId: string, recordingId: string, organizationId: string, recordingSid?: string) {
  try {
    // Check voice_configs for transcription setting
    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('transcribe')
      .eq('organization_id', organizationId)
      .limit(1)

    const shouldTranscribe = vcRows?.[0]?.transcribe === true

    if (!shouldTranscribe) {
      return
    }

    // Check if transcription already queued
    const { data: aiRows } = await supabaseAdmin
      .from('ai_runs')
      .select('id, status')
      .eq('call_id', callId)
      .eq('model', 'assemblyai-v1')
      .limit(1)

    if (aiRows && aiRows.length > 0 && aiRows[0].status !== 'failed') {
      // Already queued or processing
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
      // eslint-disable-next-line no-console
      console.warn('signalwire webhook: AI system not found, cannot trigger transcription', { callId })
      return
    }

    // Get recording URL
    const { data: recRows } = await supabaseAdmin
      .from('recordings')
      .select('recording_url')
      .eq('id', recordingId)
      .limit(1)

    const recordingUrl = recRows?.[0]?.recording_url
    if (!recordingUrl) {
      // eslint-disable-next-line no-console
      console.warn('signalwire webhook: recording URL not found', { recordingId })
      return
    }

    // Check organization plan
    const { data: orgRows } = await supabaseAdmin
      .from('organizations')
      .select('plan')
      .eq('id', organizationId)
      .limit(1)

    const orgPlan = orgRows?.[0]?.plan
    if (orgPlan === 'free') {
      // Free plan doesn't allow transcription
      return
    }

    // Call AssemblyAI directly (webhook context, no auth required)
    if (!process.env.ASSEMBLYAI_API_KEY) {
      // eslint-disable-next-line no-console
      console.warn('signalwire webhook: ASSEMBLYAI_API_KEY not configured')
      return
    }

    // Create ai_run entry first
    const aiRunId = uuidv4()
    const { error: aiErr } = await supabaseAdmin
      .from('ai_runs')
      .insert({
        id: aiRunId,
        call_id: callId,
        system_id: systemAiId,
        model: 'assemblyai-v1',
        status: 'queued',
        started_at: new Date().toISOString()
      })

    if (aiErr) {
      // eslint-disable-next-line no-console
      console.error('signalwire webhook: failed to create ai_run', { error: aiErr.message, callId })
      return
    }

    // Call AssemblyAI
    const aaiRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': process.env.ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: recordingUrl,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/assemblyai`
      })
    })

    if (aaiRes.ok) {
      const aaiData = await aaiRes.json()
      // Update ai_run with job_id
      await supabaseAdmin
        .from('ai_runs')
        .update({
          status: 'processing',
          output: { job_id: aaiData.id, status: 'queued' }
        })
        .eq('id', aiRunId)
      
      // eslint-disable-next-line no-console
      console.log('signalwire webhook: triggered AssemblyAI transcription', { aiRunId, jobId: aaiData.id })
    } else {
      const errText = await aaiRes.text()
      // eslint-disable-next-line no-console
      console.error('signalwire webhook: AssemblyAI API error', { status: aaiRes.status, error: errText, recordingId })
      await supabaseAdmin
        .from('ai_runs')
        .update({ 
          status: 'failed',
          output: { error: errText, status_code: aaiRes.status }
        }).eq('id', aiRunId)
    }

  } catch (err: any) {
    logger.error('SignalWire webhook: Transcription trigger error', err, { callId })
  }
}

// HIGH-1: Apply rate limiting per architecture: Security boundaries (1000/min per source)
export const POST = withRateLimit(handleWebhook, {
  identifier: (req) => {
    // Rate limit by source IP - SignalWire sends from known IPs
    return `webhook-signalwire-${getClientIP(req)}`
  },
  config: {
    maxAttempts: 1000, // 1000 requests per minute
    windowMs: 60 * 1000, // 1 minute window
    blockMs: 5 * 60 * 1000 // 5 minute block on abuse
  }
})
