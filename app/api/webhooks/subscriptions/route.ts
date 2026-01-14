/**
 * Webhook Subscriptions API
 * 
 * GET /api/webhooks/subscriptions - List all webhook subscriptions
 * POST /api/webhooks/subscriptions - Create a new webhook subscription
 * 
 * Per MASTER_ARCHITECTURE: Webhooks enable BYO integrations
 * Events are: call.*, recording.*, transcript.*, survey.*, scorecard.*
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { WebhookEventType, WEBHOOK_EVENT_TYPES, WebhookRetryPolicy } from '@/types/tier1-features'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * Generate a secure webhook secret
 */
function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * GET /api/webhooks/subscriptions
 * List all webhook subscriptions for the organization
 */
export async function GET(request: NextRequest) {
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
    
    // Only owners and admins can view webhooks
    if (!['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners and admins can manage webhooks' } },
        { status: 403 }
      )
    }
    
    // Get subscriptions
    const { data: subscriptions, error: fetchError } = await supabaseAdmin
      .from('webhook_subscriptions')
      .select('*')
      .eq('organization_id', member.organization_id)
      .order('created_at', { ascending: false })
    
    if (fetchError) {
      console.error('[webhooks GET] Error:', fetchError)
      return NextResponse.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch subscriptions' } },
        { status: 500 }
      )
    }
    
    // Mask secrets (show only last 4 chars)
    const maskedSubscriptions = subscriptions?.map(sub => ({
      ...sub,
      secret: `whsec_...${sub.secret.slice(-4)}`
    }))
    
    return NextResponse.json({
      success: true,
      subscriptions: maskedSubscriptions || []
    })
  } catch (error: any) {
    console.error('[webhooks GET] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/webhooks/subscriptions
 * Create a new webhook subscription
 */
export async function POST(request: NextRequest) {
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
    
    // Parse request body
    const body = await request.json()
    const { 
      name, 
      url, 
      events, 
      headers = {}, 
      retry_policy = 'exponential',
      max_retries = 5,
      timeout_ms = 30000
    } = body
    
    // Validate required fields
    if (!name || typeof name !== 'string' || name.length < 1 || name.length > 100) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NAME', message: 'Name is required (1-100 characters)' } },
        { status: 400 }
      )
    }
    
    if (!url || !isValidUrl(url)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_URL', message: 'Valid HTTPS URL is required' } },
        { status: 400 }
      )
    }
    
    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'EVENTS_REQUIRED', message: 'At least one event type is required' } },
        { status: 400 }
      )
    }
    
    // Validate event types
    const invalidEvents = events.filter((e: string) => !WEBHOOK_EVENT_TYPES.includes(e as WebhookEventType))
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_EVENTS', 
            message: `Invalid events: ${invalidEvents.join(', ')}` 
          } 
        },
        { status: 400 }
      )
    }
    
    // Validate retry policy
    if (!['none', 'fixed', 'exponential'].includes(retry_policy)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_RETRY_POLICY', message: 'Invalid retry policy' } },
        { status: 400 }
      )
    }
    
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
    
    // Only owners and admins can create webhooks
    if (!['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners and admins can create webhooks' } },
        { status: 403 }
      )
    }
    
    // Check feature flag
    const { data: featureFlag } = await supabaseAdmin
      .from('org_feature_flags')
      .select('enabled')
      .eq('organization_id', member.organization_id)
      .eq('feature', 'webhooks')
      .single()
    
    if (featureFlag?.enabled === false) {
      return NextResponse.json(
        { success: false, error: { code: 'FEATURE_DISABLED', message: 'Webhooks are disabled for this organization' } },
        { status: 403 }
      )
    }
    
    // Generate webhook secret
    const secret = generateWebhookSecret()
    
    // Create subscription
    const { data: subscription, error: insertError } = await supabaseAdmin
      .from('webhook_subscriptions')
      .insert({
        organization_id: member.organization_id,
        name,
        url,
        secret,
        events,
        headers: headers || {},
        retry_policy,
        max_retries: Math.min(max_retries, 10),  // Cap at 10
        timeout_ms: Math.min(timeout_ms, 60000),  // Cap at 60s
        created_by: userId
      })
      .select()
      .single()
    
    if (insertError) {
      // Handle duplicate URL error
      if (insertError.code === '23505') {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_URL', message: 'A webhook for this URL already exists' } },
          { status: 409 }
        )
      }
      
      console.error('[webhooks POST] Insert error:', insertError)
      return NextResponse.json(
        { success: false, error: { code: 'CREATE_FAILED', message: 'Failed to create webhook' } },
        { status: 500 }
      )
    }
    
    // Log to audit
    await supabaseAdmin.from('audit_logs').insert({
      id: crypto.randomUUID(),
      organization_id: member.organization_id,
      user_id: userId,
      resource_type: 'webhook_subscription',
      resource_id: subscription.id,
      action: 'create',
      after: { name, url, events }
    }).catch(err => console.error('[webhooks POST] Audit log error:', err))
    
    return NextResponse.json({
      success: true,
      subscription: {
        ...subscription,
        // Return full secret only on creation
        secret: subscription.secret
      },
      message: 'Webhook created. Save the secret - it will not be shown again.'
    }, { status: 201 })
  } catch (error: any) {
    console.error('[webhooks POST] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
