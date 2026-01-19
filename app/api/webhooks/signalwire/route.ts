import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { verifySignalWireSignature } from '@/lib/webhookSecurity'
import { isLiveTranslationPreviewEnabled } from '@/lib/env-validation'
import { logger } from '@/lib/logger'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'
import { parseRequestBody } from '@/lib/api/utils'

export const dynamic = 'force-dynamic'

/**
 * SignalWire Webhook Handler
 * 
 * Processes webhooks from SignalWire for:
 * - CallStatus events (completed, failed, no-answer, busy)
 * - RecordingStatus events (completed)
 * 
 * Security: 
 * - Validates webhook signature if SIGNALWIRE_TOKEN is configured
 * - Rate limited: 1000 requests/minute per source
 */
async function handleWebhook(req: Request) {
  // Log ALL incoming webhook requests for debugging
  const incomingUrl = new URL(req.url)
  logger.info('SignalWire webhook: incoming request', { 
    path: incomingUrl.pathname,
    hasQueryParams: incomingUrl.search.length > 0,
    queryParams: incomingUrl.search || 'none'
  })
  
  const skipValidation = process.env.SIGNALWIRE_SKIP_SIGNATURE_VALIDATION === 'true'
  const authToken = process.env.SIGNALWIRE_TOKEN || process.env.SIGNALWIRE_API_TOKEN
  
  if (authToken && !skipValidation) {
    const signature = req.headers.get('X-SignalWire-Signature') || 
                     req.headers.get('X-Twilio-Signature') ||
                     req.headers.get('X-Signature') ||
                     req.headers.get('Signature')
    
    if (signature) {
      const rawBody = await req.text()
      // Use the FULL URL including query params for signature validation
      // This is critical because SignalWire signs the exact URL it sends to
      const webhookUrl = process.env.NEXT_PUBLIC_APP_URL 
        ? `${process.env.NEXT_PUBLIC_APP_URL}${incomingUrl.pathname}${incomingUrl.search}`
        : req.url
      
      logger.debug('SignalWire webhook: validating signature', { 
        webhookUrl: webhookUrl.substring(0, 60) + '...',
        hasSignature: !!signature
      })
      
      const isValid = verifySignalWireSignature(rawBody, signature, authToken, webhookUrl)
      
      if (!isValid) {
        logger.error('SignalWire webhook: Invalid signature', undefined, { 
          signaturePrefix: signature.substring(0, 10),
          source: 'signalwire-webhook'
        })
        return NextResponse.json(
          { success: false, error: { code: 'WEBHOOK_SIGNATURE_INVALID', message: 'Invalid webhook signature' } },
          { status: 401 }
        )
      }
      
      req = new Request(req.url, { method: req.method, headers: req.headers, body: rawBody })
    } else if (process.env.NODE_ENV === 'production') {
      logger.warn('SignalWire webhook: Signature header missing in production')
      return NextResponse.json(
        { success: false, error: { code: 'WEBHOOK_SIGNATURE_MISSING', message: 'Webhook signature required' } },
        { status: 401 }
      )
    }
  }

  void processWebhookAsync(req).catch((err) => {
    logger.error('SignalWire webhook async processing failed', err)
  })

  return NextResponse.json({ ok: true, received: true })
}

