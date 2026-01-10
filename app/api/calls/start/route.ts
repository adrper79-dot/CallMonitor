import startCall from '../../../../app/actions/calls/startCall'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const result = await startCall(body)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ success: false, error: { id: 'route_error', code: 'ROUTE_ERROR', message: String(err?.message ?? err), severity: 'HIGH' } })
  }
}
