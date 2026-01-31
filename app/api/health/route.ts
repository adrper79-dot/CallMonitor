import { NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'

// Force dynamic rendering - health checks should always be fresh
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Health Check Endpoint
 * 
 * Checks health of critical services:
 * - Database connectivity (Postgres via pgClient)
 * - SignalWire connectivity
 * - AssemblyAI availability
 * 
 * Returns health status: healthy, degraded, critical
 */

interface HealthCheck {
  service: string
  status: 'healthy' | 'degraded' | 'critical' | 'unknown'
  message: string
  responseTime?: number
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'critical'
  timestamp: string
  checks: HealthCheck[]
}

export async function GET(req: Request) {
  const checks: HealthCheck[] = []
  const startTime = Date.now()

  // 1. Database connectivity check
  try {
    const dbStart = Date.now()
    // Simple query to check connection
    await query('SELECT 1', [])
    const dbTime = Date.now() - dbStart

    checks.push({
      service: 'database',
      status: 'healthy',
      message: 'Database connection successful',
      responseTime: dbTime
    })
  } catch (err: any) {
    checks.push({
      service: 'database',
      status: 'critical',
      message: `Database check failed: ${err?.message || 'Unknown error'}`
    })
  }

  // 2. SignalWire connectivity check
  try {
    const swStart = Date.now()
    const swProject = process.env.SIGNALWIRE_PROJECT_ID
    const swToken = process.env.SIGNALWIRE_TOKEN
    const swSpace = process.env.SIGNALWIRE_SPACE

    if (!swProject || !swToken || !swSpace) {
      checks.push({
        service: 'signalwire',
        status: 'degraded',
        message: 'SignalWire credentials not configured'
      })
    } else {
      // Try to reach SignalWire API (lightweight check)
      const swEndpoint = `https://${swSpace.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/\.signalwire\.com$/i, '')}.signalwire.com/api/laml/2010-04-01/Accounts/${swProject}.json`
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      try {
        const swRes = await fetch(swEndpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${swProject}:${swToken}`).toString('base64')}`
          },
          signal: controller.signal
        })
        clearTimeout(timeout)

        const swTime = Date.now() - swStart

        if (swRes.ok) {
          checks.push({
            service: 'signalwire',
            status: 'healthy',
            message: 'SignalWire API accessible',
            responseTime: swTime
          })
        } else {
          checks.push({
            service: 'signalwire',
            status: 'degraded',
            message: `SignalWire API returned ${swRes.status}`,
            responseTime: swTime
          })
        }
      } catch (fetchErr: any) {
        clearTimeout(timeout)
        checks.push({
          service: 'signalwire',
          status: 'degraded',
          message: `SignalWire API unreachable: ${fetchErr?.message || 'Timeout'}`
        })
      }
    }
  } catch (err: any) {
    checks.push({
      service: 'signalwire',
      status: 'degraded',
      message: `SignalWire check failed: ${err?.message || 'Unknown error'}`
    })
  }

  // 3. AssemblyAI availability check
  try {
    const aaiStart = Date.now()
    const aaiKey = process.env.ASSEMBLYAI_API_KEY

    if (!aaiKey) {
      checks.push({
        service: 'assemblyai',
        status: 'degraded',
        message: 'AssemblyAI API key not configured'
      })
    } else {
      // Lightweight API check
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      try {
        // Use /v2/transcript endpoint with minimal check (no body = 400, but proves API is reachable)
        const aaiRes = await fetch('https://api.assemblyai.com/v2/transcript', {
          method: 'GET',
          headers: {
            'Authorization': aaiKey
          },
          signal: controller.signal
        })
        clearTimeout(timeout)

        const aaiTime = Date.now() - aaiStart

        // 200 or 400 both indicate the API is reachable and key is valid
        // 401 = bad key, 5xx = service issue
        if (aaiRes.ok || aaiRes.status === 400) {
          checks.push({
            service: 'assemblyai',
            status: 'healthy',
            message: 'AssemblyAI API accessible',
            responseTime: aaiTime
          })
        } else if (aaiRes.status === 401) {
          checks.push({
            service: 'assemblyai',
            status: 'degraded',
            message: 'AssemblyAI API key invalid',
            responseTime: aaiTime
          })
        } else {
          checks.push({
            service: 'assemblyai',
            status: 'degraded',
            message: `AssemblyAI API returned ${aaiRes.status}`,
            responseTime: aaiTime
          })
        }
      } catch (fetchErr: any) {
        clearTimeout(timeout)
        checks.push({
          service: 'assemblyai',
          status: 'degraded',
          message: `AssemblyAI API unreachable: ${fetchErr?.message || 'Timeout'}`
        })
      }
    }
  } catch (err: any) {
    checks.push({
      service: 'assemblyai',
      status: 'degraded',
      message: `AssemblyAI check failed: ${err?.message || 'Unknown error'}`
    })
  }

  // 4. Storage check (Optional/Removed)
  // We removed Supabase Storage check as we are migrating away from Supabase.
  // R2 check is implicit in successful application operation or could be added later if needed.

  // Determine overall status
  const criticalCount = checks.filter(c => c.status === 'critical').length
  const degradedCount = checks.filter(c => c.status === 'degraded').length

  let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy'
  if (criticalCount > 0) {
    overallStatus = 'critical'
  } else if (degradedCount > 0) {
    overallStatus = 'degraded'
  }

  const totalTime = Date.now() - startTime

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks
  }

  const httpStatus = overallStatus === 'critical' ? 503 : 200

  const res = NextResponse.json(response, { status: httpStatus })
  res.headers.set('X-Health-Check-Time', `${totalTime}ms`)

  return res
}
