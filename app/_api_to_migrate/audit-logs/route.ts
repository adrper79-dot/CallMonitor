import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole, success, Errors } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRole(['owner', 'admin', 'viewer'])
    if (ctx instanceof NextResponse) return ctx

    const searchParams = req.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const resourceType = searchParams.get('resourceType')

    const conditions: string[] = [`organization_id = $1`]
    const params: any[] = [ctx.orgId]

    if (resourceType) {
      conditions.push(`resource_type = $${params.length + 1}`)
      params.push(resourceType)
    }

    const { rows: logs } = await query(
      `SELECT id, organization_id, user_id, system_id, resource_type, resource_id, action, before, after, created_at
       FROM audit_logs
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT ${limit}`, // Limit is safe to inject if parsed as int, but let's use param for consistency
      params
    )

    // Note: If table doesn't exist, pgClient throws error. 
    // We'll wrap in specific try/catch if we expect it to define "logs" as [], 
    // but in production tables should exist. Handled by generic catch.

    const events = (logs || []).map((log: any) => ({
      id: log.id,
      call_id: log.resource_type === 'call' ? log.resource_id : undefined,
      timestamp: log.created_at,
      type: `${log.resource_type}.${log.action}`,
      title: `${log.resource_type} ${log.action}`,
      status: log.action === 'error' ? 'error' : log.action === 'failed' ? 'error' : 'info'
    }))

    return success({ events })
  } catch (err: any) {
    logger.error('GET /api/audit-logs error', err)

    // Check for "relation does not exist" error (Postgres code 42P01)
    if (err.code === '42P01') {
      logger.info('audit_logs table does not exist yet, returning empty array')
      return success({ events: [] })
    }

    return Errors.internal(err instanceof Error ? err : new Error('Failed to fetch audit logs'))
  }
}
