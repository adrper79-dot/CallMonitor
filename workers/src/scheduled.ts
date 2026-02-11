/**
 * Scheduled Jobs Handler
 *
 * Handles cron-triggered tasks:
 * - Every 5 min: Retry failed transcriptions
 * - Hourly: Cleanup expired sessions
 * - Daily: Usage aggregation
 */

import type { Env } from './index'
import { getDb } from './lib/db'
import { logger } from './lib/logger'

export async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
  const cron = event.cron

  try {
    switch (cron) {
      case '*/5 * * * *':
        await retryFailedTranscriptions(env)
        break
      case '0 * * * *':
        await cleanupExpiredSessions(env)
        break
      case '0 0 * * *':
        await aggregateUsage(env)
        break
    }
  } catch (error) {
    logger.error('Scheduled job failed', { error: (error as Error)?.message, cron })
    // Don't throw - let the job complete so it can retry next interval
  }
}

/**
 * Retry failed transcriptions
 * Runs every 5 minutes
 */
async function retryFailedTranscriptions(env: Env): Promise<void> {
  const db = getDb(env)

  try {
    // Find calls with failed transcriptions that haven't been retried recently
    // Use updated_at to avoid hammering failed submissions
    const result = await db.query(`
    SELECT id, call_sid, recording_url
    FROM calls
    WHERE transcript_status = 'failed'
      AND recording_url IS NOT NULL
      AND ended_at > NOW() - INTERVAL '24 hours'
      AND (updated_at < NOW() - INTERVAL '5 minutes' OR updated_at IS NULL)
    LIMIT 10
  `)

    for (const call of result.rows) {
      try {
        // BL-013: Submit recording to AssemblyAI for transcription
        const audioUrl = call.recording_url.startsWith('http')
          ? call.recording_url
          : `${env.API_BASE_URL || 'https://wordisbond-api.adrper79.workers.dev'}/api/recordings/stream/${call.call_sid}`

        const webhookUrl = `${env.API_BASE_URL || 'https://wordisbond-api.adrper79.workers.dev'}/api/webhooks/assemblyai`

        const headers: Record<string, string> = {
          Authorization: env.ASSEMBLYAI_API_KEY,
          'Content-Type': 'application/json',
        }

        const assemblyRes = await fetch('https://api.assemblyai.com/v2/transcript', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            audio_url: audioUrl,
            webhook_url: webhookUrl,
            ...(env.ASSEMBLYAI_WEBHOOK_SECRET
              ? {
                  webhook_auth_header_name: 'Authorization',
                  webhook_auth_header_value: env.ASSEMBLYAI_WEBHOOK_SECRET,
                }
              : {}),
          }),
        })

        if (!assemblyRes.ok) {
          logger.warn('AssemblyAI retry submission failed', {
            callId: call.id,
            status: assemblyRes.status,
          })
          continue
        }

        const assemblyData = (await assemblyRes.json()) as { id: string }

        await db.query(
          `UPDATE calls
         SET transcript_id = $1,
             transcript_status = 'pending',
             updated_at = NOW()
         WHERE id = $2`,
          [assemblyData.id, call.id]
        )

        logger.info('AssemblyAI transcription retry submitted', {
          callId: call.id,
          transcriptId: assemblyData.id,
        })
      } catch (error) {
        logger.warn('AssemblyAI retry exception', {
          callId: call.id,
          error: (error as Error)?.message,
        })
        // Skip failed individual retries
      }
    }
  } finally {
    await db.end()
  }
}

/**
 * Cleanup expired sessions
 * Runs hourly
 */
async function cleanupExpiredSessions(env: Env): Promise<void> {
  const db = getDb(env)

  try {
    // Delete expired sessions from public.sessions
    await db.query(`
      DELETE FROM public.sessions
      WHERE expires < NOW()
    `)
  } finally {
    await db.end()
  }
}

/**
 * Aggregate daily usage statistics
 * Runs daily at midnight
 */
async function aggregateUsage(env: Env): Promise<void> {
  const db = getDb(env)

  try {
    // Calculate usage for the previous day
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]

    // Aggregate call statistics per organization
    await db.query(
      `
    INSERT INTO usage_stats (organization_id, date, total_calls, total_duration_seconds, total_recordings)
    SELECT 
      organization_id,
      $1::date as date,
      COUNT(*) as total_calls,
      COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at - started_at))), 0) as total_duration_seconds,
      COUNT(*) FILTER (WHERE recording_url IS NOT NULL) as total_recordings
    FROM calls
    WHERE DATE(started_at) = $1::date
    GROUP BY organization_id
    ON CONFLICT (organization_id, date) DO UPDATE SET
      total_calls = EXCLUDED.total_calls,
      total_duration_seconds = EXCLUDED.total_duration_seconds,
      total_recordings = EXCLUDED.total_recordings,
      updated_at = NOW()
    RETURNING organization_id
  `,
      [dateStr]
    )
  } finally {
    await db.end()
  }
}

