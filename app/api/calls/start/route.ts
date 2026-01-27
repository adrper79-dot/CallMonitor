import { NextResponse } from 'next/server'
import startCall from '../../../actions/calls/startCall'
import { parseRequestBody, Errors, getAuthUser } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

function isE164(n: string) {
  return /^\+?[1-9]\d{1,14}$/.test(n)
}

export async function POST(req: Request) {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`
  logger.info(`startCall route: REQUEST RECEIVED`, { requestId })
  
  try {
    const body = await parseRequestBody(req)

    // Normalize modulations
    if (body && typeof body.modulations === 'string') {
      try { body.modulations = JSON.parse(body.modulations) } catch { /* leave as-is */ }
    }

    const { organization_id, from_number, phone_number, flow_type, modulations } = body || {}
    
    // SYSTEM OF RECORD COMPLIANCE (Requirement 1):
    // Reject any client-supplied call_id - IDs must be server-generated only
    if (body?.call_id || body?.callId || body?.id) {
      return Errors.badRequest('Client-supplied call IDs are not permitted. Call IDs are generated server-side only.')
    }
    
    if (!organization_id) {
      return Errors.badRequest('organization_id required')
    }
    if (!isE164(phone_number)) {
      return Errors.badRequest('phone_number must be E.164')
    }

    const user = await getAuthUser()
    const actorId = user?.id ?? null

    logger.debug('startCall route: session check', { 
      requestId,
      hasSession: !!user, 
      actorId: actorId ? '[REDACTED]' : null,
      nodeEnv: process.env.NODE_ENV,
      flow_type
    })

    if (!actorId) {
      logger.warn('startCall route: AUTH REQUIRED - no session', { requestId })
      return Errors.authRequired()
    }

    logger.debug('startCall route: delegating to handler', { requestId })
    const result = await startCall({ 
      organization_id,
      from_number,
      phone_number,
      flow_type,
      modulations,
      actor_id: actorId 
    } as any)
    
    logger.info('startCall route: handler returned', { 
      requestId, 
      success: result.success, 
      callId: result.success && 'call_id' in result ? result.call_id : null 
    })
    
    return NextResponse.json(result)
  } catch (err: any) {
    logger.error('startCall route: ERROR', err, { requestId })
    return Errors.internal(err)
  }
}
