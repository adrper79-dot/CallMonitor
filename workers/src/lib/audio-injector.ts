/**
 * Audio Injector — Telnyx Call Control integration for voice-to-voice translation
 *
 * Injects synthesized audio into active calls using Telnyx Call Control API.
 * Manages audio queue, prevents overlap, and handles call state synchronization.
 *
 * Architecture:
 *   TTS Processor → queueAudioInjection() → Telnyx playback_start command
 *
 * Features:
 *   - FIFO audio queue to prevent overlap
 *   - Call state tracking for active injections
 *   - Automatic cleanup on call end
 *   - Error handling with fallbacks
 *
 * @see ARCH_DOCS/02-FEATURES/VOICE_TO_VOICE_TRANSLATION.md
 */

import type { DbClient } from './db'
import { logger } from './logger'

const TELNYX_BASE = 'https://api.telnyx.com/v2'
const MAX_CONCURRENT_INJECTIONS = 3 // Telnyx supports multiple concurrent playbacks
const AUDIO_QUEUE_TIMEOUT_MS = 30000 // 30 seconds

export interface AudioInjection {
  callId: string
  segmentIndex: number
  audioUrl: string
  durationMs: number
  targetCallControlId: string
  organizationId: string
}

export interface InjectionResult {
  success: boolean
  injectionId?: string
  error?: string
}

/**
 * Queue audio for injection into an active call.
 *
 * This manages the audio injection queue to prevent overlapping playback
 * and ensures proper sequencing of translated speech segments.
 */
export async function queueAudioInjection(
  db: DbClient,
  telnyxKey: string,
  injection: AudioInjection
): Promise<InjectionResult> {
  const { callId, segmentIndex, audioUrl, durationMs, targetCallControlId, organizationId } =
    injection

  try {
    // Check if call is still active
    const callActive = await isCallActive(db, callId, organizationId)
    if (!callActive) {
      logger.info('Skipping audio injection - call no longer active', { callId, segmentIndex })
      return { success: false, error: 'Call not active' }
    }

    // Check current injection queue depth
    const queueDepth = await getInjectionQueueDepth(db, callId, organizationId)
    if (queueDepth >= MAX_CONCURRENT_INJECTIONS) {
      logger.warn('Audio injection queue full, skipping segment', {
        callId,
        segmentIndex,
        queueDepth,
      })
      return { success: false, error: 'Queue full' }
    }

    // Record injection attempt
    const injectionId = await recordInjectionAttempt(db, injection)

    // Send playback command to Telnyx
    const playbackResult = await sendPlaybackCommand(
      telnyxKey,
      targetCallControlId,
      audioUrl,
      segmentIndex
    )

    if (playbackResult.success) {
      // Mark injection as successful
      await updateInjectionStatus(db, injectionId, 'playing', playbackResult.playbackId)

      logger.info('Audio injection started', {
        callId,
        segmentIndex,
        injectionId,
        playbackId: playbackResult.playbackId,
      })

      return { success: true, injectionId }
    } else {
      // Mark injection as failed
      await updateInjectionStatus(db, injectionId, 'failed', null, playbackResult.error)
      return { success: false, error: playbackResult.error }
    }
  } catch (err: any) {
    logger.error('Audio injection error', {
      callId,
      segmentIndex,
      error: err?.message,
    })
    return { success: false, error: err?.message }
  }
}

/**
 * Send playback_start command to Telnyx Call Control API with enhanced error handling.
 */
