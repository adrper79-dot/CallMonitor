/**
 * Typed API Client for Static UI
 * Fetches from Workers API with Zod validation
 */

import { z } from 'zod'
import { sessionSchema, callsListSchema } from './schemas/api' // Add more

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev'

const SESSION_KEY = 'wb-session-token'

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(SESSION_KEY)
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface FetchOptions extends RequestInit {
  params?: Record<string, string>
  schema?: z.ZodSchema<any>
}

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<ApiResponse<T>> {
  const { params, schema, ...fetchOptions } = options

  let url = `${API_BASE}${endpoint}`
  if (params) {
    const searchParams = new URLSearchParams(params)
    url += `?${searchParams}`
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  }

  // Add Authorization header if token exists
  const token = getStoredToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    })

    const data = (await response.json()) as any

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      }
    }

    if (schema) {
      const parsed = schema.safeParse(data)
      if (!parsed.success) {
        console.error('Schema validation failed:', parsed.error.issues)
        return {
          success: false,
          error: 'Invalid response data',
        }
      }
      return {
        success: true,
        data: parsed.data as T,
      }
    }

    return {
      success: true,
      data: data as T,
    }
  } catch (error: any) {
    console.error('API fetch error:', error)
    return {
      success: false,
      error: error.message || 'Network error',
    }
  }
}

export const api = {
  health: {
    check: () => apiFetch('/health'),
  },

  auth: {
    getSession: () => apiFetch(`${API_BASE}/api/auth/session`, { schema: sessionSchema }),
    validateKey: (apiKey: string) =>
      apiFetch(`${API_BASE}/api/auth/validate-key`, {
        method: 'POST',
        body: JSON.stringify({ apiKey }),
      }),
  },

  calls: {
    list: () => apiFetch(`${API_BASE}/api/calls`, { schema: callsListSchema }),
    get: (id: string) => apiFetch(`${API_BASE}/api/calls/${id}`),
    start: (data: { phoneNumber: string; callerId?: string; systemId?: string }) =>
      apiFetch(`${API_BASE}/api/calls/start`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    end: (id: string) =>
      apiFetch(`${API_BASE}/api/calls/${id}/end`, {
        method: 'POST',
      }),
  },

  organizations: {
    create: (data: { name: string }) =>
      apiFetch(`${API_BASE}/api/organizations`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getCurrent: () => apiFetch(`${API_BASE}/api/organizations/current`),
    update: (id: string, data: { name?: string; plan?: string }) =>
      apiFetch(`${API_BASE}/api/organizations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  // Add typed methods...
}

// Convenience functions for common operations
export async function apiGet<T = any>(endpoint: string) {
  const response = await apiFetch<T>(endpoint, { method: 'GET' })
  if (!response.success) {
    throw new Error(response.error || 'Request failed')
  }
  return response.data
}

export async function apiPost<T = any>(endpoint: string, data: any) {
  const response = await apiFetch<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!response.success) {
    throw new Error(response.error || 'Request failed')
  }
  return response.data
}

export async function apiPut<T = any>(endpoint: string, data: any) {
  const response = await apiFetch<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (!response.success) {
    throw new Error(response.error || 'Request failed')
  }
  return response.data
}

export async function apiDelete<T = any>(endpoint: string) {
  const response = await apiFetch<T>(endpoint, { method: 'DELETE' })
  if (!response.success) {
    throw new Error(response.error || 'Request failed')
  }
  return response.data
}

/**
 * Raw fetch with auth — returns the Response object directly.
 * Use for blob downloads, streaming, or non-JSON responses.
 */
export async function apiFetchRaw(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = `${API_BASE}${endpoint}`
  const headers: HeadersInit = { ...options.headers }
  const token = getStoredToken()
  if (token) {
    ;(headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(url, { ...options, headers, credentials: 'include' })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(errBody.error || `HTTP ${res.status}`)
  }
  return res
}

/**
 * POST FormData with auth — browser sets Content-Type with boundary automatically.
 * Use for file uploads.
 */
export async function apiPostFormData<T = any>(endpoint: string, formData: FormData): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  const headers: Record<string, string> = {}
  const token = getStoredToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  // Do NOT set Content-Type — browser adds multipart boundary automatically
  const res = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return data as T
}

/**
 * Unauthenticated POST — for pre-auth flows (forgot-password, reset-password, CSRF).
 * No Bearer token is attached.
 */
export async function apiPostNoAuth<T = any>(endpoint: string, body?: any): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return data as T
}

/**
 * Unauthenticated GET — for pre-auth flows (health checks, CSRF).
 */
export async function apiGetNoAuth<T = any>(endpoint: string): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return data as T
}

export default api
