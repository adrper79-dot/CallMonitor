/**
 * Webhook Failures API (Dead-Letter Queue)
 * 
 * Manages failed webhook tracking, replay, and resolution.
 * Per ARCH_DOCS/01-CORE/SYSTEM_OF_RECORD_COMPLIANCE.md - Structured Error Journaling
 * 
 * GET  - List webhook failures (with filters)
 * POST - Record a webhook failure
 * PUT  - Retry or resolve a failure
 */

import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireRole } from '@/lib/api/utils'
import { Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Validation schemas
const recordFailureSchema = z.object({
  source: z.enum(['signalwire', 'assemblyai', 'resend', 'stripe', 'internal']),
  endpoint: z.string(),
  payload: z.any(),
  headers: z.record(z.string()).optional(),
  error_message: z.string(),
  error_code: z.string().optional(),
  http_status: z.number().optional(),
  idempotency_key: z.string().optional(),
  resource_type: z.string().optional(),
  resource_id: z.string().uuid().optional(),
})

const resolveFailureSchema = z.object({
  failure_id: z.string().uuid(),
  action: z.enum(['retry', 'manual_review', 'discard']),
  resolution_notes: z.string().optional(),
})

/**
 * GET /api/reliability/webhooks
 * List webhook failures for the organization
 */
export async function GET(req: Request) {
  try {
    const ctx = await requireRole(['owner', 'admin'])
    if (ctx instanceof NextResponse) return ctx
    
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'pending'
    const source = searchParams.get('source')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    
    let query = supabaseAdmin
      .from('webhook_failures')
      .select('*')
      .eq('organization_id', ctx.orgId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (status !== 'all') {
      query = query.eq('status', status)
    }
    
    if (source) {
      query = query.eq('source', source)
    }
    
    const { data, error } = await query
    
    if (error) {
      logger.error('Failed to fetch webhook failures', error, { orgId: ctx.orgId })
      return Errors.internal(error)
    }
    
    // Get summary counts
    const { data: metrics } = await supabaseAdmin
      .from('reliability_metrics')
      .select('*')
      .eq('organization_id', ctx.orgId)
      .single()
    
    return success({
      failures: data || [],
      metrics: metrics || {
        pending_webhooks: 0,
        failed_webhooks: 0,
        manual_review_webhooks: 0,
        recovered_webhooks: 0,
        failures_24h: 0,
      },
    })
  } catch (err) {
    logger.error('Webhook failures GET error', err)
    return Errors.internal(err instanceof Error ? err : new Error('Unknown error'))
  }
}

/**
 * POST /api/reliability/webhooks
 * Record a webhook failure (internal use for error handling)
 */
export async function POST(req: Request) {
  try {
    // This endpoint can be called internally without full auth
    // but we'll still try to get context for organization_id
    let orgId: string | null = null
    
    try {
      const ctx = await requireRole(['owner', 'admin', 'operator'])
      if (!(ctx instanceof NextResponse)) {
        orgId = ctx.orgId
      }
    } catch {
      // Allow internal calls without auth
    }
    
    const body = await req.json()
    const parsed = recordFailureSchema.safeParse(body)
    
    if (!parsed.success) {
      return Errors.badRequest('Invalid failure data: ' + parsed.error.message)
    }
    
    const failureData = parsed.data
    
    // Check for duplicate via idempotency key
    if (failureData.idempotency_key) {
      const { data: existing } = await supabaseAdmin
        .from('webhook_failures')
        .select('id')
        .eq('idempotency_key', failureData.idempotency_key)
        .limit(1)
      
      if (existing?.[0]) {
        return success({ 
          failure_id: existing[0].id, 
          message: 'Duplicate failure already recorded',
          duplicate: true 
        })
      }
    }
    
    // Calculate next retry time (exponential backoff)
    const nextRetry = new Date(Date.now() + 60000) // 1 minute for first retry
    
    const { data, error } = await supabaseAdmin
      .from('webhook_failures')
      .insert({
        organization_id: orgId,
        source: failureData.source,
        endpoint: failureData.endpoint,
        payload: failureData.payload,
        headers: failureData.headers,
        error_message: failureData.error_message,
        error_code: failureData.error_code,
        http_status: failureData.http_status,
        idempotency_key: failureData.idempotency_key,
        resource_type: failureData.resource_type,
        resource_id: failureData.resource_id,
        next_retry_at: nextRetry.toISOString(),
        status: 'pending',
      })
      .select()
      .single()
    
    if (error) {
      logger.error('Failed to record webhook failure', error)
      return Errors.internal(error)
    }
    
    logger.warn('Webhook failure recorded', {
      failureId: data.id,
      source: failureData.source,
      endpoint: failureData.endpoint,
      errorMessage: failureData.error_message,
    })
    
    return success({ failure_id: data.id, message: 'Failure recorded' }, 201)
  } catch (err) {
    logger.error('Webhook failures POST error', err)
    return Errors.internal(err instanceof Error ? err : new Error('Unknown error'))
  }
}

/**
 * PUT /api/reliability/webhooks
 * Resolve or retry a webhook failure
 */
export async function PUT(req: Request) {
  try {
    const ctx = await requireRole(['owner', 'admin'])
    if (ctx instanceof NextResponse) return ctx
    
    const body = await req.json()
    const parsed = resolveFailureSchema.safeParse(body)
    
    if (!parsed.success) {
      return Errors.badRequest('Invalid resolution data: ' + parsed.error.message)
    }
    
    const { failure_id, action, resolution_notes } = parsed.data
    
    // Verify failure exists and belongs to org
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('webhook_failures')
      .select('*')
      .eq('id', failure_id)
      .eq('organization_id', ctx.orgId)
      .single()
    
    if (fetchErr || !existing) {
      return Errors.notFound('Webhook failure not found')
    }
    
    let updates: Record<string, any> = {}
    
    switch (action) {
      case 'retry':
        if (existing.attempt_count >= existing.max_attempts) {
          return Errors.badRequest('Max retry attempts reached')
        }
        updates = {
          status: 'retrying',
          attempt_count: existing.attempt_count + 1,
          next_retry_at: new Date(Date.now() + 60000 * Math.pow(2, existing.attempt_count)).toISOString(),
          last_attempt_at: new Date().toISOString(),
        }
        break
        
      case 'manual_review':
        updates = {
          status: 'manual_review',
          resolution_notes,
        }
        break
        
      case 'discard':
        updates = {
          status: 'discarded',
          resolved_at: new Date().toISOString(),
          resolved_by: ctx.userId,
          resolution_notes: resolution_notes || 'Manually discarded',
        }
        break
    }
    
    const { data, error } = await supabaseAdmin
      .from('webhook_failures')
      .update(updates)
      .eq('id', failure_id)
      .select()
      .single()
    
    if (error) {
      logger.error('Failed to update webhook failure', error, { failureId: failure_id })
      return Errors.internal(error)
    }
    
    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      organization_id: ctx.orgId,
      user_id: ctx.userId,
      resource_type: 'webhook_failure',
      resource_id: failure_id,
      action: `reliability:webhook.${action}`,
      before: { status: existing.status },
      after: { status: data.status },
      created_at: new Date().toISOString(),
    })
    
    logger.info('Webhook failure resolved', {
      failureId: failure_id,
      action,
      newStatus: data.status,
      userId: ctx.userId,
    })
    
    return success({ failure: data, message: `Failure ${action} successful` })
  } catch (err) {
    logger.error('Webhook failures PUT error', err)
    return Errors.internal(err instanceof Error ? err : new Error('Unknown error'))
  }
}
