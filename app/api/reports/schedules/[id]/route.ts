/**
 * Individual Report Schedule API
 * 
 * PATCH /api/reports/schedules/[id] - Update schedule
 * DELETE /api/reports/schedules/[id] - Delete schedule
 * 
 * @module api/reports/schedules/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireRole } from '@/lib/auth/rbac'
import { logger } from '@/lib/logger'
import { AppError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/reports/schedules/[id]
 * Update scheduled report (toggle active status)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, organizationId, role } = await requireRole('owner', 'admin')
    const scheduleId = params.id

    const body = await req.json()
    const { isActive } = body

    // Get schedule to verify ownership
    const { data: schedule, error: fetchError } = await supabaseAdmin
      .from('scheduled_reports')
      .select('organization_id')
      .eq('id', scheduleId)
      .single()

    if (fetchError || !schedule) {
      throw new AppError('Schedule not found', 404)
    }

    if (schedule.organization_id !== organizationId) {
      throw new AppError('Unauthorized', 403)
    }

    // Update schedule
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('scheduled_reports')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', scheduleId)
      .select()
      .single()

    if (updateError) {
      throw new AppError('Failed to update schedule', 500, updateError)
    }

    logger.info('Scheduled report updated', {
      scheduleId,
      isActive,
      userId,
    })

    return NextResponse.json({ schedule: updated })
  } catch (error: any) {
    logger.error('PATCH /api/reports/schedules/[id] error', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}

/**
 * DELETE /api/reports/schedules/[id]
 * Delete scheduled report
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, organizationId, role } = await requireRole('owner', 'admin')
    const scheduleId = params.id

    // Get schedule to verify ownership
    const { data: schedule, error: fetchError } = await supabaseAdmin
      .from('scheduled_reports')
      .select('organization_id')
      .eq('id', scheduleId)
      .single()

    if (fetchError || !schedule) {
      throw new AppError('Schedule not found', 404)
    }

    if (schedule.organization_id !== organizationId) {
      throw new AppError('Unauthorized', 403)
    }

    // Delete schedule
    const { error: deleteError } = await supabaseAdmin
      .from('scheduled_reports')
      .delete()
      .eq('id', scheduleId)

    if (deleteError) {
      throw new AppError('Failed to delete schedule', 500, deleteError)
    }

    logger.info('Scheduled report deleted', {
      scheduleId,
      userId,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('DELETE /api/reports/schedules/[id] error', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}
