/**
 * Centralized API Client
 *
 * All client-side API calls should use this utility to ensure:
 * - Credentials (cookies) are always sent
 * - Authorization header with Bearer token for cross-origin
 * - Consistent error handling
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
}

/**
 * Make a GET request to an API endpoint
 */
export async function apiGet<T = any>(url: string, options: ApiClientOptions = {}): Promise<T> {
  const res = await fetch(resolveApiUrl(url), {
    ...options,
    method: 'GET',
    credentials: 'include', // CRITICAL: Always send cookies
    headers: {
      ...getAuthHeaders(), // Include Bearer token for cross-origin auth
      ...options.headers,
    },
  })

  if (!res.ok) {
    const error: any = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.error?.message || error.message || 'Request failed')
  }

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

  if (!res.ok) {
    const error: any = await res.json().catch(() => ({ message: res.statusText }))
    console.error('[apiPost] Request failed:', {
      url: resolveApiUrl(url),
      status: res.status,
      error,
    })
    throw new ApiError(res.status, error.error?.message || error.message || 'Request failed')
  }

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

  if (!res.ok) {
    const error: any = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.error?.message || error.message || 'Request failed')
  }

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

  if (!res.ok) {
    const error: any = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.error?.message || error.message || 'Request failed')
  }

  return res.json()
}

/**
 * Make a DELETE request to an API endpoint
 */
export async function apiDelete<T = any>(url: string, options: ApiClientOptions = {}): Promise<T> {
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

  if (!res.ok) {
    const error: any = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.error?.message || error.message || 'Request failed')
  }

  return res.json()
}

/**
 * Generic fetch wrapper that always includes credentials
 */
export async function apiFetch(url: string, options: ApiClientOptions = {}): Promise<Response> {
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
  const headers: HeadersInit = {
    ...getAuthHeaders(),
    ...options.headers,
  }

  const res = await fetch(resolveApiUrl(url), {
    ...options,
    credentials: 'include',
    headers,
  })

  if (!res.ok) {
    const errBody: any = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new ApiError(res.status, errBody.error || `HTTP ${res.status}`)
  }

  return res
}

/**
 * POST FormData with auth — browser sets Content-Type with boundary automatically.
 * Use for file uploads (do NOT set Content-Type manually).
 */
export async function apiPostFormData<T = any>(url: string, formData: FormData): Promise<T> {
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

  const data: any = await res.json()
  if (!res.ok) {
    throw new ApiError(res.status, data.error?.message || data.error || `HTTP ${res.status}`)
  }
  return data as T
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