async function processWebhookAsync(req: Request) {
  try {
    const payload = await parseRequestBody(req)

    const callSid = payload.CallSid || payload.call_sid
    const callStatus = payload.CallStatus || payload.call_status
    const recordingSid = payload.RecordingSid || payload.recording_sid
    const recordingUrl = payload.RecordingUrl || payload.recording_url
    const recordingDuration = payload.RecordingDuration || payload.recording_duration
    const callDuration = payload.CallDuration || payload.call_duration
    const eventType = payload.EventType || payload.event_type || (recordingSid ? 'recording' : 'call')
    const recordingStatus = payload.RecordingStatus || payload.recording_status

    const isRecordingCallback = !!recordingSid || !!recordingUrl || recordingStatus
    
    logger.info('SignalWire webhook received', { 
      callSid: callSid ? '[REDACTED]' : null, 
      callStatus, 
      eventType,
      isRecordingCallback,
      hasRecording: !!recordingSid,
      recordingStatus: recordingStatus || 'not-present'
    })
    
    if (recordingSid || recordingUrl || recordingStatus) {
      logger.info('SignalWire webhook: Recording artifact detected', {
        recordingSid: recordingSid ? '[REDACTED]' : 'MISSING',
        recordingDuration: recordingDuration || 'MISSING',
        recordingStatus: recordingStatus || 'MISSING'
      })
    } else if (callStatus === 'completed') {
      logger.warn('SignalWire webhook: Call completed but NO RECORDING FIELDS', {
        payloadKeys: Object.keys(payload).sort()
      })
    }

    if (!callSid) {
      logger.warn('SignalWire webhook: missing CallSid, skipping')
      return
    }

    const webhookUrl = new URL(req.url)
    const callIdFromUrl = webhookUrl.searchParams.get('callId')
    
    let call: any = null
    
    if (callIdFromUrl) {
      const { data: callRows, error: callErr } = await supabaseAdmin
        .from('calls')
        .select('id, organization_id, status, started_at, ended_at, call_sid')
        .eq('id', callIdFromUrl)
        .limit(1)
      
      if (!callErr && callRows?.[0]) {
        call = callRows[0]
        if (!call.call_sid && callSid) {
          await supabaseAdmin.from('calls').update({ call_sid: callSid }).eq('id', call.id)
          logger.debug('SignalWire webhook: linked call_sid via callId param', { callId: call.id })
        }
      }
    }
    
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
      logger.warn('SignalWire webhook: call not found', { callIdFromUrl: callIdFromUrl || 'not-provided' })
      return
    }

    const callId = call.id
    const organizationId = call.organization_id

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
      logger.warn('SignalWire webhook: failed to check live translation', { error: e })
    }

    if (eventType === 'call' || callStatus) {
      const statusMap: Record<string, string> = {
        'completed': 'completed', 'failed': 'failed', 'no-answer': 'failed',
        'busy': 'failed', 'ringing': 'in_progress', 'in-progress': 'in_progress', 'queued': 'pending'
      }

      const mappedStatus = statusMap[callStatus?.toLowerCase()] || callStatus || 'unknown'
      const updateData: any = { status: mappedStatus }

      if (mappedStatus === 'completed' || mappedStatus === 'failed') {
        updateData.ended_at = new Date().toISOString()
      }
      if ((mappedStatus === 'in_progress' || mappedStatus === 'completed') && !call.started_at) {
        updateData.started_at = new Date().toISOString()
      }

      const { error: updateErr } = await supabaseAdmin.from('calls').update(updateData).eq('id', callId)

      if (updateErr) {
        logger.error('SignalWire webhook: failed to update call', updateErr, { callId })
      } else {
        logger.info('SignalWire webhook: updated call status', { callId, status: mappedStatus })
      }
    }

    if (recordingSid && recordingUrl) {
      const { data: existingRecRows } = await supabaseAdmin
        .from('recordings')
        .select('id, status')
        .eq('recording_sid', recordingSid)
        .limit(1)

      const existingRec = existingRecRows?.[0]

      const { data: orgRows } = await supabaseAdmin
        .from('organizations')
        .select('tool_id')
        .eq('id', organizationId)
        .limit(1)

      let orgToolId = orgRows?.[0]?.tool_id

      // If organization has no tool_id, get or create the voice tool
      if (!orgToolId) {
        logger.warn('SignalWire webhook: organization has no tool_id, attempting to assign', { organizationId })
        
        // Get or create voice tool
        const { data: toolRows } = await supabaseAdmin
          .from('tools')
          .select('id')
          .eq('name', 'voice')
          .limit(1)
        
        if (toolRows?.[0]?.id) {
          orgToolId = toolRows[0].id
          // Update org with tool_id for future calls
          await supabaseAdmin
            .from('organizations')
            .update({ tool_id: orgToolId })
            .eq('id', organizationId)
          logger.info('SignalWire webhook: assigned tool_id to organization', { organizationId, toolId: orgToolId })
        } else {
          // Create voice tool if it doesn't exist
          const newToolId = uuidv4()
          const { error: toolErr } = await supabaseAdmin
            .from('tools')
            .insert({ id: newToolId, name: 'voice', description: 'Voice operations tool' })
          
          if (!toolErr) {
            orgToolId = newToolId
            await supabaseAdmin
              .from('organizations')
              .update({ tool_id: newToolId })
              .eq('id', organizationId)
            logger.info('SignalWire webhook: created voice tool and assigned to org', { organizationId, toolId: newToolId })
          }
        }
      }

      if (orgToolId) {
        const durationSeconds = recordingDuration 
          ? Math.round(parseInt(String(recordingDuration), 10) / 1000) 
          : callDuration ? Math.round(parseInt(String(callDuration), 10)) : null

        if (existingRec) {
          const updateData: any = {
            recording_url: recordingUrl, duration_seconds: durationSeconds,
            status: 'completed', updated_at: new Date().toISOString()
          }
          if (hasLiveTranslation) {
            updateData.has_live_translation = true
            updateData.live_translation_provider = 'signalwire'
          }

          const { error: updateRecErr } = await supabaseAdmin.from('recordings').update(updateData).eq('id', existingRec.id)

          if (updateRecErr) {
            logger.error('SignalWire webhook: failed to update recording', updateRecErr, { recordingId: existingRec.id })
          } else {
            logger.info('SignalWire webhook: updated recording', { recordingId: existingRec.id })
            await triggerTranscriptionIfEnabled(callId, existingRec.id, organizationId)
          }
        } else {
          const recordingId = uuidv4()
          const insertData: any = {
            id: recordingId, organization_id: organizationId, call_sid: callSid,
            call_id: callId, // FK to calls table per 20260118_schema_alignment.sql
            recording_sid: recordingSid, recording_url: recordingUrl, duration_seconds: durationSeconds,
            status: 'completed', tool_id: orgToolId,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString()
          }
          if (hasLiveTranslation) {
            insertData.has_live_translation = true
            insertData.live_translation_provider = 'signalwire'
          }

          const { error: insertRecErr } = await supabaseAdmin.from('recordings').insert(insertData)

          if (insertRecErr) {
            logger.error('SignalWire webhook: failed to create recording', insertRecErr, { callId })
          } else {
            logger.info('SignalWire webhook: created recording', { recordingId, callId })
            
            try {
              await supabaseAdmin.from('audit_logs').insert({
                id: uuidv4(), organization_id: organizationId, user_id: null, system_id: null,
                resource_type: 'recordings', resource_id: recordingId, action: 'create',
                before: null, after: { call_id: callId, recording_sid: recordingSid },
                created_at: new Date().toISOString()
              })
            } catch { /* Best-effort */ }
            
            void (async () => {
              try {
                const { storeRecording, ensureRecordingsBucket } = await import('@/app/services/recordingStorage')
                await ensureRecordingsBucket()
                await storeRecording(recordingUrl, organizationId, callId, recordingId)
              } catch (err) {
                logger.error('SignalWire webhook: failed to store recording', err, { recordingId })
              }
            })()
            
            await triggerTranscriptionIfEnabled(callId, recordingId, organizationId)
          }
        }
      } else {
        logger.error('SignalWire webhook: could not assign tool_id, recording not saved', { 
          organizationId, 
          recordingSid,
          recordingUrl: recordingUrl ? '[PRESENT]' : '[MISSING]'
        })
      }
    }

  } catch (err: any) {
    logger.error('SignalWire webhook processing error', err)
  }
}

