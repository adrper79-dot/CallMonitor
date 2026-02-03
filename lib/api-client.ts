/**
 * Typed API Client for Static UI
 * Fetches from Workers API with Zod validation
 */

import { z } from 'zod'
import { sessionSchema, callsListSchema } from './schemas/api' // Add more

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev'

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface FetchOptions extends RequestInit {
  params?: Record<string, string>
  schema?: z.ZodSchema<any>
}

async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
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

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    })

    const data = await response.json() as any

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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
    getSession: () => apiFetch('/api/auth/session', { schema: sessionSchema }),
    validateKey: (apiKey: string) =>
      apiFetch('/api/auth/validate-key', {
        method: 'POST',
        body: JSON.stringify({ apiKey }),
      }),
  },

  calls: {
    list: () => apiFetch('/api/calls', { schema: callsListSchema }),
    get: (id: string) => apiFetch(`/api/calls/${id}`),
    start: (data: { phoneNumber: string; callerId?: string; systemId?: string }) =>
      apiFetch('/api/calls/start', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    end: (id: string) =>
      apiFetch(`/api/calls/${id}/end`, {
        method: 'POST',
      }),
  },

  // Add typed methods...
}

export default api