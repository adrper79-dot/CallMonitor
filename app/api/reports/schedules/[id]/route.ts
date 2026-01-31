/**
 * Individual Report Schedule API
 * 
 * PATCH /api/reports/schedules/[id] - Update schedule
 * DELETE /api/reports/schedules/[id] - Delete schedule
 * 
 * @module api/reports/schedules/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { logger } from '@/lib/logger'
import { AppError } from '@/types/app-error'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * PATCH /api/reports/schedules/[id]
 * Update scheduled report (toggle active status)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['owner', 'admin'])
    if (session instanceof NextResponse) return session
    const userId = session.user.id
    const organizationId = session.user.organizationId
    const scheduleId = params.id

    const body = await req.json()
    const { isActive } = body

    // Get schedule to verify ownership
    const { rows: schedules } = await query(
      `SELECT organization_id FROM scheduled_reports WHERE id = $1`,
      [scheduleId]
    )

    if (schedules.length === 0) {
      throw new AppError('Schedule not found', 404)
    }

    if (schedules[0].organization_id !== organizationId) {
      throw new AppError('Unauthorized', 403)
    }

    // Update schedule
    const { rows: updatedSchedules } = await query(
      `UPDATE scheduled_reports 
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [isActive, scheduleId]
    )

    logger.info('Scheduled report updated', {
      scheduleId,
      isActive,
      userId,
    })

    return NextResponse.json({ schedule: updatedSchedules[0] })
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
    const session = await requireRole(['owner', 'admin'])
    if (session instanceof NextResponse) return session
    const userId = session.user.id
    const organizationId = session.user.organizationId
    const scheduleId = params.id

    // Get schedule to verify ownership
    const { rows: schedules } = await query(
      `SELECT organization_id FROM scheduled_reports WHERE id = $1`,
      [scheduleId]
    )

    if (schedules.length === 0) {
      throw new AppError('Schedule not found', 404)
    }

    if (schedules[0].organization_id !== organizationId) {
      throw new AppError('Unauthorized', 403)
    }

    // Delete schedule
    await query(
      `DELETE FROM scheduled_reports WHERE id = $1`,
      [scheduleId]
    )

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
