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

  console.log(`Scheduled job triggered: ${cron} at ${new Date(event.scheduledTime).toISOString()}`)

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
      default:
        console.log(`Unknown cron pattern: ${cron}`)
    }
  } catch (error) {
    console.error(`Scheduled job failed: ${cron}`, error)
    // Don't throw - let the job complete so it can retry next interval
  }
}

/**
 * Retry failed transcriptions
 * Runs every 5 minutes
 */
async function retryFailedTranscriptions(env: Env): Promise<void> {
  console.log('Running: retryFailedTranscriptions')
  
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
      // await triggerTranscription(call.recording_url)
      
      await db.query(`
        UPDATE calls 
        SET transcript_status = 'pending', transcript_retries = transcript_retries + 1
        WHERE id = $1
      `, [call.id])
      
      console.log(`Retrying transcription for call ${call.id}`)
    } catch (error) {
      console.error(`Failed to retry transcription for call ${call.id}:`, error)
    }
  }
  
  console.log(`Processed ${result.rows.length} failed transcriptions`)
}

/**
 * Cleanup expired sessions
 * Runs hourly
 */
async function cleanupExpiredSessions(env: Env): Promise<void> {
  console.log('Running: cleanupExpiredSessions')
  
  const db = getDb(env)
  
  // Delete expired sessions from NextAuth tables
  const result = await db.query(`
    DELETE FROM "authjs"."sessions"
    WHERE expires < NOW()
    RETURNING id
  `)
  
  console.log(`Cleaned up ${result.rows.length} expired sessions`)
  
  // Also cleanup expired verification tokens
  await db.query(`
    DELETE FROM "authjs"."verification_tokens"
    WHERE expires < NOW()
  `)
  
  // Cleanup old KV entries (if storing session data there)
  // Note: KV doesn't have a native expire scan, so we track manually if needed
}

/**
 * Aggregate daily usage statistics
 * Runs daily at midnight
 */
async function aggregateUsage(env: Env): Promise<void> {
  console.log('Running: aggregateUsage')
  
  const db = getDb(env)
  
  // Calculate usage for the previous day
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toISOString().split('T')[0]
  
  // Aggregate call statistics per organization
  const result = await db.query(`
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
  
  console.log(`Aggregated usage for ${result.rows.length} organizations on ${dateStr}`)
}
