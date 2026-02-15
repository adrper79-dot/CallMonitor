/**
 * Scheduled Jobs Handler
 *
 * Handles cron-triggered tasks:
 * - Every 5 min: Retry failed transcriptions
 * - Hourly: Cleanup expired sessions
 * - Daily: Usage aggregation
 *
 * Monitoring: Tracks execution metrics in KV for health endpoint
 */

import type { Env } from './index'
import { getDb } from './lib/db'
import { logger } from './lib/logger'
import { processScheduledPayments, processDunningEscalation } from './lib/payment-scheduler'
import { flushAuditDlq } from './lib/audit'
import { runPreventionScan } from './lib/prevention-scan'
import { handleCrmSync } from './crons/crm-sync'
// Cron job monitoring helpers
interface CronMetrics {
  last_run: string // ISO timestamp
  last_success: string | null
  last_error: string | null
  processed_count: number
  error_count: number
  duration_ms: number
}

async function trackCronExecution(
  env: Env,
  jobName: string,
  fn: () => Promise<{ processed: number; errors: number }>
): Promise<void> {
  const startTime = Date.now()
  const timestamp = new Date().toISOString()

  try {
    await env.KV.put(`cron:last_run:${jobName}`, timestamp)

    const result = await fn()
    const duration = Date.now() - startTime

    const metrics: CronMetrics = {
      last_run: timestamp,
      last_success: timestamp,
      last_error: null,
      processed_count: result.processed,
      error_count: result.errors,
      duration_ms: duration,
    }

    await env.KV.put(`cron:metrics:${jobName}`, JSON.stringify(metrics))
    logger.info(`Cron job completed: ${jobName}`, { duration, ...result })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = (error as Error)?.message || 'Unknown error'

    const metrics: CronMetrics = {
      last_run: timestamp,
      last_success: null,
      last_error: errorMsg,
      processed_count: 0,
      error_count: 1,
      duration_ms: duration,
    }

    await env.KV.put(`cron:metrics:${jobName}`, JSON.stringify(metrics))
    logger.error(`Cron job failed: ${jobName}`, { error: errorMsg, duration })
    throw error // Re-throw for scheduler awareness
  }
}

export async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
  const cron = event.cron

  try {
    switch (cron) {
      case '*/5 * * * *':
        await trackCronExecution(env, 'retry_transcriptions', () =>
          retryFailedTranscriptions(env)
        )
        break
      case '*/15 * * * *':
        await trackCronExecution(env, 'crm_sync', () => handleCrmSync(env))
        break
      case '0 * * * *':
        await trackCronExecution(env, 'cleanup_sessions', () => cleanupExpiredSessions(env))
        // C-2: Flush any audit log entries that failed to write to DB
        await trackCronExecution(env, 'flush_audit_dlq', async () => {
          const result = await flushAuditDlq(env)
          return { processed: result.flushed, errors: result.failed }
        })
        break
      case '0 0 * * *':
        await trackCronExecution(env, 'aggregate_usage', () => aggregateUsage(env))
        break
      case '0 6 * * *':
        // Process scheduled collection payments + dunning escalation (6am daily)
        await trackCronExecution(env, 'process_payments', () => processScheduledPayments(env))
        await trackCronExecution(env, 'dunning_escalation', () => processDunningEscalation(env))
        // Prevention scan: score accounts + create tasks for at-risk accounts (AI Role: flag only)
        await trackCronExecution(env, 'prevention_scan', async () => {
          const scan = await runPreventionScan(env)
          return { processed: scan.tasksCreated, errors: scan.errors }
        })
        break
    }
  } catch (error) {
    logger.error('Scheduled job failed', { error: (error as Error)?.message, cron })
    // Re-throw so Cloudflare Workers dashboard shows the failure.
    // trackCronExecution already records the error in KV metrics.
    // @see ARCH_DOCS/FORENSIC_DEEP_DIVE_REPORT.md — M-5
    throw error
  }
}

/**
 * Retry failed transcriptions
 * Runs every 5 minutes
 */
async function retryFailedTranscriptions(
  env: Env
): Promise<{ processed: number; errors: number }> {
  const db = getDb(env)
  let processedCount = 0
  let errorCount = 0

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
        processedCount++
      } catch (error) {
        errorCount++
        logger.warn('AssemblyAI retry exception', {
          callId: call.id,
          error: (error as Error)?.message,
        })
        // Skip failed individual retries
      }
    }

    return { processed: processedCount, errors: errorCount }
  } finally {
    await db.end()
  }
}

/**
 * Cleanup expired sessions
 * Runs hourly
 */
async function cleanupExpiredSessions(
  env: Env
): Promise<{ processed: number; errors: number }> {
  const db = getDb(env)

  try {
    // Delete expired sessions from public.sessions
    const result = await db.query(`
      DELETE FROM public.sessions
      WHERE expires < NOW()
    `)
    
    return { processed: result.rowCount || 0, errors: 0 }
  } finally {
    await db.end()
  }
}

/**
 * Aggregate daily usage statistics
 * Runs daily at midnight
 */
async function aggregateUsage(env: Env): Promise<{ processed: number; errors: number }> {
  const db = getDb(env)

  try {
    // Calculate usage for the previous day
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]

    // Aggregate call statistics per organization
    const result = await db.query(
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
    
    const orgCount = result.rowCount || 0
    return { processed: orgCount, errors: 0 }
  } finally {
    await db.end()
  }
}

