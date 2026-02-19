/**
 * Wordisbond API - Cloudflare Workers
 *
 * Edge-native API layer using Hono framework
 * Replaces Next.js API routes for Cloudflare Workers deployment
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'

// Route modules
import { healthRoutes } from './routes/health'
import { callsRoutes } from './routes/calls'
import { authRoutes } from './routes/auth'
import { webhooksRoutes } from './routes/webhooks'
import { organizationsRoutes } from './routes/organizations'
import { bookingsRoutes } from './routes/bookings'
import { userRoutes as usersRoutes } from './routes/users'
import { recordingsRoutes } from './routes/recordings'
import { auditRoutes } from './routes/audit'
import { webrtcRoutes } from './routes/webrtc'
import { handleScheduled } from './scheduled'
import { handleQueueBatch, type TranscriptionQueueMessage } from './lib/queue-consumer'
import { handleDlqBatch } from './lib/dlq-consumer'
import { scorecardsRoutes } from './routes/scorecards'
import { rbacRoutes } from './routes/rbac-v2'
import { analyticsRoutes } from './routes/analytics'
import { bondAiRoutes } from './routes/bond-ai'
import { teamsRoutes } from './routes/teams'
import { campaignsRoutes } from './routes/campaigns'
import { voiceRoutes } from './routes/voice'
import { liveTranslationRoutes } from './routes/live-translation'
import { callCapabilitiesRoutes } from './routes/call-capabilities'
import { billingRoutes } from './routes/billing'
import { surveysRoutes } from './routes/surveys'
import { callerIdRoutes } from './routes/caller-id'
import { capabilitiesRoutes } from './routes/capabilities'
import { aiConfigRoutes } from './routes/ai-config'
import { aiTranscribeRoutes } from './routes/ai-transcribe'
import { aiLlmRoutes } from './routes/ai-llm'
import { aiRouterRoutes } from './routes/ai-router'
import { teamRoutes } from './routes/team'
import { usageRoutes } from './routes/usage'
import { shopperRoutes } from './routes/shopper'
import { testRoutes } from './routes/test'
import { reportsRoutes } from './routes/reports'
import { retentionRoutes } from './routes/retention'
import { ttsRoutes } from './routes/tts'
import { audioRoutes } from './routes/audio'
import { reliabilityRoutes } from './routes/reliability'
import { adminRoutes } from './routes/admin'
import { complianceRoutes } from './routes/compliance'
import { internalRoutes } from './routes/internal'
import { collectionsRoutes } from './routes/collections'
import { sentimentRoutes } from './routes/sentiment'
import { onboardingRoutes } from './routes/onboarding'
import { dialerRoutes } from './routes/dialer'
import { ivrRoutes } from './routes/ivr'
import { aiToggleRoutes } from './routes/ai-toggle'
import { adminMetricsRoutes } from './routes/admin-metrics'
import { productivityRoutes } from './routes/productivity'
import { managerRoutes } from './routes/manager'
import { featureFlagRoutes } from './routes/feature-flags'
import { paymentsRoutes } from './routes/payments'
import { dncRoutes } from './routes/dnc'
import { feedbackRoutes } from './routes/feedback'
import { crmRoutes } from './routes/crm'
import { importRoutes } from './routes/import'
import { messagesRoutes } from './routes/messages'
import { unsubscribeRoutes } from './routes/unsubscribe'
import { webhooksOutboundRoutes } from './routes/webhooks-outbound'
import { notificationsRoutes } from './routes/notifications'
import { quickbooksRoutes } from './routes/quickbooks'
import { googleWorkspaceRoutes } from './routes/google-workspace'
import { outlookRoutes } from './routes/outlook'
import { helpdeskRoutes } from './routes/helpdesk'
import { cockpitRoutes } from './routes/cockpit'
import { legalEscalationRoutes } from './routes/legal-escalation'
import { consentRoutes } from './routes/consent'
import { settlementRoutes } from './routes/settlements'
import { validationNoticeRoutes } from './routes/validation-notices'
import {
  buildErrorContext,
  logError,
  formatErrorResponse,
  isAppError,
  generateCorrelationId,
} from './lib/errors'
import { telemetryMiddleware, type TraceContext } from './lib/telemetry'
import { configureAxiom, flushAxiomLogs, logger as axiomLogger } from './lib/logger'

// Types for Cloudflare bindings
export interface Env {
  // Hyperdrive (Neon Postgres)
  HYPERDRIVE: Hyperdrive

  // KV Namespace
  KV: KVNamespace

  // R2 Bucket
  R2: R2Bucket
  R2_PUBLIC_URL?: string // Public custom domain for R2 bucket (e.g., https://audio.wordis-bond.com)

  // Queue for async transcription/analysis processing
  TRANSCRIPTION_QUEUE?: Queue

  // Environment variables
  NODE_ENV: string
  CORS_ORIGIN: string

  // Secrets
  NEON_PG_CONN: string
  AUTH_SECRET: string
  OPENAI_API_KEY: string
  GROQ_API_KEY: string
  GROK_API_KEY: string
  RESEND_API_KEY: string
  RESEND_FROM?: string
  RESEND_REPLY_TO?: string
  DEMO_REQUEST_NOTIFY_EMAIL?: string // Recipient for demo request notifications (CEO-18)
  STRIPE_SECRET_KEY: string
  TELNYX_API_KEY: string
  TELNYX_CONNECTION_ID: string // Credential Connection for WebRTC
  TELNYX_CALL_CONTROL_APP_ID: string // Call Control Application for bridge calls
  TELNYX_NUMBER: string
  TELNYX_MESSAGING_PROFILE_ID?: string // Messaging profile for SMS campaigns
  TELNYX_PUBLIC_KEY: string // Ed25519 public key for webhook signature verification (base64)
  ASSEMBLYAI_API_KEY: string
  ELEVENLABS_API_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  TELNYX_WEBHOOK_SECRET: string
  ASSEMBLYAI_WEBHOOK_SECRET?: string
  NEXT_PUBLIC_APP_URL?: string
  API_BASE_URL?: string
  BASE_URL?: string // Base URL for Workers API (for webhooks and internal fetches)

  // Integration secrets (optional — only needed when integrations are configured)
  CRM_ENCRYPTION_KEY?: string // AES-256 key for OAuth token encryption (32+ chars)
  HUBSPOT_CLIENT_ID?: string
  HUBSPOT_CLIENT_SECRET?: string
  SALESFORCE_CLIENT_ID?: string
  SALESFORCE_CLIENT_SECRET?: string
  QUICKBOOKS_CLIENT_ID?: string
  QUICKBOOKS_CLIENT_SECRET?: string
  QUICKBOOKS_ENVIRONMENT?: string // 'sandbox' | 'production'
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  MICROSOFT_CLIENT_ID?: string
  MICROSOFT_CLIENT_SECRET?: string
  MICROSOFT_REDIRECT_URI?: string
  MICROSOFT_TENANT_ID?: string

  // Observability — Logpush → Axiom (CIO Item 0.1, configured via scripts/setup-logpush.sh)
  AXIOM_API_TOKEN?: string           // Axiom ingestion token (wrangler secret put AXIOM_API_TOKEN)
  AXIOM_DATASET?: string             // Axiom dataset name, default: 'wordisbond-workers'

  // Monitoring — cron dead-man's-switch heartbeat (CIO Items 0.2 / 0.4)
  // Compatible with any heartbeat provider: healthchecks.io (free), BetterStack, Cronitor, etc.
  // Set via: wrangler secret put CRON_HEARTBEAT_URL --config workers/wrangler.toml
  CRON_HEARTBEAT_URL?: string  // POST/HEAD this URL after every successful cron run
}

// Session type — set by authMiddleware via c.set('session', session)
import type { Session } from './lib/auth'

/**
 * Shared Hono app environment type — includes Bindings + Variables.
 * All route files should use `AppEnv` instead of `{ Bindings: Env }` directly
 * so that c.get('session') / c.set('session', ...) are type-safe.
 */
