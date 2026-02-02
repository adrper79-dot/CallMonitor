import { NextResponse } from 'next/server'
import startCall from '../../../actions/calls/startCall'
import { parseRequestBody, Errors, getAuthUser } from '@/lib/api/utils'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const e164Regex = /^\+?[1-9]\d{1,14}$/

// Validation schema
const startCallSchema = z.object({
  organization_id: z.string().uuid({ message: 'organization_id must be a valid UUID' }),
  from_number: z.string().regex(e164Regex, { message: 'from_number must be E.164 format' }).optional(),
  phone_number: z.string().regex(e164Regex, { message: 'phone_number must be E.164 format' }),
  flow_type: z.string().optional(),
  modulations: z.union([z.string(), z.record(z.unknown())]).optional(),
  // Explicitly reject any client-supplied IDs
  call_id: z.never().optional(),
  callId: z.never().optional(),
  id: z.never().optional(),
})

function isE164(n: string) {
  return e164Regex.test(n)
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

    // Validate with Zod
    const parsed = startCallSchema.safeParse(body)
    
    if (!parsed.success) {
      return Errors.badRequest('Invalid request data: ' + parsed.error.message)
    }

    const { organization_id, from_number, phone_number, flow_type, modulations } = parsed.data

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
