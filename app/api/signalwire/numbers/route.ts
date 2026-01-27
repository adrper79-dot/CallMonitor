import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireAuth, requireRole, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getSignalWireCredentials() {
  return {
    projectId: process.env.SIGNALWIRE_PROJECT_ID!,
    token: process.env.SIGNALWIRE_TOKEN || process.env.SIGNALWIRE_API_TOKEN!,
    space: process.env.SIGNALWIRE_SPACE!
  }
}

function getAuthHeader(projectId: string, token: string): string {
  return `Basic ${Buffer.from(`${projectId}:${token}`).toString('base64')}`
}

/**
 * GET /api/signalwire/numbers - List available phone numbers
 */
export async function GET() {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const { projectId, token, space } = getSignalWireCredentials()
    
    if (!projectId || !token || !space) {
      return Errors.badRequest('SignalWire not configured')
    }

    const response = await fetch(
      `https://${space}/api/laml/2010-04-01/Accounts/${projectId}/IncomingPhoneNumbers.json`,
      { method: 'GET', headers: { Authorization: getAuthHeader(projectId, token), 'Content-Type': 'application/json' } }
    )

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('SignalWire numbers API error', undefined, { status: response.status, error: errorText })
      return Errors.badRequest('Failed to fetch numbers from SignalWire')
    }

    const data = await response.json()
    
    const numbers = (data.incoming_phone_numbers || []).map((num: any) => ({
      sid: num.sid, phoneNumber: num.phone_number, friendlyName: num.friendly_name,
      voiceUrl: num.voice_url, voiceMethod: num.voice_method,
      capabilities: { voice: num.capabilities?.voice ?? true, sms: num.capabilities?.sms ?? false, mms: num.capabilities?.mms ?? false }
    }))

    return success({ numbers, total: numbers.length })
  } catch (error: any) {
    logger.error('GET /api/signalwire/numbers error', error)
    return Errors.internal(error)
  }
}

/**
 * PATCH /api/signalwire/numbers - Update a phone number's webhook URL
 */
export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireRole(['owner', 'admin'])
    if (ctx instanceof NextResponse) return ctx

    const body = await req.json()
    const { numberSid, webhookUrl } = body

    if (!numberSid) {
      return Errors.badRequest('numberSid is required')
    }

    const { projectId, token, space } = getSignalWireCredentials()
    
    if (!projectId || !token || !space) {
      return Errors.badRequest('SignalWire not configured')
    }

    const updateBody = new URLSearchParams()
    if (webhookUrl) {
      updateBody.append('VoiceUrl', webhookUrl)
      updateBody.append('VoiceMethod', 'POST')
    }

    const response = await fetch(
      `https://${space}/api/laml/2010-04-01/Accounts/${projectId}/IncomingPhoneNumbers/${numberSid}.json`,
      {
        method: 'POST',
        headers: { Authorization: getAuthHeader(projectId, token), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: updateBody.toString()
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('SignalWire number update error', undefined, { status: response.status, error: errorText })
      return Errors.badRequest('Failed to update phone number')
    }

    const data = await response.json()

    await supabaseAdmin.from('voice_configs')
      .update({ survey_inbound_number: numberSid, updated_at: new Date().toISOString() })
      .eq('organization_id', ctx.orgId)

    logger.info('SignalWire number updated', { numberSid, orgId: ctx.orgId })

    return success({ number: { sid: data.sid, phoneNumber: data.phone_number, voiceUrl: data.voice_url } })
  } catch (error: any) {
    logger.error('PATCH /api/signalwire/numbers error', error)
    return Errors.internal(error)
  }
}