export type AppEnv = { Bindings: Env; Variables: { session: Session; trace?: TraceContext } }

// Create Hono app with typed bindings + session variable
const app = new Hono<AppEnv>()

// Global middleware
// Note: Hono logger() removed — it logged all requests to console including auth headers
app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
    },
  })
)
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      // Allow configured origin, localhost for dev, and Cloudflare Pages preview URLs
      const allowed = [
        c.env.CORS_ORIGIN,
        'https://wordis-bond.com',
        'https://www.wordis-bond.com',
        'https://wordisbond.pages.dev',
        'http://localhost:3000',
      ]

      // L-2: Allow only known preview hostnames — no wildcard subdomain match
      // @see ARCH_DOCS/FORENSIC_DEEP_DIVE_REPORT.md — L-2: Wildcard .pages.dev CORS
      if (origin && /^https:\/\/[a-f0-9]{8}\.wordisbond\.pages\.dev$/.test(origin)) {
        return origin
      }

      return allowed.includes(origin) ? origin : allowed[0]
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Idempotency-Key',
      'X-Sentiment-Score',
      'X-AI-Mode',
      'X-Dialer-Session',
      'X-IVR-Flow-Id',
      'X-CRM-Sync-Id',
      'X-Integration-Provider',
      'X-Export-Job-Id',
      'X-Webhook-Signature',
      'traceparent',
      'tracestate',
    ],
    exposeHeaders: [
      'Idempotent-Replayed',
      'X-Correlation-ID',
      'X-Sentiment-Score',
      'X-AI-Mode',
      'X-Dialer-Session',
      'X-IVR-Flow-Id',
      'X-Session-Token',
      'X-SMS-Status',
      'X-Email-Status',
      'X-CRM-Sync-Id',
      'X-Export-Status',
      'X-Export-Download-Url',
      'X-Webhook-Delivery-Id',
      'traceparent',
    ],
  })
)

