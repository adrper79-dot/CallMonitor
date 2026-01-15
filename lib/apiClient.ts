/**
 * Centralized API Client
 * 
 * All client-side API calls should use this utility to ensure:
 * - Credentials (cookies) are always sent
 * - Consistent error handling
 * - Proper Content-Type headers
 */

export interface ApiClientOptions extends Omit<RequestInit, 'credentials'> {
  // credentials is always 'include', cannot be overridden
}

/**
 * Make a GET request to an API endpoint
 */
export async function apiGet<T = any>(
  url: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    method: 'GET',
    credentials: 'include', // CRITICAL: Always send cookies
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
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
    ...options.headers,
  }
  
  const res = await fetch(url, {
    ...options,
    method: 'POST',
    credentials: 'include', // CRITICAL: Always send cookies
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
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
    ...options.headers,
  }
  
  const res = await fetch(url, {
    ...options,
    method: 'PUT',
    credentials: 'include', // CRITICAL: Always send cookies
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.error?.message || error.message || 'Request failed')
  }
  
  return res.json()
}

/**
 * Make a DELETE request to an API endpoint
 */
export async function apiDelete<T = any>(
  url: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    method: 'DELETE',
    credentials: 'include', // CRITICAL: Always send cookies
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.error?.message || error.message || 'Request failed')
  }
  
  return res.json()
}

/**
 * Generic fetch wrapper that always includes credentials
 */
export async function apiFetch(
  url: string,
  options: ApiClientOptions = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'include', // CRITICAL: Always send cookies
  })
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
