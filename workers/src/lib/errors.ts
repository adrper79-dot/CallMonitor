/**
 * Structured Error Framework for Cloudflare Workers
 *
 * Best practices:
 * - Every error gets a unique correlation ID for tracing
 * - Differential data: captures request context, environment state, timing
 * - Structured JSON logging for downstream analysis
 * - Service-aware: distinguishes app errors from infrastructure failures
 * - Severity levels: debug, info, warn, error, critical
 */

import type { Context } from 'hono'
import type { Env } from '../index'

// ─── Types ──────────────────────────────────────────────────────────────────

export type ErrorSeverity = 'debug' | 'info' | 'warn' | 'error' | 'critical'
export type ErrorCategory =
  | 'auth' // Authentication/authorization failures
  | 'database' // DB connection, query, constraint errors
  | 'external_api' // Telnyx, OpenAI, Stripe, AssemblyAI, etc.
  | 'validation' // Input validation failures
  | 'business_logic' // Domain logic violations
  | 'infrastructure' // Workers runtime, KV, R2, Hyperdrive
  | 'unknown' // Uncategorized errors

export interface ErrorContext {
  correlation_id: string
  timestamp: string
  severity: ErrorSeverity
  category: ErrorCategory
  service: string
  // Request context
  request: {
    method: string
    path: string
    query?: Record<string, string>
    user_agent?: string
    cf_ray?: string
    ip_country?: string
  }
  // User context (if authenticated)
  user?: {
    user_id: string
    organization_id?: string
    role?: string
  }
  // Error details
  error: {
    name: string
    message: string
    code?: string | number
    stack?: string
  }
  // Differential data — what state was expected vs what actually happened
  differential?: {
    expected?: string
    actual?: string
    context?: Record<string, unknown>
  }
  // Performance data
  timing?: {
    request_start: number
    error_at: number
    duration_ms: number
  }
  // Environment snapshot
  environment: {
    runtime: string
    region?: string
    worker_version?: string
    has_hyperdrive: boolean
    has_kv: boolean
    has_r2: boolean
  }
}

export interface AppError extends Error {
  status: number
  category: ErrorCategory
  severity: ErrorSeverity
  code?: string
  differential?: ErrorContext['differential']
}

// ─── Error Factory ──────────────────────────────────────────────────────────

/**
 * Generate a unique correlation ID for request tracing.
 * Format: wb-{timestamp}-{random} for easy chronological sorting.
 */
export function generateCorrelationId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).substring(2, 8)
  return `wb-${ts}-${rand}`
}

/**
 * Create a structured application error with metadata.
 */
export function createAppError(
  message: string,
  status: number,
  category: ErrorCategory,
  severity: ErrorSeverity = 'error',
  options?: {
    code?: string
    cause?: Error
    differential?: ErrorContext['differential']
  }
): AppError {
  const err = new Error(message) as AppError
  err.name = 'AppError'
  err.status = status
  err.category = category
  err.severity = severity
  err.code = options?.code
  err.differential = options?.differential
  if (options?.cause) {
    err.cause = options.cause
  }
  return err
}

// ─── Pre-built Error Constructors ───────────────────────────────────────────

export const Errors = {
  unauthorized: (detail?: string) =>
    createAppError(detail || 'Authentication required', 401, 'auth', 'warn', {
      code: 'AUTH_REQUIRED',
    }),

  forbidden: (detail?: string, differential?: ErrorContext['differential']) =>
    createAppError(detail || 'Insufficient permissions', 403, 'auth', 'warn', {
      code: 'FORBIDDEN',
      differential,
    }),

  notFound: (resource: string, id?: string) =>
    createAppError(`${resource} not found${id ? `: ${id}` : ''}`, 404, 'business_logic', 'info', {
      code: 'NOT_FOUND',
      differential: { expected: `${resource} to exist`, actual: 'Not found', context: { id } },
    }),

  validation: (message: string, details?: Record<string, unknown>) =>
    createAppError(message, 400, 'validation', 'info', {
      code: 'VALIDATION_ERROR',
      differential: { expected: 'Valid input', actual: message, context: details },
    }),

  database: (message: string, cause?: Error) =>
    createAppError(message, 503, 'database', 'critical', {
      code: 'DATABASE_ERROR',
      cause,
      differential: {
        expected: 'Successful database operation',
        actual: cause?.message || message,
      },
    }),

  externalService: (service: string, message: string, cause?: Error) =>
    createAppError(`${service}: ${message}`, 502, 'external_api', 'error', {
      code: 'EXTERNAL_SERVICE_ERROR',
      cause,
      differential: {
        expected: `${service} to respond successfully`,
        actual: message,
        context: { service },
      },
    }),

  serviceDown: (service: string, cause?: Error) =>
    createAppError(`${service} is unreachable`, 503, 'infrastructure', 'critical', {
      code: 'SERVICE_DOWN',
      cause,
      differential: {
        expected: `${service} to be available`,
        actual: 'Service unreachable or timed out',
        context: { service },
      },
    }),

  rateLimit: (limit: number, window: string) =>
    createAppError('Rate limit exceeded', 429, 'business_logic', 'warn', {
      code: 'RATE_LIMIT',
      differential: { expected: `Under ${limit} requests per ${window}`, actual: 'Limit exceeded' },
    }),
}

