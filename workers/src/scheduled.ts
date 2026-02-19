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
import { flushAuditDlq, writeAuditLog, AuditAction } from './lib/audit'
import { runPreventionScan } from './lib/prevention-scan'
import { handleCrmSync } from './crons/crm-sync'
import { executeSequences } from './lib/sequence-executor'
import { processTrialExpiry } from './lib/trial-expiry'
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
        // Execute campaign sequences — evaluate enrollments and fire due steps
        await trackCronExecution(env, 'execute_sequences', () => executeSequences(env))
        break
      case '0 0 * * *':
        await trackCronExecution(env, 'aggregate_usage', () => aggregateUsage(env))
        // COO-4: Trial expiry notifications (T-7, T-3, T-0) + hard-cancel expired trials
        await trackCronExecution(env, 'trial_expiry', async () => {
          const r = await processTrialExpiry(env)
          return { processed: r.processed, errors: r.errors }
        })
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
        // TASK-006: Expire SMS consent records older than 60 days (§1006.6(d)(5))
        await trackCronExecution(env, 'sms_consent_expiry', () => expireSmsConsent(env))
        // TASK-011: Alert on validation notices approaching 5-day deadline
        await trackCronExecution(env, 'validation_notice_alerts', () => checkValidationNoticeDeadlines(env))
        break
    }
    // CIO Item 0.2/0.4: Cron dead-man's-switch heartbeat.
    // Compatible with healthchecks.io (free), BetterStack, Cronitor, etc.
    // If no ping arrives within 2× the shortest cron interval (~10 min),
    // the monitor will alert. Non-critical — failure here must not fail the cron.
    if (env.CRON_HEARTBEAT_URL) {
      fetch(env.CRON_HEARTBEAT_URL, { method: 'HEAD' }).catch(() => {
        logger.warn('Cron heartbeat ping failed — check CRON_HEARTBEAT_URL secret')
      })
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

/**
 * TASK-006: Expire SMS consent records older than 60 days
 * Regulation F §1006.6(d)(5): SMS safe harbor requires reconfirmation every 60 days
 *
 * Marks sms_contact consent records as 'expired' unless the consumer
 * has sent an inbound SMS within the last 60 days.
 *
 * Runs daily at 6am UTC.
 */
async function expireSmsConsent(
  env: Env
): Promise<{ processed: number; errors: number }> {
  const db = getDb(env)

  try {
    const result = await db.query(`
      UPDATE consent_records
      SET event_type = 'expired', updated_at = NOW()
      WHERE consent_type = 'sms_contact'
        AND event_type IN ('granted', 'renewed')
        AND created_at < NOW() - INTERVAL '60 days'
        AND account_id NOT IN (
          SELECT DISTINCT m.account_id
          FROM messages m
          WHERE m.channel = 'sms'
            AND m.direction = 'inbound'
            AND m.created_at > NOW() - INTERVAL '60 days'
            AND m.account_id IS NOT NULL
        )
      RETURNING id
    `)

    const expired = result.rowCount || 0

    if (expired > 0) {
      logger.info('SMS consent records expired per §1006.6(d)(5)', { expired })

      // Audit trail for each batch expiry
      writeAuditLog(db, {
        organizationId: 'system',
        userId: 'system',
        resourceType: 'consent_records',
        resourceId: 'batch_expiry',
        action: AuditAction.COMPLIANCE_SMS_CONSENT_EXPIRED,
        oldValue: null,
        newValue: { expired_count: expired, regulation: '§1006.6(d)(5)', interval_days: 60 },
      }).catch(() => {})
    }

    return { processed: expired, errors: 0 }
  } catch (error) {
    logger.error('SMS consent expiry cron failed', {
      error: (error as Error)?.message,
    })
    return { processed: 0, errors: 1 }
  } finally {
    await db.end()
  }
}

/**
 * TASK-011: Check for validation notices approaching the 5-day deadline
 * §1006.34(a)(1): Must provide validation info within 5 days of initial communication.
 *
 * Creates compliance_events for notices pending > 3 days (2-day warning).
 * Runs daily at 6am UTC.
 */
async function checkValidationNoticeDeadlines(
  env: Env
): Promise<{ processed: number; errors: number }> {
  const db = getDb(env)

  try {
    // Find pending notices created more than 3 days ago (approaching 5 day deadline)
    const result = await db.query(`
      SELECT vn.id, vn.organization_id, vn.account_id,
             EXTRACT(DAY FROM NOW() - vn.created_at) AS days_pending
      FROM validation_notices vn
      WHERE vn.status = 'pending'
        AND vn.created_at < NOW() - INTERVAL '3 days'
    `)

    let processed = 0
    for (const notice of result.rows) {
      // Log a compliance warning event
      await db.query(
        `INSERT INTO compliance_events
         (organization_id, account_id, event_type, severity, passed, details)
         VALUES ($1, $2, 'validation_notice_deadline_warning', 'warning', false, $3::jsonb)`,
        [
          notice.organization_id,
          notice.account_id,
          JSON.stringify({
            notice_id: notice.id,
            days_pending: Math.floor(notice.days_pending),
            message: `Validation notice pending ${Math.floor(notice.days_pending)} days — must be sent within 5 days per §1006.34(a)(1)`,
          }),
        ]
      ).catch((err) =>
        logger.warn('Failed to log validation deadline warning (non-fatal)', {
          error: (err as Error)?.message,
        })
      )
      processed++

      // Auto-escalate notices > 5 days to a violation
      if (notice.days_pending > 5) {
        await db.query(
          `INSERT INTO compliance_violations
           (organization_id, violation_type, severity, description, account_id, status)
           VALUES ($1, 'validation_notice_overdue', 'critical',
                   'Validation notice not sent within 5 days of initial communication — §1006.34(a)(1) violation',
                   $2, 'open')
           ON CONFLICT DO NOTHING`,
          [notice.organization_id, notice.account_id]
        ).catch((err) =>
          logger.warn('Failed to create validation notice violation (non-fatal)', {
            error: (err as Error)?.message,
          })
        )
      }
    }

    return { processed, errors: 0 }
  } catch (error) {
    logger.error('Validation notice deadline check failed', {
      error: (error as Error)?.message,
    })
    return { processed: 0, errors: 1 }
  } finally {
    await db.end()
  }
}
