// Centralized API response types
export interface ApiError {
  id?: string
  code: string
  message: string
  user_message?: string
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  retriable?: boolean
  details?: Record<string, any>
}

export type ApiResponseSuccess<T = any> = { success: true } & T
export type ApiResponseError = { success: false; error: ApiError }
export type ApiResponse<T = any> = ApiResponseSuccess<T> | ApiResponseError

// Helper type guards
export function isApiError(response: ApiResponse): response is ApiResponseError {
  return !response.success
}

export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiResponseSuccess<T> {
  return response.success === true
}
