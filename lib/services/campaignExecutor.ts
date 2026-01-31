/**
 * Campaign Execution Engine
 * 
 * Purpose: Orchestrates bulk call execution for campaigns
 * Architecture: Queue-based processing with rate limiting and retry logic
 * 
 * Features:
 * - Batch call processing
 * - Rate limiting per campaign
 * - Retry logic for failed calls
 * - Progress tracking
 * - SignalWire integration
 * 
 * @module lib/services/campaignExecutor
 */

import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'
import { AppError } from '@/types/app-error'

interface CampaignCall {
  id: string
  campaign_id: string
  target_phone: string
  target_metadata: any
  attempt_number: number
  max_attempts: number
  status: string
}

interface Campaign {
  id: string
  organization_id: string
  name: string
  call_flow_type: 'secret_shopper' | 'survey' | 'outbound' | 'test'
  caller_id_id: string
  script_id?: string
  survey_id?: string
  custom_prompt?: string
  call_config: {
    max_duration?: number
    timeout?: number
    retry_attempts?: number
    rate_limit_per_minute?: number
  }
  status: string
}

interface ExecutionConfig {
  rateLimitPerMinute: number
  maxConcurrent: number
  retryDelay: number
}

const DEFAULT_CONFIG: ExecutionConfig = {
  rateLimitPerMinute: 10, // 10 calls per minute max
  maxConcurrent: 5, // 5 concurrent calls max
  retryDelay: 60000, // 60 seconds between retries
}

/**
 * Execute campaign calls with rate limiting
 */
export async function executeCampaign(campaignId: string): Promise<void> {
  try {
    logger.info('executeCampaign: starting', { campaignId })

    // Get campaign details
    const campaign = await getCampaign(campaignId)
    if (!campaign) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND')
    }

    // Validate campaign status
    if (campaign.status !== 'active') {
      throw new AppError('Campaign is not active', 400, 'CAMPAIGN_NOT_ACTIVE')
    }

    // Get pending calls
    const pendingCalls = await getPendingCalls(campaignId)
    if (pendingCalls.length === 0) {
      logger.info('executeCampaign: no pending calls', { campaignId })
      await completeCampaign(campaignId)
      return
    }

    // Get execution config
    const config: ExecutionConfig = {
      ...DEFAULT_CONFIG,
      rateLimitPerMinute: campaign.call_config.rate_limit_per_minute || DEFAULT_CONFIG.rateLimitPerMinute,
    }

    logger.info('executeCampaign: processing calls', {
      campaignId,
      pendingCalls: pendingCalls.length,
      config,
    })

    // Process calls in batches with rate limiting
    await processCalls(campaign, pendingCalls, config)

    logger.info('executeCampaign: completed', { campaignId })
  } catch (error: any) {
    logger.error('executeCampaign: failed', error, { campaignId })
    throw error
  }
}

/**
 * Get campaign details
 */
async function getCampaign(campaignId: string): Promise<Campaign | null> {
  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (error) {
    logger.error('getCampaign: database error', error, { campaignId })
    return null
  }

  return data
}

/**
 * Get pending campaign calls
 */
async function getPendingCalls(campaignId: string): Promise<CampaignCall[]> {
  const { data, error } = await supabaseAdmin
    .from('campaign_calls')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    logger.error('getPendingCalls: database error', error, { campaignId })
    return []
  }

  return data || []
}

/**
 * Process calls with rate limiting and concurrency control
 */
async function processCalls(
  campaign: Campaign,
  calls: CampaignCall[],
  config: ExecutionConfig
): Promise<void> {
  const callsPerBatch = Math.min(config.maxConcurrent, config.rateLimitPerMinute)
  const delayBetweenBatches = (60 * 1000) / (config.rateLimitPerMinute / callsPerBatch)

  for (let i = 0; i < calls.length; i += callsPerBatch) {
    const batch = calls.slice(i, i + callsPerBatch)

    // Process batch concurrently
    await Promise.allSettled(
      batch.map(call => executeCall(campaign, call))
    )

    // Update campaign progress
    await updateCampaignProgress(campaign.id)

    // Rate limiting delay (except for last batch)
    if (i + callsPerBatch < calls.length) {
      await sleep(delayBetweenBatches)
    }
  }

  // Check if campaign is complete
  const remaining = await getPendingCalls(campaign.id)
  if (remaining.length === 0) {
    await completeCampaign(campaign.id)
  }
}

/**
 * Execute individual call
 */
