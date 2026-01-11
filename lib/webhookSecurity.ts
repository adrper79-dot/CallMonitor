import crypto from 'crypto'

/**
 * Webhook Security
 * 
 * Signature validation for SignalWire and AssemblyAI webhooks.
 * Per PRODUCTION_READINESS_TASKS.md
 */

/**
 * Verify SignalWire webhook signature
 * 
 * SignalWire signs webhooks with HMAC-SHA256 using the auth token
 */
export function verifySignalWireSignature(
  payload: string,
  signature: string,
  authToken: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', authToken)
      .update(payload)
      .digest('hex')

    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch (err) {
    return false
  }
}

/**
 * Verify AssemblyAI webhook signature
 * 
 * AssemblyAI signs webhooks with HMAC-SHA256 using the API key
 */
export function verifyAssemblyAISignature(
  payload: string,
  signature: string,
  apiKey: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', apiKey)
      .update(payload)
      .digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch (err) {
    return false
  }
}

/**
 * Middleware to verify webhook signature
 */
export function withWebhookSignature(
  handler: (req: Request) => Promise<Response>,
  options: {
    provider: 'signalwire' | 'assemblyai'
    getSignature: (req: Request) => string | null
    getSecret: () => string | null
  }
) {
  return async (req: Request): Promise<Response> => {
    const signature = options.getSignature(req)
    const secret = options.getSecret()

    if (!signature || !secret) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'WEBHOOK_SIGNATURE_MISSING',
            message: 'Webhook signature or secret missing',
            severity: 'HIGH'
          }
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get raw body for signature verification
    const body = await req.text()
    const isValid = options.provider === 'signalwire'
      ? verifySignalWireSignature(body, signature, secret)
      : verifyAssemblyAISignature(body, signature, secret)

    if (!isValid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'WEBHOOK_SIGNATURE_INVALID',
            message: 'Invalid webhook signature',
            severity: 'HIGH'
          }
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Reconstruct request with body for handler
    const reconstructedReq = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body
    })

    return await handler(reconstructedReq)
  }
}

/**
 * Get CORS headers for API responses
 */
export function getCORSHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  ]

  const isAllowed = origin && allowedOrigins.some(allowed => 
    origin === allowed || origin.endsWith(allowed.replace(/^https?:\/\//, ''))
  )

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
    'Access-Control-Max-Age': '86400'
  }
}

/**
 * CORS middleware
 */
export function withCORS(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    // Handle preflight
    if (req.method === 'OPTIONS') {
      const origin = req.headers.get('origin')
      return new Response(null, {
        status: 204,
        headers: getCORSHeaders(origin)
      })
    }

    const response = await handler(req)
    const origin = req.headers.get('origin')
    const corsHeaders = getCORSHeaders(origin)

    // Add CORS headers to response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  }
}