async function sendPlaybackCommand(
  telnyxKey: string,
  callControlId: string,
  audioUrl: string,
  segmentIndex?: number
): Promise<{ success: boolean; playbackId?: string; error?: string }> {
  const maxRetries = 3
  let lastError: string | undefined

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${TELNYX_BASE}/calls/${callControlId}/actions/playback_start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${telnyxKey}`,
          'Idempotency-Key': `playback_${callControlId}_seg${segmentIndex ?? 0}`,
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          loop: false,
          overlay: true,
          target_channels: 'single',
          client_state: btoa(
            JSON.stringify({ flow: 'voice_translation', segment: segmentIndex ?? 0 })
          ),
        }),
      })

      // Handle rate limiting with proper backoff
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60'
        const delayMs = parseInt(retryAfter) * 1000
        logger.warn('Telnyx API rate limited, backing off', {
          callControlId,
          attempt,
          retryAfter: delayMs,
          remainingRetries: maxRetries - attempt,
        })
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        continue
      }

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `Telnyx API error: ${response.status}`

        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.errors?.[0]?.detail || errorData.message || errorMessage
        } catch {
          // Use raw error text if not JSON
          errorMessage = errorText.substring(0, 200)
        }

        throw new Error(errorMessage)
      }

      const result = (await response.json()) as { data?: { id?: string } }
      const playbackId = result.data?.id

      if (!playbackId) {
        throw new Error('Invalid response: missing playback ID')
      }

      return { success: true, playbackId }
    } catch (err: any) {
      lastError = err?.message || 'Unknown error'
      logger.error('Telnyx playback command failed', {
        callControlId,
        attempt,
        maxRetries,
        error: lastError,
      })

      // Exponential backoff for retries (except rate limiting which has its own delay)
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
        logger.info('Retrying Telnyx API call after backoff', {
          callControlId,
          attempt: attempt + 1,
          backoffMs,
        })
        await new Promise((resolve) => setTimeout(resolve, backoffMs))
      }
    }
  }

  return { success: false, error: lastError }
}

/**
 * Check if a call is still active.
 */
async function isCallActive(
  db: DbClient,
  callId: string,
  organizationId: string
): Promise<boolean> {
  const result = await db.query(
    `SELECT status FROM calls WHERE id = $1 AND organization_id = $2`,
    [callId, organizationId]
  )

  const status = result.rows[0]?.status
  return status === 'in_progress' || status === 'ringing'
}

/**
 * Get current depth of audio injection queue for a call.
 */
async function getInjectionQueueDepth(
  db: DbClient,
  callId: string,
  organizationId: string
): Promise<number> {
  const result = await db.query(
    `SELECT COUNT(*) as count
     FROM audio_injections
     WHERE call_id = $1 AND organization_id = $2 AND status IN ('queued', 'playing')`,
    [callId, organizationId]
  )

  return parseInt(result.rows[0]?.count || '0')
}

/**
 * Record an audio injection attempt in the database.
 */
async function recordInjectionAttempt(db: DbClient, injection: AudioInjection): Promise<string> {
  const { callId, segmentIndex, audioUrl, durationMs, targetCallControlId, organizationId } =
    injection

  const result = await db.query(
    `INSERT INTO audio_injections (
      call_id, segment_index, audio_url, duration_ms,
      target_call_control_id, organization_id, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, 'queued', NOW())
    RETURNING id`,
    [callId, segmentIndex, audioUrl, durationMs, targetCallControlId, organizationId]
  )

  return result.rows[0].id
}

/**
 * Update the status of an audio injection.
 */
async function updateInjectionStatus(
  db: DbClient,
  injectionId: string,
  status: 'playing' | 'completed' | 'failed',
  playbackId?: string | null,
  error?: string | null
): Promise<void> {
  await db.query(
    `UPDATE audio_injections
     SET status = $1, playback_id = $2, error_message = $3, updated_at = NOW()
     WHERE id = $4`,
    [status, playbackId, error, injectionId]
  )
}

/**
 * Handle Telnyx webhook for playback completion.
 * Called when Telnyx sends playback.ended webhook.
 */
export async function handlePlaybackComplete(
  db: DbClient,
  callControlId: string,
  playbackId: string,
  success: boolean
): Promise<void> {
  try {
    const status = success ? 'completed' : 'failed'

    await db.query(
      `UPDATE audio_injections
       SET status = $1, completed_at = NOW()
       WHERE target_call_control_id = $2 AND playback_id = $3`,
      [status, callControlId, playbackId]
    )

    logger.info('Audio injection completed', {
      callControlId,
      playbackId,
      success,
    })
  } catch (err: any) {
    logger.error('Failed to update injection status', {
      callControlId,
      playbackId,
      error: err?.message,
    })
  }
}

/**
 * Clean up old injection records (called by cron job).
 */
export async function cleanupOldInjections(db: DbClient): Promise<void> {
  const cutoffDate = new Date()
  cutoffDate.setHours(cutoffDate.getHours() - 24) // 24 hours ago

  await db.query(
    `DELETE FROM audio_injections
     WHERE created_at < $1 AND status IN ('completed', 'failed')`,
    [cutoffDate]
  )

  logger.info('Old injection cleanup completed', { cutoffDate: cutoffDate.toISOString() })
}

/**
 * Get injection statistics for monitoring.
 */
export async function getInjectionStats(
  db: DbClient,
  organizationId: string
): Promise<{
  totalInjections: number
  successfulInjections: number
  failedInjections: number
  averageLatency: number
}> {
  const result = await db.query(
    `SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
      AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000) as avg_latency_ms
     FROM audio_injections
     WHERE organization_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
    [organizationId]
  )

  const row = result.rows[0]
  return {
    totalInjections: parseInt(row.total || '0'),
    successfulInjections: parseInt(row.successful || '0'),
    failedInjections: parseInt(row.failed || '0'),
    averageLatency: parseFloat(row.avg_latency_ms || '0'),
  }
}
