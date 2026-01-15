import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

// Force dynamic rendering - uses headers via getServerSession
export const dynamic = 'force-dynamic'

async function handleGET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const orgId = searchParams.get('orgId')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    let query = (supabaseAdmin as any)
      .from('calls')
      .select('id,organization_id,system_id,status,started_at,ended_at,created_by,call_sid', { count: 'exact' })
      .eq('organization_id', orgId)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && status !== 'all') {
      if (status === 'active') {
        query = query.in('status', ['in_progress', 'ringing'])
      } else {
        query = query.eq('status', status)
      }
    }

    const { data, error, count } = await query

    // If table doesn't exist (42P01 error), return empty array instead of failing
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        logger.info('calls table does not exist yet, returning empty array', { orgId })
        return NextResponse.json({
          success: true,
          calls: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        })
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      calls: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (err: any) {
    logger.error('GET /api/calls error', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch calls' },
      { status: 500 }
    )
  }
}

// Apply rate limiting: 100 requests per minute per IP (generous for dashboard polling)
export const GET = withRateLimit(handleGET as any, {
  identifier: (req) => getClientIP(req),
  config: {
    maxAttempts: 100,
    windowMs: 60 * 1000, // 1 minute
    blockMs: 5 * 60 * 1000 // 5 minute block on abuse
  }
})
