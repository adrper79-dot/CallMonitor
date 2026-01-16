/**
 * Legal Hold Management API
 * 
 * Create, list, and manage legal holds on evidence.
 * Per ARCH_DOCS/01-CORE/SYSTEM_OF_RECORD_COMPLIANCE.md
 */

import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireRole } from '@/lib/api/utils'
import { Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Validation schemas
const createHoldSchema = z.object({
  hold_name: z.string().min(1).max(200),
  matter_reference: z.string().optional(),
  description: z.string().optional(),
  applies_to_all: z.boolean().default(false),
  call_ids: z.array(z.string().uuid()).optional(),
  effective_until: z.string().datetime().optional(),
})

const releaseHoldSchema = z.object({
  hold_id: z.string().uuid(),
  release_reason: z.string().min(1),
})

/**
 * GET /api/retention/legal-holds
 * List all legal holds for the organization
 */
export async function GET() {
  try {
    const ctx = await requireRole(['owner', 'admin'])
    if (ctx instanceof NextResponse) return ctx
    
    const { data, error } = await supabaseAdmin
      .from('legal_holds')
      .select(`
        *,
        created_by_user:users!legal_holds_created_by_fkey(email),
        released_by_user:users!legal_holds_released_by_fkey(email)
      `)
      .eq('organization_id', ctx.orgId)
      .order('created_at', { ascending: false })
    
    if (error) {
      logger.error('Failed to fetch legal holds', error, { orgId: ctx.orgId })
      return Errors.internal(error)
    }
    
    // Get counts of affected calls
    const holdsWithCounts = await Promise.all(
      (data || []).map(async (hold) => {
        let affectedCount = 0
        
        if (hold.applies_to_all) {
          const { count } = await supabaseAdmin
            .from('calls')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', ctx.orgId)
          affectedCount = count || 0
        } else if (hold.call_ids?.length > 0) {
          affectedCount = hold.call_ids.length
        }
        
        return {
          ...hold,
          affected_call_count: affectedCount,
        }
      })
    )
    
    return success({ legal_holds: holdsWithCounts })
  } catch (err) {
    logger.error('Legal holds GET error', err)
    return Errors.internal(err instanceof Error ? err : new Error('Unknown error'))
  }
}

/**
 * POST /api/retention/legal-holds
 * Create a new legal hold
 */
export async function POST(req: Request) {
  try {
    const ctx = await requireRole(['owner', 'admin'])
    if (ctx instanceof NextResponse) return ctx
    
    const body = await req.json()
    const parsed = createHoldSchema.safeParse(body)
    
    if (!parsed.success) {
      return Errors.badRequest('Invalid hold data: ' + parsed.error.message)
    }
    
    const holdData = parsed.data
    
    // Validate call_ids if provided
    if (holdData.call_ids && holdData.call_ids.length > 0) {
      const { data: validCalls, error: validErr } = await supabaseAdmin
        .from('calls')
        .select('id')
        .eq('organization_id', ctx.orgId)
        .in('id', holdData.call_ids)
      
      if (validErr || !validCalls || validCalls.length !== holdData.call_ids.length) {
        return Errors.badRequest('Some call IDs are invalid or not in your organization')
      }
    }
    
    // Create the hold
    const { data, error } = await supabaseAdmin
      .from('legal_holds')
      .insert({
        organization_id: ctx.orgId,
        hold_name: holdData.hold_name,
        matter_reference: holdData.matter_reference,
        description: holdData.description,
        applies_to_all: holdData.applies_to_all,
        call_ids: holdData.call_ids || [],
        effective_until: holdData.effective_until,
        created_by: ctx.userId,
      })
      .select()
      .single()
    
    if (error) {
      logger.error('Failed to create legal hold', error, { orgId: ctx.orgId })
      return Errors.internal(error)
    }
    
    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      organization_id: ctx.orgId,
      user_id: ctx.userId,
      resource_type: 'legal_hold',
      resource_id: data.id,
      action: 'retention:legal_hold.create',
      after: {
        hold_name: holdData.hold_name,
        applies_to_all: holdData.applies_to_all,
        call_count: holdData.call_ids?.length || 0,
      },
      created_at: new Date().toISOString(),
    })
    
    logger.info('Legal hold created', {
      orgId: ctx.orgId,
      holdId: data.id,
      holdName: holdData.hold_name,
      appliesToAll: holdData.applies_to_all,
    })
    
    return success({ legal_hold: data, message: 'Legal hold created' }, 201)
  } catch (err) {
    logger.error('Legal holds POST error', err)
    return Errors.internal(err instanceof Error ? err : new Error('Unknown error'))
  }
}

/**
 * DELETE /api/retention/legal-holds
 * Release (soft delete) a legal hold
 */
export async function DELETE(req: Request) {
  try {
    const ctx = await requireRole(['owner', 'admin'])
    if (ctx instanceof NextResponse) return ctx
    
    const body = await req.json()
    const parsed = releaseHoldSchema.safeParse(body)
    
    if (!parsed.success) {
      return Errors.badRequest('Invalid release data: ' + parsed.error.message)
    }
    
    const { hold_id, release_reason } = parsed.data
    
    // Verify hold exists and belongs to org
    const { data: existingHold, error: fetchErr } = await supabaseAdmin
      .from('legal_holds')
      .select('*')
      .eq('id', hold_id)
      .eq('organization_id', ctx.orgId)
      .single()
    
    if (fetchErr || !existingHold) {
      return Errors.notFound('Legal hold not found')
    }
    
    if (existingHold.status === 'released') {
      return Errors.badRequest('Legal hold is already released')
    }
    
    // Release the hold
    const { data, error } = await supabaseAdmin
      .from('legal_holds')
      .update({
        status: 'released',
        released_at: new Date().toISOString(),
        released_by: ctx.userId,
        release_reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', hold_id)
      .select()
      .single()
    
    if (error) {
      logger.error('Failed to release legal hold', error, { holdId: hold_id })
      return Errors.internal(error)
    }
    
    // Remove legal hold flags from affected calls (unless under another hold)
    if (existingHold.call_ids?.length > 0) {
      // Check if any calls are under other active holds
      const { data: otherHolds } = await supabaseAdmin
        .from('legal_holds')
        .select('call_ids')
        .eq('organization_id', ctx.orgId)
        .eq('status', 'active')
        .neq('id', hold_id)
      
      const stillHeldCallIds = new Set(
        (otherHolds || []).flatMap(h => h.call_ids || [])
      )
      
      const callsToRelease = existingHold.call_ids.filter(
        (id: string) => !stillHeldCallIds.has(id)
      )
      
      if (callsToRelease.length > 0) {
        await supabaseAdmin
          .from('calls')
          .update({
            legal_hold_flag: false,
            custody_status: 'active',
            retention_class: 'default',
          })
          .in('id', callsToRelease)
      }
    }
    
    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      organization_id: ctx.orgId,
      user_id: ctx.userId,
      resource_type: 'legal_hold',
      resource_id: hold_id,
      action: 'retention:legal_hold.release',
      before: { status: 'active' },
      after: { status: 'released', release_reason },
      created_at: new Date().toISOString(),
    })
    
    logger.info('Legal hold released', {
      orgId: ctx.orgId,
      holdId: hold_id,
      releaseReason: release_reason,
    })
    
    return success({ legal_hold: data, message: 'Legal hold released' })
  } catch (err) {
    logger.error('Legal holds DELETE error', err)
    return Errors.internal(err instanceof Error ? err : new Error('Unknown error'))
  }
}
