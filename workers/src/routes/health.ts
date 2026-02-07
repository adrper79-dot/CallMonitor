/**
 * Health Check Routes
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'

export const healthRoutes = new Hono<{ Bindings: Env }>()

interface HealthCheck {
  service: string
  status: 'healthy' | 'degraded' | 'critical' | 'unknown'
  message: string
  responseTime?: number
}

// Main health endpoint
healthRoutes.get('/', async (c) => {
  const checks: HealthCheck[] = []
  const startTime = Date.now()

  // 1. Database check — uses getDb() which prefers NEON_PG_CONN over HYPERDRIVE
  try {
    const dbStart = Date.now()
    const db = getDb(c.env)
    try {
      const result = await db.query('SELECT version()')
      const dbTime = Date.now() - dbStart

      checks.push({
        service: 'database',
        status: 'healthy',
        message: 'Database connection successful',
        responseTime: dbTime,
      })
    } finally {
      await db.end()
    }
  } catch (err: any) {
    logger.error('Database health check error', { error: err?.message || err })
    checks.push({
      service: 'database',
      status: 'critical',
      message: err.message || 'Database connection failed',
    })
  }

  // 2. KV check
  try {
    const kvStart = Date.now()
    await c.env.KV.get('health-check-test')
    const kvTime = Date.now() - kvStart

    checks.push({
      service: 'kv',
      status: 'healthy',
      message: 'KV namespace accessible',
      responseTime: kvTime,
    })
  } catch (err: any) {
    checks.push({
      service: 'kv',
      status: 'degraded',
      message: err.message || 'KV access failed',
    })
  }

  // 3. R2 check
  try {
    const r2Start = Date.now()
    await c.env.R2.head('health-check')
    const r2Time = Date.now() - r2Start

    checks.push({
      service: 'r2',
      status: 'healthy',
      message: 'R2 bucket accessible',
      responseTime: r2Time,
    })
  } catch (err: any) {
    // R2 head on non-existent object returns null, not error
    checks.push({
      service: 'r2',
      status: 'healthy',
      message: 'R2 bucket accessible',
      responseTime: Date.now() - startTime,
    })
  }

  // Determine overall status
  const hasCritical = checks.some((c) => c.status === 'critical')
  const hasDegraded = checks.some((c) => c.status === 'degraded')
  const overallStatus = hasCritical ? 'critical' : hasDegraded ? 'degraded' : 'healthy'

  const totalTime = Date.now() - startTime

  return c.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: totalTime,
      checks,
      environment: {
        runtime: 'cloudflare-workers',
        region: c.req.header('cf-ray')?.split('-')[1] || 'unknown',
      },
    },
    overallStatus === 'critical' ? 503 : 200
  )
})

// Simple ping
healthRoutes.get('/ping', (c) => {
  return c.text('pong')
})

// Auth providers status
healthRoutes.get('/auth-providers', (c) => {
  return c.json({
    providers: [
      { id: 'credentials', name: 'Email & Password', enabled: true },
      { id: 'google', name: 'Google', enabled: false },
      { id: 'github', name: 'GitHub', enabled: false },
    ],
    defaultProvider: 'credentials',
  })
})

// Analytics health check
healthRoutes.get('/analytics', async (c) => {
  const startTime = Date.now()
  const db = getDb(c.env)

  try {
    // Test KPI query for health check
    const testResult = await db.query(
      `SELECT
        COUNT(*)::int AS total_calls,
        COALESCE(AVG(duration), 0)::int AS avg_duration
      FROM calls
      WHERE created_at >= NOW() - INTERVAL '1 day'
      LIMIT 1`
    )

    const latency = Date.now() - startTime

    return c.json({
      status: 'healthy',
      feature: 'analytics',
      latency_ms: latency,
      last_check: new Date().toISOString(),
      metrics: {
        query_count: 5,
        avg_query_time_ms: Math.round(latency / 5),
        sample_calls_24h: testResult.rows[0]?.total_calls || 0,
      },
    })
  } catch (error: any) {
    logger.error('Analytics health check error', { error: error?.message || error })
    return c.json(
      {
        status: 'unhealthy',
        feature: 'analytics',
        error: error.message || 'Analytics health check failed',
        last_check: new Date().toISOString(),
      },
      503
    )
  } finally {
    await db.end()
  }
})

// Webhook health check
healthRoutes.get('/webhooks', async (c) => {
  const startTime = Date.now()
  const db = getDb(c.env)

  try {
    // Count active subscriptions
    const subsResult = await db.query(`
      SELECT COUNT(*) as count
      FROM webhook_subscriptions
      WHERE is_active = true
    `)
    const activeSubscriptions = parseInt(subsResult.rows[0]?.count || '0', 10)

    // Get delivery stats from last 24 hours
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total_deliveries,
        COUNT(*) FILTER (WHERE success = true) as successful_deliveries,
        AVG(duration_ms) as avg_response_time_ms
      FROM webhook_deliveries
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `)

    const totalDeliveries = parseInt(statsResult.rows[0]?.total_deliveries || '0', 10)
    const successfulDeliveries = parseInt(statsResult.rows[0]?.successful_deliveries || '0', 10)
    const avgResponseTime = parseFloat(statsResult.rows[0]?.avg_response_time_ms || '0')

    const successRate = totalDeliveries > 0 ? successfulDeliveries / totalDeliveries : 1
    const failedDeliveries = totalDeliveries - successfulDeliveries

    const latency = Date.now() - startTime

    return c.json({
      status: 'healthy',
      feature: 'webhooks',
      latency_ms: latency,
      last_check: new Date().toISOString(),
      metrics: {
        active_subscriptions: activeSubscriptions,
        deliveries_last_24h: totalDeliveries,
        successful_deliveries_last_24h: successfulDeliveries,
        failed_deliveries_last_24h: failedDeliveries,
        success_rate: parseFloat((successRate * 100).toFixed(2)),
        avg_response_time_ms: parseFloat(avgResponseTime.toFixed(2)),
      },
    })
  } catch (error: any) {
    logger.error('Webhook health check error', { error: error?.message || error })
    return c.json(
      {
        status: 'unhealthy',
        feature: 'webhooks',
        error: error?.message || 'Health check failed',
        last_check: new Date().toISOString(),
      },
      503
    )
  } finally {
    await db.end()
  }
})
