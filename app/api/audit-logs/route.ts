import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'

// Force dynamic rendering - uses headers via getServerSession
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const orgId = searchParams.get('orgId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const resourceType = searchParams.get('resourceType')

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    let query = (supabaseAdmin as any)
      .from('audit_logs')
      .select('id,organization_id,user_id,system_id,resource_type,resource_id,action,before,after,created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (resourceType) {
      query = query.eq('resource_type', resourceType)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    // Transform audit logs into activity events
    const events = (data || []).map((log: any) => ({
      id: log.id,
      call_id: log.resource_type === 'call' ? log.resource_id : undefined,
      timestamp: log.created_at,
      type: `${log.resource_type}.${log.action}`,
      title: `${log.resource_type} ${log.action}`,
      status: log.action === 'error' ? 'error' : log.action === 'failed' ? 'error' : 'info',
    }))

    return NextResponse.json({
      success: true,
      events,
    })
  } catch (err: any) {
    console.error('GET /api/audit-logs error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}
