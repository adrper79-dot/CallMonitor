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

export async function handleScheduled(
  event: ScheduledEvent,
  env: Env
): Promise<void> {
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
    console.error('Scheduled job failed')
    // Don't throw - let the job complete so it can retry next interval
  }
}

/**
 * Retry failed transcriptions
 * Runs every 5 minutes
 */
async function retryFailedTranscriptions(env: Env): Promise<void> {
  const db = getDb(env)
  
  // Find calls with failed transcriptions that haven't exceeded retry limit
  const result = await db.query(`
    SELECT id, call_sid, recording_url, transcript_retries
    FROM calls
    WHERE transcript_status = 'failed'
      AND transcript_retries < 3
      AND recording_url IS NOT NULL
      AND ended_at > NOW() - INTERVAL '24 hours'
    LIMIT 10
  `)

  for (const call of result.rows) {
    try {
      // TODO: Trigger AssemblyAI transcription
      await db.query(`
        UPDATE calls 
        SET transcript_status = 'pending', transcript_retries = transcript_retries + 1
        WHERE id = $1
      `, [call.id])
    } catch (error) {
      // Skip failed individual retries
    }
  }
}

/**
 * Cleanup expired sessions
 * Runs hourly
 */
async function cleanupExpiredSessions(env: Env): Promise<void> {
  const db = getDb(env)
  
  // Delete expired sessions from public.sessions
  await db.query(`
    DELETE FROM public.sessions
    WHERE expires < NOW()
  `)
}

/**
 * Aggregate daily usage statistics
 * Runs daily at midnight
 */
async function aggregateUsage(env: Env): Promise<void> {
  const db = getDb(env)
  
  // Calculate usage for the previous day
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toISOString().split('T')[0]
  
  // Aggregate call statistics per organization
  await db.query(`
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
  `, [dateStr])
}
