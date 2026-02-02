import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

/**
 * Health Monitor Cron Job
 * Runs every 5 minutes to check system health and store metrics
 */
export async function GET(request: NextRequest) {
  // Verify this is a cron request
  if (request.headers.get('CF-Cron') !== '*/5 * * * *') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch health status
    const healthResponse = await fetch(new URL('/api/health', request.url).toString())
    const healthData = await healthResponse.json()

    // Store metrics in KV if available
    const env = (globalThis as any).process?.env
    if (env?.CALLS_CACHE) {
      const timestamp = Date.now()
      const metricsKey = `health-metrics:${Math.floor(timestamp / 300000) * 300000}` // 5-minute buckets
      
      await env.CALLS_CACHE.put(metricsKey, JSON.stringify({
        timestamp,
        status: healthData.status,
        responseTime: healthData.responseTime,
        checks: healthData.checks
      }), { expirationTtl: 86400 }) // Keep for 24 hours
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      healthStatus: healthData.status
    })
  } catch (error) {
    console.error('Health monitor cron failed:', error)
    return NextResponse.json({ 
      error: 'Health monitor failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}