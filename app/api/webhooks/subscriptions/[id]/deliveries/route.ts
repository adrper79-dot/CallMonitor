/**
 * Webhook Delivery Logs API
 * 
 * GET /api/webhooks/subscriptions/[id]/deliveries - Get delivery logs for a webhook
 * 
 * Query params:
 * - limit (default 50, max 100)
 * - offset (pagination)
 * - status (filter: pending|delivered|failed|retrying)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/webhooks/subscriptions/[id]/deliveries
 * Get delivery logs for a specific webhook
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }
    
    const webhookId = params.id
    
    // Get user's organization and verify access
    const { data: member, error: memberError } = await supabaseAdmin
      .from('org_members')
      .select('organization_id, role')
      .eq('user_id', userId)
      .single()
    
    if (memberError || !member) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization membership not found' } },
        { status: 403 }
      )
    }
    
    // Only owners and admins can view delivery logs
    if (!['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners and admins can view delivery logs' } },
        { status: 403 }
      )
    }
    
    // Verify webhook exists and belongs to organization
    const { data: webhook, error: fetchError } = await supabaseAdmin
      .from('webhook_subscriptions')
      .select('id')
      .eq('id', webhookId)
      .eq('organization_id', member.organization_id)
      .single()
    
    if (fetchError || !webhook) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
        { status: 404 }
      )
    }
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const statusFilter = searchParams.get('status')
    
    // Build query
    let query = supabaseAdmin
      .from('webhook_deliveries')
      .select('*', { count: 'exact' })
      .eq('subscription_id', webhookId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    // Apply status filter if provided
    if (statusFilter && ['pending', 'processing', 'delivered', 'failed', 'retrying'].includes(statusFilter)) {
      query = query.eq('status', statusFilter)
    }
    
    const { data: deliveries, error: deliveriesError, count } = await query
    
    if (deliveriesError) {
      console.error('[deliveries GET] Error:', deliveriesError)
      return NextResponse.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch deliveries' } },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      deliveries: deliveries || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: count ? offset + limit < count : false
      }
    })
  } catch (error: any) {
    console.error('[deliveries GET] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