// ─── Structured Logger ──────────────────────────────────────────────────────

/**
 * Build a full structured error context for logging.
 * This is the "differential data" the CIO needs for diagnosis.
 */
export function buildErrorContext(
  c: Context<{ Bindings: Env }>,
  err: Error | AppError,
  requestStartTime?: number,
  user?: { user_id: string; organization_id?: string; role?: string }
): ErrorContext {
  const now = Date.now()
  const appErr = isAppError(err) ? err : null
  const url = new URL(c.req.url)

  return {
    correlation_id: generateCorrelationId(),
    timestamp: new Date().toISOString(),
    severity: appErr?.severity || 'error',
    category: appErr?.category || 'unknown',
    service: 'wordisbond-api',
    request: {
      method: c.req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      user_agent: c.req.header('user-agent')?.substring(0, 200),
      cf_ray: c.req.header('cf-ray') || undefined,
      ip_country: c.req.header('cf-ipcountry') || undefined,
    },
    user: user || undefined,
    error: {
      name: err.name,
      message: err.message,
      code: appErr?.code || undefined,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    },
    differential: appErr?.differential || {
      expected: 'Successful operation',
      actual: err.message,
    },
    timing: requestStartTime
      ? { request_start: requestStartTime, error_at: now, duration_ms: now - requestStartTime }
      : undefined,
    environment: {
      runtime: 'cloudflare-workers',
      region: c.req.header('cf-ray')?.split('-').pop() || 'unknown',
      worker_version: '1.0.0',
      has_hyperdrive: !!c.env.HYPERDRIVE,
      has_kv: !!c.env.KV,
      has_r2: !!c.env.R2,
    },
  }
}

/**
 * Type guard for AppError.
 */
export function isAppError(err: Error): err is AppError {
  return err.name === 'AppError' && 'category' in err
}

/**
 * Log a structured error to console (Workers logs / wrangler tail).
 * Uses JSON format for easy parsing by log aggregation tools.
 */
export function logError(ctx: ErrorContext): void {
  const logFn =
    ctx.severity === 'critical' || ctx.severity === 'error'
      ? console.error
      : ctx.severity === 'warn'
        ? console.warn
        : console.log

  // Structured JSON log line — parseable by any log aggregator
  logFn(
    JSON.stringify({
      level: ctx.severity.toUpperCase(),
      correlation_id: ctx.correlation_id,
      category: ctx.category,
      service: ctx.service,
      method: ctx.request.method,
      path: ctx.request.path,
      status: isAppError(ctx.error as any) ? (ctx.error as any).status : 500,
      error: ctx.error.message,
      error_code: ctx.error.code,
      user_id: ctx.user?.user_id,
      org_id: ctx.user?.organization_id,
      duration_ms: ctx.timing?.duration_ms,
      cf_ray: ctx.request.cf_ray,
      region: ctx.environment.region,
      differential: ctx.differential,
    })
  )
}

/**
 * Format error response for the client.
 * Production: minimal info. Non-production: full diagnostic data.
 */
export function formatErrorResponse(
  ctx: ErrorContext,
  status: number
): { body: Record<string, unknown>; status: number } {
  const isProduction = true // Always sanitize — never leak internals

  return {
    status,
    body: {
      error: ctx.error.message,
      code: ctx.error.code || 'INTERNAL_ERROR',
      correlation_id: ctx.correlation_id,
      timestamp: ctx.timestamp,
      path: ctx.request.path,
      // Include differential in non-production for debugging
      ...(isProduction ? {} : { differential: ctx.differential, stack: ctx.error.stack }),
    },
  }
}
