/**
 * workers/src/lib/telemetry.ts
 *
 * W3C Trace Context (traceparent) propagation layer for Cloudflare Workers.
 *
 * Implements the W3C Trace Context Level 1 spec:
 * https://www.w3.org/TR/trace-context/
 *
 * Features:
 *   - Parse incoming `traceparent` request header (or generate a new root trace)
 *   - Create a new child span for each inbound request
 *   - Expose `getTrace(c)` helper for handlers to read trace context
 *   - Provide `buildTraceparent(ctx)` for outbound fetch propagation
 *   - Integrate with the structured logger so every log line includes trace_id/span_id
 *
 * Usage in handlers:
 *   const trace = getTrace(c)
 *   // trace.traceId, trace.spanId, trace.parentSpanId, trace.sampled
 *
 * Usage for outbound fetch:
 *   const trace = getTrace(c)
 *   const res = await fetch(url, {
 *     headers: { traceparent: buildTraceparent(trace) }
 *   })
 */

import type { Context, Next } from 'hono'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TraceContext {
  /** W3C traceparent version — always '00' */
  version: string
  /** 128-bit trace ID (32 hex chars), shared across the entire distributed trace */
  traceId: string
  /** 64-bit span ID for THIS request (16 hex chars) */
  spanId: string
  /** Parent span ID from the incoming traceparent header (undefined for root spans) */
  parentSpanId?: string
  /** Whether this trace is sampled (trace-flags bit 0) */
  sampled: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRACEPARENT_VERSION = '00'
const TRACEPARENT_REGEX = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random 128-bit hex string (32 chars) for trace IDs.
 * Uses Web Crypto UUID stripped of dashes.
 */
function randomTraceId(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

/**
 * Generate a cryptographically random 64-bit hex string (16 chars) for span IDs.
 * Takes the first 16 chars of a stripped UUID.
 */
function randomSpanId(): string {
  return crypto.randomUUID().replace(/-/g, '').substring(0, 16)
}

/**
 * Parse a W3C `traceparent` header value.
 * Returns `null` if the header is absent or malformed.
 */
export function parseTraceparent(header: string | null | undefined): Pick<TraceContext, 'traceId' | 'spanId' | 'sampled'> | null {
  if (!header) return null
  const match = header.trim().match(TRACEPARENT_REGEX)
  if (!match) return null

  const [, version, traceId, spanId, flagsHex] = match

  // Reject all-zeros (invalid per spec)
  if (traceId === '0'.repeat(32) || spanId === '0'.repeat(16)) return null
  // Reject unknown future versions with additional fields we can't handle
  if (version !== TRACEPARENT_VERSION) return null

  const flags = parseInt(flagsHex, 16)
  return {
    traceId,
    spanId, // this becomes our parentSpanId
    sampled: (flags & 0x01) === 1,
  }
}

/**
 * Build a W3C `traceparent` header value from a TraceContext.
 * Use this when propagating trace context to downstream services.
 */
export function buildTraceparent(ctx: TraceContext): string {
  const flags = ctx.sampled ? '01' : '00'
  return `${TRACEPARENT_VERSION}-${ctx.traceId}-${ctx.spanId}-${flags}`
}

/**
 * Create a new TraceContext, optionally linking to an incoming parent.
 * Always generates a new spanId for the current request.
 */
export function createTraceContext(parent?: ReturnType<typeof parseTraceparent>): TraceContext {
  if (parent) {
    return {
      version: TRACEPARENT_VERSION,
      traceId: parent.traceId,
      spanId: randomSpanId(),
      parentSpanId: parent.spanId,
      sampled: parent.sampled,
    }
  }
  return {
    version: TRACEPARENT_VERSION,
    traceId: randomTraceId(),
    spanId: randomSpanId(),
    parentSpanId: undefined,
    sampled: true, // sample all root spans by default
  }
}

// ─── Context Key & Accessor ──────────────────────────────────────────────────

/** Internal Hono context key for TraceContext storage */
const TRACE_KEY = 'trace'

/**
 * Retrieve the TraceContext for the current request.
 * Must be called after `telemetryMiddleware` has run.
 */
export function getTrace(c: Context): TraceContext {
  const trace = (c as any).get(TRACE_KEY)
  if (!trace) {
    // Fallback: generate an ad-hoc context if middleware wasn't applied
    return createTraceContext()
  }
  return trace as TraceContext
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Hono middleware that wires W3C Trace Context into each request.
 *
 * Per request:
 *   1. Parse `traceparent` from inbound headers (or generate a new root trace)
 *   2. Create a child span (new spanId, same traceId as parent)
 *   3. Store TraceContext in `c.set('trace', ...)`
 *   4. Forward `traceparent` on the response for client-side correlation
 *
 * Mount BEFORE route handlers, AFTER secureHeaders/cors:
 *   app.use('*', telemetryMiddleware)
 */
export async function telemetryMiddleware(c: Context, next: Next): Promise<Response | void> {
  const incomingHeader = c.req.header('traceparent')
  const parent = parseTraceparent(incomingHeader)
  const trace = createTraceContext(parent ?? undefined)

  // Store in Hono context so handlers can retrieve it
  ;(c as any).set(TRACE_KEY, trace)

  // Propagate trace context on the response so clients can correlate
  c.header('traceparent', buildTraceparent(trace))

  await next()
}

// ─── Log Enrichment ──────────────────────────────────────────────────────────

/**
 * Returns structured log fields for trace correlation.
 * Merge into any log payload to enable trace-based log querying.
 *
 * @example
 *   const trace = getTrace(c)
 *   console.log(JSON.stringify({ ...traceFields(trace), event: 'call.started', call_id }))
 */
export function traceFields(trace: TraceContext): {
  trace_id: string
  span_id: string
  parent_span_id: string | undefined
  sampled: boolean
} {
  return {
    trace_id: trace.traceId,
    span_id: trace.spanId,
    parent_span_id: trace.parentSpanId,
    sampled: trace.sampled,
  }
}
