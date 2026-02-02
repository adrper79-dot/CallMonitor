/**
 * API Client for Static UI
 * 
 * Fetches from the Workers API instead of Next.js API routes
 * Used by all client components after static export migration
 */

// API base URL - set via environment variable or fallback to production
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export interface FetchOptions extends RequestInit {
  params?: Record<string, string>
}

/**
 * Base fetch wrapper with auth and error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
  const { params, ...fetchOptions } = options

  // Build URL with params
  let url = `${API_BASE}${endpoint}`
  if (params) {
    const searchParams = new URLSearchParams(params)
    url += `?${searchParams.toString()}`
  }

  // Default headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include', // Send cookies for session auth
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      }
    }

    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('API fetch error:', error)
    return {
      success: false,
      error: error.message || 'Network error',
    }
  }
}

// ============ API Methods ============

// Health
export const api = {
  health: {
    check: () => apiFetch('/health'),
  },

  // Auth
  auth: {
    getSession: () => apiFetch('/api/auth/session'),
    validateKey: (apiKey: string) =>
      apiFetch('/api/auth/validate-key', {
        method: 'POST',
        body: JSON.stringify({ apiKey }),
      }),
  },

  // Calls
  calls: {
    list: (params?: { status?: string; page?: number; limit?: number }) =>
      apiFetch('/api/calls', {
        params: params as Record<string, string>,
      }),
    
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

  // Organizations
  organizations: {
    get: () => apiFetch('/api/organizations/current'),
    update: (data: any) =>
      apiFetch('/api/organizations/current', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  // Users
  users: {
    me: () => apiFetch('/api/users/me'),
    list: () => apiFetch('/api/users'),
  },

  // Analytics
  analytics: {
    dashboard: (params?: { startDate?: string; endDate?: string }) =>
      apiFetch('/api/analytics/dashboard', { params: params as Record<string, string> }),
    calls: (params?: { startDate?: string; endDate?: string }) =>
      apiFetch('/api/analytics/calls', { params: params as Record<string, string> }),
  },

  // Recordings
  recordings: {
    get: (callId: string) => apiFetch(`/api/recordings/${callId}`),
    getUrl: (callId: string) => apiFetch(`/api/recordings/${callId}/url`),
  },
}

export default api
