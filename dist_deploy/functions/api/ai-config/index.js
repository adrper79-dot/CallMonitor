import { neon } from '@neondatabase/serverless'

export async function onRequestGet({ request, env }) {
  const sql = neon(env.NEON_CONNECTION_STRING)

  try {
    // TODO: Implement authentication and role check
    // const session = await requireRole('viewer')
    // const userId = session.user.id

    // For now, return default config
    const defaultConfig = {
      ai_features_enabled: true,
      ai_agent_temperature: 0.3,
      ai_agent_model: 'gpt-4o-mini',
    }

    const plan = 'free' // placeholder

    const features_available = {
      live_translation: false, // requires business/enterprise
      custom_agent_id: false,
      custom_prompts: false,
      voice_cloning: false,
    }

    return new Response(JSON.stringify({
      config: defaultConfig,
      plan,
      features_available,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('GET /api/ai-config failed', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch AI config' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export async function onRequestPut({ request, env }) {
  const sql = neon(env.NEON_CONNECTION_STRING)

  try {
    // TODO: Implement authentication and role check
    // const session = await requireRole(['owner', 'admin'])
    // const userId = session.user.id

    const body = await request.json()
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

    // Placeholder values
    const organizationId = 'placeholder-org-id'
    const userId = 'placeholder-user-id'
    const plan = 'free'

    // TODO: Validate plan-based restrictions
    // const isBusinessOrEnterprise = ['business', 'enterprise'].includes(plan)
    // const isEnterprise = plan === 'enterprise'
    // Validate features against plan...

    // TODO: Validate temperature, model, etc.

    // Build update object
    const updateData = {}
    if (ai_agent_id !== undefined) updateData.ai_agent_id = ai_agent_id
    if (ai_agent_prompt !== undefined) updateData.ai_agent_prompt = ai_agent_prompt
    if (ai_agent_temperature !== undefined) updateData.ai_agent_temperature = ai_agent_temperature
    if (ai_agent_model !== undefined) updateData.ai_agent_model = ai_agent_model
    if (ai_post_prompt_url !== undefined) updateData.ai_post_prompt_url = ai_post_prompt_url
    if (ai_features_enabled !== undefined) updateData.ai_features_enabled = ai_features_enabled
    if (translate_from !== undefined) updateData.translation_from = translate_from
    if (translate_to !== undefined) updateData.translation_to = translate_to
    if (live_translate !== undefined) updateData.live_translate = live_translate
    if (use_voice_cloning !== undefined) updateData.use_voice_cloning = use_voice_cloning
    if (cloned_voice_id !== undefined) updateData.cloned_voice_id = cloned_voice_id

    updateData.updated_by = userId
    updateData.updated_at = new Date().toISOString()

    // Update configuration
    const result = await sql`
      UPDATE voice_configs
      SET ${sql(updateData)}
      WHERE organization_id = ${organizationId}
      RETURNING *
    `

    if (result.length === 0) {
      return new Response(JSON.stringify({ error: 'Configuration not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const updatedConfig = result[0]

    // Log to audit trail
    await sql`
      INSERT INTO audit_logs (
        id, organization_id, user_id, resource_type, resource_id, action,
        actor_type, actor_label, after, created_at
      ) VALUES (
        gen_random_uuid(), ${organizationId}, ${userId}, 'voice_configs', ${updatedConfig.id}, 'ai_config_updated',
        'human', 'USER_ACTION', ${JSON.stringify({
          event_type: 'USER_ACTION',
          status: 'success',
          metadata: {
            organization_id: organizationId,
            updated_by: userId,
            changes: Object.keys(updateData).filter(k => k !== 'updated_by' && k !== 'updated_at')
          }
        })}, now()
      )
    `

    return new Response(JSON.stringify({
      success: true,
      config: updatedConfig,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('PUT /api/ai-config failed', error)
    return new Response(JSON.stringify({ error: 'Failed to update AI config' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}