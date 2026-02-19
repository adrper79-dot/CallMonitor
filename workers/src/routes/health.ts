/**
 * Health Check Routes
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { getDb } from '../lib/db'
import { logger, configureAxiom, flushAxiomLogs } from '../lib/logger'

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

  // 3. R2 bucket check
  try {
    const r2Start = Date.now()
    // List a single object to validate access; tolerate empty bucket
    const listResult = await c.env.R2.list({ limit: 1 })
    const r2Time = Date.now() - r2Start

    checks.push({
      service: 'r2',
      status: 'healthy',
      message: `R2 accessible (${listResult.objects.length} objects sampled)`,
      responseTime: r2Time,
    })
  } catch (err: any) {
    checks.push({
      service: 'r2',
      status: 'degraded',
      message: err.message || 'R2 access failed',
    })
  }

  // 4. Telnyx API check
  try {
    const telnyxStart = Date.now()
    const response = await fetch('https://api.telnyx.com/v2/phone_numbers?page[size]=1', {
      headers: {
        Authorization: `Bearer ${c.env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    const telnyxTime = Date.now() - telnyxStart

    if (response.ok) {
      checks.push({
        service: 'telnyx',
        status: 'healthy',
        message: 'Telnyx API accessible',
        responseTime: telnyxTime,
      })
    } else {
      checks.push({
        service: 'telnyx',
        status: 'degraded',
        message: `Telnyx API returned ${response.status}`,
        responseTime: telnyxTime,
      })
    }
  } catch (err: any) {
    checks.push({
      service: 'telnyx',
      status: 'critical',
      message: err.message || 'Telnyx API unreachable',
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

// Readiness probe — purpose-built for external uptime monitors (BetterUptime / Betterstack).
// CIO Item 0.2: monitor URL = https://wordisbond-api.adrper79.workers.dev/health/ready
// BetterUptime config: expected HTTP 200, keyword "ok", check interval 1 min.
//
// Intentionally lightweight: only validates the critical-path DB dependency.
// Full system health (KV, R2, Telnyx) is available at GET /health.
healthRoutes.get('/ready', async (c) => {
  const start = Date.now()
  const db = getDb(c.env)
  try {
    await db.query('SELECT 1')
    return c.json(
      {
        status: 'ok',
        version: '5.3',
        timestamp: new Date().toISOString(),
        latency_ms: Date.now() - start,
      },
      200
    )
  } catch (err: any) {
    logger.error('Readiness probe: DB unavailable', { error: err?.message })
    return c.json(
      {
        status: 'error',
        error: 'Database unavailable',
        timestamp: new Date().toISOString(),
        latency_ms: Date.now() - start,
      },
      503
    )
  } finally {
    await db.end()
  }
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

// Axiom connectivity diagnostic — call GET /health/axiom to verify token + dataset
// Returns the raw Axiom ingest HTTP status so you can pinpoint the exact failure.
// Does NOT require auth — safe because it only sends a synthetic test event.
healthRoutes.get('/axiom', async (c) => {
  const token = c.env.AXIOM_API_TOKEN
  const dataset = c.env.AXIOM_DATASET || 'wib-main'

  if (!token) {
    return c.json({
      ok: false,
      problem: 'AXIOM_API_TOKEN secret is not set',
      dataset,
      hint: 'Run: npx wrangler secret put AXIOM_API_TOKEN --config workers/wrangler.toml',
    }, 500)
  }

  // 1. List all datasets the token can access
  let datasets: string[] = []
  try {
    const dsResp = await fetch('https://api.axiom.co/v1/datasets', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (dsResp.ok) {
      const dsData: any[] = await dsResp.json()
      datasets = dsData.map((d: any) => d.name)
    }
  } catch { /* ignore */ }

  // 2. Try a direct ingest to the configured dataset
  const testEvent = [{ _time: new Date().toISOString(), msg: 'axiom-connectivity-test', level: 'INFO', source: 'health-check' }]
  const ingestResp = await fetch(`https://api.axiom.co/v1/datasets/${dataset}/ingest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(testEvent),
  })
  const ingestBody = await ingestResp.text()

  // 3. Also fire a real logger.warn so the middleware flush path is exercised
  configureAxiom(token, dataset)
  logger.warn('Axiom diagnostic test via /health/axiom', { dataset, ts: new Date().toISOString() })
  await flushAxiomLogs()

  return c.json({
    ok: ingestResp.ok,
    token_prefix: token.slice(0, 8) + '…',
    dataset_configured: dataset,
    datasets_accessible: datasets,
    dataset_match: datasets.includes(dataset),
    axiom_ingest_status: ingestResp.status,
    axiom_ingest_body: ingestBody,
    hint: !ingestResp.ok
      ? (ingestResp.status === 401 ? 'Token is invalid or lacks ingest permission' :
         ingestResp.status === 404 ? `Dataset "${dataset}" not found — check datasets_accessible list` :
         'Unexpected error — see axiom_ingest_body')
      : 'Ingest accepted — check Axiom dataset for the test event',
  })
})
