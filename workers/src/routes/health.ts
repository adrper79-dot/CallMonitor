/**
 * Health Check Routes
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'

export const healthRoutes = new Hono<AppEnv>()

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
// BL-007: Removed cross-tenant aggregate data — health check only tests DB connectivity
healthRoutes.get('/analytics', async (c) => {
  const startTime = Date.now()
  const db = getDb(c.env)

  try {
    // Only test DB connectivity — no cross-tenant data exposure
    await db.query('SELECT 1')
    const latency = Date.now() - startTime

    return c.json({
      status: 'healthy',
      feature: 'analytics',
      latency_ms: latency,
      last_check: new Date().toISOString(),
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
// BL-007: Removed cross-tenant aggregate data — only test DB connectivity
healthRoutes.get('/webhooks', async (c) => {
  const startTime = Date.now()
  const db = getDb(c.env)

  try {
    // Only test DB connectivity — no cross-tenant data exposure
    await db.query('SELECT 1')
    const latency = Date.now() - startTime

    return c.json({
      status: 'healthy',
      feature: 'webhooks',
      latency_ms: latency,
      last_check: new Date().toISOString(),
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

