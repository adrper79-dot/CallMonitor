import { neon } from '@neondatabase/serverless'

export async function onRequestGet(context) {
  const { env } = context

  try {
    const sql = neon(env.NEON_CONNECTION_STRING)
    const checks = []
    const startTime = Date.now()

    // 1. Database connectivity check
    try {
      const dbStart = Date.now()
      const result = await sql`SELECT id FROM organizations LIMIT 1`
      const dbTime = Date.now() - dbStart

      if (result.length >= 0) {
        checks.push({
          service: 'database',
          status: 'healthy',
          message: 'Database connection successful',
          responseTime: dbTime
        })
      } else {
        checks.push({
          service: 'database',
          status: 'critical',
          message: 'Database query returned no results',
          responseTime: dbTime
        })
      }
    } catch (err) {
      checks.push({
        service: 'database',
        status: 'critical',
        message: `Database check failed: ${err.message}`
      })
    }

    // 2. SignalWire connectivity check
    try {
      const swProject = env.SIGNALWIRE_PROJECT_ID
      const swToken = env.SIGNALWIRE_TOKEN
      const swSpace = env.SIGNALWIRE_SPACE

      if (!swProject || !swToken || !swSpace) {
        checks.push({
          service: 'signalwire',
          status: 'degraded',
          message: 'SignalWire credentials not configured'
        })
      } else {
        const swStart = Date.now()
        const swEndpoint = `https://${swSpace.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/\.signalwire\.com$/i, '')}.signalwire.com/api/laml/2010-04-01/Accounts/${swProject}.json`

        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 5000)

          const swRes = await fetch(swEndpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${btoa(`${swProject}:${swToken}`)}`
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
        } catch (fetchErr) {
          checks.push({
            service: 'signalwire',
            status: 'degraded',
            message: `SignalWire API unreachable: ${fetchErr.message || 'Timeout'}`
          })
        }
      }
    } catch (err) {
      checks.push({
        service: 'signalwire',
        status: 'degraded',
        message: `SignalWire check failed: ${err.message || 'Unknown error'}`
      })
    }

    // 3. AssemblyAI availability check
    try {
      const aaiKey = env.ASSEMBLYAI_API_KEY

      if (!aaiKey) {
        checks.push({
          service: 'assemblyai',
          status: 'degraded',
          message: 'AssemblyAI API key not configured'
        })
      } else {
        const aaiStart = Date.now()
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)

        try {
          const aaiRes = await fetch('https://api.assemblyai.com/v2/transcript', {
            method: 'POST',
            headers: {
              'Authorization': aaiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ audio_url: 'https://example.com/test.mp3' }),
            signal: controller.signal
          })
          clearTimeout(timeout)

          const aaiTime = Date.now() - aaiStart

          if (aaiRes.status === 400) {
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
        } catch (fetchErr) {
          checks.push({
            service: 'assemblyai',
            status: 'degraded',
            message: `AssemblyAI API unreachable: ${fetchErr.message || 'Timeout'}`
          })
        }
      }
    } catch (err) {
      checks.push({
        service: 'assemblyai',
        status: 'degraded',
        message: `AssemblyAI check failed: ${err.message || 'Unknown error'}`
      })
    }

    // Determine overall status
    const criticalCount = checks.filter(c => c.status === 'critical').length
    const degradedCount = checks.filter(c => c.status === 'degraded').length

    let overallStatus = 'healthy'
    if (criticalCount > 0) {
      overallStatus = 'critical'
    } else if (degradedCount > 0) {
      overallStatus = 'degraded'
    }

    return new Response(JSON.stringify({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: checks,
      responseTime: Date.now() - startTime
    }), {
      status: overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Health check error:', error)
    return new Response(JSON.stringify({
      status: 'critical',
      timestamp: new Date().toISOString(),
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}