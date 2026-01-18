/**
 * Webhook Retry Cron Job
 * 
 * Processes pending webhook failures with exponential backoff.
 * Run every minute via Vercel cron.
 * 
 * Per ARCH_DOCS/01-CORE/SYSTEM_OF_RECORD_COMPLIANCE.md
 */

import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/cron/webhook-retry
 * Process pending webhook retries
 */
export async function POST(req: Request) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        logger.warn('Webhook retry cron: Unauthorized access attempt')
        return ApiErrors.unauthorized()
      }
    } else if (process.env.NODE_ENV === 'production') {
      logger.error('Webhook retry cron: CRON_SECRET not configured')
      return NextResponse.json({ success: false, error: 'Configuration error' }, { status: 500 })
    }
    
    const now = new Date().toISOString()
    
    // Get pending failures ready for retry
    const { data: pendingFailures, error: fetchErr } = await supabaseAdmin
      .from('webhook_failures')
      .select('*')
      .in('status', ['pending', 'retrying'])
      .lt('next_retry_at', now)
      .lt('attempt_count', 5) // Max 5 attempts
      .order('next_retry_at', { ascending: true })
      .limit(10) // Process 10 at a time
    
    if (fetchErr) {
      logger.error('Webhook retry: Failed to fetch pending failures', fetchErr)
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 })
    }
    
    if (!pendingFailures || pendingFailures.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No pending webhooks to retry',
        processed: 0 
      })
    }
    
    logger.info('Webhook retry: Processing failures', { count: pendingFailures.length })
    
    const results: Array<{ id: string; status: string; error?: string }> = []
    
    for (const failure of pendingFailures) {
      try {
        // Attempt to replay the webhook
        const replayResult = await replayWebhook(failure)
        
        if (replayResult.success) {
          // Mark as succeeded
          await supabaseAdmin
            .from('webhook_failures')
            .update({
              status: 'succeeded',
              resolved_at: new Date().toISOString(),
              resolution_notes: 'Auto-recovered via retry',
            })
            .eq('id', failure.id)
          
          results.push({ id: failure.id, status: 'succeeded' })
          logger.info('Webhook retry: Success', { failureId: failure.id })
        } else {
          // Update attempt count and next retry time
          const nextAttempt = failure.attempt_count + 1
          const backoffMs = 60000 * Math.pow(2, nextAttempt) // Exponential backoff
          
          const newStatus = nextAttempt >= 5 ? 'failed' : 'retrying'
          
          await supabaseAdmin
            .from('webhook_failures')
            .update({
              status: newStatus,
              attempt_count: nextAttempt,
              next_retry_at: new Date(Date.now() + backoffMs).toISOString(),
              last_attempt_at: new Date().toISOString(),
              error_message: replayResult.error || failure.error_message,
            })
            .eq('id', failure.id)
          
          results.push({ 
            id: failure.id, 
            status: newStatus, 
            error: replayResult.error 
          })
          
          if (newStatus === 'failed') {
            logger.error('Webhook retry: Max attempts reached', { 
              failureId: failure.id,
              source: failure.source 
            })
          }
        }
      } catch (err) {
        logger.error('Webhook retry: Error processing failure', err, { failureId: failure.id })
        results.push({ id: failure.id, status: 'error', error: String(err) })
      }
    }
    
    const succeeded = results.filter(r => r.status === 'succeeded').length
    const failed = results.filter(r => r.status === 'failed').length
    
    logger.info('Webhook retry: Batch complete', { 
      total: results.length, 
      succeeded, 
      failed 
    })
    
    return NextResponse.json({
      success: true,
      processed: results.length,
      succeeded,
      failed,
      retrying: results.filter(r => r.status === 'retrying').length,
      results,
    })
  } catch (err) {
    logger.error('Webhook retry cron error', err)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}

/**
 * Replay a failed webhook
 */
async function replayWebhook(failure: {
  id: string
  source: string
  endpoint: string
  payload: any
  headers?: Record<string, string>
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Build the internal endpoint URL based on source
    let targetUrl: string
    
    switch (failure.source) {
      case 'signalwire':
        targetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/webhooks/signalwire`
        break
      case 'assemblyai':
        targetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/webhooks/assemblyai`
        break
      default:
        // For other sources, use the original endpoint
        targetUrl = failure.endpoint
    }
    
    // Add replay header to identify this as a retry
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Retry': 'true',
      'X-Retry-Failure-Id': failure.id,
      ...(failure.headers || {}),
    }
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(failure.payload),
    })
    
    if (response.ok) {
      return { success: true }
    }
    
    const errorText = await response.text().catch(() => 'Unknown error')
    return { 
      success: false, 
      error: `HTTP ${response.status}: ${errorText.substring(0, 200)}` 
    }
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    }
  }
}

// Also support GET for manual trigger in development
export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new Response(JSON.stringify({ error: 'Use POST in production' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }
  return POST(req)
}
