/**
 * Retention Policy API
 * 
 * Manages organization-level retention and lifecycle policies.
 * Per ARCH_DOCS/01-CORE/SYSTEM_OF_RECORD_COMPLIANCE.md
 * 
 * GET  - Fetch current retention policy
 * PUT  - Update retention policy (admin/owner only)
 */

import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireRole } from '@/lib/api/utils'
import { Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Force dynamic rendering - uses session via requireRole
export const dynamic = 'force-dynamic'
export const runtime = 'edge'

// Validation schema
const updatePolicySchema = z.object({
  default_retention_class: z.enum(['default', 'regulated', 'legal_hold']).optional(),
  default_retention_days: z.number().min(0).optional(),
  regulated_retention_days: z.number().min(0).optional(),
  auto_archive_after_days: z.number().min(0).nullable().optional(),
  auto_delete_after_days: z.number().min(0).nullable().optional(),
  legal_hold_contact_email: z.string().email().nullable().optional(),
  legal_hold_notes: z.string().nullable().optional(),
})

/**
 * GET /api/retention
 * Fetch the organization's retention policy
 */
export async function GET() {
  try {
    const ctx = await requireRole(['owner', 'admin', 'operator', 'analyst'])
    if (ctx instanceof NextResponse) return ctx
    
    const { data, error } = await supabaseAdmin
      .from('retention_policies')
      .select('*')
      .eq('organization_id', ctx.orgId)
      .single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      logger.error('Failed to fetch retention policy', error, { orgId: ctx.orgId })
      return Errors.internal(error)
    }
    
    // Return defaults if no policy exists
    if (!data) {
      return success({
        policy: {
          organization_id: ctx.orgId,
          default_retention_class: 'default',
          default_retention_days: 0,
          regulated_retention_days: 2555,
          auto_archive_after_days: 90,
          auto_delete_after_days: null,
          legal_hold_contact_email: null,
          legal_hold_notes: null,
        },
        exists: false,
      })
    }
    
    return success({ policy: data, exists: true })
  } catch (err) {
    logger.error('Retention GET error', err)
    return Errors.internal(err instanceof Error ? err : new Error('Unknown error'))
  }
}

/**
 * PUT /api/retention
 * Update the organization's retention policy
 */
export async function PUT(req: Request) {
  try {
    const ctx = await requireRole(['owner', 'admin'])
    if (ctx instanceof NextResponse) return ctx
    
    const body = await req.json()
    const parsed = updatePolicySchema.safeParse(body)
    
    if (!parsed.success) {
      return Errors.badRequest('Invalid policy data: ' + parsed.error.message)
    }
    
    const updates = parsed.data
    
    // Upsert the policy
    const { data, error } = await supabaseAdmin
      .from('retention_policies')
      .upsert({
        organization_id: ctx.orgId,
        ...updates,
        updated_at: new Date().toISOString(),
        updated_by: ctx.userId,
      }, {
        onConflict: 'organization_id',
      })
      .select()
      .single()
    
    if (error) {
      logger.error('Failed to update retention policy', error, { orgId: ctx.orgId })
      return Errors.internal(error)
    }
    
    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      organization_id: ctx.orgId,
      user_id: ctx.userId,
      resource_type: 'retention_policy',
      resource_id: data.id,
      action: 'retention:policy.update',
      actor_type: 'human',
      actor_label: ctx.userId,
      after: updates,
      created_at: new Date().toISOString(),
    })
    
    logger.info('Retention policy updated', {
      orgId: ctx.orgId,
      userId: ctx.userId,
      changes: Object.keys(updates),
    })
    
    return success({ policy: data, message: 'Retention policy updated' })
  } catch (err) {
    logger.error('Retention PUT error', err)
    return Errors.internal(err instanceof Error ? err : new Error('Unknown error'))
  }
}
