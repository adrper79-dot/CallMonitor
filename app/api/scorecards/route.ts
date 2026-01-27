import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireAuth, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const { data, error } = await supabaseAdmin
      .from('scorecards')
      .select('id,name,description,structure,created_at')
      .eq('organization_id', ctx.orgId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
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

    const { data: orgRows, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .select('tool_id')
      .eq('id', ctx.orgId)
      .limit(1)

    if (orgErr || !orgRows?.[0]?.tool_id) {
      return Errors.internal(new Error('Organization tool_id not found'))
    }

    const { error } = await supabaseAdmin.from('scorecards').insert({
      organization_id: ctx.orgId,
      name,
      description,
      structure,
      tool_id: orgRows[0].tool_id,
      created_by: ctx.userId,
      is_template: false
    })

    if (error) throw error
    return success({ ok: true })
  } catch (err: any) {
    logger.error('POST /api/scorecards error', err)
    return Errors.internal(err)
  }
}
