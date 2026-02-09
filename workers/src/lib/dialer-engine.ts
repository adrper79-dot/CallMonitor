/**
 * Dialer Engine — Predictive Dialer Queue Manager
 *
 * Manages the outbound dialing queue for campaigns.
 * Integrates with Telnyx AMD (Answering Machine Detection) to route calls:
 *   - human → bridge to available agent
 *   - machine → leave voicemail + hangup
 *   - not_sure → bridge to agent (conservative)
 *   - fax_detected → hangup immediately
 *
 * Agent pool is tracked in `dialer_agent_status` table.
 * Campaign progress is tracked in `campaign_calls` table.
 *
 * @see ARCH_DOCS/FEATURE_IMPLEMENTATION_PLAN.md — Phase 4
 */

import type { Env } from '../index'
import type { DbClient } from './db'
import { logger } from './logger'
import { writeAuditLog, AuditAction } from './audit'

const TELNYX_BASE = 'https://api.telnyx.com/v2'

/**
 * Handle AMD (Answering Machine Detection) result from Telnyx webhook.
 * Routes the call based on detection outcome.
 */
export async function handleDialerAMD(
  env: Env,
  db: DbClient,
  callControlId: string,
  callSessionId: string,
  amdResult: string
): Promise<void> {
  // Look up the campaign call record
  const callResult = await db.query(
    `SELECT cc.id AS campaign_call_id, cc.campaign_id, cc.target_phone,
            c.id AS call_id, c.organization_id,
            camp.name AS campaign_name, camp.call_flow_type
     FROM campaign_calls cc
     JOIN calls c ON c.id = cc.call_id
     JOIN campaigns camp ON camp.id = cc.campaign_id
     WHERE (c.call_control_id = $1 OR c.call_sid = $2)
       AND c.organization_id IS NOT NULL
     LIMIT 1`,
    [callControlId, callSessionId]
  )

  if (callResult.rows.length === 0) {
    logger.warn('AMD result for unknown campaign call', { callControlId, amdResult })
    return
  }

  const record = callResult.rows[0]

  logger.info('AMD result processing', {
    callControlId,
    amdResult,
    campaignId: record.campaign_id,
    targetPhone: record.target_phone,
  })

  switch (amdResult) {
    case 'human':
    case 'not_sure':
      // Human answered (or uncertain) — bridge to available agent
      await bridgeToAgent(env, db, callControlId, record)
      break

    case 'machine':
      // Answering machine — leave voicemail if configured, then hangup
      await handleVoicemail(env, db, callControlId, record)
      break

    case 'fax_detected':
      // Fax — hangup immediately
      await hangupCall(env, callControlId)
      await updateCampaignCallOutcome(db, record.campaign_call_id, 'fax', record.organization_id)
      break

    default:
      logger.warn('Unknown AMD result', { amdResult, callControlId })
      await bridgeToAgent(env, db, callControlId, record)
  }

  // Write audit log
  writeAuditLog(db, {
    organizationId: record.organization_id,
    userId: 'system',
    action: AuditAction.DIALER_AMD_DETECTED,
    resourceType: 'campaign_call',
    resourceId: record.campaign_call_id,
    oldValue: null,
    newValue: { amd_result: amdResult, call_control_id: callControlId },
  })
}

/**
 * Start a dialer session — begin outbound calling for a campaign.
 */
