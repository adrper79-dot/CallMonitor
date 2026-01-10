import { NextResponse } from 'next/server'

function isE164(n: string) {
  return /^\+?[1-9]\d{1,14}$/.test(n)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { organization_id, phone_number, modulations } = body
    if (!organization_id) {
      return NextResponse.json({ success: false, error: { id: 'invalid_input', code: 'INVALID_INPUT', message: 'organization_id required', severity: 'MEDIUM' } })
    }
    if (!isE164(phone_number)) {
      return NextResponse.json({ success: false, error: { id: 'invalid_phone', code: 'INVALID_PHONE', message: 'phone_number must be E.164', severity: 'MEDIUM' } })
    }

    // Minimal local implementation: generate a UUID-like id
    const callId = 'call_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

    // In production this route should delegate to app/actions/calls/startCall
    return NextResponse.json({ success: true, call_id: callId })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: { id: 'route_error', code: 'ROUTE_ERROR', message: String(err?.message ?? err), severity: 'HIGH' } })
  }
}
