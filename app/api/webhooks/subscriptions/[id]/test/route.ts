/**
 * Webhook Test API
 * 
 * POST /api/webhooks/subscriptions/[id]/test - Send a test webhook event
 * 
 * Purpose: Let users verify their endpoint receives webhooks correctly
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/subscriptions/[id]/test
 * Send a test webhook event
 */
export async function POST(
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
    
    // Get user's organization and verify admin role
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
    
    // Only owners and admins can test webhooks
    if (!['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners and admins can test webhooks' } },
        { status: 403 }
      )
    }
    
    // Verify webhook exists and belongs to organization
    const { data: webhook, error: fetchError } = await supabaseAdmin
      .from('webhook_subscriptions')
      .select('*')
      .eq('id', webhookId)
      .eq('organization_id', member.organization_id)
      .single()
    
    if (fetchError || !webhook) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
        { status: 404 }
      )
    }
    
    // Generate test event ID
    const testEventId = `test-${crypto.randomUUID()}`
    
    // Create test payload
    const testPayload = {
      event: 'call.completed',
      event_id: testEventId,
      timestamp: new Date().toISOString(),
      organization_id: member.organization_id,
      data: {
        call_id: 'test-call-id',
        status: 'completed',
        duration: 120,
        from: '+15551234567',
        to: '+15557654321',
        direction: 'outbound',
        _test: true  // Flag as test event
      }
    }
    
    // Queue test delivery
    const { data: delivery, error: insertError } = await supabaseAdmin
      .from('webhook_deliveries')
      .insert({
        subscription_id: webhookId,
        event_type: 'call.completed',
        event_id: testEventId,
        payload: testPayload,
        status: 'pending',
        max_attempts: webhook.max_retries + 1
      })
      .select()
      .single()
    
    if (insertError) {
      console.error('[webhook test] Insert error:', insertError)
      return NextResponse.json(
        { success: false, error: { code: 'QUEUE_FAILED', message: 'Failed to queue test webhook' } },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      delivery: {
        id: delivery.id,
        status: 'pending',
        message: 'Test webhook queued. Check your endpoint for delivery.'
      }
    })
  } catch (error: any) {
    console.error('[webhook test] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
