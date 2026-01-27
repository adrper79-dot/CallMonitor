import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { buildShopperSWML, buildShopperFallbackSWML } from '@/lib/signalwire/shopperSwmlBuilder'
import { parseRequestBody, swmlResponse } from '@/lib/api/utils'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

/**
 * POST /api/voice/swml/shopper
 * SignalWire calls this endpoint for secret shopper evaluation calls.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await parseRequestBody(req)

    const callSid = payload.CallSid || payload.call_sid
    const from = payload.From || payload.from
    const to = payload.To || payload.to

    const url = new URL(req.url)
    const scriptId = url.searchParams.get('scriptId')
    const orgId = url.searchParams.get('orgId')
    const callId = url.searchParams.get('callId') || callSid || `shopper-${Date.now()}`

    logger.info('SWML shopper: incoming call', {
      callSid: callSid ? '[REDACTED]' : null,
      scriptId, orgId, callId
    })

    if (!scriptId && !orgId) {
      logger.warn('SWML shopper: missing scriptId or orgId')
      return swmlResponse(buildShopperFallbackSWML('Sorry, this evaluation could not be configured. Goodbye.'))
    }

    let script: any = null
    let organizationId = orgId

    if (scriptId) {
      const { rows: scriptRows } = await query(
        `SELECT * FROM shopper_scripts WHERE id = $1 LIMIT 1`,
        [scriptId]
      )

      script = scriptRows?.[0]
      if (script) {
        organizationId = script.organization_id
      }
    }

    if (!script && organizationId) {
      const { rows: configRows } = await query(
        `SELECT shopper_script, shopper_expected_outcomes FROM voice_configs 
         WHERE organization_id = $1 AND shopper_script IS NOT NULL LIMIT 1`,
        [organizationId]
      )

      if (configRows?.[0]?.shopper_script) {
        script = {
          script_content: configRows[0].shopper_script,
          expected_outcomes: configRows[0].shopper_expected_outcomes || [],
          persona: 'a typical customer',
          voice: 'en'
        }
      }
    }

    if (!script || !script.script_content) {
      logger.warn('SWML shopper: no script found', { scriptId, orgId })
      return swmlResponse(buildShopperFallbackSWML('Sorry, no evaluation script was found. Goodbye.'))
    }

    const swml = buildShopperSWML({
      callId,
      organizationId: organizationId || 'unknown',
      scriptId: scriptId || undefined,
      script: script.script_content,
      persona: script.persona,
      voice: script.voice,
      expectedOutcomes: script.expected_outcomes,
      targetName: script.target_name,
      recordCall: true
    })

    logger.info('SWML shopper: generated SWML', {
      organizationId, scriptId, callId,
      hasScript: !!script.script_content,
      outcomeCount: script.expected_outcomes?.length || 0
    })

    if (callSid && organizationId) {
      try {
        // Note: shopper_results table links call to script_id after evaluation
        await query(
          `INSERT INTO calls (id, organization_id, call_sid, status, started_at)
             VALUES ($1, $2, $3, 'ringing', NOW())`,
          [uuidv4(), organizationId, callSid]
        )
      } catch (insertErr) {
        logger.warn('SWML shopper: could not create call record', { error: (insertErr as any)?.message })
      }
    }

    return swmlResponse(swml)

  } catch (err: any) {
    logger.error('SWML shopper error', err)
    return swmlResponse(buildShopperFallbackSWML('We encountered an error. Please try again later. Goodbye.'))
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true, route: '/api/voice/swml/shopper',
    method: 'Use POST for SWML generation',
    description: 'SWML endpoint for Secret Shopper AI Agent evaluations',
    params: {
      scriptId: 'shopper_scripts.id - the evaluation script to use',
      orgId: 'organization_id (fallback if scriptId not provided)',
      callId: 'call ID for tracking (auto-generated if not provided)'
    }
  })
}
