import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { query } from '@/lib/pgClient'
import { verifySignalWireSignature } from '@/lib/webhookSecurity'
import { isLiveTranslationPreviewEnabled } from '@/lib/env-validation'
import { logger } from '@/lib/logger'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'
import { parseRequestBody } from '@/lib/api/utils'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

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

  try {
    // CRITICAL FIX: Await the async process so Vercel doesn't kill the lambda
    await processWebhookAsync(req)
  } catch (err) {
    logger.error('SignalWire webhook async processing failed', err)
  }

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
      try {
        const callRes = await query(
          `SELECT id, organization_id, status, started_at, ended_at, call_sid FROM calls WHERE id = $1 LIMIT 1`,
          [callIdFromUrl]
        )
        if (callRes.rows.length > 0) {
          call = callRes.rows[0]
          if (!call.call_sid && callSid) {
            await query(`UPDATE calls SET call_sid = $1 WHERE id = $2`, [callSid, call.id])
            logger.debug('SignalWire webhook: linked call_sid via callId param', { callId: call.id })
          }
        }
      } catch (err) {
        logger.error('SignalWire webhook: error finding call by ID', err)
      }
    }

    if (!call) {
      try {
        const callRes = await query(
          `SELECT id, organization_id, status, started_at, ended_at FROM calls WHERE call_sid = $1 LIMIT 1`,
          [callSid]
        )
        if (callRes.rows.length > 0) {
          call = callRes.rows[0]
        }
      } catch (err) {
        logger.error('SignalWire webhook: error finding call by SID', err)
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
      const orgRes = await query(`SELECT plan FROM organizations WHERE id = $1 LIMIT 1`, [organizationId])
      const plan = String(orgRes.rows[0]?.plan ?? '').toLowerCase()
      const isBusinessPlan = ['business', 'enterprise'].includes(plan)
      const isFeatureFlagEnabled = isLiveTranslationPreviewEnabled()

      if (isBusinessPlan && isFeatureFlagEnabled) {
        const vcRes = await query(
          `SELECT live_translate, translate_from, translate_to FROM voice_configs WHERE organization_id = $1 LIMIT 1`,
          [organizationId]
        )
        const voiceConfig = vcRes.rows[0]
        if (voiceConfig?.live_translate === true && voiceConfig?.translate_from && voiceConfig?.translate_to) {
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

      let startedAtUpdate = ''
      const updateParams = [mappedStatus]
      let paramIdx = 2

      if ((mappedStatus === 'in_progress' || mappedStatus === 'completed') && !call.started_at) {
        const durationSec = parseInt(String(callDuration || 0), 10) || 1
        const endDate = updateData.ended_at ? new Date(updateData.ended_at) : new Date()
        const startDate = new Date(endDate.getTime() - (durationSec * 1000))
        updateData.started_at = startDate.toISOString()
        startedAtUpdate = `, started_at = $${paramIdx++}`
        updateParams.push(updateData.started_at)
      }

      let endedAtUpdate = ''
      if (updateData.ended_at) {
        endedAtUpdate = `, ended_at = $${paramIdx++}`
        updateParams.push(updateData.ended_at)
      }

      // Where clause param
      updateParams.push(callId)

      try {
        await query(
          `UPDATE calls SET status = $1 ${startedAtUpdate} ${endedAtUpdate} WHERE id = $${paramIdx}`,
          updateParams
        )
        logger.info('SignalWire webhook: updated call status', { callId, status: mappedStatus })

        if (['completed', 'failed'].includes(mappedStatus)) {
          const { captureAttentionEvent } = await import('@/lib/rti/eventIngest')
          await captureAttentionEvent({
            organizationId,
            eventType: 'call_completed',
            sourceTable: 'calls',
            sourceId: callId,
            payload: {
              callSid,
              status: mappedStatus,
              duration: callDuration,
              ended_at: updateData.ended_at
            },
            inputRefs: [{ table: 'calls', id: callId }]
          })
        }
      } catch (err) {
        logger.error('SignalWire webhook: failed to update call/RTI', err, { callId })
      }
    }

    if (recordingSid && recordingUrl) {
      let existingRec: any = null
      try {
        const recRes = await query(`SELECT id, status FROM recordings WHERE recording_sid = $1 LIMIT 1`, [recordingSid])
        existingRec = recRes.rows[0]
      } catch (e) {
        logger.error('SignalWire webhook: failed to check existing recording', e)
      }

      let orgToolId: string | null = null
      try {
        const orgRes = await query(`SELECT tool_id FROM organizations WHERE id = $1 LIMIT 1`, [organizationId])
        orgToolId = orgRes.rows[0]?.tool_id
      } catch (e) {
        logger.error('SignalWire webhook: failed to fetch org tool', e)
      }

      if (!orgToolId) {
        logger.warn('SignalWire webhook: organization has no tool_id, attempting to assign', { organizationId })
        try {
          const toolRes = await query(`SELECT id FROM tools WHERE name = 'voice' LIMIT 1`, [])
          if (toolRes.rows[0]?.id) {
            orgToolId = toolRes.rows[0].id
            await query(`UPDATE organizations SET tool_id = $1 WHERE id = $2`, [orgToolId, organizationId])
            logger.info('SignalWire webhook: assigned tool_id to organization', { organizationId, toolId: orgToolId })
          } else {
            const newToolId = uuidv4()
            await query(`INSERT INTO tools (id, name, description) VALUES ($1, 'voice', 'Voice operations tool')`, [newToolId])
            orgToolId = newToolId
            await query(`UPDATE organizations SET tool_id = $1 WHERE id = $2`, [newToolId, organizationId])
            logger.info('SignalWire webhook: created voice tool and assigned to org', { organizationId, toolId: newToolId })
          }
        } catch (e) {
          logger.error('SignalWire webhook: failed to auto-assign tool', e)
        }
      }

      if (orgToolId) {
        const durationSeconds = recordingDuration
          ? Math.round(parseInt(String(recordingDuration), 10))
          : callDuration ? Math.round(parseInt(String(callDuration), 10)) : null

        if (existingRec) {
          const updateData: any = { status: 'completed' }
          let sql = `UPDATE recordings SET recording_url = $1, duration_seconds = $2, status = 'completed', updated_at = NOW()`
          const params = [recordingUrl, durationSeconds]
          let pIdx = 3

          if (hasLiveTranslation) {
            sql += `, has_live_translation = $${pIdx++}, live_translation_provider = $${pIdx++}`
            params.push(true, 'signalwire')
          }

          sql += ` WHERE id = $${pIdx}`
          params.push(existingRec.id)

          try {
            await query(sql, params)
            logger.info('SignalWire webhook: updated recording', { recordingId: existingRec.id })
            await triggerTranscriptionIfEnabled(callId, existingRec.id, organizationId, recordingUrl)
          } catch (e) {
            logger.error('SignalWire webhook: failed to update recording', e)
          }
        } else {
          const recordingId = uuidv4()
          // ... 
          const cols = ['id', 'organization_id', 'call_sid', 'call_id', 'recording_sid', 'recording_url', 'duration_seconds', 'status', 'tool_id', 'source', 'created_at', 'updated_at']
          const vals: any[] = [recordingId, organizationId, callSid, callId, recordingSid, recordingUrl, durationSeconds, 'completed', orgToolId, 'signalwire', new Date().toISOString(), new Date().toISOString()]
          let pIdx = 13

          if (hasLiveTranslation) {
            cols.push('has_live_translation', 'live_translation_provider')
            vals.push(true, 'signalwire')
          }

          const paramsStr = vals.map((_, i) => `$${i + 1}`).join(',')
          const colStr = cols.join(',')

          try {
            await query(`INSERT INTO recordings (${colStr}) VALUES (${paramsStr})`, vals)
            logger.info('SignalWire webhook: created recording', { recordingId, callId })

            const auditId = uuidv4()
            try {
              await query(
                `INSERT INTO audit_logs (id, organization_id, resource_type, resource_id, action, actor_type, actor_label, after, created_at)
                       VALUES ($1, $2, 'recordings', $3, 'create', 'vendor', 'signalwire-webhook', $4, NOW())`,
                [auditId, organizationId, recordingId, JSON.stringify({ call_id: callId, recording_sid: recordingSid })]
              )
            } catch (e) { /* best effort */ }

            void (async () => {
              try {
                // Updated dynamic import to remove ensureRecordingsBucket
                const { storeRecording } = await import('@/app/services/recordingStorage')
                await storeRecording(recordingUrl, organizationId, callId, recordingId)
              } catch (err) {
                logger.error('SignalWire webhook: failed to store recording', err, { recordingId })
              }
            })()

            await triggerTranscriptionIfEnabled(callId, recordingId, organizationId, recordingUrl)
          } catch (e) {
            logger.error('SignalWire webhook: failed to create recording', e)
          }
        }
      } else {
        logger.error('SignalWire webhook: could not assign tool_id, recording not saved', { organizationId })
      }
    }

  } catch (err: any) {
    logger.error('SignalWire webhook processing error', err)
  }
}

async function triggerTranscriptionIfEnabled(callId: string, recordingId: string, organizationId: string, explicitRecordingUrl?: string) {
  try {
    const vcRes = await query(`SELECT transcribe FROM voice_configs WHERE organization_id = $1 LIMIT 1`, [organizationId])
    if (vcRes.rows[0]?.transcribe !== true) return

    const aiRowsRes = await query(`SELECT id, status, output FROM ai_runs WHERE call_id = $1 AND model = 'assemblyai-v1'`, [callId])
    const aiRows = aiRowsRes.rows

    let aiRunId = uuidv4()
    let shouldCreate = true

    if (aiRows.length > 0) {
      const existingForRecording = aiRows.find((run: any) =>
        run.output?.recording_id === recordingId ||
        (explicitRecordingUrl && run.output?.recording_url === explicitRecordingUrl)
      )

      if (existingForRecording) {
        if (existingForRecording.status === 'processing' || existingForRecording.status === 'completed') return
        aiRunId = existingForRecording.id
        shouldCreate = false
      } else {
        const placeholder = aiRows.find((run: any) =>
          run.status === 'queued' &&
          (!run.output || Object.keys(run.output).length === 0 || run.output.pending === true)
        )
        if (placeholder) {
          aiRunId = placeholder.id
          shouldCreate = false
        }
      }
    }

    const sysRes = await query(`SELECT id FROM systems WHERE key = 'system-ai' LIMIT 1`, [])
    const systemAiId = sysRes.rows[0]?.id
    if (!systemAiId) return

    let recordingUrlToUse = explicitRecordingUrl
    if (!recordingUrlToUse) {
      const recRes = await query(`SELECT recording_url FROM recordings WHERE id = $1 LIMIT 1`, [recordingId])
      recordingUrlToUse = recRes.rows[0]?.recording_url
    }
    if (!recordingUrlToUse) return

    // Check plan
    const orgRes = await query(`SELECT plan FROM organizations WHERE id = $1 LIMIT 1`, [organizationId])
    if (orgRes.rows[0]?.plan === 'free') return

    if (!process.env.ASSEMBLYAI_API_KEY) {
      // Log audit failure logic omitted for brevity as it's best-effort
      return
    }

    if (shouldCreate) {
      await query(
        `INSERT INTO ai_runs (id, call_id, system_id, model, status, started_at, produced_by, is_authoritative, output)
             VALUES ($1, $2, $3, 'assemblyai-v1', 'queued', NOW(), 'model', true, $4)`,
        [aiRunId, callId, systemAiId, JSON.stringify({ recording_id: recordingId, recording_url: recordingUrlToUse })]
      )
    } else {
      await query(
        `UPDATE ai_runs SET output = $1 WHERE id = $2`,
        [JSON.stringify({ recording_id: recordingId, recording_url: recordingUrlToUse }), aiRunId]
      )
    }

    const aaiRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: { 'Authorization': process.env.ASSEMBLYAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_url: recordingUrlToUse,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/assemblyai`,
        sentiment_analysis: true, entity_detection: true, auto_chapters: true,
        speaker_labels: true, content_safety: true, iab_categories: true, language_detection: true
      })
    })

    if (aaiRes.ok) {
      const aaiData = await aaiRes.json()
      await query(
        `UPDATE ai_runs SET status = 'processing', produced_by = 'model', is_authoritative = true, output = $1 WHERE id = $2`,
        [JSON.stringify({ job_id: aaiData.id, status: 'queued' }), aiRunId]
      )
      logger.info('SignalWire webhook: triggered AssemblyAI transcription', { aiRunId, jobId: aaiData.id })
    } else {
      const errText = await aaiRes.text()
      await query(
        `UPDATE ai_runs SET status = 'failed', produced_by = 'model', is_authoritative = true, output = $1 WHERE id = $2`,
        [JSON.stringify({ error: errText, status_code: aaiRes.status }), aiRunId]
      )
    }

  } catch (err: any) {
    logger.error('SignalWire webhook: Transcription trigger error', err, { callId })
  }
}

export const POST = withRateLimit(handleWebhook, {
  identifier: (req) => `webhook-signalwire-${getClientIP(req)}`,
  config: { maxAttempts: 1000, windowMs: 60 * 1000, blockMs: 5 * 60 * 1000 }
})