async function executeCall(campaign: Campaign, call: CampaignCall): Promise<void> {
  try {
    logger.info('executeCall: starting', {
      campaignId: campaign.id,
      callId: call.id,
      phone: call.target_phone,
    })

    // Update call status to calling
    await supabaseAdmin
      .from('campaign_calls')
      .update({
        status: 'calling',
        started_at: new Date().toISOString(),
      })
      .eq('id', call.id)

    // Get caller ID phone number
    const { data: callerId } = await supabaseAdmin
      .from('caller_id_numbers')
      .select('phone_number')
      .eq('id', campaign.caller_id_id)
      .single()

    if (!callerId) {
      throw new AppError('Caller ID not found', 404, 'CALLER_ID_NOT_FOUND')
    }

    // Prepare call parameters based on campaign type
    const callParams = await prepareCallParams(campaign, call, callerId.phone_number)

    // Initiate call via SignalWire
    const callResult = await initiateSignalWireCall(callParams)

    // Update campaign_call with call_id
    await supabaseAdmin
      .from('campaign_calls')
      .update({
        call_id: callResult.call_id,
        status: 'completed',
        outcome: callResult.outcome,
        duration_seconds: callResult.duration,
        completed_at: new Date().toISOString(),
      })
      .eq('id', call.id)

    logger.info('executeCall: completed', {
      campaignId: campaign.id,
      callId: call.id,
      resultCallId: callResult.call_id,
    })
  } catch (error: any) {
    logger.error('executeCall: failed', error, {
      campaignId: campaign.id,
      callId: call.id,
      phone: call.target_phone,
    })

    // Handle retry logic
    if (call.attempt_number < call.max_attempts) {
      // Schedule retry
      await supabaseAdmin
        .from('campaign_calls')
        .update({
          status: 'pending',
          attempt_number: call.attempt_number + 1,
          error_message: error.message,
          scheduled_for: new Date(Date.now() + 300000).toISOString(), // 5 minutes from now
        })
        .eq('id', call.id)
    } else {
      // Max attempts reached, mark as failed
      await supabaseAdmin
        .from('campaign_calls')
        .update({
          status: 'failed',
          outcome: 'error',
          error_message: error.message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', call.id)
    }
  }
}

/**
 * Prepare call parameters based on campaign type
 */
async function prepareCallParams(
  campaign: Campaign,
  call: CampaignCall,
  callerIdPhone: string
): Promise<any> {
  const baseParams = {
    to: call.target_phone,
    from: callerIdPhone,
    organization_id: campaign.organization_id,
    campaign_id: campaign.id,
    campaign_call_id: call.id,
  }

  switch (campaign.call_flow_type) {
    case 'secret_shopper':
      return {
        ...baseParams,
        call_type: 'secret_shopper',
        script_id: campaign.script_id,
        swml_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/voice/swml/shopper?campaignCallId=${call.id}`,
      }

    case 'survey':
      return {
        ...baseParams,
        call_type: 'survey',
        survey_id: campaign.survey_id,
        swml_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/voice/swml/survey?campaignCallId=${call.id}`,
      }

    case 'outbound':
    case 'test':
    default:
      return {
        ...baseParams,
        call_type: campaign.call_flow_type,
        custom_prompt: campaign.custom_prompt,
      }
  }
}

/**
 * Initiate call via SignalWire API
 */
async function initiateSignalWireCall(params: any): Promise<any> {
  const signalwireProjectId = process.env.SIGNALWIRE_PROJECT_ID!
  const signalwireToken = process.env.SIGNALWIRE_TOKEN!
  const signalwireSpace = process.env.SIGNALWIRE_SPACE!

  try {
    // Call our internal API endpoint which handles SignalWire integration
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/voice/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SERVICE_API_KEY}`,
      },
      body: JSON.stringify({
        to_number: params.to,
        from_number: params.from,
        record: true,
        transcribe: true,
        organization_id: params.organization_id,
        campaign_id: params.campaign_id,
        campaign_call_id: params.campaign_call_id,
        swml_url: params.swml_url,
        call_type: params.call_type,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new AppError(
        error.message || 'Failed to initiate call',
        response.status,
        'SIGNALWIRE_CALL_FAILED'
      )
    }

    const result = await response.json()
    return {
      call_id: result.call_id,
      outcome: 'answered', // Will be updated by webhook
      duration: 0, // Will be updated by webhook
    }
  } catch (error: any) {
    logger.error('initiateSignalWireCall: failed', error, params)
    throw error
  }
}

/**
 * Update campaign progress counters
 */
async function updateCampaignProgress(campaignId: string): Promise<void> {
  try {
    // Get call stats
    const { data: stats } = await supabaseAdmin.rpc('get_campaign_stats', {
      campaign_id_param: campaignId,
    })

    if (!stats) return

    // Update campaign with stats
    await supabaseAdmin
      .from('campaigns')
      .update({
        total_targets: stats.total,
        calls_completed: stats.completed,
        calls_successful: stats.successful,
        calls_failed: stats.failed,
      })
      .eq('id', campaignId)
  } catch (error: any) {
    logger.error('updateCampaignProgress: failed', error, { campaignId })
  }
}

/**
 * Mark campaign as completed
 */
async function completeCampaign(campaignId: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('campaigns')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', campaignId)

    // Log audit event
    await supabaseAdmin.from('campaign_audit_log').insert({
      campaign_id: campaignId,
      user_id: null, // System action
      action: 'completed',
      changes: { status: 'completed' },
    })

    logger.info('completeCampaign: campaign completed', { campaignId })
  } catch (error: any) {
    logger.error('completeCampaign: failed', error, { campaignId })
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Queue campaign for execution
 * This can be called from the API route or a cron job
 */
export async function queueCampaignExecution(campaignId: string): Promise<void> {
  // In production, this would add the campaign to a job queue (Redis, BullMQ, etc.)
  // For now, we'll execute directly in the background
  executeCampaign(campaignId).catch(error => {
    logger.error('queueCampaignExecution: execution failed', error, { campaignId })
  })
}
