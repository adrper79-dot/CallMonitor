import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireAuth, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const { rows: data } = await query(
      `SELECT id, name, description, structure, created_at 
       FROM scorecards 
       WHERE organization_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [ctx.orgId]
    )

    return success({ scorecards: data || [] })
  } catch (err: any) {
    logger.error('GET /api/scorecards error', err)
    return Errors.internal(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const body = await req.json()
    const name = String(body?.name || '').trim()
    const description = String(body?.description || '').trim()
    const structure = body?.structure

    if (!name || !structure?.criteria?.length) {
      return Errors.badRequest('Scorecard name and criteria are required')
    }

    const { rows: orgRows } = await query(
      `SELECT tool_id FROM organizations WHERE id = $1 LIMIT 1`,
      [ctx.orgId]
    )

    if (!orgRows?.[0]?.tool_id) {
      return Errors.internal(new Error('Organization tool_id not found'))
    }

    const scorecardId = uuidv4()
    await query(
      `INSERT INTO scorecards (id, organization_id, name, description, structure, tool_id, created_by, is_template)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        scorecardId,
        ctx.orgId,
        name,
        description,
        JSON.stringify(structure),
        orgRows[0].tool_id,
        ctx.userId,
        false
      ]
    )

    return success({ ok: true, id: scorecardId })
  } catch (err: any) {
    logger.error('POST /api/scorecards error', err)
    return Errors.internal(err)
  }
}
