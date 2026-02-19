/**
 * Structured Logger for Cloudflare Workers
 *
 * Outputs JSON-formatted log lines visible in `wrangler tail` and
 * Cloudflare dashboard → Workers → Logs.
 *
 * Also ships logs directly to Axiom when AXIOM_API_TOKEN is configured.
 * Call `configureAxiom(token, dataset)` once per request (in middleware),
 * then `flushAxiomLogs()` via ctx.waitUntil() after the response is sent.
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
 *  - Axiom sink is non-blocking: buffered during request, flushed via waitUntil after response
 *  - Axiom dataset: wib-main (configurable via AXIOM_DATASET env var)
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

interface LogPayload {
  [key: string]: unknown
}

// ─── Axiom direct-log sink ────────────────────────────────────────────────────
// Populated each request by configureAxiom(); flushed after response via waitUntil.
// Module-level state is safe here — logs from concurrent requests are all destined
// for the same Axiom dataset, so mixing them in one batch is harmless.
let _axiomToken = ''
let _axiomDataset = 'wib-main'
const _axiomBuffer: object[] = []

/**
 * Configure the Axiom sink for this Worker invocation.
 * Call once per request from Hono middleware (uses c.env.AXIOM_API_TOKEN).
 */
export function configureAxiom(token: string, dataset?: string): void {
  _axiomToken = token
  if (dataset) _axiomDataset = dataset
}

/**
 * Flush buffered log entries to Axiom and clear the buffer.
 * Register with ctx.waitUntil() so the Worker stays alive until the POST completes.
 */
export async function flushAxiomLogs(): Promise<void> {
  if (!_axiomToken || _axiomBuffer.length === 0) return
  // Atomically snapshot + clear so a concurrent flush doesn't double-send
  const batch = _axiomBuffer.splice(0, _axiomBuffer.length)
  try {
    await fetch(`https://api.axiom.co/v1/datasets/${_axiomDataset}/ingest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${_axiomToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batch),
    })
  } catch {
    // Non-critical — console fallback already captured the lines
  }
}
// ─────────────────────────────────────────────────────────────────────────────

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

  // Buffer for Axiom flush — only WARN/ERROR in production to reduce ingestion volume.
  // Change the condition to `true` to ship all levels.
  if (_axiomToken && (level === 'WARN' || level === 'ERROR')) {
    _axiomBuffer.push(entry)
  }
}

export const logger = {
  debug: (msg: string, data?: LogPayload) => emit('DEBUG', msg, data),
  info: (msg: string, data?: LogPayload) => emit('INFO', msg, data),
  warn: (msg: string, data?: LogPayload) => emit('WARN', msg, data),
  error: (msg: string, data?: LogPayload) => emit('ERROR', msg, data),
}