// W3C Trace Context middleware — must be BEFORE request timing so every
// log line and correlation entry can include trace_id / span_id
app.use('*', telemetryMiddleware)

// Request timing middleware — attaches start time + correlation ID for error diagnostics
// Must be BEFORE route modules so handlers can access requestStart/correlationId
app.use('*', async (c, next) => {
  c.set('requestStart' as any, Date.now())
  const correlationId = generateCorrelationId()
  c.set('correlationId' as any, correlationId)
  // Expose correlation ID on every response for client-side log correlation
  c.header('X-Correlation-ID', correlationId)
  await next()
})

// Axiom direct-log middleware — configures the logger sink and flushes buffered
// WARN/ERROR entries to Axiom after the response is sent (non-blocking).
// Requires AXIOM_API_TOKEN Workers secret. AXIOM_DATASET defaults to 'wib-main'.
app.use('*', async (c, next) => {
  if (c.env.AXIOM_API_TOKEN) {
    configureAxiom(c.env.AXIOM_API_TOKEN, c.env.AXIOM_DATASET)
  }
  await next()
  // Log every 4xx/5xx response as a structured WARN/ERROR so it reaches Axiom.
  // This captures silent failures (invalid auth, not-found, validation errors)
  // that the route handlers return without calling logger.warn/error directly.
  const status = c.res.status
  if (status >= 400) {
    const level = status >= 500 ? 'error' : 'warn'
    const entry = {
      msg: `HTTP ${status}`,
      status,
      method: c.req.method,
      path: c.req.path,
      correlation_id: (c as any).get?.('correlationId'),
    }
    if (level === 'error') {
      axiomLogger.error(entry.msg, entry)
    } else {
      axiomLogger.warn(entry.msg, entry)
    }
  }
  if (c.env.AXIOM_API_TOKEN) {
    c.executionCtx?.waitUntil(flushAxiomLogs())
  }
})

