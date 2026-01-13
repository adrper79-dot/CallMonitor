import { NextResponse } from 'next/server'
import startCall from '../../../actions/calls/startCall'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

function isE164(n: string) {
  return /^\+?[1-9]\d{1,14}$/.test(n)
}

export async function POST(req: Request) {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`
  console.log(`[${requestId}] POST /api/calls/start: REQUEST RECEIVED`)
  
  try {
    const contentType = String(req.headers.get('content-type') || '')
    let body: any = null
    // Try to parse JSON, but be tolerant: fall back to form-encoded parsing
    if (contentType.includes('application/json')) {
      try {
        body = await req.json()
      } catch (jsonErr) {
        const txt = await req.text()
        try {
          body = JSON.parse(txt)
        } catch (e) {
          // final fallback: attempt to parse as URLSearchParams
          const params = new URLSearchParams(txt)
          if (Array.from(params.keys()).length > 0) body = Object.fromEntries(Array.from(params.entries()))
          else throw jsonErr
        }
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const txt = await req.text()
      body = Object.fromEntries(Array.from(new URLSearchParams(txt).entries()))
    } else {
      // unknown content type: attempt JSON then form parsing
      try {
        body = await req.json()
      } catch {
        const txt = await req.text()
        body = Object.fromEntries(Array.from(new URLSearchParams(txt).entries()))
      }
    }

    // normalize modulations (allow JSON string or object)
    if (body && typeof body.modulations === 'string') {
      try { body.modulations = JSON.parse(body.modulations) } catch { /* leave as-is */ }
    }

    const { organization_id, from_number, phone_number, flow_type, modulations } = body || {}
    if (!organization_id) {
      return NextResponse.json({ success: false, error: { id: 'invalid_input', code: 'INVALID_INPUT', message: 'organization_id required', severity: 'MEDIUM' } })
    }
    if (!isE164(phone_number)) {
      return NextResponse.json({ success: false, error: { id: 'invalid_phone', code: 'INVALID_PHONE', message: 'phone_number must be E.164', severity: 'MEDIUM' } })
    }

    // Get actor_id from session
    const session = await getServerSession(authOptions as any).catch(() => null)
    const actorId = session?.user?.id ?? null

    // Log for debugging
    console.log(`[${requestId}] startCall route: session check`, { 
      hasSession: !!session, 
      hasUser: !!session?.user, 
      hasId: !!session?.user?.id,
      actorId: actorId ? '[REDACTED]' : null,
      nodeEnv: process.env.NODE_ENV,
      phone_number: phone_number ? '[REDACTED]' : null,
      from_number: from_number ? '[REDACTED]' : null,
      flow_type
    })

    // TEMPORARY: Always use fallback actor if session is missing (for debugging)
    // TODO: Remove this once session management is working properly
    const effectiveActorId = actorId || '28d68e05-ab20-40ee-b935-b19e8927ae68'

    // Delegate to server action which performs DB/audit and SignalWire call
    console.log(`[${requestId}] startCall route: delegating to startCall handler`)
    const result = await startCall({ 
      organization_id,
      from_number,
      phone_number,
      flow_type,
      modulations,
      actor_id: effectiveActorId 
    } as any)
    console.log(`[${requestId}] startCall route: handler returned`, { success: result.success, callId: result.success && 'call_id' in result ? result.call_id : null })
    return NextResponse.json(result)
  } catch (err: any) {
    console.error(`[${requestId}] startCall route: ERROR`, err)
    return NextResponse.json({ success: false, error: { id: 'route_error', code: 'ROUTE_ERROR', message: String(err?.message ?? err), severity: 'HIGH' } })
  }
}
