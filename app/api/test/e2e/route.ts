import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import pgClient from '@/lib/pgClient'
import startCallHandler from '@/app/actions/calls/startCallHandler'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * E2E Test Endpoint - Service-to-Service Authentication
 * 
 * This endpoint allows authenticated E2E testing without browser session.
 * Requires SERVICE_API_KEY environment variable to be set.
 * 
 * POST /api/test/e2e
 * Headers: X-Service-Key: <SERVICE_API_KEY>
 * 
 * Body:
 * {
 *   "action": "create_target" | "create_survey" | "update_config" | "execute_call" | "full_pipeline",
 *   "organization_id": "uuid",
 *   "params": { ... action-specific params ... }
 * }
 */

export async function POST(req: Request) {
  try {
    // Check service key authentication
    const serviceKey = req.headers.get('X-Service-Key') || req.headers.get('x-service-key')
    const expectedKey = process.env.SERVICE_API_KEY

    if (!expectedKey) {
      return NextResponse.json({
        success: false,
        error: 'SERVICE_API_KEY not configured. Set it in Vercel environment variables.'
      }, { status: 500 })
    }

    if (!serviceKey || serviceKey !== expectedKey) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or missing service key. Pass X-Service-Key header.'
      }, { status: 401 })
    }

    const body = await req.json()
    const { action, organization_id, params = {} } = body

    if (!organization_id) {
      return NextResponse.json({
        success: false,
        error: 'organization_id is required'
      }, { status: 400 })
    }

    // Verify organization exists
    const orgRes = await pgClient.query(`SELECT id, name, plan FROM organizations WHERE id = $1 LIMIT 1`, [organization_id])
    const org = orgRes?.rows && orgRes.rows.length ? orgRes.rows[0] : null
    if (!org) {
      return NextResponse.json({
        success: false,
        error: `Organization not found: ${organization_id}`
      }, { status: 404 })
    }

    // Get a user from this org for operations
    const membersRes = await pgClient.query(`SELECT user_id, role FROM org_members WHERE organization_id = $1 AND role = $2 LIMIT 1`, [organization_id, 'owner'])
    const members = membersRes?.rows || []
    const ownerId = members?.[0]?.user_id

    const results: any = {
      organization: { id: org.id, name: org.name, plan: org.plan },
      actions: []
    }

    // Handle different actions
    switch (action) {
      case 'create_target': {
        const { phone_number, name, description } = params
        if (!phone_number) {
          return NextResponse.json({ success: false, error: 'phone_number required' }, { status: 400 })
        }

        const targetId = uuidv4()
        try {
          await pgClient.query(`INSERT INTO voice_targets (id, organization_id, phone_number, name, description, is_active, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [targetId, organization_id, phone_number, name || 'E2E Test Target', description || `Created via E2E test at ${new Date().toISOString()}`, true, new Date().toISOString()])
          results.actions.push({ action: 'create_target', success: true, target: { id: targetId } })
          results.target_id = targetId
        } catch (err: any) {
          results.actions.push({ action: 'create_target', success: false, error: err?.message || String(err) })
        }
        break
      }

      case 'create_survey': {
        const { name, questions } = params
        const surveyId = uuidv4()
        try {
          await pgClient.query(`INSERT INTO surveys (id, organization_id, name, questions, is_active, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [surveyId, organization_id, name || 'E2E Test Survey', questions || [{ type: 'scale', question: 'How satisfied were you? (1-5)', min: 1, max: 5 }, { type: 'yes_no', question: 'Would you recommend us?' }, { type: 'text', question: 'Any additional feedback?' }], true, new Date().toISOString(), new Date().toISOString()])
          results.actions.push({ action: 'create_survey', success: true, survey: { id: surveyId } })
          results.survey_id = surveyId
        } catch (err: any) {
          results.actions.push({ action: 'create_survey', success: false, error: err?.message || String(err) })
        }
        break
      }

      case 'update_config': {
        const { modulations } = params

        // Check if config exists
        const existingRes = await pgClient.query(`SELECT * FROM voice_configs WHERE organization_id = $1 LIMIT 1`, [organization_id])
        const existing = existingRes?.rows || []
        const configPayload = {
          record: modulations?.record ?? true,
          transcribe: modulations?.transcribe ?? true,
          translate: modulations?.translate ?? false,
          translate_from: modulations?.translate_from || null,
          translate_to: modulations?.translate_to || null,
          survey: modulations?.survey ?? false,
          updated_by: ownerId,
          updated_at: new Date().toISOString()
        }

        if (!existing || existing.length === 0) {
          const configId = uuidv4()
          try {
            await pgClient.query(`INSERT INTO voice_configs (id, organization_id, record, transcribe, translate, translate_from, translate_to, survey, updated_by, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [configId, organization_id, configPayload.record, configPayload.transcribe, configPayload.translate, configPayload.translate_from, configPayload.translate_to, configPayload.survey, configPayload.updated_by, configPayload.updated_at])
            results.actions.push({ action: 'update_config', success: true, config_id: configId })
          } catch (err: any) {
            results.actions.push({ action: 'update_config', success: false, error: err?.message || String(err) })
          }
        } else {
          try {
            await pgClient.query(`UPDATE voice_configs SET record = $1, transcribe = $2, translate = $3, translate_from = $4, translate_to = $5, survey = $6, updated_by = $7, updated_at = $8 WHERE organization_id = $9`, [configPayload.record, configPayload.transcribe, configPayload.translate, configPayload.translate_from, configPayload.translate_to, configPayload.survey, configPayload.updated_by, configPayload.updated_at, organization_id])
            results.actions.push({ action: 'update_config', success: true, config_id: existing[0].id })
          } catch (err: any) {
            results.actions.push({ action: 'update_config', success: false, error: err?.message || String(err) })
          }
        }
        break
      }

      case 'execute_call': {
        const { phone_to, from_number, modulations } = params
        if (!phone_to || !from_number) {
          return NextResponse.json({
            success: false,
            error: 'phone_to and from_number required in params'
          }, { status: 400 })
        }

        try {
          // Get an owner user for this organization to use as actor
          const ownerRes = await pgClient.query(`SELECT user_id FROM org_members WHERE organization_id = $1 AND role = $2 LIMIT 1`, [organization_id, 'owner'])
          const ownerData = ownerRes?.rows || []
          if (!ownerData || ownerData.length === 0) {
            return NextResponse.json({
              success: false,
              error: 'No owner user found for organization'
            }, { status: 400 })
          }

          const actorId = ownerData[0].user_id

          // Use startCallHandler directly with actor_id
          const callResult = await startCallHandler({
            organization_id,
            phone_number: phone_to,
            from_number,
            modulations: modulations || { record: true, transcribe: true },
            actor_id: actorId
          } as any)

          if (callResult.success) {
            const successResult = callResult as any
            results.actions.push({
              action: 'execute_call',
              success: true,
              call_id: successResult.call_id,
              call_sid: successResult.call?.call_sid || 'N/A'
            })
            results.call_id = successResult.call_id
            results.call_sid = successResult.call?.call_sid
          } else {
            // Properly serialize error
            const errorMsg = typeof callResult.error === 'string'
              ? callResult.error
              : (callResult.error as any)?.message || (callResult.error as any)?.user_message || JSON.stringify(callResult.error)

            logger.error('Execute call failed', undefined, { errorMsg, callResult })

            results.actions.push({
              action: 'execute_call',
              success: false,
              error: errorMsg
            })
          }
        } catch (callErr: any) {
          logger.error('Exception during execute_call', callErr)
          results.actions.push({
            action: 'execute_call',
            success: false,
            error: callErr?.message || 'Unexpected error during call execution'
          })
        }
        break
      }

      case 'full_pipeline': {
        // Full E2E pipeline: target → config → call
        const { phone_to, from_number, translate_from, translate_to, email } = params

        if (!phone_to || !from_number) {
          return NextResponse.json({
            success: false,
            error: 'phone_to and from_number required for full_pipeline'
          }, { status: 400 })
        }

        // Step 0: Get owner user as actor
        const ownerRes = await pgClient.query(`SELECT user_id FROM org_members WHERE organization_id = $1 AND role = $2 LIMIT 1`, [organization_id, 'owner'])
        const ownerData = ownerRes?.rows || []
        if (!ownerData || ownerData.length === 0) {
          results.success = false
          results.error = 'No owner user found for organization'
          return NextResponse.json(results, { status: 400 })
        }

        const actorId = ownerData[0].user_id

        // Step 1: Create target
        const targetId = uuidv4()
        const { error: targetErr } = await supabaseAdmin
          .from('voice_targets')
          .insert({
            id: targetId,
            organization_id,
            phone_number: phone_to,
            name: 'E2E Pipeline Test',
            is_active: true,
            created_at: new Date().toISOString()
          })

        results.actions.push({
          action: 'create_target',
          success: !targetErr,
          target_id: targetId,
          error: targetErr?.message
        })

        // Step 2: Update config
        const enableTranslation = !!(translate_from && translate_to)
        const configPayload = {
          record: true,
          transcribe: true,
          translate: enableTranslation,
          translate_from: translate_from || null,
          translate_to: translate_to || null,
          survey: false,
          survey_webhook_email: email || null,
          updated_at: new Date().toISOString()
        }

        const { data: existing } = await supabaseAdmin
          .from('voice_configs')
          .select('id')
          .eq('organization_id', organization_id)
          .limit(1)

        if (!existing || existing.length === 0) {
          const configId = uuidv4()
          await supabaseAdmin
            .from('voice_configs')
            .insert({ id: configId, organization_id, ...configPayload })
          results.actions.push({ action: 'update_config', success: true, config_id: configId })
        } else {
          await supabaseAdmin
            .from('voice_configs')
            .update(configPayload)
            .eq('organization_id', organization_id)
          results.actions.push({ action: 'update_config', success: true, config_id: existing[0].id })
        }

        // Step 3: Execute call
        let callResult
        try {
          callResult = await startCallHandler({
            organization_id,
            phone_number: phone_to,
            from_number,
            modulations: {
              record: true,
              transcribe: true,
              translate: enableTranslation
            },
            actor_id: actorId
          } as any)
        } catch (callErr: any) {
          logger.error('Exception in startCallHandler', callErr)
          callResult = {
            success: false,
            error: callErr?.message || 'Unexpected error during call execution'
          }
        }

        if (callResult.success) {
          const successResult = callResult as any
          results.actions.push({
            action: 'execute_call',
            success: true,
            call_id: successResult.call_id,
            call_sid: successResult.call?.call_sid
          })
          results.call_id = successResult.call_id
          results.call_sid = successResult.call?.call_sid
          results.success = true
        } else {
          // Properly serialize error object
          const errorMsg = typeof callResult.error === 'string'
            ? callResult.error
            : (callResult.error as any)?.message || (callResult.error as any)?.user_message || JSON.stringify(callResult.error)

          logger.error('Execute call failed', undefined, { errorMsg, callResult })

          results.actions.push({
            action: 'execute_call',
            success: false,
            error: errorMsg
          })
          results.success = false
          results.error_details = callResult // Include full error for debugging
        }
        break
      }

      case 'get_call': {
        const { call_id } = params
        if (!call_id) {
          return NextResponse.json({ success: false, error: 'call_id required' }, { status: 400 })
        }

        const { data: call, error } = await supabaseAdmin
          .from('calls')
          .select('*, recordings(*), ai_runs(*)')
          .eq('id', call_id)
          .single()

        if (error) {
          results.actions.push({ action: 'get_call', success: false, error: error.message })
        } else {
          results.actions.push({ action: 'get_call', success: true })
          results.call = call
        }
        break
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}. Valid actions: create_target, create_survey, update_config, execute_call, full_pipeline, get_call`
        }, { status: 400 })
    }

    return NextResponse.json({
      success: results.success !== false,
      ...results
    })

  } catch (err: any) {
    logger.error('E2E Test error', err)
    return NextResponse.json({
      success: false,
      error: err?.message || 'Unexpected error'
    }, { status: 500 })
  }
}

// GET method for testing connectivity
export async function GET() {
  const hasKey = !!process.env.SERVICE_API_KEY
  return NextResponse.json({
    success: true,
    message: 'E2E Test endpoint ready',
    service_key_configured: hasKey,
    available_actions: [
      'create_target',
      'create_survey',
      'update_config',
      'execute_call',
      'full_pipeline',
      'get_call'
    ]
  })
}
