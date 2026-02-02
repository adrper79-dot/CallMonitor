import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

/**
 * Cleanup Recordings Cron Job
 * Runs every 6 hours to clean up old temporary recordings
 */
export async function GET(request: NextRequest) {
  // Verify this is a cron request
  if (request.headers.get('CF-Cron') !== '0 */6 * * *') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const env = (globalThis as any).process?.env
    let cleanedCount = 0

    // Clean R2 temporary recordings older than 24 hours
    if (env?.RECORDINGS_BUCKET) {
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000) // 24 hours ago
      
      // List objects with temp prefix
      const objects = await env.RECORDINGS_BUCKET.list({
        prefix: 'temp/',
        limit: 1000
      })

      for (const object of objects.objects || []) {
        if (object.uploaded && new Date(object.uploaded).getTime() < cutoffTime) {
          await env.RECORDINGS_BUCKET.delete(object.key)
          cleanedCount++
        }
      }
    }

    // Clean KV cache entries older than configured TTL
    if (env?.CALLS_CACHE) {
      // KV entries with TTL are automatically cleaned up
      // This is mainly for logging purposes
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      cleanedRecordings: cleanedCount,
      message: `Cleaned up ${cleanedCount} temporary recordings`
    })
  } catch (error) {
    console.error('Cleanup cron failed:', error)
    return NextResponse.json({ 
      error: 'Cleanup failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}