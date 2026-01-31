import crypto from 'node:crypto'

/**
 * Webhook Security
 * 
 * Signature validation for SignalWire and AssemblyAI webhooks.
 * Per PRODUCTION_READINESS_TASKS.md
 */

/**
 * Verify SignalWire webhook signature
 * 
 * SignalWire (like Twilio) signs webhooks with HMAC-SHA1 using the auth token.
 * The signature is Base64-encoded and includes the full webhook URL + sorted form params.
 * 
 * For LaML webhooks, SignalWire uses the same signing algorithm as Twilio.
 * 
 * NOTE: Due to complexities with URL reconstruction in serverless environments,
 * we provide a fallback mode that skips validation if env var is set.
 * 
 * Set SIGNALWIRE_SKIP_SIGNATURE_VALIDATION=true in production if validation fails
 * due to URL proxy/rewrite issues, then configure IP allowlist instead.
 */
export function verifySignalWireSignature(
  payload: string,
  signature: string,
  authToken: string,
  url?: string
): boolean {
  // Skip validation if explicitly disabled (use IP allowlist instead)
  if (process.env.SIGNALWIRE_SKIP_SIGNATURE_VALIDATION === 'true') {
    return true
  }

  try {
    // SignalWire/Twilio uses HMAC-SHA1 with Base64 encoding
    // The payload for LaML is: URL + sorted form-urlencoded params

    // If URL provided, use it in the hash (standard Twilio/SignalWire validation)
    let dataToSign = payload
    if (url) {
      // Parse form data and sort alphabetically
      const params = new URLSearchParams(payload)
      const sortedParams = Array.from(params.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => `${k}${v}`)
        .join('')
      dataToSign = url + sortedParams
    }

    const expectedSignature = crypto
      .createHmac('sha1', authToken)
      .update(dataToSign)
      .digest('base64')

    // Use constant-time comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    } catch {
      // If lengths don't match, timingSafeEqual throws
      return signature === expectedSignature
    }
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

  // Security: Never fall back to wildcard '*' in production
  // Only allow explicitly configured origins
  const allowedOrigin = isAllowed && origin ? origin : allowedOrigins[0]

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
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
