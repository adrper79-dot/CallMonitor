import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
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
    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .select('id, name, plan')
      .eq('id', organization_id)
      .single()

    if (orgErr || !org) {
      return NextResponse.json({
        success: false,
        error: `Organization not found: ${organization_id}`
      }, { status: 404 })
    }

    // Get a user from this org for operations
    const { data: members } = await supabaseAdmin
      .from('org_members')
      .select('user_id, role')
      .eq('organization_id', organization_id)
      .eq('role', 'owner')
      .limit(1)
    
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
        const { data: target, error } = await supabaseAdmin
          .from('voice_targets')
          .insert({
            id: targetId,
            organization_id,
            phone_number,
            name: name || 'E2E Test Target',
            description: description || `Created via E2E test at ${new Date().toISOString()}`,
            is_active: true,
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) {
          results.actions.push({ action: 'create_target', success: false, error: error.message })
        } else {
          results.actions.push({ action: 'create_target', success: true, target })
          results.target_id = targetId
        }
        break
      }

      case 'create_survey': {
        const { name, questions } = params
        const surveyId = uuidv4()
        const { data: survey, error } = await supabaseAdmin
          .from('surveys')
          .insert({
            id: surveyId,
            organization_id,
            name: name || 'E2E Test Survey',
            questions: questions || [
              { type: 'scale', question: 'How satisfied were you? (1-5)', min: 1, max: 5 },
              { type: 'yes_no', question: 'Would you recommend us?' },
              { type: 'text', question: 'Any additional feedback?' }
            ],
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) {
          results.actions.push({ action: 'create_survey', success: false, error: error.message })
        } else {
          results.actions.push({ action: 'create_survey', success: true, survey })
          results.survey_id = surveyId
        }
        break
      }

      case 'update_config': {
        const { modulations } = params
        
        // Check if config exists
        const { data: existing } = await supabaseAdmin
          .from('voice_configs')
          .select('*')
          .eq('organization_id', organization_id)
          .limit(1)
        
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
          const { error } = await supabaseAdmin
            .from('voice_configs')
            .insert({ id: configId, organization_id, ...configPayload })
          
          if (error) {
            results.actions.push({ action: 'update_config', success: false, error: error.message })
          } else {
            results.actions.push({ action: 'update_config', success: true, config_id: configId })
          }
        } else {
          const { error } = await supabaseAdmin
            .from('voice_configs')
            .update(configPayload)
            .eq('organization_id', organization_id)
          
          if (error) {
            results.actions.push({ action: 'update_config', success: false, error: error.message })
          } else {
            results.actions.push({ action: 'update_config', success: true, config_id: existing[0].id })
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
          // Use startCallHandler directly
          const callResult = await startCallHandler({
            organization_id,
            phone_number: phone_to,
            from_number,
            modulations: modulations || { record: true, transcribe: true }
          }, { supabaseAdmin })

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
              : callResult.error?.message || callResult.error?.user_message || JSON.stringify(callResult.error)
            
            console.error('Execute call failed:', errorMsg, callResult)
            
            results.actions.push({ 
              action: 'execute_call', 
              success: false, 
              error: errorMsg
            })
          }
        } catch (callErr: any) {
          console.error('Exception during execute_call:', callErr)
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
            }
          }, { supabaseAdmin })
        } catch (callErr: any) {
          console.error('Exception in startCallHandler:', callErr)
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
            : callResult.error?.message || callResult.error?.user_message || JSON.stringify(callResult.error)
          
          console.error('Execute call failed:', errorMsg, callResult)
          
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
