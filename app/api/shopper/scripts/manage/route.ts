import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'
import { requireRole, requireAuth, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/shopper/scripts/manage - Create or update a secret shopper script
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRole(['owner', 'admin'])
    if (ctx instanceof NextResponse) return ctx

    const body = await req.json()
    const {
      id, organization_id, name, description, script_text, persona = 'professional',
      tts_provider = 'signalwire', tts_voice = 'rime.spore', elevenlabs_voice_id,
      expected_outcomes = [], scoring_weights = {}, is_active = true
    } = body

    if (!organization_id || !name || !script_text) {
      return Errors.badRequest('organization_id, name, and script_text are required')
    }

    if (organization_id !== ctx.orgId) {
      return Errors.unauthorized()
    }

    const scriptData: any = {
      organization_id, name, description, script_text, persona,
      tts_provider, tts_voice, expected_outcomes, scoring_weights,
      is_active, updated_at: new Date().toISOString()
    }

    if (elevenlabs_voice_id) scriptData.elevenlabs_voice_id = elevenlabs_voice_id

    let script
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('shopper_scripts')
        .update(scriptData)
        .eq('id', id)
        .eq('organization_id', organization_id)
        .select()
        .single()

      if (error) {
        logger.error('Update script error', error)
        return Errors.internal(error)
      }
      script = data
    } else {
      scriptData.id = uuidv4()
      scriptData.created_by = ctx.userId
      scriptData.created_at = new Date().toISOString()

      const { data, error } = await supabaseAdmin
        .from('shopper_scripts')
        .insert(scriptData)
        .select()
        .single()

      if (error) {
        logger.error('Create script error', error)
        return Errors.internal(error)
      }
      script = data
    }

    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(), organization_id, user_id: ctx.userId,
        resource_type: 'shopper_scripts', resource_id: script.id,
        action: id ? 'update' : 'create', before: null,
        after: { name, persona, tts_provider }, created_at: new Date().toISOString()
      })
    } catch { /* Best effort */ }

    return NextResponse.json({ success: true, script }, { status: id ? 200 : 201 })
  } catch (error: any) {
    logger.error('Shopper script manage error', error)
    return Errors.internal(error)
  }
}

/**
 * GET /api/shopper/scripts/manage - List all shopper scripts
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const { data: scripts, error } = await supabaseAdmin
      .from('shopper_scripts')
      .select('*')
      .eq('organization_id', ctx.orgId)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Fetch scripts error', error)
      return Errors.internal(error)
    }

    return success({ scripts: scripts || [] })
  } catch (error: any) {
    logger.error('Shopper script list error', error)
    return Errors.internal(error)
  }
}

/**
 * DELETE /api/shopper/scripts/manage - Delete a shopper script
 */
export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireRole(['owner', 'admin'])
    if (ctx instanceof NextResponse) return ctx

    const url = new URL(req.url)
    const scriptId = url.searchParams.get('id')

    if (!scriptId) {
      return Errors.badRequest('id required')
    }

    const { error } = await supabaseAdmin
      .from('shopper_scripts')
      .delete()
      .eq('id', scriptId)
      .eq('organization_id', ctx.orgId)

    if (error) {
      logger.error('Delete script error', error)
      return Errors.internal(error)
    }

    return success({ message: 'Script deleted' })
  } catch (error: any) {
    logger.error('Shopper script delete error', error)
    return Errors.internal(error)
  }
}
