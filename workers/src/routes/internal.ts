/**
 * Internal Monitoring Routes
 *
 * Health endpoints for cron jobs, webhooks, and system monitoring.
 * These endpoints are for operational monitoring and should be secured
 * or rate-limited for production use.
 *
 * Routes:
 *   GET /cron-health     - Cron job execution metrics
 *   GET /webhook-dlq     - Dead letter queue for failed webhooks
 *   GET /schema-health   - Database schema validation
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { logger } from '../lib/logger'
import { getDb } from '../lib/db'
import { analyticsRateLimit } from '../lib/rate-limit'

export const internalRoutes = new Hono<AppEnv>()

/**
 * Internal routes security middleware.
 * Validates X-Internal-Key header against INTERNAL_API_KEY secret.
 * These routes expose monitoring data (cron health, webhook DLQ, schema)
 * and MUST NOT be publicly accessible.
 *
 * @see ARCH_DOCS/FORENSIC_DEEP_DIVE_REPORT.md — C-2
 */
const requireInternalKey = async (c: any, next: any) => {
  const key = c.req.header('X-Internal-Key')
  const expected = (c.env as any).INTERNAL_API_KEY
  if (!expected) {
    logger.error('[internal] INTERNAL_API_KEY not configured — blocking all internal routes')
    return c.json({ error: 'Internal routes not configured' }, 503)
  }
  if (!key || key !== expected) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return next()
}

interface CronMetrics {
  last_run: string
  last_success: string | null
  last_error: string | null
  processed_count: number
  error_count: number
  duration_ms: number
}

interface CronHealth {
  job_name: string
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  last_run: string | null
  last_success: string | null
  last_error: string | null
  metrics: {
    processed: number
    errors: number
    duration_ms: number
  } | null
  staleness_minutes: number | null
}

/**
 * GET /cron-health
 * 
 * Returns health status of all scheduled cron jobs.
 * Uses KV metrics written by scheduled.ts trackCronExecution().
 *
 * Status levels:
 * - healthy: Job ran recently, no errors
 * - degraded: Job ran but has errors
 * - down: Job hasn't run in expected interval
 * - unknown: No metrics available (job never ran)
 */
internalRoutes.get('/cron-health', requireInternalKey, analyticsRateLimit, async (c) => {
  try {
    const jobs = [
      { name: 'retry_transcriptions', interval_minutes: 5 },
      { name: 'cleanup_sessions', interval_minutes: 60 },
      { name: 'aggregate_usage', interval_minutes: 1440 },
    ]

    const health: CronHealth[] = []

    for (const job of jobs) {
      const metricsJson = await c.env.KV.get(`cron:metrics:${job.name}`)

      if (!metricsJson) {
        health.push({
          job_name: job.name,
          status: 'unknown',
          last_run: null,
          last_success: null,
          last_error: null,
          metrics: null,
          staleness_minutes: null,
        })
        continue
      }

      const metrics: CronMetrics = JSON.parse(metricsJson)
      const lastRunTime = new Date(metrics.last_run).getTime()
      const now = Date.now()
      const stalenessMinutes = (now - lastRunTime) / (1000 * 60)

      let status: 'healthy' | 'degraded' | 'down' = 'healthy'

      // Job is stale (hasn't run in 2x expected interval)
      if (stalenessMinutes > job.interval_minutes * 2) {
        status = 'down'
      }
      // Job has errors but is running
      else if (metrics.error_count > 0 || metrics.last_error) {
        status = 'degraded'
      }

      health.push({
        job_name: job.name,
        status,
        last_run: metrics.last_run,
        last_success: metrics.last_success,
        last_error: metrics.last_error,
        metrics: {
          processed: metrics.processed_count,
          errors: metrics.error_count,
          duration_ms: metrics.duration_ms,
        },
        staleness_minutes: Math.round(stalenessMinutes),
      })
    }

    // Overall system status
    const overallStatus = health.some((h) => h.status === 'down')
      ? 'down'
      : health.some((h) => h.status === 'degraded')
        ? 'degraded'
        : health.some((h) => h.status === 'unknown')
          ? 'unknown'
          : 'healthy'

    return c.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      jobs: health,
    })
  } catch (error) {
    logger.error('Cron health check failed', { error: (error as Error)?.message })
    return c.json(
      {
        status: 'error',
        error: 'Failed to retrieve cron health metrics',
      },
      500
    )
  }
})

