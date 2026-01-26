import { NextResponse } from 'next/server'
import startCallHandler from '@/app/actions/calls/startCallHandler'


// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // debug-only endpoint: disabled in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Disabled in production' } }, { status: 403 })
  }

  try {
    const body = await req.json()
    const input = {
      organization_id: body.organization_id || '00000000-0000-0000-0000-000000000000',
      phone_number: body.phone_number,
      from_number: body.from_number,
      flow_type: body.flow_type || 'outbound',
      modulations: body.modulations || { record: false, transcribe: false }
    }

    const result = await startCallHandler(input)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ success: false, error: { code: 'DEBUG_ROUTE_ERROR', message: String(e?.message ?? e) } }, { status: 500 })
  }
}
