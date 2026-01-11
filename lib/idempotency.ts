import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'

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
    // Check if idempotency table exists (create if needed)
    // For now, we'll use a simple approach with a dedicated table or use existing audit_logs
    
    // Try to find existing idempotency record
    const { data: records, error } = await supabaseAdmin
      .from('audit_logs')
      .select('id, after')
      .eq('resource_type', 'idempotency')
      .eq('resource_id', key)
      .gte('created_at', new Date(Date.now() - ttlSeconds * 1000).toISOString())
      .limit(1)

    if (!error && records && records.length > 0) {
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
    // eslint-disable-next-line no-console
    console.warn('idempotency check failed', err)
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
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        id: uuidv4(),
        organization_id: organizationId || null,
        user_id: null,
        system_id: null,
        resource_type: 'idempotency',
        resource_id: key,
        action: 'create',
        before: null,
        after: {
          request_hash: requestHash,
          response,
          expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString()
        },
        created_at: new Date().toISOString()
      })
  } catch (err) {
    // Best-effort
    // eslint-disable-next-line no-console
    console.warn('storeIdempotency failed', err)
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
    getKey?: (req: Request) => string
    ttlSeconds?: number
  }
) {
  return async (req: Request): Promise<Response> => {
    // Get idempotency key from header or generate from request
    const idempotencyKey = req.headers.get('Idempotency-Key') || 
                          options?.getKey?.(req) ||
                          null

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