/**
 * GET /webhook-dlq
 * 
 * Returns failed webhook deliveries from Dead Letter Queue.
 * Stored in KV by webhook handlers when processing fails.
 *
 * Query params:
 * - source: Filter by webhook source (telnyx, stripe, assemblyai)
 * - limit: Max results (default 50, max 100)
 */
internalRoutes.get('/webhook-dlq', requireInternalKey, analyticsRateLimit, async (c) => {
  try {
    const source = c.req.query('source')
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)

    // List all DLQ entries from KV
    const prefix = source ? `webhook-dlq:${source}:` : 'webhook-dlq:'
    const list = await c.env.KV.list({ prefix, limit })

    const entries = await Promise.all(
      list.keys.map(async (key) => {
        const value = await c.env.KV.get(key.name)
        return value ? JSON.parse(value) : null
      })
    )

    const safeEntries = entries.filter((e) => e !== null)

    return c.json({
      total: list.keys.length,
      total_count: list.keys.length, // backward-compatible shape for monitoring dashboards
      has_more: !list.list_complete,
      entries: safeEntries,
    })
  } catch (error) {
    logger.error('Webhook DLQ retrieval failed', { error: (error as Error)?.message })
    return c.json(
      {
        error: 'Failed to retrieve webhook DLQ',
      },
      500
    )
  }
})

/**
 * GET /schema-health
 * 
 * Validates database schema against expected columns in critical tables.
 * Catches schema drift bugs like non-existent column references.
 *
 * Checks:
 * - calls table: transcript_status, transcript_id, recording_url, etc.
 * - users table: organization_id, role, etc.
 * - organizations table: plan, stripe_customer_id, etc.
 */
internalRoutes.get('/schema-health', requireInternalKey, analyticsRateLimit, async (c) => {
  const db = getDb(c.env)

  try {
    // Expected critical columns in key tables
    const expectedColumns = {
      calls: [
        'id',
        'organization_id',
        'call_session_id',
        'direction',
        'status',
        'transcript',
        'transcript_status',
        'recording_url',
        'duration_seconds',
        'created_at',
        'updated_at',
      ],
      users: ['id', 'email', 'organization_id', 'role', 'created_at'],
      organizations: ['id', 'name', 'subscription_status', 'created_at', 'updated_at'],
      voice_configs: ['id', 'organization_id', 'transcribe', 'ai_enabled', 'bond_enabled', 'created_at', 'updated_at'],
      usage_stats: [
        'id',
        'organization_id',
        'date',
        'calls_count',
        'minutes_used',
        'transcripts_count',
        'ai_requests_count',
        'created_at',
      ],
    }

    const validationResults: Record<
      string,
      { status: 'valid' | 'invalid'; missing_columns: string[]; column_count: number; actual_columns: string[] }
    > = {}

    for (const [tableName, expectedCols] of Object.entries(expectedColumns)) {
      // Query information_schema to get actual columns
      const result = await db.query(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_schema = 'public' 
         AND table_name = $1
         ORDER BY ordinal_position`,
        [tableName]
      )

      const actualColumns = result.rows.map((row: any) => row.column_name)
      const missingColumns = expectedCols.filter((col) => !actualColumns.includes(col))

      validationResults[tableName] = {
        status: missingColumns.length === 0 ? 'valid' : 'invalid',
        missing_columns: missingColumns,
        column_count: actualColumns.length,
        actual_columns: actualColumns,
      }
    }

    const overallStatus = Object.values(validationResults).every((v) => v.status === 'valid')
      ? 'valid'
      : 'invalid'

    return c.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      tables: validationResults,
    })
  } catch (error) {
    logger.error('Schema health check failed', { error: (error as Error)?.message })
    return c.json(
      {
        status: 'error',
        error: 'Failed to validate database schema',
      },
      500
    )
  } finally {
    await db.end()
  }
})
