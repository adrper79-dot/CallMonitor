/**
 * Centralized API Client
 *
 * All client-side API calls should use this utility to ensure:
 * - Credentials (cookies) are always sent
 * - Authorization header with Bearer token for cross-origin
 * - Consistent error handling with proper message extraction
 * - Automatic 401 recovery (clear token + redirect to login)
 * - Token presence guard (fail fast if no token stored)
 * - Proper Content-Type headers
 * - Correct API base URL for deployed environments
 */

// Workers API URL - frontend calls this, not relative /api/ paths
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev'

// Session storage key (must match AuthProvider)
const SESSION_KEY = 'wb-session-token'

/**
 * Get stored session token from localStorage
 */
function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(SESSION_KEY)
}

/**
 * Get auth headers with Bearer token if available
 */
function getAuthHeaders(): HeadersInit {
  const token = getStoredToken()
  if (token) {
    return { Authorization: `Bearer ${token}` }
  }
  return {}
}

/**
 * Resolve URL to use API_BASE for /api/* paths
 */
function resolveApiUrl(url: string): string {
  // If URL starts with /api/, prepend the API base
  if (url.startsWith('/api/')) {
    return `${API_BASE}${url}`
  }
  // If URL is already absolute, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  // For other relative paths, prepend API_BASE
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`
}

export interface ApiClientOptions extends Omit<RequestInit, 'credentials'> {
  // credentials is always 'include', cannot be overridden
  /** Skip the token-existence check (for endpoints that work without auth) */
  skipAuthCheck?: boolean
}

// ─── Centralized error handling ─────────────────────────────────────────────

/**
 * Extract a human-readable error message from any Workers API error response.
 * Handles ALL response formats used across the codebase:
 *   { error: 'string' }               — most routes
 *   { error: { message: 'string' } }  — some validation endpoints
 *   { message: 'string' }             — generic
 *   HTML / non-JSON                   — Cloudflare edge errors
 */
function extractErrorMessage(body: any, statusText: string): string {
  if (!body) return statusText || 'Request failed'

  // { error: { message: '...' } }
  if (body.error && typeof body.error === 'object' && body.error.message) {
    return body.error.message
  }
  // { error: '...' }  — the standard format from all Workers routes
  if (body.error && typeof body.error === 'string') {
    return body.error
  }
  // { message: '...' }
  if (body.message && typeof body.message === 'string') {
    return body.message
  }

  return statusText || 'Request failed'
}

/**
 * Handle non-2xx responses uniformly across all API methods.
 *
 * - On 401: clears the stored token + dispatches 'auth-change' so AuthProvider
 *   transitions to 'unauthenticated' and UI redirects to /signin.
 * - On any error: extracts the best available message from the response body.
 */
async function handleErrorResponse(res: Response): Promise<never> {
  const body: any = await res.json().catch(() => null)
  const message = extractErrorMessage(body, res.statusText)

  // ── 401 auto-recovery ─────────────────────────
  // Session expired or token invalid — clear local state so the UI reacts
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(`${SESSION_KEY}-expires`)
      window.dispatchEvent(new Event('auth-change'))
    }
  }

  throw new ApiError(res.status, message)
}

/**
 * Guard: fail fast if no auth token is stored.
 * Prevents pointless network round-trips that will always return 401.
 * Skipped for explicitly unauthenticated calls (skipAuthCheck: true).
 */
function requireToken(options: ApiClientOptions): void {
  if (options.skipAuthCheck) return
  const token = getStoredToken()
  if (!token) {
    throw new ApiError(401, 'Not authenticated')
  }
}

/**
 * Make a GET request to an API endpoint
 */
export async function apiGet<T = any>(url: string, options: ApiClientOptions = {}): Promise<T> {
  requireToken(options)

  const res = await fetch(resolveApiUrl(url), {
    ...options,
    method: 'GET',
    credentials: 'include', // CRITICAL: Always send cookies
    headers: {
      ...getAuthHeaders(), // Include Bearer token for cross-origin auth
      ...options.headers,
    },
  })

  if (!res.ok) return handleErrorResponse(res)

  return res.json()
}

/**
 * Make a POST request to an API endpoint
 */
export async function apiPost<T = any>(
  url: string,
  body?: any,
  options: ApiClientOptions = {}
): Promise<T> {
  requireToken(options)

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(), // Include Bearer token for cross-origin auth
    ...options.headers,
  }

  const res = await fetch(resolveApiUrl(url), {
    ...options,
    method: 'POST',
    credentials: 'include', // CRITICAL: Always send cookies
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) return handleErrorResponse(res)

  return res.json()
}

/**
 * Make a PATCH request to an API endpoint
 */
export async function apiPatch<T = any>(
  url: string,
  body?: any,
  options: ApiClientOptions = {}
): Promise<T> {
  requireToken(options)

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...options.headers,
  }

  const res = await fetch(resolveApiUrl(url), {
    ...options,
    method: 'PATCH',
    credentials: 'include', // CRITICAL: Always send cookies
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) return handleErrorResponse(res)

  return res.json()
}

/**
 * Make a PUT request to an API endpoint
 */
export async function apiPut<T = any>(
  url: string,
  body?: any,
  options: ApiClientOptions = {}
): Promise<T> {
  requireToken(options)

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...options.headers,
  }

  const res = await fetch(resolveApiUrl(url), {
    ...options,
    method: 'PUT',
    credentials: 'include', // CRITICAL: Always send cookies
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) return handleErrorResponse(res)

  return res.json()
}

/**
 * Make a DELETE request to an API endpoint
 */
export async function apiDelete<T = any>(url: string, options: ApiClientOptions = {}): Promise<T> {
  requireToken(options)

  const headers: HeadersInit = {
    ...getAuthHeaders(),
    ...options.headers,
  }

  const res = await fetch(resolveApiUrl(url), {
    ...options,
    method: 'DELETE',
    credentials: 'include', // CRITICAL: Always send cookies
    headers,
  })

  if (!res.ok) return handleErrorResponse(res)

  return res.json()
}

/**
 * Generic fetch wrapper that always includes credentials.
 * Returns raw Response — callers handle their own error checking.
 */
export async function apiFetch(url: string, options: ApiClientOptions = {}): Promise<Response> {
  requireToken(options)

  const headers: HeadersInit = {
    ...getAuthHeaders(),
    ...options.headers,
  }

  return fetch(resolveApiUrl(url), {
    ...options,
    credentials: 'include', // CRITICAL: Always send cookies
    headers,
  })
}

// Export the resolver for direct use
export { resolveApiUrl, API_BASE }

/**
 * Raw fetch with auth — returns the Response object directly with error checking.
 * Use for blob downloads, streaming, or non-JSON responses.
 */
export async function apiFetchRaw(url: string, options: ApiClientOptions = {}): Promise<Response> {
  requireToken(options)

  const headers: HeadersInit = {
    ...getAuthHeaders(),
    ...options.headers,
  }

  const res = await fetch(resolveApiUrl(url), {
    ...options,
    credentials: 'include',
    headers,
  })

  if (!res.ok) return handleErrorResponse(res)

  return res
}

/**
 * POST FormData with auth — browser sets Content-Type with boundary automatically.
 * Use for file uploads (do NOT set Content-Type manually).
 */
export async function apiPostFormData<T = any>(url: string, formData: FormData): Promise<T> {
  requireToken({})

  const headers: Record<string, string> = {}
  const token = getStoredToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(resolveApiUrl(url), {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  })

  if (!res.ok) return handleErrorResponse(res)

  return res.json()
}

/**
 * Unauthenticated POST — for pre-auth flows (forgot-password, reset-password, CSRF).
 * No Bearer token is attached.
 */
export async function apiPostNoAuth<T = any>(url: string, body?: any): Promise<T> {
  const res = await fetch(resolveApiUrl(url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })

  const data: any = await res.json()
  if (!res.ok) {
    throw new ApiError(res.status, data.error?.message || data.error || `HTTP ${res.status}`)
  }
  // H-1: Read session token from header (not JSON body) for login/signup flows
  const sessionToken = res.headers.get('X-Session-Token')
  if (sessionToken) {
    data.session_token = sessionToken
  }
  return data as T
}

/**
 * Unauthenticated GET — for pre-auth flows (health checks, CSRF).
 * No Bearer token is attached.
 */
export async function apiGetNoAuth<T = any>(url: string): Promise<T> {
  const res = await fetch(resolveApiUrl(url), {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })

  const data: any = await res.json()
  if (!res.ok) {
    throw new ApiError(res.status, data.error?.message || data.error || `HTTP ${res.status}`)
  }
  return data as T
}

/**
 * Custom API error class
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