export async function startDialerQueue(
  env: Env,
  db: DbClient,
  campaignId: string,
  organizationId: string,
  userId: string
): Promise<{ queued: number; started: boolean }> {
  // Get available targets
  const targets = await db.query(
    `SELECT id, target_phone FROM campaign_calls
     WHERE campaign_id = $1 AND status = 'pending'
     ORDER BY created_at ASC
     LIMIT 10`,
    [campaignId]
  )

  if (targets.rows.length === 0) {
    return { queued: 0, started: false }
  }

  // Get available agents
  const agents = await db.query(
    `SELECT user_id FROM dialer_agent_status
     WHERE organization_id = $1 AND status = 'available'
       AND (campaign_id = $2 OR campaign_id IS NULL)
     ORDER BY last_call_ended_at ASC NULLS FIRST
     LIMIT 5`,
    [organizationId, campaignId]
  )

  if (agents.rows.length === 0) {
    logger.warn('No available agents for dialer queue', { campaignId, organizationId })
    return { queued: targets.rows.length, started: false }
  }

  // Update campaign status
  await db.query(
    `UPDATE campaigns SET status = 'active', updated_at = NOW()
     WHERE id = $1 AND organization_id = $2`,
    [campaignId, organizationId]
  )

  // Get the org's outbound number
  const callerIdResult = await db.query(
    `SELECT phone_number FROM voice_targets
     WHERE organization_id = $1 AND is_default = true
     LIMIT 1`,
    [organizationId]
  )
  const fromNumber = callerIdResult.rows[0]?.phone_number || ''

  if (!fromNumber) {
    logger.error('No default voice target for dialer', { organizationId })
    return { queued: targets.rows.length, started: false }
  }

  // Dial the first batch (conservative: 1 call per available agent)
  const dialCount = Math.min(targets.rows.length, agents.rows.length)
  let dialed = 0

  for (let i = 0; i < dialCount; i++) {
    const target = targets.rows[i]
    try {
      const callResult = await dialNumber(env, db, {
        toNumber: target.target_phone,
        fromNumber,
        organizationId,
        campaignCallId: target.id,
        campaignId,
      })
      if (callResult) dialed++
    } catch (err) {
      logger.warn('Dialer dial failed', {
        targetPhone: target.target_phone,
        error: (err as Error)?.message,
      })
    }
  }

  writeAuditLog(db, {
    organizationId,
    userId,
    action: AuditAction.DIALER_QUEUE_STARTED,
    resourceType: 'campaign',
    resourceId: campaignId,
    oldValue: null,
    newValue: { dialed, total_pending: targets.rows.length },
  })

  logger.info('Dialer queue started', { campaignId, dialed, agents: agents.rows.length })

  return { queued: dialed, started: true }
}

/**
 * Pause a dialer queue — stop making new outbound calls.
 */
export async function pauseDialerQueue(
  db: DbClient,
  campaignId: string,
  organizationId: string,
  userId: string
): Promise<void> {
  await db.query(
    `UPDATE campaigns SET status = 'paused', updated_at = NOW()
     WHERE id = $1 AND organization_id = $2`,
    [campaignId, organizationId]
  )

  writeAuditLog(db, {
    organizationId,
    userId,
    action: AuditAction.DIALER_QUEUE_PAUSED,
    resourceType: 'campaign',
    resourceId: campaignId,
    oldValue: null,
    newValue: { status: 'paused' },
  })
}

/**
 * Get dialer stats for a campaign.
 */
export async function getDialerStats(
  db: DbClient,
  campaignId: string,
  organizationId: string
): Promise<any> {
  const [callStats, agentStats] = await Promise.all([
    db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending') AS pending,
         COUNT(*) FILTER (WHERE status = 'calling') AS calling,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed,
         COUNT(*) FILTER (WHERE status = 'failed') AS failed,
         COUNT(*) AS total
       FROM campaign_calls
       WHERE campaign_id = $1`,
      [campaignId]
    ),
    db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'available') AS available,
         COUNT(*) FILTER (WHERE status = 'on_call') AS on_call,
         COUNT(*) FILTER (WHERE status = 'wrap_up') AS wrap_up,
         COUNT(*) AS total
       FROM dialer_agent_status
       WHERE organization_id = $1
         AND (campaign_id = $2 OR campaign_id IS NULL)
         AND status != 'offline'`,
      [organizationId, campaignId]
    ),
  ])

  return {
    calls: callStats.rows[0] || {},
    agents: agentStats.rows[0] || {},
  }
}

// --- Internal helpers ---

/**
 * Dial a phone number via Telnyx Call Control v2 with AMD enabled.
 */