// Mount route modules
app.route('/health', healthRoutes)
app.route('/api/health', healthRoutes)
app.route('/api/calls', callsRoutes)
app.route('/api/auth', authRoutes)
app.route('/api/organizations', organizationsRoutes)
app.route('/api/bookings', bookingsRoutes)
app.route('/api/users', usersRoutes)
app.route('/api/recordings', recordingsRoutes)
app.route('/api/audit-logs', auditRoutes) // Mount audit routes at /api/audit-logs
app.route('/api/audit', auditRoutes) // Alias: frontend also calls /api/audit
app.route('/api/webrtc', webrtcRoutes) // Mount webrtc routes at /api/webrtc
app.route('/webhooks', webhooksRoutes)
app.route('/api/webhooks', webhooksRoutes) // Also mount at /api/webhooks
app.route('/api/scorecards', scorecardsRoutes)
app.route('/api/rbac', rbacRoutes)
app.route('/api/analytics', analyticsRoutes)
app.route('/api/campaigns', campaignsRoutes)
app.route('/api/voice', voiceRoutes)
app.route('/api/voice/translate', liveTranslationRoutes)
app.route('/api/call-capabilities', callCapabilitiesRoutes)
app.route('/api/billing', billingRoutes)
app.route('/api/surveys', surveysRoutes)
app.route('/api/caller-id', callerIdRoutes)
app.route('/api/capabilities', capabilitiesRoutes)
app.route('/api/ai-config', aiConfigRoutes)
app.route('/api/ai/transcribe', aiTranscribeRoutes)
app.route('/api/ai/llm', aiLlmRoutes)
app.route('/api/ai/router', aiRouterRoutes)
app.route('/api/team', teamRoutes)
app.route('/api/teams', teamsRoutes)
app.route('/api/bond-ai', bondAiRoutes)
app.route('/api/usage', usageRoutes)
app.route('/api/shopper', shopperRoutes)
app.route('/api/test', testRoutes)
app.route('/api/reports', reportsRoutes)
app.route('/api/retention', retentionRoutes)
app.route('/api/tts', ttsRoutes)
app.route('/api/audio', audioRoutes)
app.route('/api/reliability', reliabilityRoutes)
app.route('/api/_admin', adminRoutes)
app.route('/api/compliance', complianceRoutes)
app.route('/api/collections', collectionsRoutes)
app.route('/api/sentiment', sentimentRoutes)
app.route('/api/onboarding', onboardingRoutes)
app.route('/api/dialer', dialerRoutes)
app.route('/api/ivr', ivrRoutes)
app.route('/api/ai-toggle', aiToggleRoutes)
app.route('/api/internal', internalRoutes) // Monitoring and health endpoints
app.route('/api/admin/metrics', adminMetricsRoutes)
app.route('/api/productivity', productivityRoutes)
app.route('/api/manager', managerRoutes)
app.route('/api/feature-flags', featureFlagRoutes)
app.route('/api/payments', paymentsRoutes)
app.route('/api/messages', messagesRoutes)
app.route('/api/messages', unsubscribeRoutes)
app.route('/api/dnc', dncRoutes)
app.route('/api/feedback', feedbackRoutes)
app.route('/api/crm', crmRoutes)
app.route('/api/import', importRoutes)
app.route('/api/webhooks/outbound', webhooksOutboundRoutes)
app.route('/api/notifications', notificationsRoutes)
app.route('/api/quickbooks', quickbooksRoutes)
app.route('/api/google-workspace', googleWorkspaceRoutes)
app.route('/api/outlook', outlookRoutes)
app.route('/api/helpdesk', helpdeskRoutes)
app.route('/api/cockpit', cockpitRoutes) // /api/cockpit/notes, /api/cockpit/callbacks, /api/cockpit/disputes
app.route('/api/legal-escalation', legalEscalationRoutes)
app.route('/api/consent', consentRoutes)
app.route('/api/settlements', settlementRoutes)
app.route('/api/validation-notices', validationNoticeRoutes)

// Root endpoint
app.get('/', (c) => {
  return c.json({
    service: 'wordisbond-api',
    version: '5.3',
    status: 'operational',
    timestamp: new Date().toISOString(),
  })
})

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      path: c.req.path,
      method: c.req.method,
    },
    404
  )
})

// Structured Error Handler — best-practice diagnostics with differential data
app.onError((err, c) => {
  const requestStart = (c as any).get?.('requestStart') || Date.now()
  const correlationId = (c as any).get?.('correlationId') || generateCorrelationId()

  // Build full diagnostic context
  const errorCtx = buildErrorContext(c as any, err, requestStart)
  errorCtx.correlation_id = correlationId

  // Structured log for Workers logs / wrangler tail / log aggregation
  logError(errorCtx)

  // Determine HTTP status
  const status = isAppError(err) ? (err as any).status : 500

  // Format client response (sanitized — no stack traces in production)
  const { body } = formatErrorResponse(errorCtx, status)
  return c.json(body, status)
})

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,

  // Scheduled handler for cron triggers
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(event, env))
  },

  // Queue consumer — routes by queue name so both main and DLQ are handled here
  async queue(batch: MessageBatch<TranscriptionQueueMessage>, env: Env) {
    if (batch.queue === 'wordisbond-transcription-dlq') {
      await handleDlqBatch(batch as MessageBatch<any>, env)
    } else {
      await handleQueueBatch(batch, env)
    }
  },
}
