/**
 * API module barrel
 *
 * Re-exports all HTTP client utilities, error types, and API response schemas.
 * Use this barrel for cleaner imports across component and hook files.
 *
 * @example
 * ```ts
 * import { apiGet, apiPost, ApiError } from '@/lib/api'
 * import type { SessionResponse } from '@/lib/api'
 * ```
 *
 * Included modules:
 *  - apiClient   : apiGet, apiPost, apiPut, apiPatch, apiDelete, apiFetch,
 *                  apiFetchRaw, apiPostFormData, apiPostNoAuth, apiGetNoAuth,
 *                  ApiError, ApiClientOptions, resolveApiUrl, API_BASE
 *  - errors      : AppError, AppErrorOptions
 *  - schemas/api : sessionSchema, SessionResponse, callsListSchema
 */

export * from '../apiClient'
export * from '../errors'
export * from '../schemas/api'
