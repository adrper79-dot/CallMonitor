import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * Get SignalWire credentials from environment
 */
function getSignalWireCredentials() {
  return {
    projectId: process.env.SIGNALWIRE_PROJECT_ID!,
    token: process.env.SIGNALWIRE_TOKEN || process.env.SIGNALWIRE_API_TOKEN!,
    space: process.env.SIGNALWIRE_SPACE!
  }
}

/**
 * Create Basic Auth header for SignalWire API
 */
function getAuthHeader(projectId: string, token: string): string {
  return `Basic ${Buffer.from(`${projectId}:${token}`).toString('base64')}`
}

/**
 * GET /api/signalwire/numbers
 * 
 * List available phone numbers from SignalWire account.
 * Used for selecting numbers for AI Survey Bot inbound calls.
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

    const { projectId, token, space } = getSignalWireCredentials()
    
    if (!projectId || !token || !space) {
      return NextResponse.json(
        { success: false, error: 'SignalWire not configured' },
        { status: 503 }
      )
    }

    // Fetch phone numbers from SignalWire
    const response = await fetch(
      `https://${space}/api/laml/2010-04-01/Accounts/${projectId}/IncomingPhoneNumbers.json`,
      {
        method: 'GET',
        headers: {
          Authorization: getAuthHeader(projectId, token),
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SignalWire numbers API error:', { status: response.status, error: errorText })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch numbers from SignalWire' },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Map to simplified format
    const numbers = (data.incoming_phone_numbers || []).map((num: any) => ({
      sid: num.sid,
      phoneNumber: num.phone_number,
      friendlyName: num.friendly_name,
      voiceUrl: num.voice_url,
      voiceMethod: num.voice_method,
      capabilities: {
        voice: num.capabilities?.voice ?? true,
        sms: num.capabilities?.sms ?? false,
        mms: num.capabilities?.mms ?? false
      }
    }))

    return NextResponse.json({
      success: true,
      numbers,
      total: numbers.length
    })
  } catch (error: any) {
    console.error('GET /api/signalwire/numbers error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/signalwire/numbers
 * 
 * Update a phone number's webhook URL.
 * Used to assign AI Survey Bot SWML endpoint to a number.
 * 
 * Body: { numberSid, webhookUrl, orgId }
 */
export async function PATCH(req: NextRequest) {
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
    const { numberSid, webhookUrl, orgId } = body

    if (!numberSid) {
      return NextResponse.json(
        { success: false, error: 'numberSid is required' },
        { status: 400 }
      )
    }

    // Verify user is member of organization
    if (orgId) {
      const { data: memberRows } = await supabaseAdmin
        .from('org_members')
        .select('id, role')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .limit(1)

      if (!memberRows || memberRows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Not authorized for this organization' },
          { status: 403 }
        )
      }

      const role = memberRows[0].role
      if (role !== 'owner' && role !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'Only owners and admins can modify phone numbers' },
          { status: 403 }
        )
      }
    }

    const { projectId, token, space } = getSignalWireCredentials()
    
    if (!projectId || !token || !space) {
      return NextResponse.json(
        { success: false, error: 'SignalWire not configured' },
        { status: 503 }
      )
    }

    // Update phone number webhook
    const updateBody = new URLSearchParams()
    if (webhookUrl) {
      updateBody.append('VoiceUrl', webhookUrl)
      updateBody.append('VoiceMethod', 'POST')
    }

    const response = await fetch(
      `https://${space}/api/laml/2010-04-01/Accounts/${projectId}/IncomingPhoneNumbers/${numberSid}.json`,
      {
        method: 'POST',
        headers: {
          Authorization: getAuthHeader(projectId, token),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: updateBody.toString()
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SignalWire number update error:', { status: response.status, error: errorText })
      return NextResponse.json(
        { success: false, error: 'Failed to update phone number' },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Update voice_configs with the number SID if orgId provided
    if (orgId) {
      await supabaseAdmin
        .from('voice_configs')
        .update({
          survey_inbound_number: numberSid,
          updated_at: new Date().toISOString()
        })
        .eq('organization_id', orgId)
    }

    // eslint-disable-next-line no-console
    console.log('SignalWire number updated', { numberSid, webhookUrl: webhookUrl ? '[SET]' : '[CLEARED]', orgId })

    return NextResponse.json({
      success: true,
      number: {
        sid: data.sid,
        phoneNumber: data.phone_number,
        voiceUrl: data.voice_url
      }
    })
  } catch (error: any) {
    console.error('PATCH /api/signalwire/numbers error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
