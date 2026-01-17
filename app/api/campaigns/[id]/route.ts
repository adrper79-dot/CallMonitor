/**
 * Campaign Detail API
 * 
 * Endpoints for individual campaign operations
 * RBAC: Owner/Admin can manage, all can view
 * 
 * GET /api/campaigns/[id] - Get campaign details
 * PATCH /api/campaigns/[id] - Update campaign
 * DELETE /api/campaigns/[id] - Delete campaign
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireRole } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

/**
 * GET /api/campaigns/[id]
 * Get campaign details with call stats
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const campaignId = params.id

    // Get user's organization
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .single()

    if (userError || !user?.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get campaign with creator info
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select(`
        *,
        created_by:users!campaigns_created_by_fkey(id, name, email),
        caller_id:caller_ids(id, phone_number),
        script:shopper_scripts(id, name),
        survey:surveys(id, name)
      `)
      .eq('id', campaignId)
      .eq('organization_id', user.organization_id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get campaign calls summary
    const { data: calls, error: callsError } = await supabaseAdmin
      .from('campaign_calls')
      .select('status, outcome, duration_seconds')
      .eq('campaign_id', campaignId)

    const callStats = {
      total: calls?.length || 0,
      pending: calls?.filter(c => c.status === 'pending').length || 0,
      calling: calls?.filter(c => c.status === 'calling').length || 0,
      completed: calls?.filter(c => c.status === 'completed').length || 0,
      failed: calls?.filter(c => c.status === 'failed').length || 0,
      answered: calls?.filter(c => c.outcome === 'answered').length || 0,
      no_answer: calls?.filter(c => c.outcome === 'no_answer').length || 0,
      avg_duration: (calls?.filter(c => c.duration_seconds) || [])
        .reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / 
        (calls?.filter(c => c.duration_seconds).length || 1)
    }

    return NextResponse.json({ 
      campaign: {
        ...campaign,
        call_stats: callStats
      }
    })
  } catch (error) {
    console.error('Error in GET /api/campaigns/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/campaigns/[id]
 * Update campaign (name, description, status, schedule)
 * RBAC: Owner/Admin only
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const campaignId = params.id

    // Get user's organization and role
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('organization_id, role')
      .eq('id', userId)
      .single()

    if (userError || !user?.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Check RBAC
    await requireRole(['owner', 'admin'])

    // Get existing campaign
    const { data: existingCampaign, error: fetchError } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('organization_id', user.organization_id)
      .single()

    if (fetchError || !existingCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      description,
      status,
      scheduled_at,
      recurring_pattern,
      call_config
    } = body

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      draft: ['scheduled', 'active', 'canceled'],
      scheduled: ['active', 'paused', 'canceled'],
      active: ['paused', 'completed', 'canceled'],
      paused: ['active', 'canceled'],
      completed: [],
      canceled: []
    }

    if (status && !validTransitions[existingCampaign.status]?.includes(status)) {
      return NextResponse.json({ 
        error: `Invalid status transition from ${existingCampaign.status} to ${status}` 
      }, { status: 400 })
    }

    // Build update object
    const updates: any = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (status !== undefined) {
      updates.status = status
      if (status === 'active' && !existingCampaign.started_at) {
        updates.started_at = new Date().toISOString()
      }
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString()
      }
    }
    if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at
    if (recurring_pattern !== undefined) updates.recurring_pattern = recurring_pattern
    if (call_config !== undefined) updates.call_config = call_config

    // Update campaign
    const { data: campaign, error: updateError } = await supabaseAdmin
      .from('campaigns')
      .update(updates)
      .eq('id', campaignId)
      .eq('organization_id', user.organization_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating campaign:', updateError)
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
    }

    // Log audit event
    await supabaseAdmin.from('campaign_audit_log').insert({
      campaign_id: campaignId,
      user_id: userId,
      action: 'updated',
      changes: { before: existingCampaign, after: campaign }
    })

    return NextResponse.json({ campaign })
  } catch (error) {
    console.error('Error in PATCH /api/campaigns/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/campaigns/[id]
 * Delete campaign (soft delete by setting status to canceled)
 * RBAC: Owner/Admin only
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const campaignId = params.id

    // Get user's organization and role
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('organization_id, role')
      .eq('id', userId)
      .single()

    if (userError || !user?.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Check RBAC
    await requireRole(['owner', 'admin'])

    // Get existing campaign
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from('campaigns')
      .select('status')
      .eq('id', campaignId)
      .eq('organization_id', user.organization_id)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Can only delete draft or completed campaigns
    // Active campaigns must be canceled first
    if (!['draft', 'completed', 'canceled'].includes(campaign.status)) {
      return NextResponse.json({ 
        error: 'Can only delete draft, completed, or canceled campaigns. Please cancel active campaigns first.' 
      }, { status: 400 })
    }

    // Hard delete campaign (cascades to campaign_calls and campaign_audit_log)
    const { error: deleteError } = await supabaseAdmin
      .from('campaigns')
      .delete()
      .eq('id', campaignId)
      .eq('organization_id', user.organization_id)

    if (deleteError) {
      console.error('Error deleting campaign:', deleteError)
      return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error in DELETE /api/campaigns/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
