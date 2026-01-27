import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'
import { requireAuth, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

/**
 * POST /api/caller-id/verify - Initiate caller ID verification
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const body = await req.json()
    const { phone_number, display_name } = body

    if (!phone_number) {
      return Errors.badRequest('Phone number is required')
    }

    if (!phone_number.match(/^\+[1-9]\d{1,14}$/)) {
      return Errors.badRequest('Use E.164 format (e.g., +12025551234)')
    }

    const { data: existingRows } = await supabaseAdmin
      .from('caller_id_numbers')
      .select('id, is_verified')
      .eq('organization_id', ctx.orgId)
      .eq('phone_number', phone_number)
      .limit(1)

    if (existingRows?.[0]?.is_verified) {
      return success({ message: 'Number already verified', verified: true })
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const recordId = existingRows?.[0]?.id || uuidv4()

    if (existingRows?.[0]) {
      await supabaseAdmin.from('caller_id_numbers').update({
        verification_code: verificationCode, is_verified: false, display_name: display_name || null
      }).eq('id', recordId)
    } else {
      await supabaseAdmin.from('caller_id_numbers').insert({
        id: recordId, organization_id: ctx.orgId, phone_number,
        display_name: display_name || null, verification_code: verificationCode,
        is_verified: false, created_by: ctx.userId
      })
    }

    const swProject = process.env.SIGNALWIRE_PROJECT_ID
    const swToken = process.env.SIGNALWIRE_TOKEN || process.env.SIGNALWIRE_API_TOKEN
    const rawSpace = process.env.SIGNALWIRE_SPACE || process.env.SIGNALWIRE_SPACE_URL || ''
    // Normalize space: strip protocol and trailing slashes, keep domain
    const swSpace = rawSpace
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .trim()
    const swNumber = process.env.SIGNALWIRE_NUMBER

    if (!swProject || !swToken || !swSpace || !swNumber) {
      logger.warn('SignalWire credentials missing', { 
        hasProject: !!swProject, 
        hasToken: !!swToken, 
        hasSpace: !!swSpace, 
        hasNumber: !!swNumber 
      })
      return Errors.badRequest('Voice service is not configured')
    }

    const auth = Buffer.from(`${swProject}:${swToken}`).toString('base64')
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/caller-id/verification-twiml?code=${verificationCode}`
    
    const params = new URLSearchParams()
    params.append('From', swNumber)
    params.append('To', phone_number)
    params.append('Url', verificationUrl)

    // Construct endpoint - if swSpace already has .signalwire.com, don't add it again
    const spaceDomain = swSpace.includes('.signalwire.com') ? swSpace : `${swSpace}.signalwire.com`
    const swEndpoint = `https://${spaceDomain}/api/laml/2010-04-01/Accounts/${swProject}/Calls.json`

    logger.debug('Placing verification call', { endpoint: swEndpoint, to: '[REDACTED]' })

    const swRes = await fetch(swEndpoint, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    }).catch(fetchErr => {
      logger.error('Fetch failed to SignalWire', fetchErr, { endpoint: swEndpoint })
      throw new Error(`Network error calling SignalWire: ${fetchErr.message}`)
    })

    if (!swRes.ok) {
      const errorText = await swRes.text()
      logger.error('Verification call failed', undefined, { status: swRes.status, error: errorText })
      return Errors.badRequest(`Failed to place verification call: ${swRes.status}`)
    }

    const swData = await swRes.json()

    await supabaseAdmin.from('caller_id_numbers').update({ signalwire_verification_sid: swData.sid }).eq('id', recordId)

    logger.info('Verification call placed', { callSid: swData.sid })

    return success({ message: 'Verification call initiated. Listen for the 6-digit code.', record_id: recordId })
  } catch (err: any) {
    logger.error('Caller ID verify error', err)
    return Errors.internal(err)
  }
}

/**
 * PUT /api/caller-id/verify - Confirm verification code
 */
export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const body = await req.json()
    const { phone_number, code } = body

    if (!phone_number || !code) {
      return Errors.badRequest('Phone number and code are required')
    }

    const { data: cidRows } = await supabaseAdmin
      .from('caller_id_numbers')
      .select('id, verification_code, is_verified')
      .eq('organization_id', ctx.orgId)
      .eq('phone_number', phone_number)
      .limit(1)

    const record = cidRows?.[0]
    if (!record) {
      return Errors.notFound('Number not found. Please initiate verification first.')
    }

    if (record.is_verified) {
      return success({ message: 'Number already verified', verified: true })
    }

    if (record.verification_code !== code) {
      return Errors.badRequest('Invalid verification code')
    }

    await supabaseAdmin.from('caller_id_numbers').update({
      is_verified: true, verified_at: new Date().toISOString(), verification_code: null
    }).eq('id', record.id)

    const { data: existingDefault } = await supabaseAdmin
      .from('caller_id_numbers')
      .select('id')
      .eq('organization_id', ctx.orgId)
      .eq('is_default', true)
      .limit(1)

    if (!existingDefault?.[0]) {
      await supabaseAdmin.from('caller_id_numbers').update({ is_default: true }).eq('id', record.id)
      await supabaseAdmin.from('voice_configs').update({
        caller_id_mask: phone_number, caller_id_verified: true, caller_id_verified_at: new Date().toISOString()
      }).eq('organization_id', ctx.orgId)
    }

    logger.info('Caller ID verified', { orgId: ctx.orgId })

    return success({ message: 'Phone number verified!', verified: true })
  } catch (err: any) {
    logger.error('Caller ID confirm error', err)
    return Errors.internal(err)
  }
}

/**
 * GET /api/caller-id/verify - List verified caller IDs
 */
export async function GET() {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const { data: numbers } = await supabaseAdmin
      .from('caller_id_numbers')
      .select('id, phone_number, display_name, is_verified, is_default, verified_at, use_count')
      .eq('organization_id', ctx.orgId)
      .order('created_at', { ascending: false })

    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('caller_id_mask, caller_id_verified')
      .eq('organization_id', ctx.orgId)
      .limit(1)

    return success({
      numbers: numbers || [],
      current_mask: vcRows?.[0]?.caller_id_mask || null,
      signalwire_number: process.env.SIGNALWIRE_NUMBER || null
    })
  } catch (err: any) {
    logger.error('Caller ID list error', err)
    return Errors.internal(err)
  }
}