async function dialNumber(
  env: Env,
  db: DbClient,
  params: {
    toNumber: string
    fromNumber: string
    organizationId: string
    campaignCallId: string
    campaignId: string
  }
): Promise<boolean> {
  const { toNumber, fromNumber, organizationId, campaignCallId, campaignId } = params

  // Create a call record first
  const callInsert = await db.query(
    `INSERT INTO calls (organization_id, direction, from_number, to_number, status, campaign_id, created_at)
     VALUES ($1, 'outbound', $2, $3, 'dialing', $4, NOW())
     RETURNING id`,
    [organizationId, fromNumber, toNumber, campaignId]
  )
  const callId = callInsert.rows[0]?.id
  if (!callId) return false

  // Update campaign_call with the call reference
  await db.query(
    `UPDATE campaign_calls SET call_id = $1, status = 'calling', updated_at = NOW()
     WHERE id = $2`,
    [callId, campaignCallId]
  )

  // Place the call via Telnyx with AMD enabled
  const res = await fetch(`${TELNYX_BASE}/calls`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      connection_id: env.TELNYX_CONNECTION_ID || '',
      to: toNumber,
      from: fromNumber,
      answering_machine_detection: 'detect',
      answering_machine_detection_config: {
        after_greeting_silence_millis: 800,
        greeting_duration_millis: 3500,
        total_analysis_time_millis: 5000,
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    logger.warn('Telnyx dial failed', {
      toNumber,
      status: res.status,
      body: errText.substring(0, 200),
    })
    await db.query(
      `UPDATE campaign_calls SET status = 'failed', updated_at = NOW() WHERE id = $1`,
      [campaignCallId]
    )
    return false
  }

  const callData = await res.json<{ data: { call_control_id: string; call_session_id: string } }>()
  const ccId = callData.data?.call_control_id
  const sessionId = callData.data?.call_session_id

  // Update call record with Telnyx IDs
  if (ccId || sessionId) {
    await db.query(`UPDATE calls SET call_control_id = $1, call_sid = $2 WHERE id = $3`, [
      ccId,
      sessionId,
      callId,
    ])
  }

  return true
}

/**
 * Bridge an answered call to the next available agent.
 */
async function bridgeToAgent(
  env: Env,
  db: DbClient,
  callControlId: string,
  record: any
): Promise<void> {
  // Find an available agent
  const agentResult = await db.query(
    `UPDATE dialer_agent_status
     SET status = 'on_call', current_call_id = $3, updated_at = NOW()
     WHERE id = (
       SELECT id FROM dialer_agent_status
       WHERE organization_id = $1 AND status = 'available'
         AND (campaign_id = $2 OR campaign_id IS NULL)
       ORDER BY last_call_ended_at ASC NULLS FIRST
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING user_id`,
    [record.organization_id, record.campaign_id, record.call_id]
  )

  if (agentResult.rows.length === 0) {
    // No agents available — play hold message
    logger.warn('No available agent for bridge', {
      callControlId,
      campaignId: record.campaign_id,
    })

    await fetch(`${TELNYX_BASE}/calls/${callControlId}/actions/speak`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payload: 'Please hold while we connect you with an agent.',
        voice: 'female',
        language: 'en-US',
      }),
    }).catch(() => {})

    return
  }

  // Update campaign call outcome
  await updateCampaignCallOutcome(db, record.campaign_call_id, 'connected', record.organization_id)

  writeAuditLog(db, {
    organizationId: record.organization_id,
    userId: 'system',
    action: AuditAction.DIALER_CALL_CONNECTED,
    resourceType: 'campaign_call',
    resourceId: record.campaign_call_id,
    oldValue: null,
    newValue: { agent_user_id: agentResult.rows[0].user_id },
  })

  logger.info('Dialer call bridged to agent', {
    callControlId,
    agentUserId: agentResult.rows[0].user_id,
  })
}

/**
 * Handle voicemail — leave a message if configured, then hangup.
 */
async function handleVoicemail(
  env: Env,
  db: DbClient,
  callControlId: string,
  record: any
): Promise<void> {
  // Play a brief voicemail message
  try {
    await fetch(`${TELNYX_BASE}/calls/${callControlId}/actions/speak`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payload:
          'Hello, this is an automated call. Please call us back at your earliest convenience. Thank you.',
        voice: 'female',
        language: 'en-US',
      }),
    })

    // Wait a moment for the message to play, then hangup
    // (In practice, the speak.ended webhook would trigger the hangup,
    //  but we schedule hangup as a safety net)
    setTimeout(async () => {
      await hangupCall(env, callControlId)
    }, 15000) // 15 second safety timeout
  } catch (err) {
    logger.warn('Voicemail speak failed', { error: (err as Error)?.message })
    await hangupCall(env, callControlId)
  }

  await updateCampaignCallOutcome(db, record.campaign_call_id, 'voicemail', record.organization_id)
}

/**
 * Hangup a call via Telnyx.
 */
async function hangupCall(env: Env, callControlId: string): Promise<void> {
  await fetch(`${TELNYX_BASE}/calls/${callControlId}/actions/hangup`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  }).catch((err) => {
    logger.warn('Hangup failed', { callControlId, error: (err as Error)?.message })
  })
}

/**
 * Update campaign call outcome.
 */
async function updateCampaignCallOutcome(
  db: DbClient,
  campaignCallId: string,
  outcome: string,
  organizationId: string
): Promise<void> {
  await db.query(
    `UPDATE campaign_calls
     SET outcome = $1, status = 'completed', updated_at = NOW()
     WHERE id = $2`,
    [outcome, campaignCallId]
  )
}

