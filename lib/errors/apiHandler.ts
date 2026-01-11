import { NextResponse } from 'next/server'
import { AppError } from '@/types/app-error'
import { trackAppError, trackError } from './errorTracker'
import { recordErrorKPI, recordSuccessKPI } from './kpi'

/**
 * API Handler Wrapper
 * 
 * Wraps API route handlers with error handling, tracking, and KPI collection.
 * Per ERROR_HANDLING_PLAN.txt
 */

export interface ApiHandlerContext {
  endpoint?: string
  method?: string
  userId?: string | null
  organizationId?: string | null
  requestInfo?: Record<string, any>
}

/**
 * Wrap API route handler with error handling
 */
export function withErrorHandling<T extends any[]>(
  handler: (...args: T) => Promise<Response>,
  context?: ApiHandlerContext
) {
  return async (...args: T): Promise<Response> => {
    const startTime = Date.now()
    let response: Response

    try {
      // Extract endpoint and method from request if available
      const req = args[0] as Request
      const endpoint = context?.endpoint || new URL(req.url).pathname
      const method = context?.method || req.method

      // Call handler
      response = await handler(...args)

      // Record success KPI
      recordSuccessKPI(endpoint, method)

      // Add performance header
      const duration = Date.now() - startTime
      response.headers.set('X-Response-Time', `${duration}ms`)

      return response
    } catch (err: any) {
      // Track error
      const tracked = trackError(err, {
        endpoint: context?.endpoint,
        method: context?.method,
        userId: context?.userId,
        organizationId: context?.organizationId,
        requestInfo: context?.requestInfo
      })

      // Record error KPI
      recordErrorKPI(tracked)

      // Create AppError if not already
      const appError = err instanceof AppError ? err : new AppError({
        code: tracked.code,
        message: tracked.internalMessage,
        user_message: tracked.userMessage,
        severity: tracked.severity as any,
        details: tracked.details
      })

      // Return structured error response
      const errorResponse = {
        success: false,
        error: {
          id: tracked.id,
          code: tracked.code,
          message: tracked.userMessage,
          severity: tracked.severity.toLowerCase()
        }
      }

      // Include internal details only in development
      if (process.env.NODE_ENV === 'development') {
        (errorResponse.error as any).internal = {
          message: tracked.internalMessage,
          stack: tracked.stackTrace,
          details: tracked.details
        }
      }

      const httpStatus = appError.httpStatus || 500

      return NextResponse.json(errorResponse, { status: httpStatus })
    }
  }
}
