/**
 * Dead Letter Queue Consumer — Transcription Failure Handling
 *
 * Handles messages that exhausted all retries on `wordisbond-transcription`
 * (max_retries = 3 → routed here automatically by CF Queue runtime).
 *
 * Responsibilities:
 *  1. Mark the call record transcript_status = 'failed_permanent'
 *  2. Emit structured error log for alerting / log aggregation
 *  3. Acknowledge (ack) every message so the DLQ doesn't re-queue indefinitely
 *
 * @module workers/src/lib/dlq-consumer
 */

import type { Env } from '../index'
import { getDb } from './db'
import { logger } from './logger'

// ─── Message Shape (mirrors queue-consumer.ts) ───────────────────────────────

interface DlqMessage {
  type: string
  callId: string
  organizationId: string
  recordingR2Key?: string
  attempt?: number
}

// ─── DLQ Batch Handler ───────────────────────────────────────────────────────

/**
 * Process a batch of DLQ messages.
 *
 * Called from `index.ts` when `batch.queue === 'wordisbond-transcription-dlq'`.
 */
export async function handleDlqBatch(
  batch: MessageBatch<DlqMessage>,
  env: Env
): Promise<void> {
  const db = getDb(env)

  try {
    for (const msg of batch.messages) {
      await processDlqMessage(db, msg.body)
      msg.ack() // always ack — do not re-queue permanently failed messages
    }
  } finally {
    await db.end()
  }
}

// ─── Single Message Processing ───────────────────────────────────────────────

async function processDlqMessage(
  db: ReturnType<typeof getDb>,
  body: DlqMessage
): Promise<void> {
  const { callId, organizationId, type, attempt } = body

  logger.error('DLQ: transcription permanently failed', {
    callId,
    organizationId,
    messageType: type,
    totalAttempts: (attempt ?? 0) + 1,
    queue: 'wordisbond-transcription-dlq',
  })

  // Guard: require at minimum a callId to update the DB
  if (!callId) {
    logger.warn('DLQ message missing callId — skipping DB update', { body })
    return
  }

  try {
    // Mark transcript as permanently failed so the UI can surface the error
    await db.query(
      `UPDATE calls
          SET transcript_status = 'failed_permanent',
              updated_at         = NOW()
        WHERE id              = $1
          AND organization_id = $2`,
      [callId, organizationId]
    )

    logger.info('DLQ: call marked failed_permanent', { callId, organizationId })
  } catch (error) {
    // Log but do not throw — we still want to ack the message
    logger.error('DLQ: DB update failed', {
      callId,
      organizationId,
      error: (error as Error)?.message,
    })
  }
}
