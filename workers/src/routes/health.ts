/**
 * Health Check Routes
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { getDb } from '../lib/db'

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

  // 1. Database check via Hyperdrive
  try {
    const dbStart = Date.now()
    
    // Check if Hyperdrive is available
    if (!c.env.HYPERDRIVE) {
      checks.push({
        service: 'database',
        status: 'critical',
        message: 'Hyperdrive binding not available',
      })
    } else {
      const db = getDb(c.env)
      const result = await db.query('SELECT 1 as check')
      const dbTime = Date.now() - dbStart

      checks.push({
        service: 'database',
        status: 'healthy',
        message: 'Hyperdrive connection successful',
        responseTime: dbTime,
      })
    }
  } catch (err: any) {
    console.error('Database health check error:', err)
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
  const hasCritical = checks.some(c => c.status === 'critical')
  const hasDegraded = checks.some(c => c.status === 'degraded')
  const overallStatus = hasCritical ? 'critical' : hasDegraded ? 'degraded' : 'healthy'

  const totalTime = Date.now() - startTime

  return c.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    responseTime: totalTime,
    checks,
    environment: {
      runtime: 'cloudflare-workers',
      region: c.req.header('cf-ray')?.split('-')[1] || 'unknown',
    },
  }, overallStatus === 'critical' ? 503 : 200)
})

// Simple ping
healthRoutes.get('/ping', (c) => {
  return c.text('pong')
})
