/**
 * Structured Logger for Cloudflare Workers
 *
 * Outputs JSON-formatted log lines visible in `wrangler tail` and
 * Cloudflare dashboard → Workers → Logs.
 *
 * Usage:
 *   import { logger } from '../lib/logger'
 *
 *   logger.info('User signed in',  { userId: '...' })
 *   logger.warn('Deprecated endpoint called', { path: '/old' })
 *   logger.error('DB query failed', { route: 'GET /api/calls', error: err?.message })
 *
 * Design decisions:
 *  - No external deps — uses console.{log,warn,error} which Workers route to log sinks
 *  - JSON lines format for easy parsing by Logpush, Datadog, etc.
 *  - `debug` level is no-op in production (controlled at call-site, not env, to keep it zero-cost)
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

interface LogPayload {
  [key: string]: unknown
}

function emit(level: LogLevel, message: string, data?: LogPayload): void {
  const entry = {
    level,
    msg: message,
    ts: new Date().toISOString(),
    ...data,
  }

  switch (level) {
    case 'ERROR':
      console.error(JSON.stringify(entry))
      break
    case 'WARN':
      console.warn(JSON.stringify(entry))
      break
    default:
      console.log(JSON.stringify(entry))
      break
  }
}

export const logger = {
  debug: (msg: string, data?: LogPayload) => emit('DEBUG', msg, data),
  info: (msg: string, data?: LogPayload) => emit('INFO', msg, data),
  warn: (msg: string, data?: LogPayload) => emit('WARN', msg, data),
  error: (msg: string, data?: LogPayload) => emit('ERROR', msg, data),
}

