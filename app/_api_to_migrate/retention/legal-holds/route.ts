/**
 * Legal Hold Management API
 * 
 * Create, list, and manage legal holds on evidence.
 * Per ARCH_DOCS/01-CORE/SYSTEM_OF_RECORD_COMPLIANCE.md
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/api/utils'
import { Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'nodejs'

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

    const { rows: holds } = await query(
      `SELECT lh.*, 
              (SELECT email FROM users WHERE id = lh.created_by) as created_by_email,
              (SELECT email FROM users WHERE id = lh.released_by) as released_by_email
       FROM legal_holds lh
       WHERE lh.organization_id = $1
       ORDER BY lh.created_at DESC`,
      [ctx.orgId]
    )

    // Get counts of affected calls
    const holdsWithCounts = await Promise.all(
      (holds || []).map(async (hold: any) => {
        let affectedCount = 0

        if (hold.applies_to_all) {
          const { rows: countRows } = await query(
            `SELECT COUNT(*) as count FROM calls WHERE organization_id = $1`,
            [ctx.orgId]
          )
          affectedCount = parseInt(countRows?.[0]?.count || '0', 10)
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
      const { rows: validCalls } = await query(
        `SELECT id FROM calls WHERE organization_id = $1 AND id = ANY($2)`,
        [ctx.orgId, holdData.call_ids]
      )

      if (!validCalls || validCalls.length !== holdData.call_ids.length) {
        return Errors.badRequest('Some call IDs are invalid or not in your organization')
      }
    }

    const holdId = uuidv4()

    // Create the hold
    const { rows: newHoldRows } = await query(
      `INSERT INTO legal_holds (
        id, organization_id, hold_name, matter_reference, description, 
        applies_to_all, call_ids, effective_until, created_by, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', NOW())
      RETURNING *`,
      [
        holdId, ctx.orgId, holdData.hold_name, holdData.matter_reference || null,
        holdData.description || null, holdData.applies_to_all, holdData.call_ids || [],
        holdData.effective_until || null, ctx.userId
      ]
    )

    const data = newHoldRows[0]

    // Audit log
    await query(
      `INSERT INTO audit_logs (
        id, organization_id, user_id, resource_type, resource_id, action, 
        actor_type, actor_label, after, created_at
      ) VALUES ($1, $2, $3, 'legal_hold', $4, 'retention:legal_hold.create', 'human', $5, $6, NOW())`,
      [
        uuidv4(), ctx.orgId, ctx.userId, data.id, ctx.userId,
        JSON.stringify({
          hold_name: holdData.hold_name,
          applies_to_all: holdData.applies_to_all,
          call_count: holdData.call_ids?.length || 0
        })
      ]
    )

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
    const { rows: holdRows } = await query(
      `SELECT * FROM legal_holds WHERE id = $1 AND organization_id = $2 LIMIT 1`,
      [hold_id, ctx.orgId]
    )
    const existingHold = holdRows?.[0]

    if (!existingHold) {
      return Errors.notFound('Legal hold not found')
    }

    if (existingHold.status === 'released') {
      return Errors.badRequest('Legal hold is already released')
    }

    // Release the hold
    const { rows: updatedRows } = await query(
      `UPDATE legal_holds SET 
        status = 'released', 
        released_at = NOW(), 
        released_by = $1, 
        release_reason = $2, 
        updated_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [ctx.userId, release_reason, hold_id]
    )

    const data = updatedRows[0]

    // Remove legal hold flags from affected calls (unless under another hold)
    if (existingHold.call_ids?.length > 0) {
      // Check if any calls are under other active holds
      const { rows: otherHolds } = await query(
        `SELECT call_ids FROM legal_holds 
         WHERE organization_id = $1 AND status = 'active' AND id != $2`,
        [ctx.orgId, hold_id]
      )

      const stillHeldCallIds = new Set(
        (otherHolds || []).flatMap((h: any) => h.call_ids || [])
      )

      const callsToRelease = existingHold.call_ids.filter(
        (id: string) => !stillHeldCallIds.has(id)
      )

      if (callsToRelease.length > 0) {
        await query(
          `UPDATE calls SET 
            legal_hold_flag = false, 
            custody_status = 'active', 
            retention_class = 'default' 
           WHERE id = ANY($1)`,
          [callsToRelease]
        )
      }
    }

    // Audit log
    await query(
      `INSERT INTO audit_logs (
        id, organization_id, user_id, resource_type, resource_id, action, 
        before, after, created_at
      ) VALUES ($1, $2, $3, 'legal_hold', $4, 'retention:legal_hold.release', $5, $6, NOW())`,
      [
        uuidv4(), ctx.orgId, ctx.userId, hold_id,
        JSON.stringify({ status: 'active' }),
        JSON.stringify({ status: 'released', release_reason })
      ]
    )

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