async function triggerTranscriptionIfEnabled(callId: string, recordingId: string, organizationId: string) {
  try {
    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('transcribe')
      .eq('organization_id', organizationId)
      .limit(1)

    if (vcRows?.[0]?.transcribe !== true) return

    const { data: aiRows } = await supabaseAdmin
      .from('ai_runs')
      .select('id, status')
      .eq('call_id', callId)
      .eq('model', 'assemblyai-v1')
      .limit(1)

    if (aiRows && aiRows.length > 0 && aiRows[0].status !== 'failed') return

    const { data: systemsRows } = await supabaseAdmin
      .from('systems')
      .select('id')
      .eq('key', 'system-ai')
      .limit(1)

    const systemAiId = systemsRows?.[0]?.id
    if (!systemAiId) {
      logger.warn('SignalWire webhook: AI system not found', { callId })
      return
    }

    const { data: recRows } = await supabaseAdmin
      .from('recordings')
      .select('recording_url')
      .eq('id', recordingId)
      .limit(1)

    const recordingUrl = recRows?.[0]?.recording_url
    if (!recordingUrl) {
      logger.warn('SignalWire webhook: recording URL not found', { recordingId })
      return
    }

    const { data: orgRows } = await supabaseAdmin
      .from('organizations')
      .select('plan')
      .eq('id', organizationId)
      .limit(1)

    if (orgRows?.[0]?.plan === 'free') return

    if (!process.env.ASSEMBLYAI_API_KEY) {
      logger.warn('SignalWire webhook: ASSEMBLYAI_API_KEY not configured')
      return
    }

    const aiRunId = uuidv4()
    const { error: aiErr } = await supabaseAdmin.from('ai_runs').insert({
      id: aiRunId, call_id: callId, system_id: systemAiId,
      model: 'assemblyai-v1', status: 'queued', started_at: new Date().toISOString()
    })

    if (aiErr) {
      logger.error('SignalWire webhook: failed to create ai_run', aiErr, { callId })
      return
    }

    const aaiRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: { 'Authorization': process.env.ASSEMBLYAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_url: recordingUrl,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/assemblyai`,
        sentiment_analysis: true, entity_detection: true, auto_chapters: true,
        speaker_labels: true, content_safety: true, iab_categories: true, language_detection: true
      })
    })

    if (aaiRes.ok) {
      const aaiData = await aaiRes.json()
      await supabaseAdmin.from('ai_runs').update({
        status: 'processing', output: { job_id: aaiData.id, status: 'queued' }
      }).eq('id', aiRunId)
      logger.info('SignalWire webhook: triggered AssemblyAI transcription', { aiRunId, jobId: aaiData.id })
    } else {
      const errText = await aaiRes.text()
      logger.error('SignalWire webhook: AssemblyAI API error', undefined, { status: aaiRes.status, error: errText })
      await supabaseAdmin.from('ai_runs').update({ 
        status: 'failed', output: { error: errText, status_code: aaiRes.status }
      }).eq('id', aiRunId)
    }

  } catch (err: any) {
    logger.error('SignalWire webhook: Transcription trigger error', err, { callId })
  }
}

export const POST = withRateLimit(handleWebhook, {
  identifier: (req) => `webhook-signalwire-${getClientIP(req)}`,
  config: { maxAttempts: 1000, windowMs: 60 * 1000, blockMs: 5 * 60 * 1000 }
})
