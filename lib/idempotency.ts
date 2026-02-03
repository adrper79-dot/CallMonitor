import { query } from '@/lib/pgClient'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'

/**
 * Idempotency Service
 * 
 * Prevents duplicate operations from replay attacks or retries.
 * Per PRODUCTION_READINESS_TASKS.md
 */

interface IdempotencyRecord {
  id: string
  key: string
  request_hash: string
  response: any
  created_at: string
  expires_at: string
}

/**
 * Check if request is idempotent and return cached response if exists
 */
export async function checkIdempotency(
  key: string,
  requestHash: string,
  ttlSeconds: number = 3600 // 1 hour default
): Promise<{ cached: boolean; response?: any }> {
  try {
    // Check existing idempotency record in audit_logs
    const { rows: records } = await query(
      `SELECT id, after FROM audit_logs 
       WHERE resource_type = 'idempotency' 
       AND resource_id = $1 
       AND created_at >= $2 
       LIMIT 1`,
      [key, new Date(Date.now() - ttlSeconds * 1000).toISOString()]
    )

    if (records && records.length > 0) {
      const record = records[0]
      const storedHash = (record.after as any)?.request_hash

      // Verify request hash matches
      if (storedHash === requestHash) {
        return {
          cached: true,
          response: (record.after as any)?.response
        }
      }
    }

    return { cached: false }
  } catch (err) {
    // If idempotency check fails, allow request (fail open)
    logger.warn('idempotency check failed', { error: (err as Error).message })
    return { cached: false }
  }
}

/**
 * Store idempotency record with response
 */
export async function storeIdempotency(
  key: string,
  requestHash: string,
  response: any,
  organizationId?: string,
  ttlSeconds: number = 3600
): Promise<void> {
  try {
    const afterData = {
      request_hash: requestHash,
      response,
      expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString()
    }

    await query(
      `INSERT INTO audit_logs (
        id, organization_id, user_id, system_id, resource_type, resource_id, action, before, after, created_at
      ) VALUES ($1, $2, null, null, 'idempotency', $3, 'create', null, $4, NOW())`,
      [
        uuidv4(),
        organizationId || null,
        key,
        JSON.stringify(afterData)
      ]
    )
  } catch (err) {
    // Best-effort
    logger.warn('storeIdempotency failed', { error: (err as Error).message })
  }
}

/**
 * Generate request hash from request body
 */
export function hashRequest(body: any): string {
  // Simple hash - in production, use crypto.createHash
  const str = JSON.stringify(body)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Idempotency middleware for API routes
 */
export function withIdempotency(
  handler: (req: Request) => Promise<Response>,
  options?: {
    getKey?: (req: Request) => string | Promise<string>
    ttlSeconds?: number
  }
) {
  return async (req: Request): Promise<Response> => {
    // Get idempotency key from header or generate from request
    const headerKey = req.headers.get('Idempotency-Key')
    let idempotencyKey: string | null = headerKey

    if (!idempotencyKey && options?.getKey) {
      const keyResult = options.getKey(req)
      idempotencyKey = keyResult instanceof Promise ? await keyResult : keyResult
    }

    if (!idempotencyKey) {
      // No idempotency key, proceed normally
      return await handler(req)
    }

    // Get request body for hashing
    let requestBody: any = null
    try {
      const clonedReq = req.clone()
      requestBody = await clonedReq.json().catch(() => ({}))
    } catch {
      // Body not available or not JSON
    }

    const requestHash = hashRequest({ key: idempotencyKey, body: requestBody })

    // Check if this request was already processed
    const cached = await checkIdempotency(idempotencyKey, requestHash, options?.ttlSeconds)
    if (cached.cached && cached.response) {
      return new Response(
        JSON.stringify(cached.response),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey,
            'X-Idempotency-Cached': 'true'
          }
        }
      )
    }

    // Process request
    const response = await handler(req)

    // Store response for future idempotency checks
    if (response.ok) {
      const responseBody = await response.clone().json().catch(() => ({}))
      const orgId = new URL(req.url).searchParams.get('orgId')
      await storeIdempotency(
        idempotencyKey,
        requestHash,
        responseBody,
        orgId || undefined,
        options?.ttlSeconds
      )
    }

    // Add idempotency headers
    const headers = new Headers(response.headers)
    headers.set('X-Idempotency-Key', idempotencyKey)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    })
  }
}
