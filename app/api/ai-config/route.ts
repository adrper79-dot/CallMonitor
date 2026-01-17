/**
 * AI Agent Config API
 * GET/PUT /api/ai-config
 * 
 * Manage AI agent configuration for organization
 * Requires: Business or Enterprise plan for live translation features
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/supabaseAdmin'
import { AppError } from '@/lib/errors/AppError'
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/api/rateLimit'
import { writeAudit } from '@/lib/audit/auditLogger'

const rateLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
})

/**
 * GET /api/ai-config
 * Returns AI agent configuration for user's organization
 */
export async function GET(req: NextRequest) {
  try {
    await rateLimiter.check(req, 60)

    const user = await requireAuth(req)
    const userId = user.id

    // Get organization
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('org_members')
      .select('organization_id, organizations(id, name, plan)')
      .eq('user_id', userId)
      .single()

    if (membershipError || !membership) {
      throw new AppError('User is not part of an organization', 404, 'NO_ORGANIZATION')
    }

    const organizationId = membership.organization_id
    const org = membership.organizations as any

    // Get AI agent config from voice_configs
    const { data: config, error: configError } = await supabaseAdmin
      .from('voice_configs')
      .select(`
        ai_agent_id,
        ai_agent_prompt,
        ai_agent_temperature,
        ai_agent_model,
        ai_post_prompt_url,
        ai_features_enabled,
        translate_from,
        translate_to,
        live_translate,
        use_voice_cloning,
        cloned_voice_id
      `)
      .eq('organization_id', organizationId)
      .single()

    if (configError && configError.code !== 'PGRST116') {
      throw configError
    }

    // Return config with plan information
    return NextResponse.json({
      config: config || {
        ai_features_enabled: true,
        ai_agent_temperature: 0.3,
        ai_agent_model: 'gpt-4o-mini',
      },
      plan: org.plan || 'free',
      features_available: {
        live_translation: ['business', 'enterprise'].includes(org.plan?.toLowerCase() || ''),
        custom_agent_id: ['business', 'enterprise'].includes(org.plan?.toLowerCase() || ''),
        custom_prompts: ['enterprise'].includes(org.plan?.toLowerCase() || ''),
        voice_cloning: ['business', 'enterprise'].includes(org.plan?.toLowerCase() || ''),
      },
    })
  } catch (error: any) {
    logger.error('GET /api/ai-config failed', error)

    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    return NextResponse.json({ error: 'Failed to fetch AI config' }, { status: 500 })
  }
}

/**
 * PUT /api/ai-config
 * Updates AI agent configuration
 * Requires: owner or admin role
 */
export async function PUT(req: NextRequest) {
  try {
    await rateLimiter.check(req, 20)

    const user = await requireAuth(req)
    const userId = user.id

    // Parse request body
    const body = await req.json()
    const {
      ai_agent_id,
      ai_agent_prompt,
      ai_agent_temperature,
      ai_agent_model,
      ai_post_prompt_url,
      ai_features_enabled,
      translate_from,
      translate_to,
      live_translate,
      use_voice_cloning,
      cloned_voice_id,
    } = body

    // Get organization
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('org_members')
      .select('organization_id, role, organizations(id, name, plan)')
      .eq('user_id', userId)
      .single()

    if (membershipError || !membership) {
      throw new AppError('User is not part of an organization', 404, 'NO_ORGANIZATION')
    }

    const organizationId = membership.organization_id
    const org = membership.organizations as any

    // Check permissions
    await requireRole(userId, organizationId, ['owner', 'admin'])

    // Validate plan-based restrictions
    const plan = (org.plan || 'free').toLowerCase()
    const isBusinessOrEnterprise = ['business', 'enterprise'].includes(plan)
    const isEnterprise = plan === 'enterprise'

    // Validate features against plan
    if (live_translate && !isBusinessOrEnterprise) {
      throw new AppError('Live translation requires Business or Enterprise plan', 403, 'PLAN_UPGRADE_REQUIRED')
    }

    if (ai_agent_id && !isBusinessOrEnterprise) {
      throw new AppError('Custom AI agent requires Business or Enterprise plan', 403, 'PLAN_UPGRADE_REQUIRED')
    }

    if (ai_agent_prompt && !isEnterprise) {
      throw new AppError('Custom prompts require Enterprise plan', 403, 'PLAN_UPGRADE_REQUIRED')
    }

    if (use_voice_cloning && !isBusinessOrEnterprise) {
      throw new AppError('Voice cloning requires Business or Enterprise plan', 403, 'PLAN_UPGRADE_REQUIRED')
    }

    // Validate temperature
    if (ai_agent_temperature !== undefined && (ai_agent_temperature < 0 || ai_agent_temperature > 2)) {
      throw new AppError('Temperature must be between 0 and 2', 400, 'INVALID_TEMPERATURE')
    }

    // Validate model
    const validModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo']
    if (ai_agent_model && !validModels.includes(ai_agent_model)) {
      throw new AppError(`Model must be one of: ${validModels.join(', ')}`, 400, 'INVALID_MODEL')
    }

    // Validate live translation requires languages
    if (live_translate && (!translate_from || !translate_to)) {
      throw new AppError('Live translation requires translate_from and translate_to', 400, 'MISSING_LANGUAGES')
    }

    // Build update object (only include provided fields)
    const updateData: any = {
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }

    if (ai_agent_id !== undefined) updateData.ai_agent_id = ai_agent_id
    if (ai_agent_prompt !== undefined) updateData.ai_agent_prompt = ai_agent_prompt
    if (ai_agent_temperature !== undefined) updateData.ai_agent_temperature = ai_agent_temperature
    if (ai_agent_model !== undefined) updateData.ai_agent_model = ai_agent_model
    if (ai_post_prompt_url !== undefined) updateData.ai_post_prompt_url = ai_post_prompt_url
    if (ai_features_enabled !== undefined) updateData.ai_features_enabled = ai_features_enabled
    if (translate_from !== undefined) updateData.translate_from = translate_from
    if (translate_to !== undefined) updateData.translate_to = translate_to
    if (live_translate !== undefined) updateData.live_translate = live_translate
    if (use_voice_cloning !== undefined) updateData.use_voice_cloning = use_voice_cloning
    if (cloned_voice_id !== undefined) updateData.cloned_voice_id = cloned_voice_id

    // Update configuration
    const { data: updatedConfig, error: updateError } = await supabaseAdmin
      .from('voice_configs')
      .update(updateData)
      .eq('organization_id', organizationId)
      .select()
      .single()

    if (updateError) {
      logger.error('Failed to update AI config', updateError, { organizationId, userId })
      throw new AppError('Failed to update AI configuration', 500, 'UPDATE_FAILED', updateError)
    }

    // Log to audit trail
    await writeAudit('voice_configs', updatedConfig.id, 'ai_config_updated', {
      organization_id: organizationId,
      updated_by: userId,
      changes: Object.keys(updateData).filter(k => k !== 'updated_by' && k !== 'updated_at'),
    })

    logger.info('AI config updated', { organizationId, userId, changes: Object.keys(updateData) })

    return NextResponse.json({
      success: true,
      config: updatedConfig,
    })
  } catch (error: any) {
    logger.error('PUT /api/ai-config failed', error)

    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    return NextResponse.json({ error: 'Failed to update AI config' }, { status: 500 })
  }
}
