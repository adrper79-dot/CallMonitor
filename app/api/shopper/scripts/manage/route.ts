import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * POST /api/shopper/scripts/manage
 * 
 * Create or update a secret shopper script
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const {
      id,  // If provided, update existing
      organization_id,
      name,
      description,
      script_text,
      persona = 'professional',
      tts_provider = 'signalwire',
      tts_voice = 'rime.spore',
      elevenlabs_voice_id,
      expected_outcomes = [],
      scoring_weights = {},
      is_active = true
    } = body

    if (!organization_id || !name || !script_text) {
      return NextResponse.json(
        { success: false, error: 'organization_id, name, and script_text are required' },
        { status: 400 }
      )
    }

    // Verify user belongs to organization
    const { data: memberRows } = await supabaseAdmin
      .from('org_members')
      .select('role')
      .eq('organization_id', organization_id)
      .eq('user_id', userId)
      .limit(1)

    if (!memberRows?.[0]) {
      return NextResponse.json(
        { success: false, error: 'Not authorized for this organization' },
        { status: 403 }
      )
    }

    const role = memberRows[0].role
    if (!['owner', 'admin'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Only owners and admins can manage scripts' },
        { status: 403 }
      )
    }

    // Prepare script data
    const scriptData: any = {
      organization_id,
      name,
      description,
      script_text,
      persona,
      tts_provider,
      tts_voice,
      expected_outcomes,
      scoring_weights,
      is_active,
      updated_at: new Date().toISOString()
    }

    if (elevenlabs_voice_id) {
      scriptData.elevenlabs_voice_id = elevenlabs_voice_id
    }

    let script
    if (id) {
      // Update existing script
      const { data, error } = await supabaseAdmin
        .from('shopper_scripts')
        .update(scriptData)
        .eq('id', id)
        .eq('organization_id', organization_id)
        .select()
        .single()

      if (error) {
        console.error('Update script error:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to update script' },
          { status: 500 }
        )
      }
      script = data
    } else {
      // Create new script
      scriptData.id = uuidv4()
      scriptData.created_by = userId
      scriptData.created_at = new Date().toISOString()

      const { data, error } = await supabaseAdmin
        .from('shopper_scripts')
        .insert(scriptData)
        .select()
        .single()

      if (error) {
        console.error('Create script error:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to create script' },
          { status: 500 }
        )
      }
      script = data
    }

    // Audit log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(),
        organization_id,
        user_id: userId,
        resource_type: 'shopper_scripts',
        resource_id: script.id,
        action: id ? 'update' : 'create',
        before: null,
        after: { name, persona, tts_provider },
        created_at: new Date().toISOString()
      })
    } catch {}

    return NextResponse.json({
      success: true,
      script
    }, { status: id ? 200 : 201 })
  } catch (error: any) {
    console.error('Shopper script manage error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/shopper/scripts/manage
 * 
 * List all shopper scripts for an organization
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const url = new URL(req.url)
    const organizationId = url.searchParams.get('orgId') || url.searchParams.get('organization_id')

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'organization_id required' },
        { status: 400 }
      )
    }

    // Verify user belongs to organization
    const { data: memberRows } = await supabaseAdmin
      .from('org_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .limit(1)

    if (!memberRows?.[0]) {
      return NextResponse.json(
        { success: false, error: 'Not authorized for this organization' },
        { status: 403 }
      )
    }

    // Fetch scripts
    const { data: scripts, error } = await supabaseAdmin
      .from('shopper_scripts')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Fetch scripts error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch scripts' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      scripts: scripts || []
    })
  } catch (error: any) {
    console.error('Shopper script list error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/shopper/scripts/manage
 * 
 * Delete a shopper script
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const url = new URL(req.url)
    const scriptId = url.searchParams.get('id')
    const organizationId = url.searchParams.get('orgId')

    if (!scriptId || !organizationId) {
      return NextResponse.json(
        { success: false, error: 'id and orgId required' },
        { status: 400 }
      )
    }

    // Verify user is owner/admin
    const { data: memberRows } = await supabaseAdmin
      .from('org_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .limit(1)

    if (!memberRows?.[0] || !['owner', 'admin'].includes(memberRows[0].role)) {
      return NextResponse.json(
        { success: false, error: 'Only owners and admins can delete scripts' },
        { status: 403 }
      )
    }

    // Delete script
    const { error } = await supabaseAdmin
      .from('shopper_scripts')
      .delete()
      .eq('id', scriptId)
      .eq('organization_id', organizationId)

    if (error) {
      console.error('Delete script error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete script' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Shopper script delete error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
