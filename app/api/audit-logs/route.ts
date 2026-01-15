import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireAuth, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const searchParams = req.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const resourceType = searchParams.get('resourceType')

    let query = supabaseAdmin
      .from('audit_logs')
      .select('id,organization_id,user_id,system_id,resource_type,resource_id,action,before,after,created_at')
      .eq('organization_id', ctx.orgId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (resourceType) query = query.eq('resource_type', resourceType)

    const { data, error } = await query

    // If table doesn't exist (42P01 error), return empty array instead of failing
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        logger.info('audit_logs table does not exist yet, returning empty array')
        return success({ events: [] })
      }
      throw error
    }

    const events = (data || []).map((log: any) => ({
      id: log.id, call_id: log.resource_type === 'call' ? log.resource_id : undefined,
      timestamp: log.created_at, type: `${log.resource_type}.${log.action}`,
      title: `${log.resource_type} ${log.action}`,
      status: log.action === 'error' ? 'error' : log.action === 'failed' ? 'error' : 'info'
    }))

    return success({ events })
  } catch (err: any) {
    logger.error('GET /api/audit-logs error', err)
    return Errors.internal(err)
  }
}
