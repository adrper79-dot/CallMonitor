import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole, success, Errors } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Performance Metrics Analytics API
 * 
 * GET /api/analytics/performance - System performance and feature usage metrics
 */

interface PerformanceMetrics {
  transcription_rate: number
  translation_rate: number
  avg_transcription_time_seconds: number
  avg_recording_quality: number
  feature_usage: {
    voice_cloning: number
    surveys: number
    scorecards: number
    webhooks_sent: number
  }
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRole(['owner', 'admin', 'analyst'])
    if (ctx instanceof NextResponse) return ctx

    // Parallel queries for performance using optimized SQL
    const [callsResult, recordingsResult, aiRunsResult, webhooksResult] = await Promise.all([
      // Get total calls
      query('SELECT COUNT(*) as count FROM calls WHERE organization_id = $1', [ctx.orgId]),

      // Get recordings with transcription data
      query(
        `SELECT call_id, transcript_json, created_at 
         FROM recordings 
         WHERE organization_id = $1 AND transcript_json IS NOT NULL`,
        [ctx.orgId]
      ),

      // Get AI runs for this org's calls (JOIN)
      query(
        `SELECT ar.model, ar.status, ar.call_id
         FROM ai_runs ar
         JOIN calls c ON ar.call_id = c.id
         WHERE c.organization_id = $1 AND ar.status = 'completed'`,
        [ctx.orgId]
      ),

      // Get webhook deliveries (JOIN)
      query(
        `SELECT COUNT(*) as count
         FROM webhook_deliveries wd
         JOIN webhook_subscriptions ws ON wd.subscription_id = ws.id
         WHERE ws.organization_id = $1`,
        [ctx.orgId]
      )
    ])

    // Calculate metrics
    const totalCalls = parseInt(callsResult.rows[0]?.count || '0', 10)
    const recordings = recordingsResult.rows || []
    const aiRuns = aiRunsResult.rows || []
    const webhookCount = parseInt(webhooksResult.rows[0]?.count || '0', 10)

    // Transcription rate: % of calls with transcripts
    const transcription_rate = totalCalls > 0
      ? Math.round((recordings.length / totalCalls) * 100)
      : 0

    // Translation rate: % of calls with translations
    const translations = aiRuns.filter((run: any) =>
      run.model === 'translation' || run.model === 'elevenlabs-translate'
    ).length
    const translation_rate = totalCalls > 0
      ? Math.round((translations / totalCalls) * 100)
      : 0

    // Average transcription time estimation
    const avg_transcription_time_seconds = recordings.length > 0 ? 15 : 0

    // Average recording quality (placeholder)
    const avg_recording_quality = 85

    // Feature usage counts
    const feature_usage = {
      voice_cloning: aiRuns.filter((run: any) =>
        run.model === 'elevenlabs-clone' || run.model === 'voice-clone'
      ).length,
      surveys: aiRuns.filter((run: any) =>
        run.model === 'laml-dtmf-survey' || run.model === 'signalwire-ai-survey'
      ).length,
      scorecards: aiRuns.filter((run: any) =>
        run.model === 'scorecard' || run.model === 'quality-assessment'
      ).length,
      webhooks_sent: webhookCount
    }

    const metrics: PerformanceMetrics = {
      transcription_rate,
      translation_rate,
      avg_transcription_time_seconds,
      avg_recording_quality,
      feature_usage
    }

    return success({ metrics })
  } catch (err: any) {
    logger.error('Performance metrics analytics API error', err)
    return Errors.internal(err instanceof Error ? err : new Error('Failed to compute performance metrics'))
  }
}
