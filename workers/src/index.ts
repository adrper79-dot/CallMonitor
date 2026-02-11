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
import { collectionsRoutes } from './routes/collections'
import { sentimentRoutes } from './routes/sentiment'
import { onboardingRoutes } from './routes/onboarding'
import { dialerRoutes } from './routes/dialer'
import { ivrRoutes } from './routes/ivr'
import { aiToggleRoutes } from './routes/ai-toggle'
import { adminMetricsRoutes } from './routes/admin-metrics'
import {
  buildErrorContext,
  logError,
  formatErrorResponse,
  isAppError,
  generateCorrelationId,
} from './lib/errors'

// Types for Cloudflare bindings
export interface Env {
  // Hyperdrive (Neon Postgres)
  HYPERDRIVE: Hyperdrive

  // KV Namespace
  KV: KVNamespace

  // R2 Bucket
  R2: R2Bucket
  R2_PUBLIC_URL?: string // Public custom domain for R2 bucket (e.g., https://audio.wordis-bond.com)

  // Environment variables
  NODE_ENV: string
  CORS_ORIGIN: string

  // Secrets
  NEON_PG_CONN: string
  AUTH_SECRET: string
  OPENAI_API_KEY: string
  RESEND_API_KEY: string
  RESEND_FROM?: string
  RESEND_REPLY_TO?: string
  STRIPE_SECRET_KEY: string
  TELNYX_API_KEY: string
  TELNYX_CONNECTION_ID: string // Credential Connection for WebRTC
  TELNYX_CALL_CONTROL_APP_ID: string // Call Control Application for bridge calls
  TELNYX_NUMBER: string
  TELNYX_PUBLIC_KEY: string // Ed25519 public key for webhook signature verification (base64)
  ASSEMBLYAI_API_KEY: string
  ELEVENLABS_API_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  TELNYX_WEBHOOK_SECRET: string
  ASSEMBLYAI_WEBHOOK_SECRET?: string
  NEXT_PUBLIC_APP_URL?: string
  API_BASE_URL?: string
}

// Session type — set by authMiddleware via c.set('session', session)
import type { Session } from './lib/auth'

/**
 * Shared Hono app environment type — includes Bindings + Variables.
 * All route files should use `AppEnv` instead of `{ Bindings: Env }` directly
 * so that c.get('session') / c.set('session', ...) are type-safe.
 */
export type AppEnv = { Bindings: Env; Variables: { session: Session } }

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

      // Also allow any *.wordisbond.pages.dev preview URLs
      if (origin && origin.endsWith('.wordisbond.pages.dev')) {
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
    ],
    exposeHeaders: [
      'Idempotent-Replayed',
      'X-Correlation-ID',
      'X-Sentiment-Score',
      'X-AI-Mode',
      'X-Dialer-Session',
      'X-IVR-Flow-Id',
    ],
  })
)

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
app.route('/api/admin/metrics', adminMetricsRoutes)

// Root endpoint
app.get('/', (c) => {
  return c.json({
    service: 'wordisbond-api',
    version: '1.0.0',
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
}
