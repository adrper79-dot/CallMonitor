import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'

// Force dynamic rendering - health checks should always be fresh
export const dynamic = 'force-dynamic'

/**
 * Health Check Endpoint
 * 
 * Checks health of critical services:
 * - Database connectivity
 * - SignalWire connectivity
 * - AssemblyAI availability
 * - Supabase Storage accessibility
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
    const { error: dbError } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .limit(1)
    
    const dbTime = Date.now() - dbStart
    
    if (dbError) {
      checks.push({
        service: 'database',
        status: 'critical',
        message: `Database query failed: ${dbError.message}`,
        responseTime: dbTime
      })
    } else {
      checks.push({
        service: 'database',
        status: 'healthy',
        message: 'Database connection successful',
        responseTime: dbTime
      })
    }
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
        const aaiRes = await fetch('https://api.assemblyai.com/v2/health', {
          method: 'GET',
          headers: {
            'Authorization': aaiKey
          },
          signal: controller.signal
        })
        clearTimeout(timeout)
        
        const aaiTime = Date.now() - aaiStart
        
        if (aaiRes.ok) {
          checks.push({
            service: 'assemblyai',
            status: 'healthy',
            message: 'AssemblyAI API accessible',
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

  // 4. Supabase Storage check (if configured)
  try {
    const storageStart = Date.now()
    // Try to list buckets (lightweight operation)
    const { data, error: storageError } = await supabaseAdmin.storage.listBuckets()
    const storageTime = Date.now() - storageStart

    if (storageError) {
      checks.push({
        service: 'supabase_storage',
        status: 'degraded',
        message: `Storage access failed: ${storageError.message}`,
        responseTime: storageTime
      })
    } else {
      checks.push({
        service: 'supabase_storage',
        status: 'healthy',
        message: 'Supabase Storage accessible',
        responseTime: storageTime
      })
    }
  } catch (err: any) {
    checks.push({
      service: 'supabase_storage',
      status: 'degraded',
      message: `Storage check failed: ${err?.message || 'Unknown error'}`
    })
  }

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

  const httpStatus = overallStatus === 'critical' ? 503 : overallStatus === 'degraded' ? 200 : 200

  const res = NextResponse.json(response, { status: httpStatus })
  res.headers.set('X-Health-Check-Time', `${totalTime}ms`)
  
  return res
}
