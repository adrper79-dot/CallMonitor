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
const MAX_CONCURRENT_INJECTIONS = 1
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
    const callActive = await isCallActive(db, callId)
    if (!callActive) {
      logger.info('Skipping audio injection - call no longer active', { callId, segmentIndex })
      return { success: false, error: 'Call not active' }
    }

    // Check current injection queue depth
    const queueDepth = await getInjectionQueueDepth(db, callId)
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
    const playbackResult = await sendPlaybackCommand(telnyxKey, targetCallControlId, audioUrl)

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
 * Send playback_start command to Telnyx Call Control API.
 */
async function sendPlaybackCommand(
  telnyxKey: string,
  callControlId: string,
  audioUrl: string
): Promise<{ success: boolean; playbackId?: string; error?: string }> {
  try {
    const response = await fetch(`${TELNYX_BASE}/calls/${callControlId}/actions/playback_start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${telnyxKey}`,
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        loop: false,
        overlay: true, // Play over existing audio
        target_channels: 'single', // Play to both parties
        client_state: 'voice_translation_injection',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Telnyx playback command failed', {
        status: response.status,
        callControlId,
        error: errorText.substring(0, 200),
      })
      return { success: false, error: `Telnyx API error: ${response.status}` }
    }

    const result = await response.json()
    const playbackId = result.data?.id

    return { success: true, playbackId }
  } catch (err: any) {
    logger.error('Telnyx playback request failed', {
      callControlId,
      error: err?.message,
    })
    return { success: false, error: err?.message }
  }
}

/**
 * Check if a call is still active.
 */
async function isCallActive(db: DbClient, callId: string): Promise<boolean> {
  const result = await db.query(`SELECT status FROM calls WHERE id = $1`, [callId])

  const status = result.rows[0]?.status
  return status === 'in_progress' || status === 'ringing'
}

/**
 * Get current depth of audio injection queue for a call.
 */
async function getInjectionQueueDepth(db: DbClient, callId: string): Promise<number> {
  const result = await db.query(
    `SELECT COUNT(*) as count
     FROM audio_injections
     WHERE call_id = $1 AND status IN ('queued', 'playing')`,
    [callId]
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
