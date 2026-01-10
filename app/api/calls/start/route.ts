import { NextResponse } from 'next/server'
import startCall from '../../../actions/calls/startCall'

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

    // Delegate to server action which performs DB/audit and SignalWire call
    const result = await startCall({ organization_id, phone_number, modulations })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ success: false, error: { id: 'route_error', code: 'ROUTE_ERROR', message: String(err?.message ?? err), severity: 'HIGH' } })
  }
}
