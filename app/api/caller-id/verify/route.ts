import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

/**
 * POST /api/caller-id/verify
 * 
 * Initiate caller ID verification - SignalWire calls the number
 * and speaks a verification code
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Auth required' }, { status: 401 })
    }

    const body = await req.json()
    const { phone_number, display_name } = body

    if (!phone_number) {
      return NextResponse.json({ success: false, error: 'phone_number required' }, { status: 400 })
    }

    // Validate E.164 format
    if (!phone_number.match(/^\+[1-9]\d{1,14}$/)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid phone format. Use E.164 (e.g., +12025551234)' 
      }, { status: 400 })
    }

    // Get user's org
    const { data: userRows } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .limit(1)

    const orgId = userRows?.[0]?.organization_id
    if (!orgId) {
      return NextResponse.json({ success: false, error: 'No org found' }, { status: 404 })
    }

    // Check if number already exists
    const { data: existingRows } = await supabaseAdmin
      .from('caller_id_numbers')
      .select('id, is_verified')
      .eq('organization_id', orgId)
      .eq('phone_number', phone_number)
      .limit(1)

    if (existingRows?.[0]?.is_verified) {
      return NextResponse.json({ 
        success: true, 
        message: 'Number already verified',
        verified: true 
      })
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const recordId = existingRows?.[0]?.id || uuidv4()

    // Upsert caller_id_numbers record
    if (existingRows?.[0]) {
      await supabaseAdmin
        .from('caller_id_numbers')
        .update({
          verification_code: verificationCode,
          is_verified: false,
          display_name: display_name || null
        })
        .eq('id', recordId)
    } else {
      await supabaseAdmin
        .from('caller_id_numbers')
        .insert({
          id: recordId,
          organization_id: orgId,
          phone_number,
          display_name: display_name || null,
          verification_code: verificationCode,
          is_verified: false,
          created_by: userId
        })
    }

    // Place verification call via SignalWire
    const swProject = process.env.SIGNALWIRE_PROJECT_ID
    const swToken = process.env.SIGNALWIRE_TOKEN || process.env.SIGNALWIRE_API_TOKEN
    const swSpace = (process.env.SIGNALWIRE_SPACE || '').replace(/\.signalwire\.com$/i, '')
    const swNumber = process.env.SIGNALWIRE_NUMBER

    if (!swProject || !swToken || !swSpace || !swNumber) {
      return NextResponse.json({ 
        success: false, 
        error: 'SignalWire not configured' 
      }, { status: 503 })
    }

    const auth = Buffer.from(`${swProject}:${swToken}`).toString('base64')
    
    // Create TwiML/LaML for verification call
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/caller-id/verification-twiml?code=${verificationCode}`
    
    const params = new URLSearchParams()
    params.append('From', swNumber)
    params.append('To', phone_number)
    params.append('Url', verificationUrl)

    const swEndpoint = `https://${swSpace}.signalwire.com/api/laml/2010-04-01/Accounts/${swProject}/Calls.json`

    const swRes = await fetch(swEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    if (!swRes.ok) {
      const errorText = await swRes.text()
      console.error('Verification call failed:', errorText)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to place verification call' 
      }, { status: 500 })
    }

    const swData = await swRes.json()

    // Update record with call SID
    await supabaseAdmin
      .from('caller_id_numbers')
      .update({ signalwire_verification_sid: swData.sid })
      .eq('id', recordId)

    console.log('Verification call placed:', { phone_number: '[REDACTED]', callSid: swData.sid })

    return NextResponse.json({
      success: true,
      message: `Verification call initiated to ${phone_number}. Listen for the 6-digit code.`,
      record_id: recordId
    })
  } catch (err: any) {
    console.error('Caller ID verify error:', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}

/**
 * PUT /api/caller-id/verify
 * 
 * Confirm verification code entered by user
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Auth required' }, { status: 401 })
    }

    const body = await req.json()
    const { phone_number, code } = body

    if (!phone_number || !code) {
      return NextResponse.json({ 
        success: false, 
        error: 'phone_number and code required' 
      }, { status: 400 })
    }

    // Get user's org
    const { data: userRows } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .limit(1)

    const orgId = userRows?.[0]?.organization_id
    if (!orgId) {
      return NextResponse.json({ success: false, error: 'No org found' }, { status: 404 })
    }

    // Find the record
    const { data: cidRows } = await supabaseAdmin
      .from('caller_id_numbers')
      .select('id, verification_code, is_verified')
      .eq('organization_id', orgId)
      .eq('phone_number', phone_number)
      .limit(1)

    const record = cidRows?.[0]
    if (!record) {
      return NextResponse.json({ 
        success: false, 
        error: 'Number not found. Please initiate verification first.' 
      }, { status: 404 })
    }

    if (record.is_verified) {
      return NextResponse.json({ 
        success: true, 
        message: 'Number already verified',
        verified: true 
      })
    }

    // Check code
    if (record.verification_code !== code) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid verification code' 
      }, { status: 400 })
    }

    // Mark as verified
    await supabaseAdmin
      .from('caller_id_numbers')
      .update({
        is_verified: true,
        verified_at: new Date().toISOString(),
        verification_code: null // Clear code after use
      })
      .eq('id', record.id)

    // Also update voice_configs if this is the first/only number
    const { data: existingDefault } = await supabaseAdmin
      .from('caller_id_numbers')
      .select('id')
      .eq('organization_id', orgId)
      .eq('is_default', true)
      .limit(1)

    if (!existingDefault?.[0]) {
      // Set as default and update voice_configs
      await supabaseAdmin
        .from('caller_id_numbers')
        .update({ is_default: true })
        .eq('id', record.id)

      await supabaseAdmin
        .from('voice_configs')
        .update({
          caller_id_mask: phone_number,
          caller_id_verified: true,
          caller_id_verified_at: new Date().toISOString()
        })
        .eq('organization_id', orgId)
    }

    console.log('Caller ID verified:', { orgId, phone: '[REDACTED]' })

    return NextResponse.json({
      success: true,
      message: 'Phone number verified! It can now be used as your caller ID.',
      verified: true
    })
  } catch (err: any) {
    console.error('Caller ID confirm error:', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}

/**
 * GET /api/caller-id/verify
 * 
 * List verified caller IDs for the organization
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Auth required' }, { status: 401 })
    }

    // Get user's org
    const { data: userRows } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .limit(1)

    const orgId = userRows?.[0]?.organization_id
    if (!orgId) {
      return NextResponse.json({ success: false, error: 'No org found' }, { status: 404 })
    }

    // Get all caller IDs
    const { data: numbers } = await supabaseAdmin
      .from('caller_id_numbers')
      .select('id, phone_number, display_name, is_verified, is_default, verified_at, use_count')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    // Get current mask from voice_configs
    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('caller_id_mask, caller_id_verified')
      .eq('organization_id', orgId)
      .limit(1)

    return NextResponse.json({
      success: true,
      numbers: numbers || [],
      current_mask: vcRows?.[0]?.caller_id_mask || null,
      signalwire_number: process.env.SIGNALWIRE_NUMBER || null
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}
