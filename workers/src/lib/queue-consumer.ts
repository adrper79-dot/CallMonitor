/**
 * Queue Consumer — Async Transcription & Post-Call Processing
 *
 * Cloudflare Queue consumer that handles transcription jobs enqueued
 * from the `handleRecordingSaved` webhook handler. Moves heavy processing
 * out of the synchronous webhook path to avoid Worker timeout (30s CPU limit).
 *
 * Message types:
 *   - submit_transcription: Submit recording to AssemblyAI
 *   - retry_transcription: Retry a previously failed submission
 *
 * Architecture:
 *   - Producer: handleRecordingSaved in webhooks.ts
 *   - Consumer: this module, invoked by Cloudflare Queue runtime
 *   - Dead Letter Queue: wordisbond-transcription-dlq (after 3 retries)
 *
 * @module workers/src/lib/queue-consumer
 */

import type { Env } from '../index'
import { getDb } from './db'
import { logger } from './logger'

// ─── Message Types ──────────────────────────────────────────────────────────

export interface TranscriptionQueueMessage {
  type: 'submit_transcription' | 'retry_transcription'
  callId: string
  organizationId: string
  recordingR2Key: string
  attempt?: number
}

// ─── Queue Producer Helper ──────────────────────────────────────────────────

/**
 * Enqueue a transcription job. Falls back to inline processing if Queue is unavailable.
 *
 * @returns true if enqueued, false if Queue unavailable (caller should process inline)
 */
export async function enqueueTranscriptionJob(
  env: Env,
  message: TranscriptionQueueMessage
): Promise<boolean> {
  if (!env.TRANSCRIPTION_QUEUE) {
    logger.info('Queue not available, falling back to inline processing', {
      callId: message.callId,
    })
    return false
  }

  try {
    await env.TRANSCRIPTION_QUEUE.send(message)
    logger.info('Transcription job enqueued', {
      callId: message.callId,
      type: message.type,
    })
    return true
  } catch (err) {
    logger.error('Failed to enqueue transcription job', {
      callId: message.callId,
      error: (err as Error)?.message,
    })
    return false
  }
}

// ─── Queue Consumer ─────────────────────────────────────────────────────────

/**
 * Process a batch of transcription queue messages.
 *
 * Called by the Cloudflare Queue runtime. Each message is processed independently;
 * individual failures are acked to move to DLQ after max_retries.
 */
export async function handleQueueBatch(
  batch: MessageBatch<TranscriptionQueueMessage>,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await processQueueMessage(message.body, env)
      message.ack()
    } catch (err) {
      logger.error('Queue message processing failed', {
        callId: message.body.callId,
        type: message.body.type,
        error: (err as Error)?.message,
        attempts: message.attempts,
      })
      // Retry by not acking — Cloudflare will retry up to max_retries
      message.retry()
    }
  }
}

async function processQueueMessage(
  msg: TranscriptionQueueMessage,
  env: Env
): Promise<void> {
  switch (msg.type) {
    case 'submit_transcription':
    case 'retry_transcription':
      await submitToAssemblyAI(msg, env)
      break
    default:
      logger.warn('Unknown queue message type', { type: (msg as any).type })
  }
}

/**
 * Submit a recording to AssemblyAI for transcription.
 *
 * Mirrors the logic from handleRecordingSaved but runs asynchronously in the queue.
 */
async function submitToAssemblyAI(
  msg: TranscriptionQueueMessage,
  env: Env
): Promise<void> {
  if (!env.ASSEMBLYAI_API_KEY) {
    logger.warn('ASSEMBLYAI_API_KEY not configured, skipping transcription', {
      callId: msg.callId,
    })
    return
  }

  const recordingUrl = env.R2_PUBLIC_URL
    ? `${env.R2_PUBLIC_URL}/${msg.recordingR2Key}`
    : `${env.API_BASE_URL || 'https://wordisbond-api.adrper79.workers.dev'}/api/recordings/stream/${msg.callId}`

  const webhookUrl = `${env.API_BASE_URL || 'https://wordisbond-api.adrper79.workers.dev'}/api/webhooks/assemblyai`

  const assemblyRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      Authorization: env.ASSEMBLYAI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: recordingUrl,
      webhook_url: webhookUrl,
      speaker_labels: true,
      speakers_expected: 2,
      auto_highlights: true,
      sentiment_analysis: true,
      entity_detection: true,
      content_safety: true,
      dual_channel: true,
      ...(env.ASSEMBLYAI_WEBHOOK_SECRET
        ? {
            webhook_auth_header_name: 'Authorization',
            webhook_auth_header_value: env.ASSEMBLYAI_WEBHOOK_SECRET,
          }
        : {}),
    }),
  })

  const db = getDb(env)
  try {
    if (assemblyRes.ok) {
      const assemblyData = await assemblyRes.json<{ id: string }>()

      await db.query(
        `UPDATE calls
         SET transcript_status = 'pending', transcript_id = $1, updated_at = NOW()
         WHERE id = $2 AND organization_id = $3`,
        [assemblyData.id, msg.callId, msg.organizationId]
      )

      logger.info('Transcription submitted via queue', {
        callId: msg.callId,
        transcriptId: assemblyData.id,
      })
    } else {
      const errText = await assemblyRes.text()
      logger.error('AssemblyAI submission failed in queue', {
        callId: msg.callId,
        status: assemblyRes.status,
        error: errText.substring(0, 200),
      })

      await db.query(
        `UPDATE calls SET transcript_status = 'failed', updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [msg.callId, msg.organizationId]
      )

      // Throw to trigger queue retry
      throw new Error(`AssemblyAI returned ${assemblyRes.status}`)
    }
  } finally {
    await db.end()
  }
}
